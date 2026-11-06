import json
import time

import httpx

from app.security.signing import sign_headers


async def call_agent(site, method: str, endpoint: str, payload=None, timeout: float = 10.0):
    route = f"/iwebcreative/v1/{endpoint}"
    url = f"{site.url.rstrip('/')}/wp-json{route}"
    body = (
        json.dumps(payload, separators=(",", ":")).encode()
        if payload is not None
        else b""
    )
    headers = sign_headers(site.secret_token, method, route, body)
    if payload is not None:
        headers["Content-Type"] = "application/json"

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        return await client.request(
            method,
            url,
            headers=headers,
            content=body or None,
            params={"nocache": int(time.time())},
        )
