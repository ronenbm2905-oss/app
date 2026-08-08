// Subscription state, derived from `settings.subscription.validUntil` (an ISO date).
//
// What this is: a reminder that an invoice is due, and a nudge that escalates if it
// stays unpaid. What it is NOT: access control. The security rules still let a club's
// admins write their own document, deliberately — a club's own data must never become
// unreachable because a payment is late, and locking people out of a season's schedule
// over an unpaid invoice is a worse outcome than an unpaid invoice. Anyone technical
// could bypass every check in this file; that is an accepted trade, not an oversight.
//
// Deliberately no dependency on club settings defaults or on any asset import, so it
// stays loadable in a plain-Node test.

// Warn the club's admins this far ahead of the renewal date.
export const WARN_DAYS = 30;

// After the date passes, keep full editing for this long. A treasurer's approval cycle
// takes weeks, and cutting a club off mid-season the morning after an invoice matures
// would cost far more in goodwill than it could ever recover in payment.
export const GRACE_DAYS = 14;

const MS_PER_DAY = 86400000;

// Whole days from `todayIso` to `targetIso`. Both are "YYYY-MM-DD". Parsed at UTC noon
// so a daylight-saving change inside the range cannot round the result off by one.
export function daysBetween(todayIso, targetIso) {
  const parse = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  };
  const a = parse(todayIso);
  const b = parse(targetIso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

// States, in escalating order:
//   unmanaged — no renewal date recorded. Never nags, never restricts. This is what a
//               club with no commercial arrangement looks like, and what the original
//               single-club document looks like, so neither is ever nagged.
//   active    — more than WARN_DAYS away.
//   expiring  — within WARN_DAYS. Admins see a quiet reminder.
//   grace     — past the date, within GRACE_DAYS. Loud warning, still fully editable.
//   lapsed    — past the grace period. The app asks admins to renew and stops accepting
//               edits; everything remains readable, and nothing is ever deleted.
export function subscriptionState(settings, todayIso) {
  const sub = settings?.subscription || {};
  const validUntil = String(sub.validUntil || "").trim();
  const plan = String(sub.plan || "").trim();

  const daysLeft = validUntil ? daysBetween(todayIso, validUntil) : null;

  // An unparseable date is treated exactly like no date at all. A typo in the console
  // must never be the reason a club loses the ability to edit its own schedule.
  if (daysLeft === null) return { state: "unmanaged", daysLeft: null, validUntil: "", plan };

  let state;
  if (daysLeft < -GRACE_DAYS) state = "lapsed";
  else if (daysLeft < 0) state = "grace";
  else if (daysLeft <= WARN_DAYS) state = "expiring";
  else state = "active";

  return { state, daysLeft, validUntil, plan };
}

// Only the final state withholds editing.
export function subscriptionBlocksEditing(status) {
  return status?.state === "lapsed";
}

// Whether admins should be shown something about the subscription at all.
export function subscriptionNeedsAttention(status) {
  return ["expiring", "grace", "lapsed"].includes(status?.state);
}

// Stable JSON: keys sorted at every level, so two objects that differ only in the order
// their keys were built compare equal. Without this, a document read back from Firestore
// and one rebuilt by the settings form would look "different" and the check below would
// reject a perfectly legitimate renewal.
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

// A lapsed subscription must not lock the operator out of RENEWING it. Editing is
// withheld, but a save that changes nothing except settings.subscription still goes
// through — otherwise the only way back would be the Firebase console.
export function onlySubscriptionChanged(prev, next) {
  const strip = (d) => {
    const copy = { ...(d || {}) };
    copy.settings = { ...(copy.settings || {}) };
    delete copy.settings.subscription;
    return stable(copy);
  };
  return strip(prev) === strip(next);
}

export function describeSubscription(status) {
  if (!status) return "";
  const { state, daysLeft } = status;
  if (state === "expiring") {
    if (daysLeft === 0) return "המנוי מסתיים היום.";
    if (daysLeft === 1) return "המנוי מסתיים מחר.";
    return `המנוי מסתיים בעוד ${daysLeft} ימים.`;
  }
  if (state === "grace") {
    const over = Math.abs(daysLeft);
    const left = GRACE_DAYS + daysLeft; // days of grace still remaining
    return (
      `המנוי פג לפני ${over === 1 ? "יום" : `${over} ימים`}. ` +
      `העריכה תיחסם בעוד ${left === 1 ? "יום" : `${left} ימים`} אם לא יחודש.`
    );
  }
  if (state === "lapsed") return "המנוי פג. המערכת במצב צפייה בלבד עד לחידוש.";
  return "";
}
