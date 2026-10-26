import { useEffect, useState } from "react";

export async function apiGet(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "" && v != null)
  ).toString();
  const res = await fetch(`/api${path}${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

/** Fetch `path` whenever it or `params` change. Returns { data, error, loading }. */
export function useApi(path, params = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const key = path + JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    apiGet(path, params)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((error) => !cancelled && setState({ data: null, error, loading: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export const BILL_TYPES = {
  hr: "H.R.",
  s: "S.",
  hjres: "H.J.Res.",
  sjres: "S.J.Res.",
  hconres: "H.Con.Res.",
  sconres: "S.Con.Res.",
  hres: "H.Res.",
  sres: "S.Res.",
};

/** "2026-10-22" -> "October 22, 2026" (parsed as UTC so the day never shifts). */
export function formatDate(iso, month = "long") {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { year: "numeric", month, day: "numeric", timeZone: "UTC" });
}

/** "Rep. Khanna, Ro [D-CA-17]" -> { name: "Rep. Ro Khanna", tag: "D-CA-17" } */
export function splitMemberName(fullName = "") {
  const m = fullName.match(/^(\S+\.)\s+([^,]+),\s+(.+?)\s+\[(.+)\]$/);
  return m ? { name: `${m[1]} ${m[3]} ${m[2]}`, tag: m[4] } : { name: fullName, tag: "" };
}

export const billLabel = (b) => `${BILL_TYPES[b.type] || b.type.toUpperCase()} ${b.number}`;
