// Did this board actually change, and is it worth waking a phone for?
//
// NO IMPORTS, and that is a requirement rather than a coincidence: this runs in the Cloud
// Function as well as in the browser, and `teamBoard.js` — where it started — reaches
// `transport.js`, which pulls in SheetJS. A spreadsheet library has no business inside a
// function whose whole job is to decide whether to send one line of text.
// "עדכן את כל הלוחות" rewrites every published board whether or not anything moved — that is
// what makes it safe to press after any edit. It also means a write is NOT a change, and
// sending on every write would train a parent to ignore the notification within a week.
//
// So the rows are compared, and `updatedAt` is deliberately left out of that comparison: it
// changes on every publish by definition and would make every board look different.
const rowKey = (r) =>
  [r?.kind, r?.day, r?.start, r?.end, r?.where, r?.opponent || "", r?.type || "", r?.cancelled ? "x" : ""].join("|");

const allRows = (board) =>
  Object.entries(board?.weeks || {})
    .flatMap(([week, rows]) => (Array.isArray(rows) ? rows : []).map((r) => week + "|" + rowKey(r)))
    .sort();

// The words, in one place. A change announced at 22:30 and held until 07:05 has to read the
// same as one announced immediately — two builders would eventually disagree about what
// happened overnight.
export function changeSummary({ schedule, message, added, removed } = {}) {
  const parts = [];
  if (schedule) {
    // Counted rather than listed. A lock screen holds one line, and four rows spelled out is
    // unreadable — the board itself is one tap away.
    parts.push(added && removed ? "השתנו אימונים" : added ? "נוסף אימון" : "בוטל אימון");
  }
  if (message) parts.push("הודעה חדשה מהמאמן");
  return parts.join(" · ");
}

export function boardChanges(before, after) {
  if (!after) return { changed: false, schedule: false, message: false, added: 0, removed: 0, summary: "" };

  // A board published for the FIRST time is not a change to announce — there was nothing to
  // compare it against, and nobody is subscribed to it yet anyway.
  if (!before) return { changed: false, schedule: false, message: false, added: 0, removed: 0, summary: "" };

  const was = allRows(before);
  const now = allRows(after);
  const wasSet = new Set(was);
  const nowSet = new Set(now);
  const added = now.filter((r) => !wasSet.has(r)).length;
  const removed = was.filter((r) => !nowSet.has(r)).length;
  const schedule = added > 0 || removed > 0;

  const msgBefore = String(before?.message?.text || "").trim();
  const msgAfter = String(after?.message?.text || "").trim();
  // A message that was REMOVED is not worth a notification: nothing was said, and "the coach
  // deleted something" is not information a parent can use.
  const message = msgAfter !== "" && msgAfter !== msgBefore;

  const summary = changeSummary({ schedule, message, added, removed });

  return { changed: schedule || message, schedule, message, added, removed, summary };
}
