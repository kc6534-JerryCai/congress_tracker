import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { query, where } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext.jsx";
import { notificationsCollection, useTrackingSnapshot } from "../tracking.js";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Capitol Ledger home">
      Capitol Ledger
    </Link>
  );
}

/**
 * Site header, always pinned to the top. `overlay` makes it transparent over the home hero
 * until the page is scrolled, then it fills in so it stays readable.
 */
export default function Header({ overlay = false }) {
  const [scrolled, setScrolled] = useState(false);
  const { user, loading, logOut } = useAuth();
  const navigate = useNavigate();
  const uid = user?.uid;
  const unread = useMemo(
    () => uid ? query(notificationsCollection(uid), where("read", "==", false)) : null,
    [uid]
  );
  const { snapshot } = useTrackingSnapshot(unread);
  const count = snapshot?.size || 0;

  async function onLogOut() {
    await logOut();
    navigate("/");
  }

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  return (
    <header className={`site-header${overlay ? " overlay" : ""}${scrolled ? " scrolled" : ""}`}>
      <div className="header-inner">
        <Logo />
        <nav className="main-nav">
          <NavLink to="/bills">Bills</NavLink>
          <NavLink to="/members">Members</NavLink>
          <NavLink
            to="/tracking"
            className={({ isActive }) => `tracking-nav${isActive ? " active" : ""}`}
            aria-label={count > 0 ? `Tracking, ${count} unread notifications` : undefined}
          >
            Tracking
            {count > 0 && <span className="unread-count" aria-hidden="true">{count}</span>}
          </NavLink>
        </nav>
        <div className="header-actions">
          {/* Render nothing for the account slot while Firebase restores the session, so it doesn't flash "Log in". */}
          {loading ? null : user ? (
            <>
              <span className="header-user" title={user.email}>{user.displayName || user.email}</span>
              <button type="button" className="btn btn-light" onClick={onLogOut}>Log out</button>
            </>
          ) : (
            <Link to="/login" className="btn btn-light">Log in</Link>
          )}
          <Link to="/subscribe" className="btn btn-dark">Subscribe</Link>
        </div>
      </div>
    </header>
  );
}
