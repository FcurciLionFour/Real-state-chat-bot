from __future__ import annotations

from secrets import compare_digest

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings


def require_internal_token(
    x_internal_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    expected_token = (settings.internal_token or "").strip()

    if not expected_token:
        return

    if not x_internal_token or not compare_digest(x_internal_token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid internal token",
        )
