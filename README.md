# Congress Tracker

FastAPI backend + React (Vite) frontend for browsing U.S. congressional bills and members via the [Congress.gov API](https://api.congress.gov/).

## Setup

1. Get a free API key at https://api.data.gov/signup, then copy `.env.example` to `.env` in the project root and fill it in:
   ```
   Congress_API=your_key_here
   ```
2. Backend:
   ```powershell
   conda activate congress_project
   pip install -r backend/requirements.txt
   cd backend
   uvicorn main:app --reload --port 8000
   ```
3. Frontend (in a second terminal):
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
4. Open http://localhost:5173. API docs are at http://localhost:8000/docs.

## Accounts (Firebase)

Log-in and sign-up use Firebase Authentication; user data lives in Firestore.
The data layout is in [docs/firestore.md](docs/firestore.md) and the security rules in [firestore.rules](firestore.rules).

1. In the [Firebase console](https://console.firebase.google.com), open the team project (or create one), then:
   - Authentication → Sign-in method: enable **Email/Password** (and **Google** if you want that button to work).
   - Firestore Database: create a database, then paste `firestore.rules` into the **Rules** tab and publish.
   - Project settings → Your apps → add a **Web app** and copy its config.
2. Copy `frontend/.env.example` to `frontend/.env.local` and fill in the `VITE_FIREBASE_*` values. Restart `npm run dev`.

Without `.env.local` the site still runs; the log-in page just says Firebase isn't set up.

### Testing against local emulators

Needs Java 11+ and the Firebase CLI (`npm install -g firebase-tools`).

```bash
firebase emulators:start --only auth,firestore --project demo-capitol-ledger   # repo root
cd frontend && npm run test:rules                                              # security-rule tests
```

To click through the site against the emulators instead of the real project, create
`frontend/.env.emulator.local` with `VITE_FIREBASE_API_KEY=demo-key`,
`VITE_FIREBASE_PROJECT_ID=demo-capitol-ledger`, `VITE_USE_FIREBASE_EMULATORS=true`,
then run `npx vite --mode emulator`. The emulator UI at http://127.0.0.1:4000 shows the users and data created.

## Tracking and notifications

Sign in and choose **Follow** on a bill or member page. **Tracking** shows the
followed items and their latest activity, plus notifications you can mark as
read. The header updates the unread count as notifications arrive or are read.
For a member, activity is the most recent legislative action among their 20
recently sponsored measures, with the introduction date used when a measure
has no latest action.

The notification worker is a separate, one-shot process. Set `Congress_API`
and `FIREBASE_PROJECT_ID` in the root `.env` or the job's environment. Use the
same Firebase project as the frontend. The worker uses Application Default
Credentials with Firestore read/write access (for example, a runtime service
account with the `roles/datastore.user` role). If your host requires a
service-account JSON file, mount it securely and set
`GOOGLE_APPLICATION_CREDENTIALS` to its absolute path.

Run one check from the repository root:

```bash
python backend/check_tracking.py
```

For hourly alerts, configure the same command as an hourly job on the backend
host. For example, use this crontab entry with paths adjusted for the host:

```cron
0 * * * * cd /path/to/congress_tracker && /path/to/venv/bin/python backend/check_tracking.py
```

The worker checks each distinct followed item once per run, writes in-app
notifications for changes, and advances the saved activity in the same
Firestore write batch. An unchanged item produces no notification. A failed
lookup leaves the previous activity in place for the next run.

To point a manual run at the local Firestore emulator (Congress.gov still
requires an API key):

```bash
FIREBASE_PROJECT_ID=demo-capitol-ledger FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 python backend/check_tracking.py
```

With that emulator running, the integration test simulates bill and member
changes without an API key:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 python -m unittest discover -s backend
```

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/bills?q=&type=&offset=&limit=` | Recent bills in the 119th Congress |
| `GET /api/bills/{congress}/{type}/{number}` | Bill overview and per-section counts |
| `GET /api/bills/{congress}/{type}/{number}/{section}` | One tab: `summary`, `text` (`?version=`), `actions`, `titles`, `amendments`, `cosponsors`, `committees`, `related` |
| `GET /api/members?q=&state=&party=&chamber=` | Current members |
| `GET /api/members/{bioguideId}` | Member profile and sponsored bills |

## Known limitations (prototype)

- The Congress API has no keyword search; `q` only filters the 250 most recently updated bills.
- Congress API responses are cached in memory; user accounts, follows, notifications, and comments are stored in Firestore.
- On Windows, `uvicorn --reload` sometimes misses backend changes; restart the backend if a change doesn't show up.

## Credits

- Data: [Congress.gov API](https://api.congress.gov/) (Library of Congress).
- Home page photo: "United States Capitol – west front", Architect of the Capitol, public domain, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:United_States_Capitol_-_west_front.jpg).
