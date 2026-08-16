// מזהה קצר ויציב, בלי תלות חיצונית. crypto.randomUUID כשקיים.
export function newId(prefix = "") {
  const uuid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const short = uuid.replace(/-/g, "").slice(0, 16);
  return prefix ? `${prefix}_${short}` : short;
}

export function nowIso() {
  return new Date().toISOString();
}
