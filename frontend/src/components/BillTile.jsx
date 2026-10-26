import { Link } from "react-router-dom";
import { billLabel } from "../api.js";

// How each bill type is typeset on the printed bill.
const PRINTED_TYPES = {
  hr: "H. R.",
  s: "S.",
  hres: "H. RES.",
  sres: "S. RES.",
  hjres: "H. J. RES.",
  sjres: "S. J. RES.",
  hconres: "H. CON. RES.",
  sconres: "S. CON. RES.",
};

const PARTY_CLASS = { R: "rep", D: "dem" };

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** First session is the odd year a Congress begins (e.g. 2025 for the 119th). */
function session(bill) {
  const startYear = 1789 + (bill.congress - 1) * 2;
  const year = Number((bill.introducedDate || "").slice(0, 4));
  return year > startYear ? "2d" : "1st";
}

const initials = (name = "") =>
  name.replace(/^(Rep|Sen|Del|Resident Commissioner)\.?\s+/, "").split(",")[0].slice(0, 1) || "?";

/** A card whose thumbnail mimics the first page of the printed bill, with the sponsor's photo. */
export default function BillTile({ bill }) {
  const sponsor = bill.sponsor;
  const party = PARTY_CLASS[sponsor?.party] || "ind";
  const printed = `${PRINTED_TYPES[bill.type] || bill.type.toUpperCase()} ${bill.number}`;

  return (
    <Link to={`/bills/${bill.congress}/${bill.type}/${bill.number}`} className="bill-tile">
      <div className={`bill-paper ${party}`} aria-hidden="true">
        <div className="paper-session">
          {ordinal(bill.congress)} Congress
          <br />
          {session(bill)} Session
        </div>
        <div className={`paper-number${printed.length > 11 ? " long" : ""}`}>{printed}</div>
        <div className="paper-rule" />
        <p className="paper-text">{bill.title}</p>
        <div className="paper-band" />
        {sponsor &&
          (sponsor.imageUrl ? (
            <img className="paper-photo" src={sponsor.imageUrl} alt="" loading="lazy" />
          ) : (
            <div className="paper-photo paper-photo-empty">{initials(sponsor.name)}</div>
          ))}
      </div>
      <div className="bill-tile-body">
        <h3>
          {billLabel(bill)}: {bill.title}
        </h3>
        {sponsor && <p className="bill-tile-sponsor">{sponsor.name}</p>}
        <p className="muted small">Introduced {bill.introducedDate}</p>
        {bill.latestAction && (
          <p className="bill-tile-action small">
            <span className="muted">{bill.latestAction.actionDate}:</span> {bill.latestAction.text}
          </p>
        )}
      </div>
    </Link>
  );
}
