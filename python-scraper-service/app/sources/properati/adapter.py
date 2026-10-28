from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

from app.contracts.search import PropertyListing, SearchFilters
from app.sources.base import SourceAdapter
from app.utils.text import (
    capitalize_words as shared_capitalize_words,
    clean_text as shared_clean_text,
    normalize_phone as shared_normalize_phone,
    normalize_search_text as shared_normalize_search_text,
    slugify as shared_slugify,
    to_plain_text as shared_to_plain_text,
)


class ProperatiSourceAdapter(SourceAdapter):
    source_name = "properati"
    base_url = "https://www.properati.com.ar"

    operation_terms = {
        "buy": "venta",
        "rent": "alquiler",
    }

    property_type_terms = {
        "apartment": "departamento",
        "house": "casa",
        "ph": "ph",
        "office": "oficina",
        "land": "terreno",
        "garage": "cochera",
        "local": "local",
    }

    feature_terms = {
        "balcony": ["balcon"],
        "terrace": ["terraza", "solarium"],
        "patio": ["patio"],
        "garage": ["garage", "cochera"],
        "pool": ["pileta", "piscina"],
        "barbecue": ["parrilla", "barbecue"],
        "gym": ["gimnasio", "gym"],
        "professional_use": ["apto profesional"],
        "mortgage_eligible": ["apto credito", "credito"],
        "furnished": ["amoblado", "amueblado"],
        "pets_allowed": ["mascotas", "pets allowed"],
    }

    known_neighborhoods = [
        "palermo hollywood",
        "palermo chico",
        "palermo soho",
        "palermo viejo",
        "las canitas",
        "villa crespo",
        "villa urquiza",
        "villa devoto",
        "puerto madero",
        "san telmo",
        "belgrano",
        "caballito",
        "recoleta",
        "almagro",
        "colegiales",
        "nunez",
        "palermo",
    ]

    def can_handle(self, url: str) -> bool:
        try:
            hostname = urlparse(url).hostname or ""
            return hostname == "www.properati.com.ar" or hostname.endswith(".properati.com.ar")
        except ValueError:
            return False

    def is_detail_url(self, url: str) -> bool:
        try:
            path = (urlparse(url).path or "").lower().rstrip("/")
            return path.startswith("/detalle/") and len(path.split("/")) >= 3
        except ValueError:
            return False

    def build_search_urls(self, filters: SearchFilters) -> list[str]:
        location = self.slugify(filters.locations[0]) if filters.locations else "capital-federal"
        property_type = self.property_type_terms.get((filters.propertyType or "apartment").lower())
        operation = self.operation_terms.get((filters.operation or "buy").lower(), "venta")

        base_segments = [self.base_url, "s", location]
        if property_type:
            base_segments.append(property_type)
        base_segments.append(operation)
        base_url = "/".join(segment.strip("/") for segment in base_segments)

        urls = [base_url]

        if filters.priceMin or filters.priceMax:
            min_price = filters.priceMin or 0
            max_price = filters.priceMax or ""
            urls.append(f"{base_url}/precio%3A{min_price}-{max_price}")

        return list(dict.fromkeys(urls))

    def extract_listing_urls(self, html: str) -> list[str]:
        normalized_html = html.replace("\\/", "/")
        urls: list[str] = []

        hrefs = re.findall(r'href=["\']([^"\']+)["\']', normalized_html, flags=re.IGNORECASE)
        for href in hrefs:
            absolute = urljoin(self.base_url, href)
            if self.can_handle(absolute) and self.is_detail_url(absolute):
                urls.append(self.normalize_detail_url(absolute))

        direct_matches = re.findall(
            r"https?://(?:www\.)?properati\.com\.ar/detalle/[^\s\"'<>]+",
            normalized_html,
            flags=re.IGNORECASE,
        )
        for match in direct_matches:
            if self.is_detail_url(match):
                urls.append(self.normalize_detail_url(match))

        relative_matches = re.findall(r"/detalle/[^\s\"'<>]+", normalized_html, flags=re.IGNORECASE)
        for match in relative_matches:
            absolute = urljoin(self.base_url, match)
            if self.is_detail_url(absolute):
                urls.append(self.normalize_detail_url(absolute))

        return list(dict.fromkeys(urls))

    def extract(self, url: str, html: str) -> PropertyListing | None:
        metadata = self.extract_metadata(html)
        json_ld = self.extract_json_ld_payload(html)
        plain_text = self.to_plain_text(html)
        title = metadata["title"] or self.extract_string(json_ld, ["name", "headline"]) or self.extract_heading_title(plain_text)

        if not title:
            return None

        description = metadata["description"] or self.extract_string(json_ld, ["description"]) or self.extract_description(plain_text)
        searchable_text = self.normalize_search_text(f"{title} {description or ''} {plain_text} {url}")
        location_text = (
            metadata["locationText"]
            or self.extract_location_text(json_ld)
            or self.extract_heading_location(plain_text, title)
            or self.extract_location_from_title(title)
            or self.extract_string(json_ld, ["address.streetAddress"])
        )
        city = self.extract_city(location_text, title)
        neighborhood = self.extract_neighborhood(location_text, title)

        return PropertyListing(
            externalId=self.extract_external_id(url),
            source=self.source_name,
            sourceUrl=self.normalize_detail_url(url),
            publisher=self.extract_publisher(plain_text),
            contactPhone=self.extract_contact_phone(html, plain_text),
            contactWhatsApp=self.extract_contact_whatsapp(html),
            title=title,
            description=description,
            operation=self.detect_operation(searchable_text),
            propertyType=self.detect_property_type(searchable_text),
            price=metadata["price"] or self.extract_number(json_ld, ["offers.price", "price"]) or self.extract_price(plain_text),
            currency=metadata["currency"]
            or self.normalize_currency(self.extract_string(json_ld, ["offers.priceCurrency", "priceCurrency"]))
            or self.extract_currency(plain_text),
            expenses=metadata["expenses"] or self.extract_expenses(plain_text),
            locationText=location_text,
            city=city,
            neighborhood=neighborhood,
            rooms=metadata["rooms"] or self.extract_number(json_ld, ["numberOfRooms", "numberOfBedrooms"]),
            bedrooms=metadata["bedrooms"] or self.extract_number(json_ld, ["numberOfBedrooms"]) or self.extract_bedrooms(plain_text),
            bathrooms=metadata["bathrooms"] or self.extract_number(json_ld, ["numberOfBathroomsTotal"]) or self.extract_bathrooms(plain_text),
            areaTotal=metadata["areaTotal"] or self.extract_number(json_ld, ["floorSize.value"]) or self.extract_area_total(plain_text),
            areaCovered=metadata["areaCovered"],
            features=self.detect_features(searchable_text),
            images=self.extract_images(metadata["images"], json_ld),
            latitude=None,
            longitude=None,
            publishedAt=metadata["publishedAt"] or self.extract_string(json_ld, ["datePublished"]),
            scrapedAt=datetime.now(timezone.utc).isoformat(),
        )

    def extract_metadata(self, html: str) -> dict[str, object]:
        plain_text = self.to_plain_text(html)
        return {
            "title": self.find_meta_content(html, "og:title") or self.extract_title_tag(html),
            "description": self.find_meta_content(html, "og:description") or self.find_meta_content(html, "description"),
            "price": self.parse_number(
                self.find_meta_content(html, "product:price:amount")
                or self.find_meta_content(html, "og:price:amount")
            ),
            "currency": self.normalize_currency(
                self.find_meta_content(html, "product:price:currency")
                or self.find_meta_content(html, "og:price:currency")
            ),
            "locationText": self.find_meta_content(html, "og:locality") or self.find_meta_content(html, "twitter:data1"),
            "publishedAt": self.find_meta_content(html, "article:published_time"),
            "rooms": self.extract_rooms(plain_text),
            "bedrooms": self.extract_bedrooms(plain_text),
            "bathrooms": self.extract_bathrooms(plain_text),
            "areaTotal": self.extract_area_total(plain_text),
            "areaCovered": self.extract_area_covered(plain_text),
            "expenses": self.extract_expenses(plain_text),
            "images": self.collect_meta_images(html),
        }

    def extract_json_ld_payload(self, html: str) -> dict[str, object] | None:
        scripts = re.findall(
            r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
            html,
            flags=re.IGNORECASE,
        )
        for raw in scripts:
            raw_content = raw.strip()
            if not raw_content:
                continue
            try:
                parsed = json.loads(raw_content)
            except json.JSONDecodeError:
                continue
            for item in self.flatten_json_ld(parsed):
                if self.looks_like_property_metadata(item):
                    return item
        return None

    def flatten_json_ld(self, payload: object) -> list[dict[str, object]]:
        if payload is None:
            return []
        if isinstance(payload, list):
            flattened: list[dict[str, object]] = []
            for item in payload:
                flattened.extend(self.flatten_json_ld(item))
            return flattened
        if not isinstance(payload, dict):
            return []
        graph = payload.get("@graph")
        graph_items = graph if isinstance(graph, list) else []
        flattened = [payload]
        for item in graph_items:
            flattened.extend(self.flatten_json_ld(item))
        return flattened

    def looks_like_property_metadata(self, payload: dict[str, object]) -> bool:
        payload_type = str(payload.get("@type", "")).lower()
        return (
            "product" in payload_type
            or "offer" in payload_type
            or "residence" in payload_type
            or "apartment" in payload_type
            or "house" in payload_type
            or bool(payload.get("offers"))
            or bool(payload.get("address"))
        )

    def extract_string(self, payload: dict[str, object] | None, paths: list[str]) -> str | None:
        for path in paths:
            value = self.get_nested_value(payload, path)
            if isinstance(value, str) and value.strip():
                return self.clean_text(value)
        return None

    def extract_number(self, payload: dict[str, object] | None, paths: list[str]) -> int | None:
        for path in paths:
            value = self.get_nested_value(payload, path)
            parsed = self.parse_number(value)
            if parsed is not None:
                return parsed
        return None

    def get_nested_value(self, payload: dict[str, object] | None, path: str) -> object | None:
        current: object | None = payload
        for key in path.split("."):
            if not isinstance(current, dict):
                return None
            current = current.get(key)
        return current

    def find_meta_content(self, html: str, property_name: str) -> str | None:
        escaped = re.escape(property_name)
        patterns = [
            rf'<meta[^>]+property=["\']{escaped}["\'][^>]+content=["\']([^"\']+)["\'][^>]*>',
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']{escaped}["\'][^>]*>',
            rf'<meta[^>]+name=["\']{escaped}["\'][^>]+content=["\']([^"\']+)["\'][^>]*>',
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']{escaped}["\'][^>]*>',
        ]
        for pattern in patterns:
            match = re.search(pattern, html, flags=re.IGNORECASE)
            if match and match.group(1):
                return self.clean_text(match.group(1))
        return None

    def extract_title_tag(self, html: str) -> str | None:
        match = re.search(r"<title>([\s\S]*?)</title>", html, flags=re.IGNORECASE)
        return self.clean_text(match.group(1)) if match and match.group(1) else None

    def collect_meta_images(self, html: str) -> list[str]:
        return [
            match.group(1).strip()
            for match in re.finditer(
                r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\'][^>]*>',
                html,
                flags=re.IGNORECASE,
            )
            if match.group(1).strip()
        ]

    def extract_images(self, meta_images: object, payload: dict[str, object] | None) -> list[str]:
        collected = list(meta_images) if isinstance(meta_images, list) else []
        json_ld_images = self.get_nested_value(payload, "image")
        if isinstance(json_ld_images, list):
            collected.extend([item for item in json_ld_images if isinstance(item, str)])
        elif isinstance(json_ld_images, str):
            collected.append(json_ld_images)
        return list(dict.fromkeys(collected))[:12]

    def extract_location_text(self, payload: dict[str, object] | None) -> str | None:
        address = self.get_nested_value(payload, "address")
        if isinstance(address, str):
            return self.clean_text(address)
        if not isinstance(address, dict):
            return None
        parts = [
            address.get("streetAddress"),
            address.get("addressLocality"),
            address.get("addressRegion"),
            address.get("addressCountry"),
        ]
        clean_parts = [self.clean_text(str(value)) for value in parts if isinstance(value, str) and value.strip()]
        return ", ".join(clean_parts) if clean_parts else None

    def extract_heading_title(self, plain_text: str) -> str | None:
        match = re.search(
            r"(Departamento|Casa|PH|Oficina|Terreno|Cochera|Local)\s+en\s+(venta|alquiler)\s+en\s+[^\n]+",
            plain_text,
            flags=re.IGNORECASE,
        )
        return self.clean_text(match.group(0)) if match else None

    def extract_heading_location(self, plain_text: str, title: str) -> str | None:
        last_index = plain_text.rfind(title)
        if last_index == -1:
            return None

        tail = plain_text[last_index + len(title) : last_index + len(title) + 220]
        match = re.search(
            r"\s*([A-Za-zÁÉÍÓÚÑáéíóúñ ,.-]+?)\s+\d+\s+(?:dormitorios?|banos?|m[²2])",
            tail,
            flags=re.IGNORECASE,
        )
        if match:
            candidate = self.clean_text(match.group(1))
            if len(candidate) >= 4:
                return candidate

        location_match = re.search(
            r"Localizaci[oó]n\s+([A-Za-zÁÉÍÓÚÑáéíóúñ ,.-]+)",
            tail,
            flags=re.IGNORECASE,
        )
        if location_match:
            return self.clean_text(location_match.group(1))
        return None

    def extract_description(self, plain_text: str) -> str | None:
        match = re.search(r"Descripción\s+(.+?)(?:Características de la vivienda|Características del edificio|Localización)", plain_text)
        return self.clean_text(match.group(1)) if match else None

    def extract_location_from_title(self, title: str) -> str | None:
        match = re.search(r"\ben\s+([^-|]+)", title, flags=re.IGNORECASE)
        return self.clean_text(match.group(1)) if match else None

    def extract_publisher(self, plain_text: str) -> str | None:
        match = re.search(r"Publicado por\s+(.+?)\s+USD", plain_text, flags=re.IGNORECASE)
        if match:
            return self.clean_text(match.group(1))
        match = re.search(r"Agency information\s+(.+?)\s+Ver más publicaciones", plain_text, flags=re.IGNORECASE)
        if match:
            return self.clean_text(match.group(1))
        return None

    def extract_contact_phone(self, html: str, plain_text: str) -> str | None:
        match = re.search(r'href=["\']tel:([^"\']+)["\']', html, flags=re.IGNORECASE)
        if match:
            return self.normalize_phone(match.group(1))
        match = re.search(r"(\+54\d{8,15})", plain_text)
        if match:
            return self.normalize_phone(match.group(1))
        return None

    def extract_contact_whatsapp(self, html: str) -> str | None:
        match = re.search(
            r'href=["\'](https?://(?:wa\.me|api\.whatsapp\.com)/[^"\']+)["\']',
            html,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        phone = re.search(r"(?:wa\.me/|phone=)(\d+)", match.group(1))
        return f"https://wa.me/{phone.group(1)}" if phone else None

    def detect_operation(self, text: str) -> str | None:
        if "venta" in text:
            return "buy"
        if "alquiler" in text:
            return "rent"
        return None

    def detect_property_type(self, text: str) -> str | None:
        if "departamento" in text:
            return "apartment"
        if "casa" in text:
            return "house"
        if re.search(r"\bph\b", text):
            return "ph"
        if "oficina" in text:
            return "office"
        if "terreno" in text or "lote" in text:
            return "land"
        if "cochera" in text:
            return "garage"
        if "local" in text:
            return "local"
        return None

    def detect_features(self, text: str) -> list[str]:
        matches: list[str] = []
        for feature, tokens in self.feature_terms.items():
            if any(token in text for token in tokens):
                matches.append(feature)
        return matches

    def extract_price(self, text: str) -> int | None:
        match = re.search(r"(?:USD|US\$|U\$S)\s*([\d\.\,]+)", text, flags=re.IGNORECASE)
        return self.parse_number(match.group(1)) if match else None

    def extract_currency(self, text: str) -> str | None:
        if re.search(r"(?:USD|US\$|U\$S)", text, flags=re.IGNORECASE):
            return "USD"
        if re.search(r"\bARS\b|\$", text, flags=re.IGNORECASE):
            return "ARS"
        return None

    def extract_expenses(self, text: str) -> int | None:
        match = re.search(r"expensas[^0-9]*(\d[\d\.\,]*)", text, flags=re.IGNORECASE)
        return self.parse_number(match.group(1)) if match else None

    def extract_rooms(self, text: str) -> int | None:
        match = re.search(r"(\d+)\s+ambientes?", text, flags=re.IGNORECASE)
        return self.parse_number(match.group(1)) if match else None

    def extract_bedrooms(self, text: str) -> int | None:
        match = re.search(r"(\d+)\s+dormitorios?", text, flags=re.IGNORECASE)
        return self.parse_number(match.group(1)) if match else None

    def extract_bathrooms(self, text: str) -> int | None:
        match = re.search(r"(\d+)\s+banos?", self.normalize_search_text(text), flags=re.IGNORECASE)
        return self.parse_number(match.group(1)) if match else None

    def extract_area_total(self, text: str) -> int | None:
        match = re.search(r"(\d[\d\.\,]*)\s*m[²2]", text, flags=re.IGNORECASE)
        return self.parse_number(match.group(1)) if match else None

    def extract_area_covered(self, text: str) -> int | None:
        match = re.search(
            r"cubiertos?[^0-9]*(\d[\d\.\,]*)\s*m[²2]|(\d[\d\.\,]*)\s*m[²2][^a-zA-Z]*cubiertos?",
            text,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        return self.parse_number(match.group(1) or match.group(2))

    def extract_city(self, location_text: str | None, title: str) -> str | None:
        source = self.normalize_search_text(f"{location_text or ''} {title}")
        if "capital federal" in source or "caba" in source or "ciudad de buenos aires" in source:
            return "CABA"
        if "buenos aires" in source:
            return "Buenos Aires"
        return None

    def extract_neighborhood(self, location_text: str | None, title: str) -> str | None:
        source = self.normalize_search_text(f"{location_text or ''} {title}")
        match = next((candidate for candidate in self.known_neighborhoods if candidate in source), None)
        if not match:
            return None
        if match == "nunez":
            return "Nuñez"
        if match == "las canitas":
            return "Las Cañitas"
        return self.capitalize_words(match)

    def extract_external_id(self, url: str) -> str | None:
        try:
            path = urlparse(url).path.rstrip("/")
        except ValueError:
            return None
        if not path.startswith("/detalle/"):
            return None
        return path.removeprefix("/detalle/") or None

    def normalize_detail_url(self, url: str) -> str:
        parsed = urlparse(url)
        normalized_path = parsed.path.rstrip("/")
        return f"{self.base_url}{normalized_path}"

    def normalize_currency(self, value: str | None) -> str | None:
        if not value:
            return None
        normalized = self.normalize_search_text(value)
        if "usd" in normalized or "u$s" in normalized:
            return "USD"
        if "ars" in normalized or normalized == "$":
            return "ARS"
        return None

    def parse_number(self, value: object) -> int | None:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return int(value)
        if not isinstance(value, str):
            return None
        cleaned = re.sub(r"[^0-9,.-]", "", value).strip()
        if not cleaned:
            return None
        if "." in cleaned and "," not in cleaned and re.fullmatch(r"\d{1,3}(?:\.\d{3})+", cleaned):
            cleaned = cleaned.replace(".", "")
        if "," in cleaned and "." in cleaned:
            normalized = cleaned.replace(".", "").replace(",", ".")
        else:
            normalized = cleaned.replace(",", ".")
        try:
            parsed = float(normalized)
        except ValueError:
            return None
        return int(parsed) if parsed == int(parsed) else int(round(parsed))

    def clean_text(self, value: str) -> str:  # type: ignore[override]
        return shared_clean_text(value)

    def to_plain_text(self, value: str) -> str:  # type: ignore[override]
        return shared_to_plain_text(value)

    def normalize_search_text(self, value: str) -> str:  # type: ignore[override]
        return shared_normalize_search_text(value)

    def normalize_phone(self, value: str) -> str | None:  # type: ignore[override]
        return shared_normalize_phone(value)

    def slugify(self, value: str) -> str:  # type: ignore[override]
        return shared_slugify(value)

    def capitalize_words(self, value: str) -> str:  # type: ignore[override]
        return shared_capitalize_words(value)
