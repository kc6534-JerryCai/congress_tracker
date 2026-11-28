"""Run one pass of the tracking job. Schedule this command hourly."""

import asyncio
import logging
import os
import re
from collections import defaultdict

import firebase_admin
from firebase_admin import firestore_async
from google.api_core.exceptions import FailedPrecondition, NotFound
from google.auth.credentials import AnonymousCredentials
from google.cloud.firestore import AsyncClient, SERVER_TIMESTAMP

import congress_client as cc
from tracking_activity import Activity, bill_activity, member_activity

logger = logging.getLogger(__name__)
BILL_ID = re.compile(r"\d{1,3}-(?:hr|s|hjres|sjres|hres|sres|hconres|sconres)-[1-9]\d{0,8}", re.ASCII)
MEMBER_ID = re.compile(r"[A-Z]\d{6}", re.ASCII)


def follow_target(snapshot) -> tuple[str, str] | None:
    parts = snapshot.reference.path.split("/")
    if len(parts) != 4 or parts[0] != "users" or parts[2] != "follows":
        return None
    follow = snapshot.to_dict()
    kind = follow.get("kind")
    if kind not in ("bill", "member"):
        return None
    target_id = follow.get("billId" if kind == "bill" else "bioguideId")
    pattern = BILL_ID if kind == "bill" else MEMBER_ID
    if isinstance(target_id, str) and pattern.fullmatch(target_id) and snapshot.id == f"{kind}-{target_id}":
        return kind, target_id
    return None


async def get_activity(kind: str, target_id: str) -> tuple[Activity, str]:
    if kind == "bill":
        path = target_id.replace("-", "/")
        data = await cc.get(f"/bill/{path}", ttl=0)
        activity = bill_activity(data["bill"])
        if not (activity.update_date or activity.action):
            raise ValueError("Congress.gov returned a bill without activity fields")
        return activity, f"/bills/{path}"
    data = await cc.get(f"/member/{target_id}/sponsored-legislation", ttl=0, limit=20)
    return member_activity(data), f"/members/{target_id}"


async def record_activity(db: AsyncClient, original, activity: Activity, link: str) -> bool:
    ref = original.reference
    previous = original.to_dict()
    fields = activity.follow_fields()
    old_update = previous.get("lastSeenUpdateDate") or ""
    old_action_date = previous.get("lastSeenActionDate") or ""
    if old_update and activity.update_date and activity.update_date < old_update:
        return False
    if previous["kind"] == "member" and activity.action_date < old_action_date:
        return False
    if all((previous.get(key) or "") == value for key, value in fields.items()):
        return False

    # Older follow documents may lack the action date. Save it without alerting
    # when the existing bill update date and action text are already current.
    metadata_only = (
        previous["kind"] == "bill"
        and "lastSeenActionDate" not in previous
        and old_update == activity.update_date
        and (previous.get("lastSeenAction") or "") == activity.action
    )
    batch = db.batch()
    batch.update(ref, fields, option=db.write_option(last_update_time=original.update_time))
    if not metadata_only:
        notification = ref.parent.parent.collection("notifications").document()
        message = activity.action or "Congress.gov updated this bill."
        if previous["kind"] == "bill" and (previous.get("lastSeenAction") or "") == activity.action:
            if not old_action_date or old_action_date == activity.action_date:
                message = "Congress.gov updated the bill record."
        batch.create(notification, {
            "followId": ref.id,
            "label": previous.get("label") or ref.id,
            "message": message,
            "link": link,
            "read": False,
            "createdAt": SERVER_TIMESTAMP,
        })
    try:
        await batch.commit()
    except (FailedPrecondition, NotFound):
        # A competing job or a user unfollowing/re-following invalidated the snapshot.
        return False
    return not metadata_only


async def check_follows(db: AsyncClient) -> tuple[int, int]:
    grouped = defaultdict(list)
    async for snapshot in db.collection_group("follows").stream():
        target = follow_target(snapshot)
        if target:
            grouped[target].append(snapshot)

    # Share a single upstream lookup across users following the same target.
    slots = asyncio.Semaphore(8)

    async def check_target(target, follows):
        async with slots:
            try:
                activity, link = await get_activity(*target)
            except Exception as exc:
                # HTTP errors can include the Congress.gov API key in the URL.
                logger.error("Congress.gov lookup failed for %s (%s)", target, type(exc).__name__)
                return 0, 1

            alerts = failures = 0
            for snapshot in follows:
                try:
                    alerts += await record_activity(db, snapshot, activity, link)
                except Exception as exc:
                    logger.error("Firestore update failed for %s (%s)", target, type(exc).__name__)
                    failures += 1
            return alerts, failures

    results = await asyncio.gather(*(check_target(target, follows) for target, follows in grouped.items()))
    return sum(alerts for alerts, _ in results), sum(failures for _, failures in results)


async def main() -> int:
    project = os.getenv("FIREBASE_PROJECT_ID")
    if not project:
        raise SystemExit("FIREBASE_PROJECT_ID is required. See README.md.")
    if os.getenv("FIRESTORE_EMULATOR_HOST"):
        db = AsyncClient(project=project, credentials=AnonymousCredentials())
    else:
        app = firebase_admin.initialize_app(options={"projectId": project})
        db = firestore_async.client(app)
    alerts, failures = await check_follows(db)
    logger.info("Tracking check finished: %d notifications, %d failures", alerts, failures)
    return int(failures > 0)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    # The HTTP library logs the full request URL, including the API key, at INFO.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    raise SystemExit(asyncio.run(main()))
