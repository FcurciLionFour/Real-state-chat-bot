from __future__ import annotations

import hashlib
import re
import unicodedata

from app.contracts.search import ListingSourceEntry, PropertyListing


class ListingDedupeService:
    def dedupe_listings(self, listings: list[PropertyListing]) -> tuple[list[PropertyListing], int]:
        groups: list[list[PropertyListing]] = []

        for listing in listings:
            matched_group: list[PropertyListing] | None = None
            for group in groups:
                if any(self.listings_match(existing, listing) for existing in group):
                    matched_group = group
                    break

            if matched_group is None:
                groups.append([listing])
            else:
                matched_group.append(listing)

        deduped = [self.canonicalize_group(group) for group in groups]
        collapsed = max(0, len(listings) - len(deduped))
        return deduped, collapsed

    def canonicalize_group(self, group: list[PropertyListing]) -> PropertyListing:
        canonical = max(group, key=self.completeness_score)
        source_entries = self.build_source_entries(group)
        duplicate_group_id = self.build_duplicate_group_id(source_entries)

        return canonical.model_copy(
            update={
                "sourceEntries": source_entries,
                "duplicateGroupId": duplicate_group_id,
                "duplicateCount": len(source_entries),
            }
        )

    def listings_match(self, left: PropertyListing, right: PropertyListing) -> bool:
        if left.source == right.source:
            if left.externalId and right.externalId and left.externalId == right.externalId:
                return True
            if left.sourceUrl == right.sourceUrl:
                return True
            return False

        strong_signals = 0

        if self.same_location(left, right):
            strong_signals += 1
        if self.same_price(left, right):
            strong_signals += 1
        if self.same_area(left, right):
            strong_signals += 1
        if self.same_room_shape(left, right):
            strong_signals += 1
        if self.same_coordinates(left, right):
            strong_signals += 2

        return strong_signals >= 3

    def build_source_entries(self, group: list[PropertyListing]) -> list[ListingSourceEntry]:
        entries: list[ListingSourceEntry] = []
        seen: set[tuple[str, str, str | None]] = set()

        for listing in group:
            entry = ListingSourceEntry(
                source=listing.source,
                sourceUrl=listing.sourceUrl,
                externalId=listing.externalId,
            )
            key = (entry.source, entry.sourceUrl, entry.externalId)
            if key in seen:
                continue
            seen.add(key)
            entries.append(entry)

        entries.sort(key=lambda entry: (entry.source, entry.sourceUrl))
        return entries

    def build_duplicate_group_id(self, entries: list[ListingSourceEntry]) -> str:
        raw = "|".join(f"{entry.source}:{entry.externalId or ''}:{entry.sourceUrl}" for entry in entries)
        digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]
        return f"dup-{digest}"

    def completeness_score(self, listing: PropertyListing) -> int:
        scalar_fields = [
            listing.externalId,
            listing.publisher,
            listing.contactPhone,
            listing.contactWhatsApp,
            listing.description,
            listing.operation,
            listing.propertyType,
            listing.price,
            listing.currency,
            listing.expenses,
            listing.locationText,
            listing.city,
            listing.neighborhood,
            listing.rooms,
            listing.bedrooms,
            listing.bathrooms,
            listing.areaTotal,
            listing.areaCovered,
            listing.latitude,
            listing.longitude,
            listing.publishedAt,
        ]
        score = sum(1 for value in scalar_fields if value is not None)
        score += min(5, len(listing.images))
        score += min(5, len(listing.features))
        return score

    def same_location(self, left: PropertyListing, right: PropertyListing) -> bool:
        left_key = self.location_key(left)
        right_key = self.location_key(right)
        return bool(left_key and right_key and left_key == right_key)

    def same_price(self, left: PropertyListing, right: PropertyListing) -> bool:
        if left.price is None or right.price is None:
            return False
        if left.currency != right.currency:
            return False

        highest = max(left.price, right.price)
        diff = abs(left.price - right.price)
        return diff <= max(3000, int(highest * 0.05))

    def same_area(self, left: PropertyListing, right: PropertyListing) -> bool:
        left_area = left.areaCovered or left.areaTotal
        right_area = right.areaCovered or right.areaTotal
        if left_area is None or right_area is None:
            return False
        diff = abs(left_area - right_area)
        return diff <= max(5, int(max(left_area, right_area) * 0.12))

    def same_room_shape(self, left: PropertyListing, right: PropertyListing) -> bool:
        if left.propertyType and right.propertyType and left.propertyType != right.propertyType:
            return False
        comparable = 0
        matched = 0
        for left_value, right_value in [
            (left.rooms, right.rooms),
            (left.bedrooms, right.bedrooms),
            (left.bathrooms, right.bathrooms),
        ]:
            if left_value is not None and right_value is not None:
                comparable += 1
                if left_value == right_value:
                    matched += 1
        return comparable > 0 and matched == comparable

    def same_coordinates(self, left: PropertyListing, right: PropertyListing) -> bool:
        if None in {left.latitude, left.longitude, right.latitude, right.longitude}:
            return False

        assert left.latitude is not None
        assert left.longitude is not None
        assert right.latitude is not None
        assert right.longitude is not None

        return (
            abs(left.latitude - right.latitude) <= 0.0012
            and abs(left.longitude - right.longitude) <= 0.0012
        )

    def location_key(self, listing: PropertyListing) -> str | None:
        location_text = listing.locationText or ""
        normalized = self.normalize_text(location_text)
        normalized = normalized.replace("capital federal", "").replace("caba", "").replace("argentina", "")
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized or None

    def normalize_text(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value.strip().lower())
        normalized = normalized.encode("ascii", "ignore").decode("ascii")
        normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
        return normalized.strip()
