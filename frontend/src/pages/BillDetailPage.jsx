import { Link, useParams, useSearchParams } from "react-router-dom";
import { billLabel, formatDate, splitMemberName, useApi } from "../api.js";

const CHAMBER_NOUN = { hr: "House bill", s: "Senate bill", hres: "House resolution", sres: "Senate resolution" };

const TABS = [
  ["summary", "Summary"],
  ["text", "Text"],
  ["actions", "Actions"],
  ["titles", "Titles"],
  ["amendments", "Amendments"],
  ["cosponsors", "Cosponsors"],
  ["committees", "Committees"],
  ["related", "Related Bills"],
];

/** Open on the summary if there is one, otherwise the bill text, otherwise actions. */
const defaultTab = (counts) => (counts.summary ? "summary" : counts.text ? "text" : "actions");

export default function BillDetailPage() {
  const { congress, type, number } = useParams();
  const [params, setParams] = useSearchParams();
  const base = `/bills/${congress}/${type}/${number}`;
  const { data: bill, error, loading } = useApi(base);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error.message}</p>;

  const tab = params.get("tab") || defaultTab(bill.counts);
  const sponsor = bill.sponsors[0];
  const sponsorName = sponsor && splitMemberName(sponsor.fullName);
  const cosponsors = bill.counts.cosponsors;

  return (
    <article className="bill-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/bills">Bills</Link>
        <span aria-hidden="true">/</span>
        <span>{billLabel(bill)}</span>
      </nav>

      <header className="bill-head">
        <p className="eyebrow">
          {billLabel(bill)} · {bill.congress}th Congress ·{" "}
          {CHAMBER_NOUN[bill.type] || `${bill.originChamber} measure`}
        </p>
        <h1 className="bill-title">{bill.title}</h1>

        {sponsor && (
          <div className="byline">
            {sponsor.imageUrl && <img src={sponsor.imageUrl} alt="" />}
            <div>
              <p>
                Sponsored by{" "}
                <Link to={`/members/${sponsor.bioguideId}`}>{sponsorName.name}</Link>
                {sponsorName.tag && <span className="muted"> ({sponsorName.tag})</span>}
              </p>
              <p className="muted">
                Introduced {formatDate(bill.introducedDate)}
                {cosponsors > 0 && ` · ${cosponsors} cosponsor${cosponsors === 1 ? "" : "s"}`}
                {bill.policyArea && ` · ${bill.policyArea}`}
              </p>
            </div>
          </div>
        )}

        {bill.latestAction && (
          <blockquote className="latest-action">
            <span className="latest-action-label">
              Latest action, {formatDate(bill.latestAction.actionDate, "short")}
            </span>
            {bill.latestAction.text}
          </blockquote>
        )}
      </header>

      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`tab${tab === key ? " active" : ""}${bill.counts[key] ? "" : " empty"}`}
            onClick={() => setParams({ tab: key }, { replace: true })}
          >
            {label} <span className="tab-count">{bill.counts[key].toLocaleString()}</span>
          </button>
        ))}
      </div>

      <div className="tab-panel" role="tabpanel">
        <SectionPanel key={tab} base={base} tab={tab} bill={bill} onSwitch={(t) => setParams({ tab: t }, { replace: true })} />
      </div>

      <p className="source-note">
        Source: Congress.gov.{" "}
        <a href={bill.congressGovUrl} target="_blank" rel="noreferrer">View this bill on Congress.gov</a>
      </p>
    </article>
  );
}

