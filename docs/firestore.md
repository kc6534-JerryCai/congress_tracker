# Firestore data layout

Security rules live in [`firestore.rules`](../firestore.rules). Paste them into
Firebase console → Firestore → Rules, or run `firebase deploy --only firestore:rules`.

## `users/{uid}` — profile (Task 1)

Written by the frontend on sign-up and on each log-in.

| Field | Type | Notes |
|---|---|---|
| `displayName` | string | Name from the sign-up form or Google account |
| `email` | string | |
| `createdAt` | timestamp | Set once at sign-up |
| `lastLoginAt` | timestamp | Updated on every log-in |

Only the user can read or write it.

## `users/{uid}/follows/{followId}` — followed bills and members (Task 2)

Document id: `bill-{congress}-{type}-{number}` (e.g. `bill-119-hr-1234`) or
`member-{bioguideId}` (e.g. `member-K000389`). Using a fixed id means following
twice just overwrites, and unfollowing is a single delete.

| Field | Type | Notes |
|---|---|---|
| `kind` | `"bill"` \| `"member"` | |
| `billId` | string | Bills only: `119-hr-1234` |
| `bioguideId` | string | Members only |
| `label` | string | What to show on /tracking, e.g. `H.R. 1234` or `Rep. Ro Khanna` |
| `title` | string | Bill title or member name |
| `lastSeenUpdateDate` | string | Bill `updateDate` when followed / last checked |
| `lastSeenAction` | string | Bill `latestAction.text` when followed / last checked |
| `createdAt` | timestamp | |

The scheduled job compares `lastSeenUpdateDate` / `lastSeenAction` with the
Congress API. When they differ it writes a notification and updates both fields.
Only the user can read or write their follows.

## `users/{uid}/notifications/{id}` — update alerts (Task 2)

Created by the backend with the Firebase Admin SDK (clients cannot create them).

| Field | Type | Notes |
|---|---|---|
| `followId` | string | The follow that changed |
| `label` | string | e.g. `H.R. 1234` |
| `message` | string | e.g. the new latest action |
| `link` | string | e.g. `/bills/119/hr/1234` |
| `read` | boolean | Unread count = number with `read == false` |
| `createdAt` | timestamp | |

The user can read and delete them, and can change only `read`.

## `comments/{commentId}` — bill discussion (Task 4)

Auto-generated id. Query with
`where("billId", "==", "119-hr-1234"), orderBy("createdAt", "desc")`;
Firestore will ask for a composite index the first time (the error links to it).

| Field | Type | Notes |
|---|---|---|
| `billId` | string | `119-hr-1234` |
| `uid` | string | Must equal the author's auth uid |
| `displayName` | string | Copied at posting time so readers don't need the author's profile |
| `text` | string | 1–2000 characters |
| `createdAt` | timestamp | Must be `serverTimestamp()` |

Anyone can read. Signed-in users can create with their own `uid` and delete
their own comments; nobody can edit.
