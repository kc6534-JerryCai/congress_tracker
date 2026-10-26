import asyncio

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import congress_client as cc

app = FastAPI(title="Congress Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(httpx.HTTPStatusError)
async def upstream_error(_, exc: httpx.HTTPStatusError):
    return JSONResponse(
        status_code=exc.response.status_code,
        content={"detail": f"Congress API error: {exc.response.status_code}"},
    )


# URL slugs congress.gov uses for each bill type.
CONGRESS_GOV_SLUGS = {
    "hr": "house-bill", "s": "senate-bill",
    "hres": "house-resolution", "sres": "senate-resolution",
    "hjres": "house-joint-resolution", "sjres": "senate-joint-resolution",
    "hconres": "house-concurrent-resolution", "sconres": "senate-concurrent-resolution",
}


def _bill_summary(b: dict) -> dict:
    return {
        "congress": b.get("congress"),
        "type": (b.get("type") or "").lower(),
        "number": b.get("number"),
        "title": b.get("title"),
        "introducedDate": b.get("introducedDate"),
        "updateDate": b.get("updateDate"),
        "originChamber": b.get("originChamber"),
        "latestAction": b.get("latestAction"),
    }


# ---------- Bills ----------

@app.get("/api/bills")
async def list_bills(
    q: str | None = None,
    type: str | None = Query(None, description="hr, s, hjres, sjres, hres, sres, hconres, sconres"),
    offset: int = 0,
    limit: int = Query(20, le=100),
):
    path = f"/bill/{cc.CURRENT_CONGRESS}" + (f"/{type.lower()}" if type else "")

    if not q:
        data = await cc.get(path, offset=offset, limit=limit, sort="updateDate desc")
        return {
            "count": data["pagination"]["count"],
            "bills": await _with_sponsors([_bill_summary(b) for b in data["bills"]]),
        }

    # The Congress API has no keyword search, so filter titles of the 250 most recently updated bills.
    data = await cc.get(path, limit=250, sort="updateDate desc")
    words = q.lower().split()
    matches = [b for b in data["bills"] if all(w in (b.get("title") or "").lower() for w in words)]
    return {
        "count": len(matches),
        "bills": await _with_sponsors([_bill_summary(b) for b in matches[offset : offset + limit]]),
        "note": "Keyword search covers the 250 most recently updated bills.",
    }


async def _with_sponsors(bills: list[dict]) -> list[dict]:
    """Attach each bill's sponsor (name, party, photo). The list endpoint omits sponsors, so this
    fetches each bill's detail (cached) and matches photos from the current-member roster."""
    details, members = await asyncio.gather(
        asyncio.gather(
            *(cc.get(f"/bill/{b['congress']}/{b['type']}/{b['number']}") for b in bills),
            return_exceptions=True,
        ),
        _all_current_members(),
    )
    photos = {m["bioguideId"]: (m.get("depiction") or {}).get("imageUrl") for m in members}

    for bill, detail in zip(bills, details):
        sponsors = [] if isinstance(detail, Exception) else detail["bill"].get("sponsors", [])
        s = sponsors[0] if sponsors else None
        bill["sponsor"] = s and {
            "bioguideId": s.get("bioguideId"),
            "name": s.get("fullName"),
            "party": s.get("party"),
            "imageUrl": photos.get(s.get("bioguideId")),
        }
    return bills


def _congress_gov_url(congress: int, bill_type: str, number) -> str:
    slug = CONGRESS_GOV_SLUGS.get(bill_type.lower(), "house-bill")
    return f"https://www.congress.gov/bill/{congress}th-congress/{slug}/{number}"


# Tab name -> key in the bill detail response that holds its {"count": n}.
BILL_SECTIONS = {
    "summary": "summaries",
    "text": "textVersions",
    "actions": "actions",
    "titles": "titles",
    "amendments": "amendments",
    "cosponsors": "cosponsors",
    "committees": "committees",
    "related": "relatedBills",
}


@app.get("/api/bills/{congress}/{bill_type}/{number}")
async def bill_detail(congress: int, bill_type: str, number: str):
    detail, members = await asyncio.gather(
        cc.get(f"/bill/{congress}/{bill_type.lower()}/{number}"), _all_current_members()
    )
    bill = detail["bill"]
    photos = {m["bioguideId"]: (m.get("depiction") or {}).get("imageUrl") for m in members}
    return {
        **_bill_summary(bill),
        "policyArea": (bill.get("policyArea") or {}).get("name"),
        "sponsors": [{**s, "imageUrl": photos.get(s.get("bioguideId"))} for s in bill.get("sponsors", [])],
        "counts": {tab: (bill.get(key) or {}).get("count", 0) for tab, key in BILL_SECTIONS.items()},
        "congressGovUrl": _congress_gov_url(congress, bill_type, number),
    }


AMENDMENT_SLUGS = {"SAMDT": "senate-amendment", "HAMDT": "house-amendment", "SUAMDT": "senate-amendment"}


@app.get("/api/bills/{congress}/{bill_type}/{number}/{section}")
async def bill_section(congress: int, bill_type: str, number: str, section: str, version: int = 0):
    path = f"/bill/{congress}/{bill_type.lower()}/{number}"

    if section == "summary":
        items = (await cc.get(path + "/summaries", limit=250)).get("summaries", [])
        # Oldest first from the API; show newest first.
        items = [
            {"version": s.get("actionDesc"), "date": s.get("actionDate"), "html": s.get("text")}
            for s in reversed(items)
        ]
        return {"count": len(items), "items": items}

    if section == "text":
        versions = (await cc.get(path + "/text")).get("textVersions", [])
        items = [
            {
                "type": v.get("type"),
                "date": (v.get("date") or "")[:10] or None,
                "formats": {f["type"]: f["url"] for f in v.get("formats", [])},
            }
            for v in versions
        ]
        content = None
        if items and 0 <= version < len(items) and "Formatted Text" in items[version]["formats"]:
            content = await cc.get_bill_text(items[version]["formats"]["Formatted Text"])
        return {"count": len(items), "items": items, "version": version, "content": content}

    if section == "actions":
        raw = (await cc.get(path + "/actions", limit=250)).get("actions", [])
        # The House/Senate and the Library of Congress often record the same action twice.
        seen, items = set(), []
        for a in raw:
            key = (a.get("actionDate"), a.get("text"))
            if key in seen:
                continue
            seen.add(key)
            items.append({
                "date": a.get("actionDate"),
                "text": a.get("text"),
                "chamber": (a.get("sourceSystem") or {}).get("name"),
            })
        return {"count": len(items), "items": items}

    if section == "titles":
        items = [
            {"title": t.get("title"), "type": t.get("titleType"), "version": t.get("billTextVersionName")}
            for t in (await cc.get(path + "/titles", limit=250)).get("titles", [])
        ]
        return {"count": len(items), "items": items}

    if section == "amendments":
        data = await cc.get(path + "/amendments", limit=250)
        items = [
            {
                "label": f"{'S.Amdt.' if a.get('type', '').startswith('S') else 'H.Amdt.'} {a.get('number')}",
                "updateDate": (a.get("updateDate") or "")[:10],
                "url": f"https://www.congress.gov/amendment/{congress}th-congress/"
                f"{AMENDMENT_SLUGS.get(a.get('type'), 'house-amendment')}/{a.get('number')}",
            }
            for a in data.get("amendments", [])
        ]
        return {"count": data.get("pagination", {}).get("count", len(items)), "items": items}

    if section == "cosponsors":
        data = await cc.get(path + "/cosponsors", limit=250)
        items = [
            {
                "bioguideId": c.get("bioguideId"),
                "name": c.get("fullName"),
                "date": c.get("sponsorshipDate"),
                "original": c.get("isOriginalCosponsor"),
                "withdrawn": c.get("sponsorshipWithdrawnDate"),
            }
            for c in data.get("cosponsors", [])
        ]
        return {"count": data.get("pagination", {}).get("count", len(items)), "items": items}

    if section == "committees":
        def activities(c):
            return [{"name": a.get("name"), "date": (a.get("date") or "")[:10]} for a in c.get("activities", [])]

        items = [
            {
                "name": c.get("name"),
                "chamber": c.get("chamber"),
                "activities": activities(c),
                "subcommittees": [
                    {"name": s.get("name"), "activities": activities(s)} for s in c.get("subcommittees", [])
                ],
            }
            for c in (await cc.get(path + "/committees")).get("committees", [])
        ]
        return {"count": len(items), "items": items}

    if section == "related":
        items = [
            {
                **_bill_summary(r),
                "relationship": ", ".join(
                    d.get("type", "") for d in r.get("relationshipDetails", []) if d.get("type")
                ),
            }
            for r in (await cc.get(path + "/relatedbills", limit=250)).get("relatedBills", [])
        ]
        return {"count": len(items), "items": items}

    raise HTTPException(404, f"Unknown section '{section}'")


# ---------- Members ----------

async def _all_current_members() -> list[dict]:
    first = await cc.get("/member", ttl=3600, currentMember="true", limit=250)
    members = list(first["members"])
    total = first["pagination"]["count"]
    rest = await asyncio.gather(
        *(cc.get("/member", ttl=3600, currentMember="true", limit=250, offset=o) for o in range(250, total, 250))
    )
    for page in rest:
        members.extend(page["members"])
    return members


def _member_summary(m: dict) -> dict:
    terms = (m.get("terms") or {}).get("item", [])
    chamber = terms[-1]["chamber"] if terms else None
    return {
        "bioguideId": m["bioguideId"],
        "name": m.get("name"),
        "party": m.get("partyName"),
        "state": m.get("state"),
        "district": m.get("district"),
        "chamber": "Senate" if chamber == "Senate" else "House",
        "imageUrl": (m.get("depiction") or {}).get("imageUrl"),
    }


@app.get("/api/members")
async def list_members(
    q: str | None = None,
    state: str | None = None,
    party: str | None = None,
    chamber: str | None = Query(None, description="House or Senate"),
):
    members = [_member_summary(m) for m in await _all_current_members()]
    if q:
        members = [m for m in members if q.lower() in (m["name"] or "").lower()]
    if state:
        members = [m for m in members if m["state"] == state]
    if party:
        members = [m for m in members if m["party"] == party]
    if chamber:
        members = [m for m in members if m["chamber"] == chamber]
    members.sort(key=lambda m: m["name"] or "")
    return {"count": len(members), "members": members}


@app.get("/api/members/{bioguide_id}")
async def member_detail(bioguide_id: str):
    try:
        detail, sponsored = await asyncio.gather(
            cc.get(f"/member/{bioguide_id}"),
            cc.get(f"/member/{bioguide_id}/sponsored-legislation", limit=20),
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(404, "Member not found")
        raise
    m = detail["member"]
    terms = m.get("terms", [])
    return {
        "bioguideId": m["bioguideId"],
        "name": m.get("directOrderName"),
        "party": (m.get("partyHistory") or [{}])[-1].get("partyName"),
        "state": m.get("state"),
        "district": m.get("district"),
        "birthYear": m.get("birthYear"),
        "imageUrl": (m.get("depiction") or {}).get("imageUrl"),
        "website": m.get("officialWebsiteUrl"),
        "terms": [
            {"chamber": t.get("chamber"), "congress": t.get("congress"),
             "startYear": t.get("startYear"), "endYear": t.get("endYear")}
            for t in terms
        ],
        "sponsoredCount": (m.get("sponsoredLegislation") or {}).get("count", 0),
        "cosponsoredCount": (m.get("cosponsoredLegislation") or {}).get("count", 0),
        # Amendments show up here without a bill type/title; keep only bills.
        "sponsoredBills": [
            _bill_summary(b) for b in sponsored.get("sponsoredLegislation", []) if b.get("type")
        ],
    }


@app.get("/api/health")
async def health():
    return {"ok": True}
