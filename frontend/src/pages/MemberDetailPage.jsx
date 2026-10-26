import { Link, useParams } from "react-router-dom";
import { billLabel, useApi } from "../api.js";

export default function MemberDetailPage() {
  const { bioguideId } = useParams();
  const { data: m, error, loading } = useApi(`/members/${bioguideId}`);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error.message}</p>;

  const current = m.terms[m.terms.length - 1];

  return (
    <>
      <Link to="/members" className="back">← Back to members</Link>
      <div className="profile">
        {m.imageUrl && <img src={m.imageUrl} alt={m.name} />}
        <div>
          <h1>{m.name}</h1>
          <p>
            {m.party} · {m.state}
            {m.district ? `, District ${m.district}` : ""}
            {current ? ` · ${current.chamber}` : ""}
          </p>
          {m.website && (
            <a href={m.website} target="_blank" rel="noreferrer">Official website ↗</a>
          )}
        </div>
      </div>

      <dl className="facts">
        <div><dt>Sponsored</dt><dd>{m.sponsoredCount}</dd></div>
        <div><dt>Cosponsored</dt><dd>{m.cosponsoredCount}</dd></div>
        <div><dt>Born</dt><dd>{m.birthYear || "—"}</dd></div>
        <div><dt>Terms</dt><dd>{m.terms.length}</dd></div>
      </dl>

      <section>
        <h2>Recently sponsored bills</h2>
        {m.sponsoredBills.length === 0 && <p className="muted">No sponsored bills.</p>}
        <ul className="card-list">
          {m.sponsoredBills.map((b) => (
            <li key={`${b.congress}${b.type}${b.number}`} className="card">
              <Link to={`/bills/${b.congress}/${b.type}/${b.number}`} className="card-link">
                <div className="card-head">
                  <span className="badge">{billLabel(b)}</span>
                  <span className="muted small">{b.congress}th · Introduced {b.introducedDate}</span>
                </div>
                <h3>{b.title}</h3>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
