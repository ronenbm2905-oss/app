import { useState } from "react";
import { entriesByDay, entrySummary, localTime, LOG_KINDS, KIND_LABELS } from "../utils/importLog";
import { IconCheck, IconAlert, IconChevronDown, IconChevronUp } from "./ui/icons";

// What came in from the federation, and who said yes to it.
//
// Until 23.9.2026 this had no screen at all: the proposals were listened to, filtered down
// to the one still open, and the rest thrown away. A manager who approved ninety-four
// fixtures in one evening had nowhere to go afterwards and ask what they had been.
//
// Read-only on purpose, and not only because there is nothing to edit. An entry is the
// record that a named person approved a change a background job proposed — `firestore.rules`
// refuses an update or a delete on this collection, so the screen has no button that the
// rules would reject anyway.

const TONE = {
  added: "text-green-700",
  updated: "text-amber-700",
  cancelled: "text-red-700",
  restored: "text-sky-700",
};

function Entry({ entry }) {
  const [open, setOpen] = useState(false);
  // Israel time, not the raw UTC string. `at` is an ISO stamp and slicing it printed UTC
  // while looking exactly like a local clock — see `localTime` in utils/importLog.js.
  const time = localTime(entry.at);

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-stone-50"
      >
        <span className="text-xs font-semibold text-stone-700 tabular-nums shrink-0" dir="ltr">{time}</span>
        <span className="text-xs text-stone-700 flex-1 min-w-0 truncate">{entrySummary(entry)}</span>
        {/* Said out loud, because three entries on one date are otherwise unexplained: is
            that three files, or one file approved squad by squad? */}
        {entry.partial && <span className="text-[11px] text-stone-500 shrink-0">אישור חלקי</span>}
        {open ? <IconChevronUp size={14} className="text-stone-500 shrink-0" /> : <IconChevronDown size={14} className="text-stone-500 shrink-0" />}
      </button>

      {open && (
        <div className="px-3 py-2 border-t border-stone-100 space-y-2">
          <p className="text-[11px] text-stone-500">
            אישר/ה: {entry.by || "—"}
            {entry.sourceFile ? ` · מקור: ${entry.sourceFile}` : ""}
            {entry.proposalId ? ` · הצעה ${entry.proposalId}` : ""}
          </p>
          {LOG_KINDS.map((kind) => {
            const items = Array.isArray(entry[kind]) ? entry[kind] : [];
            if (items.length === 0) return null;
            return (
              <div key={kind}>
                <p className={`text-[11px] font-semibold ${TONE[kind]}`}>
                  {KIND_LABELS[kind]} ({items.length})
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {items.map((it, i) => (
                    <li key={`${it.code}-${i}`} className="text-xs text-stone-600">
                      {it.label || it.code || "—"}
                      {/* The number the league identifies the fixture by — the one field
                          here that cannot be recovered from the sentence beside it. */}
                      {/* stone-500, not stone-400. This is the fifth time that shade has
                          failed the 4.5:1 the accessibility statement claims — and here it
                          was on the fixture NUMBER, the one field the comment above calls
                          irrecoverable from the sentence beside it. */}
                      {it.code && it.label ? <span className="text-stone-500 tabular-nums"> · {it.code}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ImportLogView({ entries, logFailed }) {
  const days = entriesByDay(entries);

  // "The read failed" and "nothing has been imported yet" are the same empty list, and a
  // screen that showed one sentence for both would be quietly lying on the day it matters.
  if (logFailed) {
    return (
      <div className="text-xs text-red-700 flex items-start gap-1.5" dir="rtl">
        <IconAlert size={14} className="mt-0.5 shrink-0" />
        <span>לא הצלחנו לקרוא את יומן הייבוא. רענן/י את הדף — אין זה אומר שהיומן ריק.</span>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="space-y-2" dir="rtl">
        <div className="text-xs text-stone-500 flex items-start gap-1.5">
          <IconCheck size={13} className="mt-0.5 opacity-60 shrink-0" />
          <span>
            עדיין לא נרשם ייבוא. היומן מתחיל להתמלא מהאישור הבא —
            <span className="font-medium"> ייבוא שאושר לפני 23.9.2026 אינו כאן</span>, כי הרישום לא היה קיים.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      <p className="text-xs text-stone-500">
        כל אישור של קובץ מהאיגוד, לפי סדר יורד. הרשומות אינן ניתנות לעריכה או למחיקה מהמסך.
      </p>
      {days.map((d) => (
        <div key={d.day} className="space-y-1.5">
          <div className="text-xs font-semibold text-stone-600">
            {d.day}
            <span className="text-stone-500 font-normal"> · {d.total} משחקים</span>
          </div>
          {d.entries.map((e, i) => (
            <Entry key={e.id || `${e.at}-${i}`} entry={e} />
          ))}
        </div>
      ))}
    </div>
  );
}
