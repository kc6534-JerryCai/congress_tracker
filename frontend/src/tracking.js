import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase.js";

export const followsCollection = (uid) => collection(db, "users", uid, "follows");
export const followRef = (uid, id) => doc(followsCollection(uid), id);
export const notificationsCollection = (uid) => collection(db, "users", uid, "notifications");

export const loginFor = (path) => `/login?${new URLSearchParams({ next: path })}`;

export function followLink(follow) {
  if (follow.kind === "bill" && /^\d+-[a-z]+-\d+$/.test(follow.billId)) {
    return `/bills/${follow.billId.replaceAll("-", "/")}`;
  }
  if (follow.kind === "member" && /^[A-Z]\d{6}$/.test(follow.bioguideId)) {
    return `/members/${follow.bioguideId}`;
  }
  return null;
}

export function useTrackingSnapshot(source) {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!source) return;
    return onSnapshot(
      source,
      (snapshot) => setState({ source, snapshot, error: null }),
      (error) => setState({ source, snapshot: null, error })
    );
  }, [source]);

  // During navigation or an account change, wait for the listener for the new source.
  if (state?.source === source) return { ...state, loading: false };
  return { snapshot: null, error: null, loading: Boolean(source) };
}
