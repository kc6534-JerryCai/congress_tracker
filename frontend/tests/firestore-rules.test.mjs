// Checks firestore.rules against the local emulator, using the same client SDK the
// browser uses (so this is what someone could do from the browser console).
//
//   firebase emulators:start --only auth,firestore     (repo root, in one terminal)
//   npm run test:rules                                  (frontend/, in another)

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import {
  addDoc, collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs,
  getFirestore, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";

const PROJECT = "demo-capitol-ledger";
const run = Date.now();
const apps = [];

/** A separate Firebase app per person, like two different browsers. */
async function person(name) {
  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT }, `${name}-${run}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  if (name === "anon") return { db };
  const { user } = await createUserWithEmailAndPassword(auth, `${name}-${run}@example.test`, "emulator-pass-1");
  return { db, uid: user.uid };
}

const denied = (p) => assert.rejects(p, (e) => e.code === "permission-denied");

let alice, bob, anon;
before(async () => {
  [alice, bob, anon] = await Promise.all([person("alice"), person("bob"), person("anon")]);
  await setDoc(doc(alice.db, "users", alice.uid), { displayName: "Alice" });
  await setDoc(doc(alice.db, "users", alice.uid, "follows", "bill-119-hr-1"), { kind: "bill", billId: "119-hr-1" });
});
after(() => Promise.all(apps.map(deleteApp)));

test("a user can read and write their own profile and follows", async () => {
  assert.equal((await getDoc(doc(alice.db, "users", alice.uid))).data().displayName, "Alice");
  assert.equal((await getDocs(collection(alice.db, "users", alice.uid, "follows"))).size, 1);
});

test("another user cannot read or write someone's profile or follows", async () => {
  await denied(getDoc(doc(bob.db, "users", alice.uid)));
  await denied(getDocs(collection(bob.db, "users", alice.uid, "follows")));
  await denied(setDoc(doc(bob.db, "users", alice.uid, "follows", "x"), { kind: "bill" }));
  await denied(getDocs(collection(anon.db, "users", alice.uid, "follows")));
});

test("users cannot create their own notifications, only mark them read", async () => {
  await denied(setDoc(doc(alice.db, "users", alice.uid, "notifications", "n1"), { read: false }));
});

test("comments: public read, post as yourself, delete only your own", async () => {
  const comment = (uid) => ({
    billId: "119-hr-1", uid, displayName: "Alice", text: "Hello", createdAt: serverTimestamp(),
  });
  const ref = await addDoc(collection(alice.db, "comments"), comment(alice.uid));
  assert.equal((await getDoc(doc(anon.db, "comments", ref.id))).data().text, "Hello");

  await denied(addDoc(collection(bob.db, "comments"), comment(alice.uid))); // pretending to be Alice
  await denied(addDoc(collection(anon.db, "comments"), comment("nobody"))); // not signed in
  await denied(addDoc(collection(alice.db, "comments"), { ...comment(alice.uid), text: "" }));
  await denied(updateDoc(doc(alice.db, "comments", ref.id), { text: "edited" }));
  await denied(deleteDoc(doc(bob.db, "comments", ref.id)));
  await deleteDoc(doc(alice.db, "comments", ref.id));
});
