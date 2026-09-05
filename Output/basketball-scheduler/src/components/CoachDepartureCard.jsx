import { useState } from "react";
import {
  departureHoldings, describeHoldings, unclaimedAddresses, coachesMissingEmail,
} from "../utils/coachDeparture";
import { IconUserX, IconAlert } from "./ui/icons";

// Ending a coach's role, in one act.
//
// This card exists because deleting a coach from the roster was never the whole job. The
// roster row is a name and a phone number; the records that name them live in three
// subcollections and in the club's absence list, and removing the row leaves every one of
// them behind — game notes and training plans that carry the departed coach's name and
// address, on documents that name players, some of them minors. A client club has no
// Firebase console to go and fix that by hand, so without this the privacy policy was
// promising something the product could not do.
//
// Deliberately its own card and not a button on the roster row. The roster list is a shared
// component that also draws halls, and this is a different kind of act from editing a name:
// it is irreversible, it touches records the manager cannot see from this screen, and it
// should be read before it is clicked. A card that lists exactly what will happen, per
// coach, is the honest shape for that.
export function CoachDepartureCard({ coaches, notes, plans, videos, absences, onDepart }) {
  const [confirmId, setConfirmId] = useState(null);

  const rows = (coaches || [])
    .map((coach) => ({ coach, held: departureHoldings(coach, { notes, plans, videos, absences }) }))
    .filter((r) => r.held.total > 0);

  // Records written by an address the roster does not know. Searching only from the roster
  // missed exactly the coach whose email field was never filled in — and the card would
  // then disappear, so the most dangerous state was the one with nothing on screen.
  const orphans = unclaimedAddresses({ notes, plans, videos, coaches });
  const missing = coachesMissingEmail(coaches);
  const warn = missing.length > 0 && orphans.length > 0;

  // Nothing to clear is the normal state, and an empty card would be noise on every visit.
  if (rows.length === 0 && orphans.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-stone-300 overflow-hidden" dir="rtl">
      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
        <h3 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <IconUserX size={15} /> סיום תפקיד
        </h3>
        <p className="text-xs text-stone-600 mt-1">
          כשמאמן/ת מסיים/ת את תפקידו/ה: <span className="font-medium">התיעוד המקצועי נשאר
          למועדון</span> — הערות המשחק, מערכי האימון והסרטונים — <span className="font-medium">אבל
          השם וכתובת הדוא"ל יורדים מהם</span>, וסימוני ההיעדרות שנרשמו לגביו/ה נמחקים.
          פעולה חד-כיוונית.
        </p>
      </div>

      {warn && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <p className="text-xs text-amber-900 flex items-start gap-2">
            <IconAlert size={14} />
            <span>
              {missing.length === 1
                ? `לא מולאה כתובת דוא"ל ברשומה של ${missing[0].name}.`
                : `לא מולאה כתובת דוא"ל ברשומות של ${missing.length} מאמנים.`}{" "}
              הפעולה מאתרת רשומות <span className="font-medium">לפי כתובת</span>, ולכן רשומות
              שכתבו מופיעות למטה תחת "רשומות ללא מאמן משויך" ולא תחת שמם. מילוי הכתובת
              ברשומת המאמן/ת יחבר ביניהן.
            </span>
          </p>
        </div>
      )}

      <div className="divide-y divide-stone-100">
        {rows.map(({ coach, held }) => (
          <div key={coach.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm text-stone-700">
                {coach.name}
                <span className="block text-xs text-stone-500 mt-0.5">{describeHoldings(held)}</span>
              </span>
              {confirmId !== coach.id && (
                <button
                  onClick={() => setConfirmId(coach.id)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 shrink-0"
                >
                  סיום תפקיד
                </button>
              )}
            </div>

            {confirmId === coach.id && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-900 flex items-start gap-2">
                  <IconAlert size={14} />
                  <span>
                    {/* Spelled out per record type, because "יוסרו הפרטים" hides which of the two
                        very different things happens to which record. */}
                    שמו/ה וכתובתו/ה של <span className="font-medium">{coach.name}</span> יוסרו
                    {held.notes.length > 0 && " מהערות המשחק"}
                    {held.plans.length > 0 && " ממערכי האימון"}
                    {held.videos.length > 0 && " ומרשומות הסרטונים"}
                    {(held.notes.length > 0 || held.plans.length > 0 || held.videos.length > 0) &&
                      ", והתוכן עצמו יישאר למועדון"}
                    {held.absences.length > 0 && (
                      <>
                        {held.notes.length + held.plans.length + held.videos.length > 0 ? ". " : ""}
                        {held.absences.length === 1 ? "סימון היעדרות אחד יימחק" : `${held.absences.length} סימוני היעדרות יימחקו`}
                      </>
                    )}
                    . מרגע זה רק מנהל יוכל לערוך את הרשומות, ולא ניתן לבטל את הפעולה.
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { onDepart(coach); setConfirmId(null); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                  >
                    כן, סיים תפקיד
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-white"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {orphans.map((row) => (
          <div key={`orphan:${row.email}`} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm text-stone-700">
                רשומות ללא מאמן משויך
                <span className="block text-xs text-stone-500 mt-0.5" dir="ltr">{row.email}</span>
                <span className="block text-xs text-stone-500 mt-0.5">
                  {describeHoldings(row)}
                </span>
              </span>
              {confirmId !== `orphan:${row.email}` && (
                <button
                  onClick={() => setConfirmId(`orphan:${row.email}`)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 shrink-0"
                >
                  הסר פרטים
                </button>
              )}
            </div>

            {confirmId === `orphan:${row.email}` && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-xs text-amber-900 flex items-start gap-2">
                  <IconAlert size={14} />
                  <span>
                    הכתובת <span dir="ltr" className="font-medium">{row.email}</span> תוסר
                    מהרשומות האלה יחד עם השם שנשמר לצידה, והתוכן יישאר למועדון.{" "}
                    <span className="font-medium">ודאו שזו אינה כתובת של מאמן/ת פעיל/ה</span> —
                    אם כן, עדיף למלא אותה ברשומת המאמן/ת במקום להסירה כאן. לא ניתן לבטל
                    את הפעולה.
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { onDepart({ id: "", name: "", email: row.email }); setConfirmId(null); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                  >
                    כן, הסר את הפרטים
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-white"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
