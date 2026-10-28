from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

from app.contracts.search import PropertyListing, SearchFilters
from app.sources.base import SourceAdapter
from app.utils.text import (
    clean_text as shared_clean_text,
    normalize_phone as shared_normalize_phone,
    normalize_search_text as shared_normalize_search_text,
    slugify as shared_slugify,
    to_plain_text as shared_to_plain_text,
)


class ArgenpropSourceAdapter(SourceAdapter):
    source_name = "argenprop"
    base_url = "https://www.argenprop.com"
    number_terms = {
        "un": 1,
        "una": 1,
        "uno": 1,
        "dos": 2,
        "tres": 3,
        "cuatro": 4,
        "cinco": 5,
        "seis": 6,
    }

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
        "local": "locales",
    }

    feature_terms = {
        "balcony": "balcon",
        "garage": "cochera",
        "terrace": "terraza",
        "pool": "pileta",
        "barbecue": "parrilla",
        "mortgage_eligible": "apto credito",
        "professional_use": "apto profesional",
        "pets_allowed": "mascotas",
    }

    def can_handle(self, url: str) -> bool:
        try:
            hostname = urlparse(url).hostname or ""
            return hostname == "www.argenprop.com" or hostname.endswith(".argenprop.com")
        except ValueError:
            return False

    def is_detail_url(self, url: str) -> bool:
        try:
            path = (urlparse(url).path or "").lower()
            return bool(re.search(r"-\d{5,}(?:[./]|$)", path))
        except ValueError:
            return False

    def build_search_urls(self, filters: SearchFilters) -> list[str]:
        property_type = self.property_type_terms.get((filters.propertyType or "apartment").lower(), "departamentos")
        operation = self.operation_terms.get((filters.operation or "buy").lower(), "venta")
        location = self.slugify(filters.locations[0]) if filters.locations else "capital-federal"
        urls = [f"{self.base_url}/{property_type}/{operation}/{location}"]

        room_values = filters.roomsAnyOf or ([filters.rooms] if filters.rooms else [])
        for rooms in room_values[:3]:
            urls.append(f"{self.base_url}/{property_type}/{operation}/{location}?ambientes={rooms}")

        if filters.priceMax and (filters.currency or "").upper() == "USD":
            urls.append(f"{self.base_url}/{property_type}/{operation}/{location}?usdHasta={filters.priceMax}")

        return list(dict.fromkeys(urls))

    def extract_listing_urls(self, html: str) -> list[str]:
        hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.IGNORECASE)
        urls: list[str] = []

        for href in hrefs:
            absolute = urljoin(self.base_url, href)
            if self.can_handle(absolute) and self.is_detail_url(absolute):
                urls.append(absolute)

        return list(dict.fromkeys(urls))

    def extract(self, url: str, html: str) -> PropertyListing | None:
        metadata = self.extract_metadata(html)
        json_ld = self.extract_json_ld_payload(html)
        title = metadata["title"] or self.extract_string(json_ld, ["name", "headline"])

        if not title:
            return None

        description = metadata["description"] or self.extract_string(json_ld, ["description"])
        plain_text = self.to_plain_text(html)
        combined_text = f"{title} {description or ''} {html} {url}"
        searchable_text = f"{title} {description or ''} {plain_text} {url}"
        price = metadata["price"] or self.extract_number(json_ld, ["offers.price", "price"]) or self.extract_price(combined_text)
        currency = (
            metadata["currency"]
            or self.normalize_currency(self.extract_string(json_ld, ["offers.priceCurrency", "priceCurrency"]))
            or self.extract_price_currency(combined_text)
        )
        location_text = (
            metadata["locationText"]
            or self.extract_location_text(json_ld)
            or self.extract_location_from_title(title)
            or self.extract_string(json_ld, ["address.streetAddress"])
        )
        latitude = metadata["latitude"] or self.extract_float(json_ld, ["geo.latitude"])
        longitude = metadata["longitude"] or self.extract_float(json_ld, ["geo.longitude"])

        return PropertyListing(
            externalId=self.extract_external_id(url),
            source=self.source_name,
            sourceUrl=url,
            publisher=self.extract_publisher(html),
            contactPhone=self.extract_contact_phone(html),
            contactWhatsApp=self.extract_contact_whatsapp(html),
            title=title,
            description=description,
            operation=self.detect_operation(f"{title} {url}") or self.detect_operation(searchable_text),
            propertyType=self.detect_property_type(searchable_text),
            price=price,
            currency=currency,
            expenses=self.extract_expenses(searchable_text),
            locationText=location_text,
            city=self.extract_city(location_text, title),
            neighborhood=self.extract_neighborhood(location_text, title),
            rooms=metadata["rooms"] or self.extract_number(json_ld, ["numberOfRooms", "numberOfBedrooms"]),
            bedrooms=metadata["bedrooms"] or self.extract_number(json_ld, ["numberOfBedrooms"]),
            bathrooms=metadata["bathrooms"] or self.extract_number(json_ld, ["numberOfBathroomsTotal"]),
            areaTotal=metadata["areaTotal"] or self.extract_number(json_ld, ["floorSize.value"]),
            areaCovered=metadata["areaCovered"] or self.extract_covered_area(html),
            features=self.detect_features(searchable_text),
            images=self.extract_images(metadata["images"], json_ld),
            latitude=latitude,
            longitude=longitude,
            publishedAt=metadata["publishedAt"] or self.extract_string(json_ld, ["datePublished"]),
            scrapedAt=datetime.now(timezone.utc).isoformat(),
        )

    def extract_metadata(self, html: str) -> dict[str, object]:
        price = (
            self.find_meta_content(html, "product:price:amount")
            or self.find_meta_content(html, "og:price:amount")
            or self.find_input_value(html, "Precio")
            or self.find_data_attribute(html, "data-price")
        )
        currency = (
            self.find_meta_content(html, "product:price:currency")
            or self.find_meta_content(html, "og:price:currency")
            or self.find_input_value(html, "Moneda")
            or self.find_data_attribute(html, "data-moneda")
        )

        return {
            "title": self.find_meta_content(html, "og:title") or self.extract_title_tag(html),
            "description": self.find_meta_content(html, "og:description") or self.find_meta_content(html, "description"),
            "price": self.parse_number(price),
            "currency": self.normalize_currency(currency),
            "locationText": self.find_meta_content(html, "og:locality")
            or self.find_meta_content(html, "twitter:data1")
            or self.find_meta_content(html, "geo.position"),
            "publishedAt": self.find_meta_content(html, "article:published_time"),
            "rooms": self.extract_rooms(html),
            "bedrooms": self.parse_number(self.find_meta_content(html, "twitter:data2")),
            "bathrooms": self.extract_bathrooms_normalized(html),
            "areaTotal": self.extract_area(html),
            "areaCovered": self.extract_covered_area(html),
            "images": self.collect_meta_images(html),
            "latitude": self.extract_latitude(html),
            "longitude": self.extract_longitude(html),
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

    def extract_float(self, payload: dict[str, object] | None, paths: list[str]) -> float | None:
        for path in paths:
            value = self.get_nested_value(payload, path)
            parsed = self.parse_float(value)
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

    def find_input_value(self, html: str, field_name: str) -> str | None:
        expected = field_name.strip().lower()
        for match in re.finditer(r"<input\b[^>]*>", html, flags=re.IGNORECASE):
            tag = match.group(0)
            input_id = self.find_attribute(tag, "id")
            input_name = self.find_attribute(tag, "name")
            if (input_id or "").strip().lower() != expected and (input_name or "").strip().lower() != expected:
                continue

            value = self.find_attribute(tag, "value")
            if value:
                return self.clean_text(value)
        return None

    def find_data_attribute(self, html: str, attribute_name: str) -> str | None:
        for match in re.finditer(r"<[^>]+>", html, flags=re.IGNORECASE):
            value = self.find_attribute(match.group(0), attribute_name)
            if value:
                return self.clean_text(value)
        return None

    def find_attribute(self, tag: str, attribute_name: str) -> str | None:
        escaped = re.escape(attribute_name)
        match = re.search(rf"\b{escaped}\s*=\s*([\"'])(.*?)\1", tag, flags=re.IGNORECASE | re.DOTALL)
        return match.group(2).strip() if match and match.group(2).strip() else None

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

        static_images = [
            match.group(0)
            for match in re.finditer(
                r"https://www\.argenprop\.com/static-content/[^\s\"'<>]+?\.(?:jpg|jpeg|png|webp)",
                html,
                flags=re.IGNORECASE,
            )
        ]

        return list(dict.fromkeys(images + static_images))

    def extract_images(self, meta_images: object, payload: dict[str, object] | None) -> list[str]:
        collected = list(meta_images) if isinstance(meta_images, list) else []
        json_ld_images = self.get_nested_value(payload, "image")
        if isinstance(json_ld_images, list):
            collected.extend([item for item in json_ld_images if isinstance(item, str)])
        elif isinstance(json_ld_images, str):
            collected.append(json_ld_images)
        return list(dict.fromkeys(collected))[:12]

    def extract_publisher(self, html: str) -> str | None:
        patterns = [
            r'<a id="avisos-anunciante-(?:inf|sup)"[^>]*>(.*?)</a>',
            r'<a[^>]+data-agent-more-properties[^>]*>(.*?)</a>',
        ]
        for pattern in patterns:
            match = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
            if not match:
                continue
            publisher = self.to_plain_text(match.group(1))
            if publisher:
                return publisher
        return None

    def extract_contact_phone(self, html: str) -> str | None:
        tel_match = re.search(r'href="tel:([^"]+)"', html, flags=re.IGNORECASE)
        if tel_match:
            normalized = self.normalize_phone(tel_match.group(1))
            if normalized:
                return normalized

        for match in re.finditer(
            r'<div class="form-detail-phone-number">\s*(.*?)\s*</div>',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        ):
            normalized = self.normalize_phone(self.to_plain_text(match.group(1)))
            if normalized:
                return normalized

        return None

    def extract_contact_whatsapp(self, html: str) -> str | None:
        match = re.search(r'href="(https://wa\.me/(\d+)/?[^"]*)"\s+[^>]*data-whatsapp-target', html, flags=re.IGNORECASE)
        if not match:
            return None
        return f"https://wa.me/{match.group(2)}"

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
        match = re.search(r" en ([A-Za-zÁÉÍÓÚáéíóúñÑ ,.-]+)", title, flags=re.IGNORECASE)
        return self.clean_text(match.group(1)) if match else None

    def extract_external_id(self, url: str) -> str | None:
        match = re.search(r"-(\d{5,})(?:[./]|$)", url)
        return match.group(1) if match else None

    def extract_rooms(self, text: str) -> int | None:
        match = re.search(r"(\d+)\s+amb", text, flags=re.IGNORECASE)
        return int(match.group(1)) if match else None

    def extract_bathrooms(self, text: str) -> int | None:
        patterns = [
            r"(\d+)\s+ba(?:ñ|n)os?",
            r"Cant\.\s*Ba(?:ñ|n)os:\s*(\d+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                return int(match.group(1))

        if re.search(r"\bbaño completo\b", text, flags=re.IGNORECASE):
            return 1

        return None

    def extract_bathrooms_normalized(self, text: str) -> int | None:
        plain_text = self.to_plain_text(text)
        candidates = [self.normalize_search_text(text), self.normalize_search_text(plain_text)]
        patterns = [
            r"(\d+)\s+banos?",
            r"cant\.\s*banos:\s*(\d+)",
            r"\b(un|una|uno|dos|tres|cuatro|cinco|seis)\s+banos?\b",
        ]
        for candidate in candidates:
            for pattern in patterns:
                match = re.search(pattern, candidate, flags=re.IGNORECASE)
                if not match:
                    continue
                parsed = self.parse_number_word(match.group(1))
                if parsed is not None:
                    return parsed

            if re.search(r"\bbano(?:\s+completo)?\b", candidate, flags=re.IGNORECASE):
                return 1

        return None

    def extract_area(self, text: str) -> int | None:
        patterns = [
            r"(\d+)\s*m2\s+tot",
            r"Sup\.\s*Total:\s*(\d+)\s*m2",
            r"Sup\.\s*Total:\s*(?:<[^>]+>\s*)+(\d+)\s*m2",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                return int(match.group(1))
        return None

    def extract_covered_area(self, text: str) -> int | None:
        plain_text = self.to_plain_text(text)
        patterns = [
            r"(\d+)\s*m2\s+cub",
            r"Sup\.\s*Cubierta:\s*(\d+)\s*m2",
            r"Sup\.\s*Cubierta:\s*(?:<[^>]+>\s*)+(\d+)\s*m2",
            r"Sup(?:erficie)?\.?\s*Cub(?:ierta)?\s*:?\s*([\d\.\,]+)\s*m2",
            r"([\d\.\,]+)\s*m2\s*cub(?:iertos?|ierta)?",
        ]
        for candidate in (text, plain_text):
            for pattern in patterns:
                match = re.search(pattern, candidate, flags=re.IGNORECASE)
                if not match:
                    continue
                parsed = self.parse_number(match.group(1))
                if parsed is not None:
                    return parsed
        return None

    def extract_expenses(self, text: str) -> int | None:
        plain_text = self.to_plain_text(text)
        patterns = [
            r"expensas?\s*[$ ]\s*([\d\.\,]+)",
            r"\+\s*\$\s*([\d\.\,]+)\s*expensas?",
            r"Expensas:\s*(?:<[^>]+>\s*)+\$?\s*([\d\.\,]+)",
            r"expensas?(?:\s+aprox(?:imadas?)?)?\s*:?\s*(?:\$|ars)?\s*([\d\.\,]+)",
            r"(?:\$|ars)?\s*([\d\.\,]+)\s*expensas?",
        ]
        for candidate in (text, plain_text):
            for pattern in patterns:
                match = re.search(pattern, candidate, flags=re.IGNORECASE)
                if not match:
                    continue
                parsed = self.parse_number(match.group(1))
                if parsed is not None:
                    return parsed
        return None

    def extract_latitude(self, text: str) -> float | None:
        match = re.search(r'data-latitude=["\'](-?[\d\.,]+)["\']', text, flags=re.IGNORECASE)
        if match:
            return self.parse_float(match.group(1))
        return None

    def extract_longitude(self, text: str) -> float | None:
        match = re.search(r'data-longitude=["\'](-?[\d\.,]+)["\']', text, flags=re.IGNORECASE)
        if match:
            return self.parse_float(match.group(1))
        return None

    def extract_price(self, text: str) -> int | None:
        patterns = [
            r"(?:USD|US\$|U\$S|U\$D)\s*([\d\.\,]+)",
            r"(?:ARS|\$)\s*([\d\.\,]+)",
            r'data-price=["\']([\d\.\,]+)["\']',
            r'<input[^>]+(?:id|name)=["\']Precio["\'][^>]+value=["\']([\d\.\,]+)["\']',
            r'<input[^>]+value=["\']([\d\.\,]+)["\'][^>]+(?:id|name)=["\']Precio["\']',
            r'"price"\s*:\s*"?(?:USD|US\$|U\$S)?\s*([\d\.\,]+)"?',
            r'"mainPrice"\s*:\s*"?(?:USD|US\$|U\$S)?\s*([\d\.\,]+)"?',
            r'"precio"\s*:\s*"?(?:USD|US\$|U\$S)?\s*([\d\.\,]+)"?',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                parsed = self.parse_number(match.group(1))
                if parsed is not None:
                    return parsed
        return None

    def extract_price_currency(self, text: str) -> str | None:
        if re.search(r"(?:USD|US\$|U\$S|U\$D)", text, flags=re.IGNORECASE):
            return "USD"
        if re.search(
            r'"priceCurrency"\s*:\s*"ARS"|<input[^>]+(?:id|name)=["\']Moneda["\'][^>]+value=["\'](?:ARS|\$)["\']|data-moneda=["\'](?:ARS|\$)["\']',
            text,
            flags=re.IGNORECASE,
        ):
            return "ARS"
        return None

    def extract_city(self, location_text: str | None, title: str) -> str | None:
        combined = f"{location_text or ''} {title}".lower()
        if "capital federal" in combined or "caba" in combined:
            return "CABA"
        return None

    def extract_neighborhood(self, location_text: str | None, title: str) -> str | None:
        if location_text:
            parts = [part.strip() for part in location_text.split(",") if part.strip()]
            if parts:
                last_part = parts[-1]
                if last_part.lower() not in {"argentina", "capital federal", "caba"}:
                    return last_part

        combined = f"{location_text or ''} {title}"
        neighborhoods = [
            "Palermo Hollywood",
            "Palermo Chico",
            "Palermo Soho",
            "Palermo Viejo",
            "Palermo Nuevo",
            "Palermo",
            "Belgrano",
            "Caballito",
            "Recoleta",
            "Almagro",
            "Villa Crespo",
            "Botanico",
        ]
        for neighborhood in neighborhoods:
            if neighborhood.lower() in combined.lower():
                return neighborhood
        return None

    def detect_operation(self, text: str) -> str | None:
        lowered = text.lower()
        rent_match = re.search(r"\balquiler(?:es)?\b|en-alquiler", lowered)
        buy_match = re.search(r"\bventa(?:s)?\b|en-venta", lowered)

        if rent_match and buy_match:
            return "rent" if rent_match.start() < buy_match.start() else "buy"
        if rent_match:
            return "rent"
        if buy_match:
            return "buy"
        return None

    def detect_property_type(self, text: str) -> str | None:
        lowered = text.lower()
        if "depart" in lowered:
            return "apartment"
        if "casa" in lowered:
            return "house"
        if re.search(r"\bph\b", lowered):
            return "ph"
        if "oficina" in lowered:
            return "office"
        return None

    def detect_features(self, text: str) -> list[str]:
        lowered = text.lower()
        features = []
        for feature, term in self.feature_terms.items():
            if term in lowered:
                features.append(feature)
        return features

    def normalize_currency(self, value: str | None) -> str | None:
        if not value:
            return None
        normalized = value.strip().upper()
        if normalized in {"USD", "US$", "U$S", "U$D", "DOLAR", "DOLARES"}:
            return "USD"
        if normalized in {"ARS", "$", "PESO", "PESOS"}:
            return "ARS"
        return None

    def parse_number(self, value: object) -> int | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if not isinstance(value, str):
            return None
        digits = re.sub(r"[^\d]", "", value)
        return int(digits) if digits else None

    def parse_float(self, value: object) -> float | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        if not isinstance(value, str):
            return None

        normalized = value.strip()
        if "," in normalized and "." in normalized:
            normalized = normalized.replace(".", "").replace(",", ".")
        else:
            normalized = normalized.replace(",", ".")

        normalized = re.sub(r"[^0-9\.-]", "", normalized)
        if not normalized or normalized in {"-", ".", "-."}:
            return None

        try:
            return float(normalized)
        except ValueError:
            return None

    def clean_text(self, value: str) -> str:
        cleaned = unescape(re.sub(r"\s+", " ", value)).strip()
        return self.repair_mojibake(cleaned)

    def to_plain_text(self, value: str) -> str:
        without_blocks = re.sub(r"<(script|style)[^>]*>[\s\S]*?</\1>", " ", value, flags=re.IGNORECASE)
        without_tags = re.sub(r"<[^>]+>", " ", without_blocks)
        return self.clean_text(without_tags)

    def repair_mojibake(self, value: str) -> str:
        if "Ãƒ" not in value and "Ã‚" not in value:
            return value
        try:
            return value.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return value

    def normalize_search_text(self, value: str) -> str:
        cleaned = self.clean_text(value).lower()
        normalized = unicodedata.normalize("NFKD", cleaned)
        normalized = normalized.encode("ascii", "ignore").decode("ascii")
        return re.sub(r"\s+", " ", normalized).strip()

    def parse_number_word(self, value: str) -> int | None:
        parsed = self.parse_number(value)
        if parsed is not None:
            return parsed
        return self.number_terms.get(value.strip().lower())

    def normalize_phone(self, value: str) -> str | None:
        digits = re.sub(r"[^\d+]", "", self.clean_text(value))
        normalized_digits = re.sub(r"\D", "", digits)
        if len(normalized_digits) < 8:
            return None
        return digits if digits.startswith("+") else normalized_digits

    def slugify(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value.strip().lower())
        normalized = normalized.encode("ascii", "ignore").decode("ascii")
        normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
        return normalized.strip("-")

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
