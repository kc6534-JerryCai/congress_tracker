"""Congress.gov activity shared by member profiles and the tracking job."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Activity:
    update_date: str = ""
    action: str = ""
    action_date: str = ""
    activity_id: str = ""

    def follow_fields(self) -> dict:
        return {
            "lastSeenUpdateDate": self.update_date,
            "lastSeenAction": self.action,
            "lastSeenActionDate": self.action_date,
            "lastSeenActivityId": self.activity_id,
        }


def bill_activity(bill: dict) -> Activity:
    action = bill.get("latestAction") or {}
    return Activity(
        update_date=bill.get("updateDate") or "",
        action=action.get("text") or "",
        action_date=action.get("actionDate") or "",
    )


def member_activity(sponsored: dict) -> Activity:
    """Find the most recent action among the member's recently sponsored bills."""
    activities = []
    for measure in sponsored.get("sponsoredLegislation") or []:
        if not all(measure.get(key) for key in ("type", "number", "congress")):
            continue  # The endpoint can also include amendments.
        bill_type = measure["type"].lower()
        number = measure["number"]
        congress = measure["congress"]
        introduced = measure.get("introducedDate") or ""
        latest = measure.get("latestAction") or {}
        activity_date = latest.get("actionDate") or introduced
        if not activity_date:
            continue
        activity = Activity(
            action=f"{bill_type.upper()} {number} · {latest.get('text') or 'Introduced'}",
            action_date=activity_date,
            activity_id=f"{congress}-{bill_type}-{number}",
        )
        activities.append(((activity_date, introduced, int(congress), bill_type, int(number)), activity))
    return max(activities, key=lambda item: item[0])[1] if activities else Activity()
