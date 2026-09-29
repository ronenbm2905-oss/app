// "I am about to schedule two weeks of training. Do not ring anybody."
//
// Every save writes the sessions that moved into `changes`, and the cloud function turns
// each of those into a notification — to the coach whose training moved, and to the parents
// whose team board changed. That is exactly right when a manager moves ONE training on a
// Tuesday evening. It is exactly wrong when he sits down to build a fortnight: Ronen,
// 29.9.2026 — "every time I schedule something it reaches the coach as if his training had
// been moved, and it will drive them all mad."
//
// WHAT THIS DOES AND DOES NOT DO. It silences the PHONE, not the record. The change entries
// are still written, still shown in the app, still carried into the weekly WhatsApp message
// and onto the board. Nothing is hidden from anybody — what is withheld is the interruption,
// which is the only part that was wrong.
//
// AND IT EXPIRES BY ITSELF. This is the whole reason it is a deadline and not a switch: a
// switch that can be left on is a switch that will be left on, and the failure it produces
// is silent and arrives weeks later — a genuinely urgent cancellation that nobody's phone
// mentions. A deadline fails safe. The longest it can be set for is deliberately short;
// scheduling a fortnight takes minutes, not an evening.

const str = (v) => String(v ?? "").trim();

export const PAUSE_OPTIONS = [
  { minutes: 30, label: "חצי שעה" },
  { minutes: 60, label: "שעה" },
  { minutes: 120, label: "שעתיים" },
];

export const MAX_PAUSE_MINUTES = 120;

// ISO, so it compares as a string against the `now` that `withScheduleChanges` already has.
export function pauseUntil(minutes, now = new Date()) {
  const m = Math.max(1, Math.min(MAX_PAUSE_MINUTES, Math.floor(Number(minutes) || 0)));
  return new Date(now.getTime() + m * 60000).toISOString();
}

// A stamp that cannot be read counts as NOT paused.
//
// The direction of that failure is chosen: an unreadable value meaning "paused" would
// silence every notification for ever, with nothing on any screen to say why. Meaning "not
// paused" costs one unwanted buzz.
// The shape is checked before the value is parsed, and that is not belt-and-braces.
// `Date.parse("12345")` does not fail — it reads as the YEAR 12345, ten thousand years from
// now, and a stray number in this field would have silenced every notification for ever.
// Caught by the test that asserted a number is ignored, 29.9.2026.
const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function isNotifyPaused(data, now = new Date()) {
  const until = str(data?.notifyPausedUntil);
  if (!ISO_STAMP.test(until)) return false;
  const t = Date.parse(until);
  if (Number.isNaN(t)) return false;
  return t > (now instanceof Date ? now.getTime() : new Date(now).getTime());
}

export function pauseMinutesLeft(data, now = new Date()) {
  if (!isNotifyPaused(data, now)) return 0;
  const t = Date.parse(str(data.notifyPausedUntil));
  const ms = t - (now instanceof Date ? now.getTime() : new Date(now).getTime());
  return Math.max(1, Math.ceil(ms / 60000));
}

// Hebrew counts one, two and many differently, and a screen that says "עוד 1 שעות" reads
// like a machine wrote it — which is exactly the tone to avoid on the one card that has to
// be taken seriously. Caught on screen, not in a test: "1 שעות".
export function humanLeft(minutes) {
  const m = Math.max(1, Math.round(Number(minutes) || 0));
  if (m < 60) {
    if (m === 1) return "דקה";
    if (m === 2) return "שתי דקות";
    return `${m} דקות`;
  }
  const h = Math.round(m / 60);
  if (h === 1) return "שעה";
  if (h === 2) return "שעתיים";
  return `${h} שעות`;
}

// The line the manager reads while it is on. It says the hour as well as the countdown,
// because "another 43 minutes" is not something anyone can plan around.
export function pauseLabel(data, now = new Date()) {
  if (!isNotifyPaused(data, now)) return "";
  const left = pauseMinutesLeft(data, now);
  const until = new Date(Date.parse(str(data.notifyPausedUntil)));
  const hhmm = until.toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return `ההתראות מושתקות עוד ${humanLeft(left)} — עד ${hhmm}`;
}

// Mark the entries this save produced, so the cloud can tell them apart later.
//
// The flag rides on the ENTRY and not on the club document, and that matters: the function
// wakes up some seconds after the save and reads whatever the document holds then. By that
// time the pause may have expired, or a second save may have lifted it — and the entries
// written while it was on would go out anyway. What was true at the moment of writing has to
// travel with what was written.
export function markSilent(entries, paused) {
  if (!paused) return entries;
  return (Array.isArray(entries) ? entries : []).map((e) => ({ ...e, silent: true }));
}

export const isSilent = (entry) => entry?.silent === true;
