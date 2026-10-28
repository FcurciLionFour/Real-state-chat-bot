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


class ZonapropSourceAdapter(SourceAdapter):
    source_name = "zonaprop"
    base_url = "https://www.zonaprop.com.ar"

    def requires_browser_fallback(self, url: str) -> bool:
        return True

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
        "local": "locales-comerciales",
    }

    feature_terms = {
        "balcony": ["balcon", "balcón"],
        "garage": ["cochera"],
        "terrace": ["terraza"],
        "pool": ["pileta", "piscina"],
        "barbecue": ["parrilla", "barbecue"],
        "gym": ["gimnasio", "gym"],
        "professional_use": ["apto profesional"],
        "mortgage_eligible": ["apto credito", "apto crédito"],
        "furnished": ["amoblado", "amueblado"],
        "pets_allowed": ["mascotas"],
    }

    def can_handle(self, url: str) -> bool:
        try:
            hostname = urlparse(url).hostname or ""
            return hostname == "www.zonaprop.com.ar" or hostname.endswith(".zonaprop.com.ar")
        except ValueError:
            return False

    def is_detail_url(self, url: str) -> bool:
        try:
            path = (urlparse(url).path or "").lower()
            return bool(re.search(r"-\d+\.html$", path))
        except ValueError:
            return False

    def build_search_urls(self, filters: SearchFilters) -> list[str]:
        property_type = self.property_type_terms.get((filters.propertyType or "apartment").lower(), "departamentos")
        operation = self.operation_terms.get((filters.operation or "buy").lower(), "venta")
        location = self.slugify(filters.locations[0]) if filters.locations else "capital-federal"
        return [f"{self.base_url}/{property_type}-{operation}-{location}.html"]

    def extract_listing_urls(self, html: str) -> list[str]:
        hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, flags=re.IGNORECASE)
        urls: list[str] = []

        for href in hrefs:
            absolute = urljoin(self.base_url, unescape(href))
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
        location_text = (
            metadata["locationText"]
            or self.extract_location_text(json_ld)
            or self.extract_location_from_title(title)
            or self.extract_string(json_ld, ["address.streetAddress"])
        )
        summary_text = " ".join(part for part in [title, description or "", location_text or ""] if part)
        searchable_text = self.normalize_search_text(summary_text)

        return PropertyListing(
            externalId=self.extract_external_id(url),
            source=self.source_name,
            sourceUrl=url,
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
            expenses=self.extract_expenses(summary_text),
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
            latitude=None,
            longitude=None,
            publishedAt=metadata["publishedAt"] or self.extract_string(json_ld, ["datePublished"]),
            scrapedAt=datetime.now(timezone.utc).isoformat(),
        )

    def extract_metadata(self, html: str) -> dict[str, object]:
        return {
            "title": self.find_meta_content(html, "og:title") or self.extract_title_tag(html),
            "description": self.find_meta_content(html, "og:description") or self.find_meta_content(html, "description"),
            "price": self.parse_number(self.find_meta_content(html, "product:price:amount")),
            "currency": self.normalize_currency(self.find_meta_content(html, "product:price:currency")),
            "locationText": self.find_meta_content(html, "og:locality") or self.find_meta_content(html, "twitter:data1"),
            "publishedAt": self.find_meta_content(html, "article:published_time"),
            "rooms": self.extract_rooms(html),
            "bedrooms": self.parse_number(self.find_meta_content(html, "twitter:data2")),
            "bathrooms": self.extract_bathrooms(html),
            "areaTotal": self.extract_area(html),
            "areaCovered": self.extract_covered_area(html),
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

    def extract_location_from_title(self, title: str) -> str | None:
        match = re.search(r"\ben\s+([^-|]+)", title, flags=re.IGNORECASE)
        return self.clean_text(match.group(1)) if match else None

    def extract_external_id(self, url: str) -> str | None:
        path = urlparse(url).path or ""
        match = re.search(r"-(\d+)\.html$", path, flags=re.IGNORECASE)
        return match.group(1) if match else None

    def extract_publisher(self, html: str) -> str | None:
        patterns = [
            r'data-qa="publisher-name"[^>]*>(.*?)<',
            r'class="[^"]*advertiser-name[^"]*"[^>]*>(.*?)<',
            r'class="[^"]*agency-name[^"]*"[^>]*>(.*?)<',
        ]
        for pattern in patterns:
            match = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
            if match:
                publisher = self.to_plain_text(match.group(1))
                if publisher:
                    return publisher
        return None

    def extract_contact_phone(self, html: str) -> str | None:
        match = re.search(r'href=["\']tel:([^"\']+)["\']', html, flags=re.IGNORECASE)
        if not match:
            return None
        return self.normalize_phone(match.group(1))

    def extract_contact_whatsapp(self, html: str) -> str | None:
        match = re.search(r'href=["\'](https://wa\.me/\d+[^"\']*)["\']', html, flags=re.IGNORECASE)
        if not match:
            return None
        phone = re.search(r"wa\.me/(\d+)", match.group(1))
        return f"https://wa.me/{phone.group(1)}" if phone else None

    def detect_operation(self, text: str) -> str | None:
        if "venta" in text or "/venta-" in text or "comprar" in text:
            return "buy"
        if "alquiler" in text or "/alquiler-" in text or "renta" in text:
            return "rent"
        return None

    def detect_property_type(self, text: str) -> str | None:
        if "departamento" in text:
            return "apartment"
        if "casa" in text:
            return "house"
        if " ph " in f" {text} " or " p.h" in text:
            return "ph"
        if "terreno" in text or "lote" in text:
            return "land"
        if "oficina" in text:
            return "office"
        if "local" in text:
            return "local"
        if "cochera" in text:
            return "garage"
        return None

    def detect_features(self, text: str) -> list[str]:
        matches: list[str] = []
        for feature, tokens in self.feature_terms.items():
            if any(token in text for token in tokens):
                matches.append(feature)
        return matches

    def extract_expenses(self, text: str) -> int | None:
        match = re.search(r"expensas[^0-9]*(\d[\d\.\,]*)", text, flags=re.IGNORECASE)
        return self.parse_number(match.group(1)) if match else None

    def extract_rooms(self, text: str) -> int | None:
        match = re.search(r"(\d+)\s+ambientes?", text, flags=re.IGNORECASE)
        return self.parse_number(match.group(1)) if match else None

    def extract_bathrooms(self, text: str) -> int | None:
        match = re.search(r"(\d+)\s+bañ?os?", text, flags=re.IGNORECASE)
        if match:
            return self.parse_number(match.group(1))
        normalized = self.normalize_search_text(text)
        fallback = re.search(r"(\d+)\s+banos?", normalized, flags=re.IGNORECASE)
        return self.parse_number(fallback.group(1)) if fallback else None

    def extract_area(self, text: str) -> int | None:
        match = re.search(r"(\d[\d\.\,]*)\s*m2", text, flags=re.IGNORECASE)
        return self.parse_number(match.group(1)) if match else None

    def extract_covered_area(self, text: str) -> int | None:
        match = re.search(
            r"cubiertos?[^0-9]*(\d[\d\.\,]*)\s*m2|(\d[\d\.\,]*)\s*m2[^a-zA-Z]*cubiertos?",
            text,
            flags=re.IGNORECASE,
        )
        if not match:
            return None
        return self.parse_number(match.group(1) or match.group(2))

    def extract_neighborhood(self, location_text: str | None, title: str) -> str | None:
        source = self.normalize_search_text(f"{location_text or ''} {title}")
        known = [
            "palermo",
            "caballito",
            "belgrano",
            "almagro",
            "recoleta",
            "villa crespo",
            "nunez",
            "colegiales",
            "puerto madero",
            "san telmo",
        ]
        match = next((candidate for candidate in known if candidate in source), None)
        if not match:
            return None
        if match == "nunez":
            return "Nuñez"
        return self.capitalize_words(match)

    def extract_city(self, location_text: str | None, title: str) -> str | None:
        source = self.normalize_search_text(f"{location_text or ''} {title}")
        if "capital federal" in source or "caba" in source or "ciudad de buenos aires" in source:
            return "CABA"
        if "buenos aires" in source:
            return "Buenos Aires"
        return None

    def normalize_currency(self, value: str | None) -> str | None:
        if not value:
            return None
        normalized = value.upper()
        if "USD" in normalized or "U$S" in normalized:
            return "USD"
        if "ARS" in normalized or "$" in normalized:
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
        return unescape(value).replace("\xa0", " ").replace("&nbsp;", " ").strip().replace("\n", " ").replace("\r", " ")

    def to_plain_text(self, value: str) -> str:
        plain = re.sub(r"<[^>]+>", " ", value)
        return re.sub(r"\s+", " ", unescape(plain)).strip()

    def normalize_search_text(self, value: str) -> str:
        plain = self.to_plain_text(value).lower()
        normalized = unicodedata.normalize("NFKD", plain)
        return "".join(char for char in normalized if not unicodedata.combining(char))

    def normalize_phone(self, value: str) -> str | None:
        cleaned = re.sub(r"[^\d+]", "", value or "")
        return cleaned or None

    def slugify(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        ascii_value = "".join(char for char in normalized if not unicodedata.combining(char))
        slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value.lower()).strip("-")
        return slug or "capital-federal"

    def capitalize_words(self, value: str) -> str:
        return " ".join(part[:1].upper() + part[1:] if part else part for part in value.split(" "))

    def clean_text(self, value: str) -> str:  # type: ignore[override]
        return shared_clean_text(value)

    def to_plain_text(self, value: str) -> str:  # type: ignore[override]
        return shared_to_plain_text(value)

    def normalize_search_text(self, value: str) -> str:  # type: ignore[override]
        return shared_normalize_search_text(value)

    def normalize_phone(self, value: str) -> str | None:  # type: ignore[override]
        return shared_normalize_phone(value)

    def slugify(self, value: str) -> str:  # type: ignore[override]
        return shared_slugify(value) or "capital-federal"

    def capitalize_words(self, value: str) -> str:  # type: ignore[override]
        return shared_capitalize_words(value)
