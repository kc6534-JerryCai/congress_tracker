"""Thin async wrapper around the Congress.gov v3 API with a small in-memory TTL cache."""
import html
import os
import re
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_KEY = os.getenv("Congress_API")
BASE_URL = "https://api.congress.gov/v3"
CURRENT_CONGRESS = 119

if not API_KEY:
    raise RuntimeError("Congress_API is missing from .env")

_client = httpx.AsyncClient(base_url=BASE_URL, timeout=30)
_cache: dict[tuple, tuple[float, dict]] = {}


async def get(path: str, ttl: int = 600, **params) -> dict:
    """GET a Congress API path, caching the JSON response for `ttl` seconds."""
    key = (path, tuple(sorted(params.items())))
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]

    resp = await _client.get(path, params={"api_key": API_KEY, "format": "json", **params})
    resp.raise_for_status()
    data = resp.json()
    _cache[key] = (time.time(), data)
    return data


MAX_TEXT_CHARS = 400_000


async def get_bill_text(url: str) -> dict:
    """Fetch a bill's 'Formatted Text' page (plain text wrapped in <pre>) and return it as plain text."""
    key = ("text", url)
    hit = _cache.get(key)
    if hit:
        return hit[1]

    if not url.startswith(("https://www.congress.gov/", "https://www.govinfo.gov/")):
        raise ValueError(f"Unexpected bill text URL: {url}")
    resp = await _client.get(url, follow_redirects=True)
    resp.raise_for_status()
    match = re.search(r"<pre>(.*?)</pre>", resp.text, re.S)
    text = html.unescape(match.group(1) if match else resp.text)
    # Drop the GPO header block that precedes the bill itself.
    text = text.split("<DOC>", 1)[-1].strip()

    # Some bills (e.g. omnibus packages) run to millions of characters; send the start and link the rest.
    result = {"text": text[:MAX_TEXT_CHARS], "truncated": len(text) > MAX_TEXT_CHARS}
    _cache[key] = (time.time(), result)
    return result
