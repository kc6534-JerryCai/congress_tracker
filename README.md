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
- Responses are cached in memory (no database yet).
- On Windows, `uvicorn --reload` sometimes misses backend changes; restart the backend if a change doesn't show up.

## Credits

- Data: [Congress.gov API](https://api.congress.gov/) (Library of Congress).
- Home page photo: "United States Capitol – west front", Architect of the Capitol, public domain, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:United_States_Capitol_-_west_front.jpg).