function SectionPanel({ base, tab, bill, onSwitch }) {
  const [params, setParams] = useSearchParams();
  const version = Number(params.get("version") || 0);
  const { data, error, loading } = useApi(`${base}/${tab}`, tab === "text" ? { version } : {});

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error.message}</p>;

  const label = TABS.find(([k]) => k === tab)[1];
  const empty = (msg) => <p className="muted">{msg || `No ${label.toLowerCase()} for this bill.`}</p>;

  switch (tab) {
    case "summary":
      if (!data.items.length)
        return (
          <div>
            {empty("No summary yet. The Congressional Research Service usually publishes summaries several weeks after a bill is introduced, and some bills never get one.")}
            {bill.counts.text > 0 && <button className="link-btn" onClick={() => onSwitch("text")}>Read the bill text →</button>}
          </div>
        );
      return data.items.map((s, i) => (
        <article key={i} className="summary-version">
          <h3>{s.version} <span className="muted small">{formatDate(s.date)}</span></h3>
          {/* Summaries are HTML written by the Congressional Research Service. */}
          <div className="summary" dangerouslySetInnerHTML={{ __html: s.html }} />
        </article>
      ));

    case "text": {
      if (!data.items.length) return empty("The bill text hasn't been published yet.");
      const v = data.items[data.version] || data.items[0];
      return (
        <>
          <div className="text-toolbar">
            {data.items.length > 1 ? (
              <select
                value={data.version}
                onChange={(e) => setParams({ tab: "text", version: e.target.value }, { replace: true })}
              >
                {data.items.map((it, i) => (
                  <option key={i} value={i}>{it.type} ({it.date})</option>
                ))}
              </select>
            ) : (
              <strong>{v.type} <span className="muted small">{formatDate(v.date)}</span></strong>
            )}
            <span className="muted small">
              {Object.entries(v.formats).map(([fmt, url]) => (
                <a key={fmt} href={url} target="_blank" rel="noreferrer" className="format-link">{fmt}</a>
              ))}
            </span>
          </div>
          {data.content ? (
            <>
              {data.content.truncated && (
                <p className="muted small">
                  This bill is very long, so only the beginning is shown. Open the PDF or Formatted Text link for the full text.
                </p>
              )}
              <pre className="bill-text">{data.content.text}</pre>
            </>
          ) : (
            empty("No plain-text version is available. Use the links above.")
          )}
        </>
      );
    }

    case "actions":
      if (!data.items.length) return empty();
      return (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Action</th><th>Recorded by</th></tr></thead>
          <tbody>
            {data.items.map((a, i) => (
              <tr key={i}><td className="nowrap muted">{formatDate(a.date, "short")}</td><td>{a.text}</td><td className="muted">{a.chamber}</td></tr>
            ))}
          </tbody>
        </table>
      );

    case "titles":
      if (!data.items.length) return empty();
      return (
        <table className="data-table">
          <thead><tr><th>Type</th><th>Title</th></tr></thead>
          <tbody>
            {data.items.map((t, i) => (
              <tr key={i}>
                <td className="muted">{t.type}{t.version ? ` — ${t.version}` : ""}</td>
                <td>{t.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "amendments":
      if (!data.items.length) return empty();
      return (
        <>
          {data.count > data.items.length && (
            <p className="muted small">Showing {data.items.length} of {data.count.toLocaleString()} amendments.</p>
          )}
          <table className="data-table">
            <thead><tr><th>Amendment</th><th>Last updated</th></tr></thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.label}>
                  <td><a href={a.url} target="_blank" rel="noreferrer">{a.label} ↗</a></td>
                  <td className="muted">{formatDate(a.updateDate, "short")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );

    case "cosponsors":
      if (!data.items.length) return empty();
      return (
        <table className="data-table">
          <thead><tr><th>Cosponsor</th><th>Date cosponsored</th></tr></thead>
          <tbody>
            {data.items.map((c) => {
              const n = splitMemberName(c.name);
              return (
                <tr key={c.bioguideId} className={c.withdrawn ? "withdrawn" : ""}>
                  <td>
                    <Link to={`/members/${c.bioguideId}`}>{n.name}</Link>
                    {n.tag && <span className="muted"> ({n.tag})</span>}
                    {c.original && <span className="tag">original cosponsor</span>}
                    {c.withdrawn && <span className="tag">withdrew {formatDate(c.withdrawn, "short")}</span>}
                  </td>
                  <td className="nowrap muted">{formatDate(c.date, "short")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );

    case "committees":
      if (!data.items.length) return empty();
      return (
        <table className="data-table">
          <thead><tr><th>Committee / Subcommittee</th><th>Activity</th><th>Date</th></tr></thead>
          <tbody>
            {data.items.flatMap((c) => [
              ...c.activities.map((a, i) => (
                <tr key={`${c.name}-${i}`}>
                  <td>{i === 0 && <strong>{c.chamber} {c.name}</strong>}</td>
                  <td>{a.name}</td>
                  <td className="nowrap muted">{formatDate(a.date, "short")}</td>
                </tr>
              )),
              ...c.subcommittees.flatMap((s) =>
                s.activities.map((a, i) => (
                  <tr key={`${c.name}-${s.name}-${i}`}>
                    <td className="indent">{i === 0 && s.name}</td>
                    <td>{a.name}</td>
                    <td className="nowrap muted">{formatDate(a.date, "short")}</td>
                  </tr>
                ))
              ),
            ])}
          </tbody>
        </table>
      );

    case "related":
      if (!data.items.length) return empty();
      return (
        <table className="data-table">
          <thead><tr><th>Bill</th><th>Title</th><th>Relationship</th><th>Latest action</th></tr></thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={`${r.congress}${r.type}${r.number}`}>
                <td className="nowrap">
                  <Link to={`/bills/${r.congress}/${r.type}/${r.number}`}>{billLabel(r)}</Link>
                </td>
                <td>{r.title}</td>
                <td className="muted">{r.relationship}</td>
                <td className="small">
                  {r.latestAction && <><span className="muted">{r.latestAction.actionDate}</span> {r.latestAction.text}</>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );

    default:
      return empty();
  }
}
