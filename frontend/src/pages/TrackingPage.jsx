import { useMemo, useState } from "react";
import { orderBy, query, runTransaction } from "firebase/firestore";
import { Link } from "react-router-dom";
import { formatDate } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { db } from "../firebase.js";
import {
  followLink, followsCollection, loginFor, notificationsCollection, useTrackingSnapshot,
} from "../tracking.js";

function Notification({ item }) {
  const { label, message, link, read, createdAt } = item.data();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function markRead() {
    setPending(true);
    setError(false);
    try {
      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(item.ref);
        if (current.exists() && current.data().read === false) {
          transaction.update(item.ref, { read: true });
        }
      });
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="card tracking-card">
      <div className="card-head">
        <Link to={link}><strong>{label}</strong></Link>
        <span className="muted small">{createdAt?.toDate().toLocaleString()}</span>
      </div>
      <p>{message}</p>
      {read === false && (
        <button type="button" className="btn btn-light" onClick={markRead} disabled={pending}>
          Mark as read
        </button>
      )}
      {error && <p className="error small" role="alert">Couldn't mark this notification as read.</p>}
    </li>
  );
}

function FollowList({ title, follows, empty }) {
  return (
    <section>
      <h2>{title}</h2>
      {follows.length ? (
        <ul className="card-list">
          {follows.map((item) => {
            const follow = item.data();
            const link = followLink(follow);
            const date = follow.lastSeenActionDate || follow.lastSeenUpdateDate;
            return (
              <li className="card tracking-card" key={item.id}>
                <h3>{link ? <Link to={link}>{follow.label || item.id}</Link> : follow.label || item.id}</h3>
                {follow.kind === "bill" && follow.title && <p>{follow.title}</p>}
                <p className="muted">
                  {date && <><time dateTime={date.slice(0, 10)}>{formatDate(date, "short")}</time> · </>}
                  {follow.lastSeenAction || "No recent activity available."}
                </p>
              </li>
            );
          })}
        </ul>
      ) : <p className="muted">{empty}</p>}
    </section>
  );
}

function TrackingContent({ uid }) {
  const follows = useMemo(() => followsCollection(uid), [uid]);
  const notifications = useMemo(() => query(notificationsCollection(uid), orderBy("createdAt", "desc")), [uid]);
  const followState = useTrackingSnapshot(follows);
  const notificationState = useTrackingSnapshot(notifications);
  const docs = followState.snapshot?.docs || [];
  const alerts = notificationState.snapshot?.docs || [];

  return (
    <>
      <section>
        <h2>Notifications</h2>
        {notificationState.loading ? <p className="muted">Loading notifications…</p>
          : notificationState.error ? <p className="error" role="alert">Couldn't load notifications.</p>
          : alerts.length ? (
            <ul className="card-list">{alerts.map((item) => <Notification item={item} key={item.id} />)}</ul>
          ) : <p className="muted">No notifications yet.</p>}
      </section>
      {followState.loading ? <p className="muted">Loading follows…</p>
        : followState.error ? <p className="error" role="alert">Couldn't load follows.</p>
        : (
          <>
            <FollowList title="Followed bills" follows={docs.filter((item) => item.data().kind === "bill")}
              empty={<>You can follow bills from their <Link to="/bills">detail pages</Link>.</>} />
            <FollowList title="Followed members" follows={docs.filter((item) => item.data().kind === "member")}
              empty={<>You can follow members from their <Link to="/members">profiles</Link>.</>} />
          </>
        )}
    </>
  );
}

export default function TrackingPage() {
  const { user, loading, configured } = useAuth();
  return (
    <>
      <h1>Tracking</h1>
      {loading ? <p className="muted">Loading…</p>
        : user ? <TrackingContent key={user.uid} uid={user.uid} />
        : <p className="muted">
            {configured
              ? <><Link to={loginFor("/tracking")}>Log in</Link> to follow bills and members and see their updates.</>
              : "Tracking is unavailable until Firebase is configured."}
          </p>}
    </>
  );
}
