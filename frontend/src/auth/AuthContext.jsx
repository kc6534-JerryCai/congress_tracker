import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../firebase.js";

const AuthContext = createContext(null);

/** Creates or refreshes users/{uid}. `merge` keeps fields other features add later. */
function saveProfile(user, displayName = user.displayName) {
  return setDoc(
    doc(db, "users", user.uid),
    { displayName: displayName || "", email: user.email, lastLoginAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Holds the signed-in Firebase user for the whole app.
 * `loading` is true until Firebase has restored the session from the browser,
 * so pages don't flash "Log in" on refresh.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [profileVersion, setProfileVersion] = useState(0);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: firebaseConfigured,

      async signUp(name, email, password) {
        const { user: u } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(u, { displayName: name });
        await setDoc(doc(db, "users", u.uid), {
          displayName: name,
          email: u.email,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
        // updateProfile changes the same user object without firing onAuthStateChanged,
        // so bump a counter to re-render the header with the new name.
        setProfileVersion((v) => v + 1);
      },

      async logIn(email, password) {
        const { user: u } = await signInWithEmailAndPassword(auth, email, password);
        await saveProfile(u);
      },

      async logInWithGoogle() {
        const { user: u } = await signInWithPopup(auth, new GoogleAuthProvider());
        await saveProfile(u);
      },

      logOut: () => signOut(auth),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, profileVersion]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** { user, loading, configured, signUp, logIn, logInWithGoogle, logOut } */
export function useAuth() {
  return useContext(AuthContext);
}

const MESSAGES = {
  "auth/invalid-credential": "Email or password is incorrect.",
  // Older codes, still returned by the emulator and by projects without email-enumeration protection.
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/email-already-in-use": "An account with this email already exists. Try logging in.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/popup-closed-by-user": "The Google sign-in window was closed before finishing.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled in the Firebase project.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
};

/** Turns a Firebase error into a sentence for the form. */
export function authErrorMessage(err) {
  return MESSAGES[err?.code] || err?.message || "Something went wrong. Please try again.";
}
