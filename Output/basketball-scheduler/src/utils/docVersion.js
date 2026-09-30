// Stop a device from writing yesterday over today.
//
// WHAT HAPPENED ON 30.9.2026, and it is the reason this file exists.
//
// Every save in this app writes the WHOLE club document. That is deliberate and it is what
// makes the weekly board simple — but it means the last writer wins, completely, including
// over changes it never saw. Two of Ronen's devices did exactly that to each other in one
// morning:
//
//   07:15  the phone deleted יורם's trainings for the week of 4.10
//   08:02  the computer — still holding the document as it was BEFORE 07:15 — saved, and
//          those trainings came back. No error, and NOTHING IN THE CHANGE LOG, because the
//          log diffs what the client had against what it saves, and the computer's copy had
//          them all along.
//   09:23  the phone — still holding 07:15 — saved, and wiped the whole morning's work:
//          six of מוקט's sessions and eleven secretariat rows.
//
// Twelve records destroyed, silently, in a hundred and thirty minutes. The only reason it
// was caught at all is that the change log's newest entry jumped BACKWARDS in time.
//
// THE FIX IS A VERSION NUMBER, NOT A MERGE. Merging two whole club documents would need a
// rule for every field and would be wrong in a new way each time. Refusing is honest: the
// document carries `rev`, every save checks that the server is still on the `rev` the client
// started from, and a save built on an older one is REJECTED rather than applied. The
// manager reloads and redoes one edit, instead of losing an evening and not knowing.
//
// The comparison happens inside a Firestore transaction, so the check and the write are one
// step. Checking first and writing after would leave exactly the gap this is closing.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// A document written before this existed has no `rev`. It counts as 0, and the first save
// moves it to 1 — so an old document is adopted rather than rejected forever.
export function revOf(data) {
  return Math.max(0, Math.trunc(num(data?.rev)));
}

export function nextRev(current) {
  return revOf({ rev: current }) + 1;
}

// Is the save about to be made built on a copy older than what the server holds?
//
// `expected` is the rev the client believes it is editing; `server` is what the transaction
// just read. Strictly-greater rather than not-equal, deliberately: if a client somehow holds
// a rev AHEAD of the server — a restore, a rolled-back write — refusing would lock the app
// permanently with no way out from inside it. Behind is a conflict; ahead is a curiosity.
export function isStale(expected, server) {
  return revOf({ rev: server }) > revOf({ rev: expected });
}

export const CONFLICT_CODE = "stale-document";

// Said in full, because the next thing this person does depends on understanding it. "Save
// failed, try again" would be a lie — trying again with the same screen would overwrite the
// other device, which is the bug.
// Two corrections from gate #25, and both matter more than they look:
//
//   "(F5)" — THERE IS NO F5 ON A PHONE. And the device that gets this message is by
//   definition the one left behind, which on 30.9 was the phone. Telling the person holding
//   a phone to press a key it does not have is telling them the app is broken.
//
//   "ממכשיר אחר" — the club has more than one manager. Assuming the other writer was
//   another DEVICE of yours invites "redo what you did" over a colleague's deliberate
//   change, which is the same overwrite wearing different clothes.
export const CONFLICT_MESSAGE =
  "הלוח עודכן מאז שפתחת את הדף — ממכשיר אחר או ממנהל/ת אחר/ת — והשמירה בוטלה כדי לא " +
  "למחוק את השינוי ההוא. טען מחדש את הדף, בדוק מה השתנה, ובצע שוב את מה שחסר. " +
  "מה שכבר נשמר קודם לא אבד.";

export function conflictError() {
  const err = new Error(CONFLICT_MESSAGE);
  err.code = CONFLICT_CODE;
  return err;
}

export const isConflict = (err) => err?.code === CONFLICT_CODE;

// The save itself, so the app and the test run the same code rather than two copies of it.
//
// `runTransaction` and `db` are passed in rather than imported: this module stays free of the
// Firebase SDK, which is what lets the emulator test drive it with the rules-testing client.
// The alternative — a test that reimplements the transaction — would pass happily on a day
// the real one was broken.
//
// Returns the rev that was written. Throws `conflictError()` when the server has moved on.
export async function commitWithVersion({ runTransaction, db, ref, next, expectedRev }) {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    // `exists` is a METHOD in the browser SDK and a PROPERTY in the Admin SDK. Read the wrong
    // way it is a function object — always truthy — so a missing document would read as
    // present and `snap.data()` would throw or return undefined. It is the kind of difference
    // that never fails in the environment it was written in.
    const exists = typeof snap.exists === "function" ? snap.exists() : Boolean(snap.exists);
    const serverRev = exists ? revOf(snap.data()) : 0;
    if (isStale(expectedRev, serverRev)) throw conflictError();
    const rev = nextRev(serverRev);
    tx.set(ref, { ...next, rev });
    return rev;
  });
}
