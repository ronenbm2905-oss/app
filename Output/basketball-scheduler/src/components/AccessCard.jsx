import { useState } from "react";
import {
  accessList, grantRole, revokeAccess, isValidEmail, normalizeEmail,
  wouldLockOut, brokenEntries,
} from "../utils/access";
import { IconTrash, IconCheck, IconAlert, IconUserPlus } from "./ui/icons";

// Hebrew agreement runs through the verb as well as the noun, so these return the
// whole clause rather than a count to be glued onto a fixed sentence.
const wontEnter = (n) =>
  n === 1
    ? "כתובת אחת לא תיכנס בפועל — היא שמורה עם אותיות גדולות"
    : `${n} כתובות לא ייכנסו בפועל — הן שמורות עם אותיות גדולות`;
const wereFixed = (n) => (n === 1 ? "כתובת אחת תוקנה" : `${n} כתובות תוקנו`);

// Managing who can open the club, without going into the Firebase console.
//
// The console meant editing a raw array by hand, and the security rules compare the
// address exactly as stored — so one capital letter locked a coach out with no
// explanation the app could give. Everything added here is lowercased first.
//
// A club's own manager has no console to be sent to, so on a multi-club deployment this
// screen is not a convenience — it is the only way a club adds a coach. The document-size
// meter that accompanies this card on the single-club branch is deliberately absent: the
// settings screen around it already has one.
export function AccessCard({ data, save, currentEmail }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [msg, setMsg] = useState("");

  const rows = accessList(data);
  const broken = brokenEntries(data);

  const add = () => {
    const e = normalizeEmail(email);
    if (!isValidEmail(e)) { setMsg("כתובת לא תקינה. בדוק שיש @ ושם מתחם."); return; }
    if (rows.some((r) => normalizeEmail(r.email) === e)) { setMsg("הכתובת כבר ברשימה."); return; }
    save(grantRole(data, e, role));
    setEmail("");
    setMsg(`${e} נוסף${role === "admin" ? " כמנהל" : " כצופה"}.`);
  };

  const remove = (target) => {
    if (wouldLockOut(data, target)) {
      setMsg("זה המנהל האחרון. אם תסיר אותו, איש לא יוכל לערוך — ואי אפשר לתקן את זה מתוך האפליקציה.");
      return;
    }
    save(revokeAccess(data, target));
    setMsg(`${target} הוסר.`);
  };

  const setRoleOf = (target, next) => {
    if (next === "member" && wouldLockOut(data, target)) {
      setMsg("זה המנהל האחרון. הורדה לצפייה תשאיר את המועדון בלי אף אחד שיכול לערוך.");
      return;
    }
    save(grantRole(data, target, next));
    setMsg(`${target} — ${next === "admin" ? "מנהל" : "צפייה בלבד"}.`);
  };

  const fixCasing = () => {
    let next = data;
    for (const bad of broken) {
      const role = (data.admins || []).includes(bad) ? "admin" : "member";
      next = grantRole(revokeAccess(next, bad), bad, role);
    }
    save(next);
    setMsg(`${wereFixed(broken.length)} לאותיות קטנות.`);
  };

  const inputCls =
    "bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden" dir="rtl">
      <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center gap-2 text-stone-700 font-semibold text-sm">
        <IconUserPlus size={16} /> מי יכול להיכנס
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-stone-500">
          מנהל יכול לערוך הכול. צופה רואה את הלוח בלבד. הכתובת חייבת להיות בדיוק זו של חשבון
          הגוגל שאיתו הוא מתחבר — היא נשמרת באותיות קטנות אוטומטית.
        </p>

        {broken.length > 0 && (
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2.5 flex items-start gap-2">
            <IconAlert size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <strong>{wontEnter(broken.length)}</strong>, והבדיקה רגישה לכך. נראֶה
              מורשה במסך הזה — ואינו.
              <div className="mt-1 text-[11px]" dir="ltr">{broken.join(", ")}</div>
              <button onClick={fixCasing} className="mt-1.5 underline font-semibold">תקן אותן</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="coach@gmail.com"
            className={`${inputCls} flex-1 min-w-[200px]`}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            <option value="member">צופה</option>
            <option value="admin">מנהל</option>
          </select>
          <button
            onClick={add}
            className="px-4 min-h-11 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            הוסף
          </button>
        </div>

        {msg && <p className="text-xs text-stone-600 flex items-center gap-1"><IconCheck size={13} /> {msg}</p>}

        <ul className="border border-stone-200 rounded-lg divide-y divide-stone-100">
          {rows.length === 0 ? (
            <li className="p-4 text-sm text-stone-500 text-center">אין עדיין מורשים.</li>
          ) : (
            rows.map((r) => (
              <li key={r.email} className="flex items-center gap-2 px-3 py-2 flex-wrap">
                <span className="text-sm text-stone-800 flex-1 min-w-0 truncate" dir="ltr">{r.email}</span>
                {normalizeEmail(r.email) === normalizeEmail(currentEmail) && (
                  <span className="text-[11px] text-stone-500">זה אתה</span>
                )}
                <select
                  value={r.role}
                  onChange={(e) => setRoleOf(r.email, e.target.value)}
                  className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs"
                >
                  <option value="member">צופה</option>
                  <option value="admin">מנהל</option>
                </select>
                <button
                  onClick={() => remove(r.email)}
                  aria-label={`הסר ${r.email}`}
                  className="w-11 h-11 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
                >
                  <IconTrash size={15} />
                </button>
              </li>
            ))
          )}
        </ul>

      </div>
    </div>
  );
}
