import { birthdaysInWeek, playerBirthdaysInWeek, birthdayWhen, todayOffsetInWeek } from "../utils/birthdays";
import { toISODate } from "../utils/dates";

// Birthdays for the week being viewed, pulled straight from the dates on the records —
// nobody has to remember to write them into the notice.
//
// Scoped to the week rather than to a rolling window from today, so it lines up with
// everything else in this app: whatever week the board is showing, this shows the same
// week's birthdays. Looking ahead at next week's schedule shows next week's birthdays,
// which is when you would actually plan something.
//
// COACHES AND PLAYERS ARE NOT THE SAME LIST, and the difference is `myTeamIds`:
//   null  → the club (a manager)
//   [...] → those squads only (a coach — their own children, nobody else's)
//   []    → nothing
// Coach birthdays have always been club-wide; a coach is one of about thirty adults who
// chose to be listed. A child is one of about 550, and there is no reason for every coach
// in the club to hold every child's date. The scope is decided once, in App.jsx.
//
// No age anywhere. `utils/birthdays.js` drops the year before anything reaches this file.

// Beyond this many names the strip stops being a glance and starts being a list. A manager
// looking at the whole club can easily have ten in a week, and the full card in the notices
// screen is where a list belongs.
const STRIP_MAX = 4;

function Line({ entry, todayOffset, withTeam }) {
  const isToday = todayOffset === entry.offset;
  return (
    <>
      <span className="font-medium">{entry.name}</span>
      {withTeam && entry.team ? <span className="text-pink-700 text-xs"> · {entry.team}</span> : null}{" "}
      <span className={`text-xs ${isToday ? "text-pink-700 font-semibold" : "text-pink-700"}`}>
        {birthdayWhen(entry, todayOffset)}
        {isToday && <span aria-hidden="true"> 🎉</span>}
      </span>
      {/* 29 February in a common year — say so rather than quietly showing the 28th. It was
          computed and then dropped on the strip, which is where most people read this. */}
      {entry.observed && <span className="text-[11px] text-pink-700"> (נולד/ה ב-29/02)</span>}
    </>
  );
}

export function BirthdayReminder({ data, myTeamIds = [], weekStart, compact = false }) {
  const coaches = birthdaysInWeek(data?.coaches, weekStart);
  const players = playerBirthdaysInWeek(data, weekStart, { teamIds: myTeamIds });
  if (coaches.length === 0 && players.length === 0) return null;

  // "היום"/"מחר" only when the week on screen really is the current one.
  const todayOffset = todayOffsetInWeek(weekStart, toISODate(new Date()));
  const total = coaches.length + players.length;
  const title = total === 1 ? "יום הולדת השבוע" : "ימי הולדת השבוע";

  if (compact) {
    const shown = players.slice(0, STRIP_MAX);
    const rest = players.length - shown.length;
    return (
      <div
        className="no-print rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 flex items-start gap-2.5"
        dir="rtl"
      >
        <span aria-hidden="true" className="text-lg leading-none mt-0.5">🎂</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-pink-800 mb-0.5">{title}</p>
          {coaches.length > 0 && (
            <p className="text-sm text-pink-900">
              {coaches.map((c, i) => (
                <span key={c.id || i}>
                  {i > 0 && <span className="text-pink-700" aria-hidden="true"> · </span>}
                  <Line entry={c} todayOffset={todayOffset} />
                </span>
              ))}
            </p>
          )}
          {players.length > 0 && (
            <p className="text-sm text-pink-900">
              {shown.map((p, i) => (
                <span key={p.id || i}>
                  {i > 0 && <span className="text-pink-700" aria-hidden="true"> · </span>}
                  {/* No squad name in the strip. Entries are separated by " · " and the
                      squad would be joined by one too — "מאיה גל · בוגרים · יוסי כהן"
                      reads as three people. The strip answers "who, when"; the squad is
                      on the full card, which is a list rather than a glance. */}
                  <Line entry={p} todayOffset={todayOffset} />
                </span>
              ))}
              {rest > 0 && (
                <span className="text-xs text-pink-700">
                  {" "}· ועוד {rest} — במסך ההודעות
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="no-print bg-pink-50 border border-pink-200 rounded-xl p-4" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <span aria-hidden="true">🎂</span>
        <h2 className="text-sm font-semibold text-pink-900">{title}</h2>
      </div>

      {coaches.length > 0 && (
        <>
          {players.length > 0 && <p className="text-xs font-semibold text-pink-700 mb-1">מאמנים</p>}
          <ul className="space-y-1">
            {coaches.map((c, i) => (
              <li key={c.id || i} className="text-sm text-pink-900 flex items-center gap-2 flex-wrap">
                <Line entry={c} todayOffset={todayOffset} />
              </li>
            ))}
          </ul>
        </>
      )}

      {players.length > 0 && (
        <>
          <p className={`text-xs font-semibold text-pink-700 mb-0.5 ${coaches.length > 0 ? "mt-3" : ""}`}>
            שחקנים
          </p>
          {/* The rule from the terms of use, standing where it is actually read — next to
              the names. "Not for forwarding" in a document nobody opens is not a control. */}
          <p className="text-[11px] text-pink-700 mb-1.5">
            {myTeamIds === null ? "כל המועדון" : "הקבוצות שלך"} · לברכה בקבוצה, לא להעברה
          </p>
          {/* Ordered by the day it falls on, not grouped by squad: the question a week's
              list answers is "who is it today", and the squad is on the line anyway. */}
          <ul className="space-y-1">
            {players.map((p, i) => (
              <li key={p.id || i} className="text-sm text-pink-900 flex items-center gap-2 flex-wrap">
                <Line entry={p} todayOffset={todayOffset} withTeam />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
