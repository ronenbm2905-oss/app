import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";

import {
  newEntriesSince,
  freshEntries,
  notificationsFor,
  tokensForCoach,
  inQuietWindow,
  isDeadToken,
} from "./shared/utils/pushTargets.js";
import { boardChanges, changeSummary } from "./shared/utils/boardChanges.js";

// Phone notifications for schedule changes. This is the only thing that runs in the cloud.
//
// ───────────────────────────────────────────────────────────────────────────────────────
// THIS PROCESS SEES THE WHOLE CLUB DOCUMENT, INCLUDING `players[]`, AND IT MUST NOT.
//
// A Firestore trigger has no `.select()` — the projection every other read in this project
// uses to keep minors' records out of reach simply does not exist here. The document
// arrives complete. That is a property of the platform, not a choice, so the controls are
// behavioural and they are written down rather than assumed:
//
//   1. Only `changes` is ever read out of the snapshot. Nothing else is touched.
//   2. NOTHING from the document is logged. Not a field, not a count of players, not an
//      error object that might carry one. `console.log` of document content is forbidden
//      here, and that is the rule this comment exists to state out loud.
//   3. The region is European, matching where the data is declared to live.
//
// Privacy policy §6 describes this process to the people it holds data about. If any of
// the three above changes, that section is wrong and has to change with it.
// ───────────────────────────────────────────────────────────────────────────────────────

setGlobalOptions({
  // eur3 is where the club document lives and what the privacy policy states seven times.
  // The default would be us-central1 — Iowa — and nothing in the console would have said so.
  region: "europe-west1",
  // The real ceiling. A budget alert emails; this refuses. Three is far above a single
  // club's need and low enough that a runaway loop cannot become a bill.
  maxInstances: 3,
  memory: "256MiB",
  timeoutSeconds: 60,
});

initializeApp();
const db = getFirestore();

const stateRef = (clubId) => db.collection("clubs").doc(clubId).collection("push").doc("state");

// Send one notification per coach, and clean up the devices that no longer exist.
//
// Data-only on purpose: a `notification` payload is drawn by the browser, which would
// ignore the service worker's formatting and, on some platforms, show a second copy
// alongside it.
async function deliver(clubId, entries, names) {
  const notes = notificationsFor(entries, names);
  if (notes.length === 0) return 0;

  const snap = await db.collection("clubs").doc(clubId).collection("pushTokens").get();
  const rows = snap.docs.map((d) => d.data());
  let sent = 0;
  const dead = [];

  for (const note of notes) {
    for (const token of tokensForCoach(rows, note.coachId)) {
      try {
        await getMessaging().send({
          token,
          data: { title: note.title, body: note.body },
          webpush: { headers: { Urgency: "normal", TTL: "43200" } },
        });
        sent++;
      } catch (err) {
        // A dead device is deleted; a network blip is not. Getting this backwards would
        // silence a coach permanently on one bad afternoon.
        if (isDeadToken(err)) dead.push(token);
      }
    }
  }

  await Promise.all(
    dead.map((t) => db.collection("clubs").doc(clubId).collection("pushTokens").doc(t).delete())
  );
  return sent;
}

// The halls, and only the halls. `changeLabel` reads `names.halls` and nothing else, so
// this is the entire name lookup the notification needs — and the reason a player's name
// cannot reach a lock screen even by accident.
const hallNames = (doc) => ({ halls: (doc?.halls || []).map((h) => ({ id: h.id, name: h.name })) });

async function run(clubId, before, after, now = new Date()) {
  const state = await stateRef(clubId).get();
  const lastSentAt = state.exists ? state.data()?.lastSentAt || "" : "";

  // A document that arrives with no `before` is a restore, a migration, or a first write —
  // never an edit someone just made. Sending on it would broadcast up to 150 entries a
  // month old. The marker is advanced so the next real change is measured from here.
  const fresh = before
    ? freshEntries(newEntriesSince(before.changes, after.changes), now)
    : [];

  if (fresh.length === 0) {
    await stateRef(clubId).set({ lastSentAt: now.toISOString() }, { merge: true });
    return 0;
  }

  // Ronen's decision, 16.9: nothing between 22:00 and 07:00 Israel time. Not dropped —
  // the marker is NOT advanced, so the morning job picks these up.
  if (inQuietWindow(now)) return 0;

  const held = lastSentAt ? fresh.filter((e) => String(e.at) > lastSentAt) : fresh;
  const sent = await deliver(clubId, held, hallNames(after));
  await stateRef(clubId).set({ lastSentAt: now.toISOString() }, { merge: true });
  return sent;
}

export const onClubChange = onDocumentWritten("clubs/{clubId}", async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!after) return;
  const sent = await run(event.params.clubId, before, after);
  // A count. Never a field, never an entry, never the document.
  console.log(`push: delivered ${sent}`);
});

