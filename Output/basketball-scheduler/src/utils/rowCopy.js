// Copying one row of the weekly board — the trainings of a single team/coach — and
// dropping it into another week.
//
// The board's time model is week-by-week: every session carries a `weekOf` and each week
// is entered on its own (28.7.2026). "שכפל שבוע קודם" copies the WHOLE week, which is the
// right tool when a whole week repeats and the wrong one when a single coach's row is what
// moved. That is what this is: the same bargain at row resolution.
//
// Three properties, and the first two are here because of the week that was duplicated on
// 31.8.2026 (115 August trainings appended blind onto a built week):
//
// 1. **A copy is never a duplicate.** A session already standing in the target week — same
//    team, coach, hall, day, hours and type — is skipped. Pasting twice writes nothing the
//    second time.
// 2. **A row that is already built is not written over silently.** The caller is told how
//    many sessions the target row already holds so it can ask first. Skipping identical
//    rows does not cover this case: a row whose hours all moved has no identical rows at
//    all, and that is exactly the shape the August accident had.
// 3. **What comes out is an ordinary session.** A fresh id, the target week, and nothing
//    else carried over — so the hours report, conflicts, transport and the calendar treat
//    it like any other training and have no idea this feature exists.
//
// Imported games are never copied. The federation owns those dates; a fixture on Tuesday
// says nothing about next Tuesday. Same rule `handleCopyPrevWeek` and the school template
// already follow.

const arr = (list) => (Array.isArray(list) ? list : []);

// What makes two sessions "the same training". Deliberately identical to the key
// `handleCopyPrevWeek` compares on — one definition of a duplicate for the whole app.
// `notes` is out on purpose: a typo fixed in the note does not make it a different
// training, and including it would let a duplicate through.
export function sessionKey(s) {
  return [s.teamId, s.coachId, s.hallId, s.day, s.start, s.end, s.type || ""].join("|");
}

// The manual trainings of one team in one week.
export function rowSessions(sessions, teamId, weekOf) {
  if (!teamId) return [];
  return arr(sessions).filter(
    (s) => s && s.teamId === teamId && (s.weekOf || "") === (weekOf || "") && !s.fromGame
  );
}

// The clipboard payload. The sessions are stored stripped — no id, no week, and none of
// the marks that belong to the week they were set in — so what is held is the shape of the
// row, not the rows themselves. It stays valid if the source week is edited or deleted
// afterwards, which a list of ids would not.
export function copyRow(sessions, teamId, weekOf) {
  const list = rowSessions(sessions, teamId, weekOf);
  if (list.length === 0) return null;
  return {
    teamId,
    fromWeek: weekOf || "",
    sessions: list.map((s) => {
      const { id, weekOf: _w, timeOverride, cancelled, cancelledAt, ...rest } = s;
      return rest;
    }),
  };
}

// What pasting would do, without doing it. `makeId` is injected so the caller owns id
// generation and this stays a pure function.
//
// status: "empty"      — nothing on the clipboard
//         "same-week"  — the week it came from; there is nothing to add
//         "nothing-new"— every session is already there (a second press)
//         "ok"         — `fresh` is what would be appended
export function planRowPaste(clipboard, sessions, targetWeek, makeId) {
  const empty = { status: "empty", fresh: [], skipped: 0, existing: 0 };
  if (!clipboard || !arr(clipboard.sessions).length || !targetWeek) return empty;

  const current = rowSessions(sessions, clipboard.teamId, targetWeek);
  const existing = current.length;
  if ((clipboard.fromWeek || "") === targetWeek) {
    return { status: "same-week", fresh: [], skipped: clipboard.sessions.length, existing };
  }

  const here = new Set(current.map(sessionKey));
  const fresh = [];
  let skipped = 0;
  clipboard.sessions.forEach((s) => {
    const candidate = { ...s, teamId: clipboard.teamId, weekOf: targetWeek };
    if (here.has(sessionKey(candidate))) {
      skipped++;
      return;
    }
    // Guards against a clipboard that holds the same training twice — two identical rows
    // would both miss the `here` set and both be written.
    here.add(sessionKey(candidate));
    fresh.push({ ...candidate, id: makeId() });
  });

  if (fresh.length === 0) return { status: "nothing-new", fresh: [], skipped, existing };
  return { status: "ok", fresh, skipped, existing };
}
