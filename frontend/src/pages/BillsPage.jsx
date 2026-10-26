import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BILL_TYPES, useApi } from "../api.js";
import BillTile from "../components/BillTile.jsx";

const PAGE_SIZE = 24;

export default function BillsPage() {
  // Keep filters in the URL so the back button and shared links work.
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const type = params.get("type") || "";
  const page = Number(params.get("page") || 0);
  const [draft, setDraft] = useState(q);

  const { data, error, loading } = useApi("/bills", {
    q,
    type,
    offset: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const update = (changes) => {
    const next = { q, type, page: 0, ...changes };
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  };

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0;

  return (
    <>
      <h1>Recent Bills</h1>
      <p className="muted">119th Congress, sorted by most recently updated.</p>

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: draft.trim() });
        }}
      >
        <input
          type="search"
          placeholder="Search bill titles…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <select value={type} onChange={(e) => update({ type: e.target.value })}>
          <option value="">All types</option>
          {Object.entries(BILL_TYPES).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>

      {data?.note && <p className="muted small">{data.note}</p>}
      {error && <p className="error">{error.message}</p>}
      {loading && <p className="muted">Loading…</p>}

      {data && !loading && (
        <>
          <p className="muted small">{data.count.toLocaleString()} results</p>
          <ul className="bill-grid">
            {data.bills.map((b) => (
              <li key={`${b.type}${b.number}`}>
                <BillTile bill={b} />
              </li>
            ))}
          </ul>
          {data.bills.length === 0 && <p className="muted">No bills match.</p>}

          {totalPages > 1 && (
            <div className="pager">
              <button disabled={page === 0} onClick={() => update({ page: page - 1 })}>← Prev</button>
              <span className="muted small">Page {page + 1} of {totalPages.toLocaleString()}</span>
              <button disabled={page + 1 >= totalPages} onClick={() => update({ page: page + 1 })}>Next →</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