// What the quiet window held back.
//
// It reads the club document itself rather than a queue, because the log IS the queue —
// one source of truth for "what changed", the same one the banner and the WhatsApp message
// already use.
export const morningPush = onSchedule(
  { schedule: "5 7 * * *", timeZone: "Asia/Jerusalem" },
  async () => {
    const clubs = await db.collection("clubs").get();
    for (const club of clubs.docs) {
      const data = club.data();
      const state = await stateRef(club.id).get();
      const lastSentAt = state.exists ? state.data()?.lastSentAt || "" : "";
      const held = freshEntries(
        (data.changes || []).filter((e) => !lastSentAt || String(e?.at) > lastSentAt),
        new Date()
      );
      if (held.length === 0) continue;
      const sent = await deliver(club.id, held, hallNames(data));
      await stateRef(club.id).set({ lastSentAt: new Date().toISOString() }, { merge: true });
      console.log(`morning push: delivered ${sent}`);
    }

    // And what the quiet window held back from the PARENTS' boards. Same job, because the
    // alternative is a second schedule to keep in step with this one — and because a family
    // and a coach should learn about the same change at the same hour.
    for (const club of clubs.docs) {
      const held = await db.collection("clubs").doc(club.id).collection("boardPush").get();
      for (const row of held.docs) {
        const x = row.data() || {};
        if (!x.pending) continue;
        const body = changeSummary(x) || "הלוח עודכן";
        const sent = await deliverBoard(club.id, row.id, x.teamName || "לוח הקבוצה", body);
        // Cleared before anything else can add to it, so a change arriving during the drain
        // is held for tomorrow rather than lost between the send and the clear.
        await row.ref.set({ pending: false, schedule: false, message: false, added: 0, removed: 0 }, { merge: true });
        console.log(`morning board push: delivered ${sent}`);
      }
    }
  }
);

// Sending to every device that follows one board. Shared by the live path and by the
// morning catch-up, so a change held overnight is delivered exactly as one sent at once.
async function deliverBoard(clubId, token, title, body) {
  const snap = await db
    .collection("clubs").doc(clubId).collection("boardSubs")
    .where("boardToken", "==", token)
    .get();
  if (snap.empty) return 0;
  let sent = 0;
  const dead = [];
  for (const row of snap.docs) {
    const fcmToken = row.data()?.fcmToken;
    if (!fcmToken) continue;
    try {
      await getMessaging().send({
        token: fcmToken,
        data: { title, body, url: `/t/${token}` },
        webpush: { headers: { Urgency: "normal", TTL: "43200" } },
      });
      sent++;
    } catch (err) {
      if (isDeadToken(err)) dead.push(row.id);
    }
  }
  await Promise.all(
    dead.map((id) => db.collection("clubs").doc(clubId).collection("boardSubs").doc(id).delete())
  );
  return sent;
}

// A team board moved, so the phones following it are told.
//
// This is the quietest thing in the project and deliberately so: the subscription holds a
// push token and a board id, and nothing else. No account, no email, no name — the function
// knows WHERE to send and has no way to know WHO reads it. That is what let this be built
// without accounts, codes or a consent chain, and it is worth keeping true.
//
// A write is not a change. "עדכן את כל הלוחות" rewrites every board after any edit, which is
// what makes that button safe to press — and it means sending on every write would train a
// parent to ignore the notification inside a week. `boardChanges` compares the rows.
export const onBoardChange = onDocumentWritten("clubs/{clubId}/boards/{token}", async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const change = boardChanges(before, after);
  if (!change.changed) return;

  const clubId = event.params.clubId;
  const token = event.params.token;

  // Held, not dropped. The coaches' notifications have had a morning job since day one;
  // this path did not, so a change made at 22:04 was silenced and never mentioned again —
  // which is worse than arriving late, because nobody ever learns it happened.
  //
  // Written to a separate document ON PURPOSE: marking the board itself would re-trigger
  // this very function.
  if (inQuietWindow(new Date())) {
    const held = db.collection("clubs").doc(clubId).collection("boardPush").doc(token);
    const prev = (await held.get()).data() || {};
    await held.set(
      {
        pending: true,
        schedule: Boolean(prev.schedule) || change.schedule,
        message: Boolean(prev.message) || change.message,
        added: (prev.added || 0) + change.added,
        removed: (prev.removed || 0) + change.removed,
        teamName: after?.teamName || prev.teamName || "",
        at: new Date().toISOString(),
      },
      { merge: true }
    );
    return;
  }

  const sent = await deliverBoard(clubId, token, after?.teamName || "לוח הקבוצה", change.summary || "הלוח עודכן");
  // A count. The board carries no personal data and neither does this line.
  console.log(`board push: delivered ${sent}`);
});
