"""Run with the local Firestore emulator. Congress.gov responses are mocked."""

import asyncio
import os
import unittest
from collections import Counter
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from google.auth.credentials import AnonymousCredentials
from google.cloud.firestore import AsyncClient

os.environ.setdefault("Congress_API", "tracking-test-key")

from check_tracking import check_follows
from tracking_activity import Activity


@unittest.skipUnless(os.getenv("FIRESTORE_EMULATOR_HOST"), "requires the Firestore emulator")
class TrackingTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = AsyncClient(project="demo-capitol-ledger", credentials=AnonymousCredentials())
        suffix = uuid4().hex[:12]
        self.users = [self.db.collection("users").document(f"{name}-{suffix}") for name in ("alice", "bob")]
        for user in self.users:
            await user.set({"displayName": user.id})

    async def asyncTearDown(self):
        for user in self.users:
            await self.db.recursive_delete(user)

    async def test_changed_activity_notifies_once_per_user(self):
        old = Activity(update_date="2026-11-20T14:00:00Z", action="Introduced")
        original = Activity(action="HR 2 · Introduced", action_date="2026-11-20", activity_id="119-hr-2")
        for user in self.users:
            await user.collection("follows").document("bill-119-hr-1").set({
                "kind": "bill", "billId": "119-hr-1", "label": "H.R. 1", **old.follow_fields(),
            })
        member = self.users[0].collection("follows").document("member-K000389")
        await member.set({
            "kind": "member", "bioguideId": "K000389", "label": "Rep. Ro Khanna", **original.follow_fields(),
        })
        congress = {
            "/bill/119/hr/1": {"bill": {
                "updateDate": "2026-11-21T14:00:00Z",
                "latestAction": {"text": "Passed House", "actionDate": "2026-11-21"},
            }},
            "/member/K000389/sponsored-legislation": {"sponsoredLegislation": [{
                "type": "HR", "number": "3", "congress": 119, "introducedDate": "2026-11-22",
            }]},
        }

        async def lookup(path, **_):
            return congress[path]

        with patch("check_tracking.cc.get", AsyncMock(side_effect=lookup)) as get:
            # Start overlapping runs. Firestore must commit one notification per follow.
            runs = await asyncio.gather(check_follows(self.db), check_follows(self.db))
            self.assertEqual(sum(count for count, _ in runs), 3)
            self.assertEqual(sum(errors for _, errors in runs), 0)
            self.assertEqual(await check_follows(self.db), (0, 0))
            self.assertEqual(Counter(call.args[0] for call in get.await_args_list), Counter({
                "/bill/119/hr/1": 3, "/member/K000389/sponsored-legislation": 3,
            }))

        for user, expected in zip(self.users, (2, 1)):
            notifications = await user.collection("notifications").get()
            self.assertEqual(len(notifications), expected)
            self.assertTrue(all(n.get("read") is False for n in notifications))
            bill_alert = next(n for n in notifications if n.get("followId") == "bill-119-hr-1")
            self.assertEqual(bill_alert.get("message"), "Passed House")
            self.assertEqual(bill_alert.get("link"), "/bills/119/hr/1")
            bill = await user.collection("follows").document("bill-119-hr-1").get()
            self.assertEqual(bill.get("lastSeenAction"), "Passed House")
        self.assertEqual((await member.get()).get("lastSeenActivityId"), "119-hr-3")
