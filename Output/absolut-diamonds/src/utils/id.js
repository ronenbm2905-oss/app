// מזהים מקומיים. ב-Firestore המזהה מגיע מהמסמך; כאן צריך משהו יציב וייחודי.
export function makeId(prefix = "id") {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function nowIso() {
  return new Date().toISOString();
}
