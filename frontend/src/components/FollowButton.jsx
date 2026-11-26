import { useMemo, useState } from "react";
import { deleteDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { db } from "../firebase.js";
import { followRef, loginFor, useTrackingSnapshot } from "../tracking.js";

export default function FollowButton({ id, follow }) {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid;
  const location = useLocation();
  const ref = useMemo(() => uid ? followRef(uid, id) : null, [uid, id]);
  const { snapshot, loading, error } = useTrackingSnapshot(ref);
  const [operation, setOperation] = useState(null);

  if (authLoading) return <button type="button" className="btn btn-light" disabled>Follow</button>;
  if (!uid) {
    return <Link className="btn btn-light" to={loginFor(location.pathname + location.search)}>Follow</Link>;
  }

  const following = snapshot?.exists();
  const currentOperation = operation?.ref === ref ? operation : null;

  async function toggleFollow() {
    setOperation({ ref, pending: true });
    try {
      if (following) {
        await deleteDoc(ref);
      } else {
        await runTransaction(db, async (transaction) => {
          const current = await transaction.get(ref);
          if (!current.exists()) transaction.set(ref, { ...follow, createdAt: serverTimestamp() });
        });
      }
      setOperation(null);
    } catch {
      setOperation({ ref, error: "Couldn't update your follow. Please try again." });
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-light"
        onClick={toggleFollow}
        disabled={loading || Boolean(error) || currentOperation?.pending}
      >
        {following ? "Unfollow" : "Follow"}
      </button>
      {(error || currentOperation?.error) && (
        <span className="error small" role="alert">{currentOperation?.error || "Couldn't load your follow."}</span>
      )}
    </>
  );
}
