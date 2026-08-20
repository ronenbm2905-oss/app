// The session types a given club may use: the three structural ones every club has,
// plus whatever that club added for itself.
//
// Kept out of constants.js because the list is no longer a constant — it depends on the
// club document — and out of colors.js because the parent portal needs the colour
// helper without having a club document at all.

import { BASE_SESSION_TYPES, DEFAULT_SESSION_TYPE, UNKNOWN_TYPE_COLOR } from "../constants";
import { clubSettings } from "./club";

const BASE_IDS = new Set(BASE_SESSION_TYPES.map((t) => t.id));

// Accepts what a settings screen or a hand-edited club document might hold: objects, or
// bare strings for a club that only cared about the name.
function normalise(entry) {
  const raw = typeof entry === "string" ? { id: entry, name: entry } : entry || {};
  const id = String(raw.id ?? raw.name ?? "").trim();
  if (!id) return null;
  return {
    id,
    name: String(raw.name ?? id).trim() || id,
    color: raw.color || UNKNOWN_TYPE_COLOR,
    // Whether the coach-hours report counts sessions of this type. The original club
    // had two types it did not pay for, hard-coded into the report by name; it is a
    // per-club rule, so it lives on the type.
    excludeFromReport: Boolean(raw.excludeFromReport),
  };
}

// A club's custom types, cleaned: no blanks, no duplicates, and nothing that would
// shadow a structural id — a club redefining "משחק בית" with its own colour is
// harmless, but one redefining it with a different NAME would make its own game import
// look broken, so the structural three always win.
export function customSessionTypes(data) {
  const list = clubSettings(data).sessionTypes;
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const t = normalise(entry);
    if (!t || BASE_IDS.has(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

// Everything this club may choose from.
export function clubSessionTypes(data) {
  return [...BASE_SESSION_TYPES, ...customSessionTypes(data)];
}

// The options for a picker, guaranteed to contain whatever the session is already set
// to. Without this, opening a session typed with a since-deleted custom type would show
// an empty picker, and saving the form would silently retype the session — the edit
// nobody asked for, on the screen where it is least likely to be noticed.
export function sessionTypeOptions(data, current) {
  const types = clubSessionTypes(data);
  const id = String(current || "").trim();
  if (!id || types.some((t) => t.id === id)) return types;
  return [...types, { id, name: `${id} (סוג שהוסר)`, color: UNKNOWN_TYPE_COLOR }];
}

// Type ids the coach-hours report must skip. Only a club's own types can be excluded —
// a club that stopped counting "אימון" would be reporting nothing at all.
export function reportExcludedTypeIds(data) {
  return customSessionTypes(data)
    .filter((t) => t.excludeFromReport)
    .map((t) => t.id);
}

// `types` is optional so the parent portal, which is given a session's type name but
// never the club's palette, still gets a sensible colour.
export function sessionTypeColor(type, types = BASE_SESSION_TYPES) {
  return types.find((t) => t.id === type)?.color || UNKNOWN_TYPE_COLOR;
}

export { DEFAULT_SESSION_TYPE };
