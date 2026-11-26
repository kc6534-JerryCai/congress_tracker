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
- Congress API responses are cached in memory; only user data (accounts, follows, comments) is stored in Firestore.
- On Windows, `uvicorn --reload` sometimes misses backend changes; restart the backend if a change doesn't show up.

## Credits

- Data: [Congress.gov API](https://api.congress.gov/) (Library of Congress).
- Home page photo: "United States Capitol – west front", Architect of the Capitol, public domain, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:United_States_Capitol_-_west_front.jpg).
