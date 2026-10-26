import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../api.js";

const STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "American Samoa",
  "District of Columbia", "Guam", "Northern Mariana Islands", "Puerto Rico", "Virgin Islands",
];

const partyClass = (p) => (p === "Democratic" ? "dem" : p === "Republican" ? "rep" : "ind");

export default function MembersPage() {
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get("q") || "",
    state: params.get("state") || "",
    party: params.get("party") || "",
    chamber: params.get("chamber") || "",
  };
  const { data, error, loading } = useApi("/members", filters);

  const update = (k, v) => {
    const next = { ...filters, [k]: v };
    setParams(Object.fromEntries(Object.entries(next).filter(([, val]) => val)));
  };

  return (
    <>
      <h1>Members of Congress</h1>
      <div className="filters">
        <input
          type="search"
          placeholder="Search by name…"
          value={filters.q}
          onChange={(e) => update("q", e.target.value)}
        />
        <select value={filters.chamber} onChange={(e) => update("chamber", e.target.value)}>
          <option value="">Both chambers</option>
          <option>House</option>
          <option>Senate</option>
        </select>
        <select value={filters.party} onChange={(e) => update("party", e.target.value)}>
          <option value="">All parties</option>
          <option>Democratic</option>
          <option>Republican</option>
          <option>Independent</option>
        </select>
        <select value={filters.state} onChange={(e) => update("state", e.target.value)}>
          <option value="">All states</option>
          {STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {error && <p className="error">{error.message}</p>}
      {loading && !data && <p className="muted">Loading members…</p>}

      {data && (
        <>
          <p className="muted small">{data.count} members</p>
          <ul className="member-grid">
            {data.members.map((m) => (
              <li key={m.bioguideId}>
                <Link to={`/members/${m.bioguideId}`} className="member-card">
                  {m.imageUrl ? <img src={m.imageUrl} alt="" loading="lazy" /> : <div className="avatar" />}
                  <div>
                    <strong>{m.name}</strong>
                    <div className="small">
                      <span className={`party ${partyClass(m.party)}`}>{m.party}</span>
                    </div>
                    <div className="muted small">
                      {m.chamber} · {m.state}{m.district ? `-${m.district}` : ""}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
