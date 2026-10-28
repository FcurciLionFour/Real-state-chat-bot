from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from html import unescape
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


class MudafySourceAdapter(SourceAdapter):
    source_name = "mudafy"
    base_url = "https://mudafy.com.ar"

    operation_terms = {
        "buy": "venta",
        "rent": "alquiler",
    }

    property_type_terms = {
        "apartment": "departamentos",
        "house": "casas",
        "ph": "ph",
        "office": "oficinas",
        "land": "terrenos",
        "garage": "cocheras",
        "local": "propiedades",
    }

    feature_path_terms = {
        "balcony": "balcon",
        "terrace": "terraza",
        "patio": "patio",
        "pets_allowed": "aceptan-mascotas",
    }

    feature_terms = {
        "balcony": ["balcon"],
        "terrace": ["terraza", "solarium"],
        "patio": ["patio"],
        "garage": ["cochera"],
        "pool": ["pileta", "piscina"],
        "barbecue": ["parrilla"],
        "gym": ["gimnasio", "gym"],
        "professional_use": ["apto profesional"],
        "mortgage_eligible": ["apto credito", "credito"],
        "furnished": ["amoblado", "amueblado"],
        "pets_allowed": ["aceptan mascotas", "mascotas"],
    }

    known_neighborhoods = [
        "palermo hollywood",
        "palermo soho",
        "palermo chico",
        "palermo viejo",
        "palermo nuevo",
        "las canitas",
        "villa crespo",
        "villa urquiza",
        "villa devoto",
        "villa luro",
        "puerto madero",
        "parque patricios",
        "san telmo",
        "san cristobal",
        "san nicolas",
        "belgrano r",
        "belgrano",
        "caballito",
        "recoleta",
        "almagro",
        "colegiales",
        "nunez",
        "palermo",
        "flores",
    ]

    detail_patterns = (
        "departamento",
        "casa",
        "ph",
        "oficina",
        "terreno",
        "cochera",
        "propiedad",
    )

    def can_handle(self, url: str) -> bool:
        try:
            hostname = urlparse(url).hostname or ""
            return hostname == "mudafy.com.ar" or hostname == "www.mudafy.com.ar" or hostname.endswith(".mudafy.com.ar")
        except ValueError:
            return False

    def is_detail_url(self, url: str) -> bool:
        try:
            path = (urlparse(url).path or "").lower()
            return bool(
                re.search(
                    rf"/(?:{'|'.join(self.detail_patterns)})/[^?#]+-\d{{5,}}(?:[/?#]|$)",
                    path,
                )
            )
        except ValueError:
            return False

    def build_search_urls(self, filters: SearchFilters) -> list[str]:
        operation = self.operation_terms.get((filters.operation or "buy").lower(), "venta")
        property_type = self.property_type_terms.get((filters.propertyType or "apartment").lower(), "departamentos")
        base_path = f"{self.base_url}/{operation}/{property_type}"
        location_path = self.build_location_path(base_path, filters.locations[0] if filters.locations else None)
        rooms_segment = f"{filters.rooms}-ambientes" if filters.rooms else None
        feature_segment = self.build_feature_segment(filters.features)

        candidates: list[str] = []
        roots = [location_path, base_path] if location_path else [base_path]

        for root in roots:
            if rooms_segment and feature_segment:
                candidates.append(f"{root}/{rooms_segment}/con-{feature_segment}")
            if rooms_segment:
                candidates.append(f"{root}/{rooms_segment}")
            if feature_segment:
                candidates.append(f"{root}/con-{feature_segment}")
            candidates.append(root)

        return list(dict.fromkeys(candidates))

    def extract_listing_urls(self, html: str) -> list[str]:
        normalized_html = html.replace("\\/", "/")
        candidates: list[str] = []

        hrefs = re.findall(r'href=["\']([^"\']+)["\']', normalized_html, flags=re.IGNORECASE)
        for href in hrefs:
            absolute = urljoin(self.base_url, href)
            if self.can_handle(absolute) and self.is_detail_url(absolute):
                candidates.append(self.normalize_detail_url(absolute))

        direct_matches = re.findall(
            r"https?://(?:www\.)?mudafy\.com\.ar/[^\s\"'<>]+",
            normalized_html,
            flags=re.IGNORECASE,
        )
        for match in direct_matches:
            if self.is_detail_url(match):
                candidates.append(self.normalize_detail_url(match))

        relative_matches = re.findall(
            rf"/(?:{'|'.join(self.detail_patterns)})/[^\"'<>\\s]+?-\d{{5,}}(?:[/?#][^\"'<>\\s]*)?",
            normalized_html,
            flags=re.IGNORECASE,
        )
        for match in relative_matches:
            absolute = urljoin(self.base_url, match)
            if self.is_detail_url(absolute):
                candidates.append(self.normalize_detail_url(absolute))

        return list(dict.fromkeys(candidates))

    def extract(self, url: str, html: str) -> PropertyListing | None:
        metadata = self.extract_metadata(html)
        json_ld = self.extract_json_ld_payload(html)
        title = metadata["title"] or self.extract_string(json_ld, ["name", "headline"])

        if not title:
            return None

        description = metadata["description"] or self.extract_string(json_ld, ["description"])
        plain_text = self.to_plain_text(html)
        combined_text = f"{title} {description or ''} {plain_text} {url}"
        searchable_text = self.normalize_search_text(combined_text)
        location_text = (
            self.extract_location_text(json_ld)
            or self.extract_location_from_title(title)
            or metadata["locationText"]
            or self.extract_string(json_ld, ["address.streetAddress"])
        )

        return PropertyListing(
            externalId=self.extract_external_id(url),
            source=self.source_name,
            sourceUrl=self.normalize_detail_url(url),
            publisher=self.extract_publisher(html),
            contactPhone=self.extract_contact_phone(html),
            contactWhatsApp=self.extract_contact_whatsapp(html),
            title=title,
            description=description,
            operation=self.detect_operation(searchable_text),
            propertyType=self.detect_property_type(searchable_text),
            price=metadata["price"] or self.extract_number(json_ld, ["offers.price", "price"]),
            currency=metadata["currency"]
            or self.normalize_currency(self.extract_string(json_ld, ["offers.priceCurrency", "priceCurrency"])),
            expenses=metadata["expenses"] or self.extract_expenses(combined_text),
            locationText=location_text,
            city=self.extract_city(location_text, title),
            neighborhood=self.extract_neighborhood(location_text, title),
            rooms=metadata["rooms"] or self.extract_number(json_ld, ["numberOfRooms", "numberOfBedrooms"]),
            bedrooms=metadata["bedrooms"] or self.extract_number(json_ld, ["numberOfBedrooms"]),
            bathrooms=metadata["bathrooms"] or self.extract_number(json_ld, ["numberOfBathroomsTotal"]),
            areaTotal=metadata["areaTotal"] or self.extract_number(json_ld, ["floorSize.value"]),
            areaCovered=metadata["areaCovered"],
            features=self.detect_features(searchable_text),
            images=self.extract_images(metadata["images"], json_ld),
            latitude=None,
            longitude=None,
            publishedAt=metadata["publishedAt"] or self.extract_string(json_ld, ["datePublished"]),
            scrapedAt=datetime.now(timezone.utc).isoformat(),
        )

    def extract_metadata(self, html: str) -> dict[str, object]:
        title = self.find_meta_content(html, "og:title") or self.extract_title_tag(html)
        description = self.find_meta_content(html, "og:description") or self.find_meta_content(html, "description")
        plain_text = self.to_plain_text(html)

        return {
            "title": title,
            "description": description,
            "price": self.parse_number(
                self.find_meta_content(html, "product:price:amount")
                or self.find_meta_content(html, "og:price:amount")
                or self.extract_labeled_number(plain_text, ["usd", "ars", "precio"])
            ),
            "currency": self.normalize_currency(
                self.find_meta_content(html, "product:price:currency")
                or self.find_meta_content(html, "og:price:currency")
                or self.extract_currency(plain_text)
            ),
            "locationText": self.extract_location_from_plain_text(plain_text, title),
            "publishedAt": self.find_meta_content(html, "article:published_time"),
            "rooms": self.extract_labeled_number(plain_text, ["ambientes"]),
            "bedrooms": self.extract_labeled_number(plain_text, ["dormitorios"]),
            "bathrooms": self.extract_labeled_number(plain_text, ["banos"]),
            "areaTotal": self.extract_labeled_number(plain_text, ["superficie total", "sup total"]),
            "areaCovered": self.extract_labeled_number(plain_text, ["sup cubierta", "sup. cubierta", "superficie cubierta"]),
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
        images = [
            match.group(1).strip()
            for match in re.finditer(
                r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\'][^>]*>',
                html,
                flags=re.IGNORECASE,
            )
            if match.group(1).strip()
        ]
        return list(dict.fromkeys(images))

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

    def extract_location_from_title(self, title: str) -> str | None:
        match = re.search(r"departamento en (?:venta|alquiler) en ([^-|]+)", title, flags=re.IGNORECASE)
        return self.clean_text(match.group(1)) if match else None

    def extract_location_from_plain_text(self, plain_text: str, title: str | None) -> str | None:
        normalized = self.normalize_search_text(plain_text)
        match = re.search(
            r"departamento en (?:venta|alquiler) en ([a-z0-9 ,]+?) - ([a-z0-9 .]+)",
            normalized,
            flags=re.IGNORECASE,
        )
        if match:
            street = self.capitalize_words(match.group(2))
            neighborhood = self.capitalize_words(match.group(1))
            return f"{street}, {neighborhood}"
        return self.extract_location_from_title(title or "")

    def extract_publisher(self, html: str) -> str | None:
        plain_text = self.to_plain_text(html)
        match = re.search(r"perfil de ([^.]+?) se encuentran", plain_text, flags=re.IGNORECASE)
        if match:
            return self.clean_text(match.group(1))
        return None

    def extract_contact_phone(self, html: str) -> str | None:
        match = re.search(r'href=["\']tel:([^"\']+)["\']', html, flags=re.IGNORECASE)
        if not match:
            return None
        return self.normalize_phone(match.group(1))

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

    def extract_expenses(self, text: str) -> int | None:
        normalized = self.normalize_search_text(text)
        patterns = [
            r"expensas?\s*\$?\s*([\d\.\,]+)",
            r"\$([\d\.\,]+)\s*expensas?",
        ]
        for pattern in patterns:
            match = re.search(pattern, normalized, flags=re.IGNORECASE)
            if match:
                return self.parse_number(match.group(1))
        return None

    def extract_city(self, location_text: str | None, title: str) -> str | None:
        source = self.normalize_search_text(f"{location_text or ''} {title}")
        if self.extract_neighborhood(location_text, title):
            return "CABA"
        if "caba" in source or "capital federal" in source or "ciudad autonoma de buenos aires" in source:
            return "CABA"
        if "provincia de buenos aires" in source:
            return "Buenos Aires"
        return None

    def extract_neighborhood(self, location_text: str | None, title: str) -> str | None:
        source = self.normalize_search_text(f"{location_text or ''} {title}")
        match = next((candidate for candidate in self.known_neighborhoods if candidate in source), None)
        if not match:
            return None
        if match == "nunez":
            return "Nuñez"
        return self.capitalize_words(match)

    def extract_external_id(self, url: str) -> str | None:
        match = re.search(r"-(\d{5,})(?:[/?#]|$)", url)
        return match.group(1) if match else None

    def extract_currency(self, text: str) -> str | None:
        normalized = self.normalize_search_text(text)
        if "usd" in normalized or "u$s" in normalized:
            return "USD"
        if "ars" in normalized:
            return "ARS"
        return None

    def extract_labeled_number(self, text: str, labels: list[str]) -> int | None:
        normalized = self.normalize_search_text(text)
        for label in labels:
            escaped = re.escape(label)
            patterns = [
                rf"{escaped}\s*([\d\.\,]+)\s*m?2?",
                rf"{escaped}\s*:?\s*([\d\.\,]+)",
                rf"([\d\.\,]+)\s*m?2?\s*{escaped}",
            ]
            for pattern in patterns:
                match = re.search(pattern, normalized, flags=re.IGNORECASE)
                if match:
                    parsed = self.parse_number(match.group(1))
                    if parsed is not None:
                        return parsed
        return None

    def normalize_currency(self, value: str | None) -> str | None:
        if not value:
            return None
        normalized = self.normalize_search_text(value)
        if "usd" in normalized or "u$s" in normalized:
            return "USD"
        if "ars" in normalized:
            return "ARS"
        if normalized == "$":
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

    def clean_text(self, value: str) -> str:
        cleaned = re.sub(r"\s+", " ", unescape(value).replace("\xa0", " ")).strip()
        return self.repair_mojibake(cleaned)

    def to_plain_text(self, value: str) -> str:
        without_blocks = re.sub(r"<(script|style)[^>]*>[\s\S]*?</\1>", " ", value, flags=re.IGNORECASE)
        without_tags = re.sub(r"<[^>]+>", " ", without_blocks)
        return self.clean_text(without_tags)

    def normalize_search_text(self, value: str) -> str:
        plain = self.to_plain_text(value).lower()
        normalized = unicodedata.normalize("NFKD", plain)
        ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
        return re.sub(r"\s+", " ", ascii_value).strip()

    def repair_mojibake(self, value: str) -> str:
        if "Ã" not in value and "Â" not in value:
            return value
        try:
            return value.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return value

    def normalize_phone(self, value: str) -> str | None:
        cleaned = re.sub(r"[^\d+]", "", value or "")
        return cleaned or None

    def slugify(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")

    def capitalize_words(self, value: str) -> str:
        return " ".join(part[:1].upper() + part[1:] if part else part for part in value.split(" "))

    def build_location_path(self, base_path: str, location: str | None) -> str | None:
        if not location:
            return None

        slug = self.slugify(location)
        if not slug:
            return None

        if slug.startswith(("caba-", "gba-", "cordoba", "rio-negro", "costa-atlantica", "interior-de-bs-as")):
            location_segment = slug
        else:
            location_segment = f"caba-{slug}"

        return f"{base_path}/{location_segment}"

    def build_feature_segment(self, features: list[str]) -> str | None:
        for feature in features:
            segment = self.feature_path_terms.get((feature or "").lower())
            if segment:
                return segment
        return None

    def normalize_detail_url(self, url: str) -> str:
        parsed = urlparse(url)
        normalized_path = parsed.path.rstrip("/")
        return f"{self.base_url}{normalized_path}"

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
