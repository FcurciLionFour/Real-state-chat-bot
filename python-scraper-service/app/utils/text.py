from __future__ import annotations

import re
import unicodedata
from html import unescape


MOJIBAKE_MARKERS = (
    "\u00c3\u0192",
    "\u00c3\u201a",
    "\u00c3",
    "\u00c2",
    "\u00c3\u00a2\u201a\u00ac\u201e\u00a2",
    "\u00c3\u00a2\u201a\u00ac\u00c5\u201c",
    "\u00c3\u00a2\u201a\u00ac",
    "\ufffd",
)


def clean_text(value: str) -> str:
    cleaned = unescape(value).replace("\xa0", " ").replace("&nbsp;", " ")
    cleaned = repair_mojibake(cleaned)
    cleaned = unicodedata.normalize("NFC", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def to_plain_text(value: str) -> str:
    without_blocks = re.sub(r"<(script|style)[^>]*>[\s\S]*?</\1>", " ", value, flags=re.IGNORECASE)
    without_tags = re.sub(r"<[^>]+>", " ", without_blocks)
    return clean_text(without_tags)


def normalize_search_text(value: str) -> str:
    plain = clean_text(value).lower()
    normalized = unicodedata.normalize("NFKD", plain)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_value).strip()


def normalize_phone(value: str) -> str | None:
    cleaned = re.sub(r"[^\d+]", "", clean_text(value))
    if not cleaned:
        return None
    normalized_digits = re.sub(r"\D", "", cleaned)
    if len(normalized_digits) < 8:
        return None
    return cleaned if cleaned.startswith("+") else normalized_digits


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", clean_text(value).lower())
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")


def capitalize_words(value: str) -> str:
    normalized = clean_text(value)
    return " ".join(part[:1].upper() + part[1:] if part else part for part in normalized.split(" "))


def repair_mojibake(value: str) -> str:
    current = value
    for _ in range(2):
        if not looks_like_mojibake(current):
            break
        repaired = choose_best_mojibake_candidate(current)
        if repaired == current:
            break
        current = repaired
    return current


def looks_like_mojibake(value: str) -> bool:
    return count_mojibake_markers(value) > 0


def count_mojibake_markers(value: str) -> int:
    return sum(value.count(marker) for marker in MOJIBAKE_MARKERS)


def choose_best_mojibake_candidate(value: str) -> str:
    candidates = [value]

    for encoding in ("latin-1", "cp1252"):
        try:
            candidates.append(value.encode(encoding).decode("utf-8"))
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue

    return min(dict.fromkeys(candidates), key=text_quality_score)


def text_quality_score(value: str) -> tuple[int, int, int]:
    marker_count = count_mojibake_markers(value)
    replacement_count = value.count("\ufffd")
    control_count = sum(
        1
        for char in value
        if unicodedata.category(char).startswith("C") and char not in ("\n", "\r", "\t")
    )
    return (marker_count + replacement_count, control_count, len(value))
