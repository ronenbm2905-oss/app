import { useMemo, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, ORG_ID } from "../firebase.js";
import { Button } from "./ui/Button.jsx";
import { EditableField } from "./ui/EditableField.jsx";
import { IconUsers, IconWarning, IconPlus, IconCog } from "./ui/icons.jsx";
import { fmtILS } from "../utils/money.js";
import { todayISO } from "../utils/dates.js";
import { makeVendor, makeEmployee } from "../schema.js";
import { vendorSpend } from "../utils/vendors.js";
import { canDeleteVendor, canDeleteEmployee, employeeUsage } from "../utils/entities.js";

/**
 * ניהול הישויות המשותפות: ספקים ועובדים.
 *
 * ספק אחד משרת 82 בניינים ועובד אחד אחראי על 50 — ולכן **מחיקה אינה פעולה
 * מקומית**. כל מחיקה עוברת דרך מדריך טהור (`canDeleteVendor` /
 * `canDeleteEmployee`) שמחזיר סיבה, והכפתור מושבת עם הסיבה כ-tooltip.
 * הכלל: אי אפשר למחוק ישות שמישהו מצביע עליה — קודם מחליפים אותה.
 */
export default function SettingsView({ data, contractIndex, asOf = todayISO(), readOnly = false, update, add, remove, auth = {} }) {
  const [newMember, setNewMember] = useState("");
  const [memberError, setMemberError] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [newEmployee, setNewEmployee] = useState("");
  const [confirm, setConfirm] = useState(null); // { kind, id, name, reason }

  const spendById = useMemo(() => {
    const rows = vendorSpend(data.vendors, data.buildings, contractIndex, asOf);
    return new Map(rows.map((r) => [r.id, r]));
  }, [data.vendors, data.buildings, contractIndex, asOf]);

  const vendors = useMemo(
    () => [...data.vendors].sort((a, b) =>
      (spendById.get(b.id)?.monthlySpend || 0) - (spendById.get(a.id)?.monthlySpend || 0) ||
      a.name.localeCompare(b.name, "he")),
    [data.vendors, spendById]
  );

  const addVendor = () => {
    const name = newVendor.trim();
    if (!name || readOnly) return;
    add("vendors", makeVendor({ name }));
    setNewVendor("");
  };
  const addEmployee = () => {
    const name = newEmployee.trim();
    if (!name || readOnly) return;
    add("employees", makeEmployee({ name }));
    setNewEmployee("");
  };

  /**
   * ניהול המורשים. הרשימה יושבת ב-`orgs/{ORG_ID}` ונאכפת ב-`firestore.rules`;
   * המסך הזה הוא רק הדרך הנוחה לערוך אותה.
   *
   * ⚠ **אי אפשר להסיר את עצמך.** לא נימוס אלא הגנה: ארגון שנשאר בלי אף מורשה
   * אינו ניתן לתיקון מהממשק — הכללים חוסמים את מי שכבר אינו ברשימה, כולל את מי
   * שהסיר את עצמו רגע קודם. הכלל נאכף גם ב-rules, לא רק כאן.
   */
  const saveMembers = async (next) => {
    setMemberError("");
    try {
      await updateDoc(doc(db, "orgs", ORG_ID), { members: next });
    } catch (e) {
      setMemberError(`עדכון המורשים נכשל: ${e.message}`);
    }
  };
  const MEMBER_CAP = 3;
  const addMember = () => {
    const email = newMember.trim().toLowerCase();
    if (!email) return;
    if (auth.members.length >= MEMBER_CAP) {
      setMemberError(`הרשימה מלאה (${MEMBER_CAP}). הסר מישהו לפני שתוסיף.`);
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMemberError("כתובת מייל לא תקינה"); return; }
    if (auth.members.includes(email)) { setMemberError("הכתובת כבר ברשימה"); return; }
    saveMembers([...auth.members, email]);
    setNewMember("");
  };
  const removeMember = (email) => saveMembers(auth.members.filter((m) => m !== email));

  const askDelete = (kind, id, name) => {
    const guard = kind === "vendors"
      ? canDeleteVendor(id, data.contracts)
      : canDeleteEmployee(id, data.buildings);
    if (!guard.ok) { setConfirm({ kind, id, name, blocked: guard.reason }); return; }
    setConfirm({ kind, id, name, blocked: null });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      {readOnly && (
        <div className="card border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          צפייה בתמונה של תאריך עבר — העריכה נעולה. חזרה להיום כדי לערוך.
        </div>
      )}

      {confirm && (
        <div className="card border-amber-300 bg-amber-50 p-4">
          {confirm.blocked ? (
            <>
              <div className="flex items-start gap-2">
                <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div className="text-sm text-amber-900">
                  <b>אי אפשר למחוק את ״{confirm.name}״.</b> {confirm.blocked}
                </div>
              </div>
              <Button className="mt-3" onClick={() => setConfirm(null)}>הבנתי</Button>
            </>
          ) : (
            <>
              <div className="text-sm text-amber-900">
                למחוק את ״{confirm.name}״? אף רשומה לא מצביעה עליו, ולכן המחיקה בטוחה.
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="danger" onClick={() => { remove(confirm.kind, confirm.id); setConfirm(null); }}>
                  מחיקה
                </Button>
                <Button onClick={() => setConfirm(null)}>ביטול</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- מי מורשה להיכנס למערכת --- */}
      {auth.cloud && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-baseline gap-2 border-b border-slate-200 px-4 py-3">
            <IconCog className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">
              גישה למערכת ({auth.members.length} מתוך 3)
            </h2>
            <span className="text-xs text-slate-500">
              כל מי שברשימה רואה וכותב הכול — אין הסתרה ואין תפקידים
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {auth.members.map((m) => (
              <li key={m} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium">
                  {m}
                  {m === auth.email && <span className="mr-2 text-xs text-slate-400">(אתה)</span>}
                </span>
                <button
                  disabled={m === auth.email}
                  title={m === auth.email ? "אי אפשר להסיר את עצמך — זה היה נועל את כולם החוצה" : "הסרת הגישה"}
                  onClick={() => removeMember(m)}
                  className="text-xs text-red-600 hover:underline disabled:text-slate-300 disabled:no-underline"
                >
                  הסרה
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
            <input
              value={newMember}
              onChange={(e) => { setNewMember(e.target.value); setMemberError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              placeholder="כתובת Gmail של חבר צוות…"
              className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <Button disabled={!newMember.trim() || auth.members.length >= 3} onClick={addMember}>
              <IconPlus /> הוספה
            </Button>
            {memberError && <span className="text-xs text-red-700">{memberError}</span>}
          </div>
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs leading-relaxed text-slate-500">
            ⚠ הכתובת חייבת להיות זו שאיתה הוא מתחבר ל-Google. אחרי ההוספה הוא
            נכנס לאותה כתובת אתר ומתחבר — אין הזמנה במייל ואין סיסמה.
          </p>
          {/*
            ⚠ התקרה אינה שרירותית והיא נאכפת גם ב-`firestore.rules`. תקנות אבטחת
            מידע מכירות ב״מאגר המנוהל בידי יחיד״ — הקטגוריה עם החובות המצומצמות
            ביותר — ואחד מתנאיה הוא היחיד + לכל היותר שני בעלי הרשאה נוספים.
          */}
          <p className={`border-t px-4 py-2 text-xs leading-relaxed ${
            auth.members.length >= 3
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-slate-100 bg-slate-50 text-slate-500"}`}>
            {auth.members.length >= 3 ? <b>הרשימה מלאה. </b> : null}
            המערכת מוגבלת ל-3 מורשים. זו אינה מגבלה טכנית אלא <b>קו משפטי</b>:
            מאגר בניהול יחיד עם עד שני בעלי הרשאה נוספים נהנה מהחובות
            המצומצמות ביותר בתקנות אבטחת מידע. מורשה רביעי מוציא את המאגר
            מהקטגוריה ומחייב נוהל אבטחה כתוב, תיעוד גישה, הדרכות וביקורת
            תקופתית. אם באמת צריך רביעי — זו שיחה עם עורך דין, לא שינוי הגדרה.
          </p>
        </div>
      )}

      {/* --- עובדים --- */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <IconUsers className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700">עובדים ({data.employees.length})</h2>
        </div>
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className="th">שם</th><th className="th">בניינים באחריותו</th><th className="th">פעיל</th><th className="th" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.employees.map((e) => {
              const usage = employeeUsage(e.id, data.buildings);
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="td font-medium">
                    <EditableField value={e.name} readOnly={readOnly}
                      onSave={(v) => update("employees", e.id, { name: v })} />
                  </td>
                  <td className="td tnum text-slate-600">{usage.buildingCount}</td>
                  <td className="td">
                    <EditableField type="checkbox" value={e.active} readOnly={readOnly} placeholder="פעיל"
                      onSave={(v) => update("employees", e.id, { active: v })} />
                  </td>
                  <td className="td text-left">
                    <button disabled={readOnly} onClick={() => askDelete("employees", e.id, e.name)}
                      className="text-xs text-red-600 hover:underline disabled:text-slate-300 disabled:no-underline">
                      מחיקה
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          <input value={newEmployee} onChange={(e) => setNewEmployee(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmployee()}
            placeholder="שם עובד חדש…" disabled={readOnly}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <Button disabled={readOnly || !newEmployee.trim()} onClick={addEmployee}><IconPlus /> הוספה</Button>
        </div>
      </div>

      {/* --- ספקים --- */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">ספקים ({data.vendors.length})</h2>
          <span className="text-xs text-slate-500">שינוי שם או טלפון מתעדכן בכל הבניינים</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">שם</th><th className="th">טלפון</th>
                <th className="th">בניינים</th><th className="th">הוצאה חודשית</th>
                <th className="th">עוסק פטור</th><th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map((v) => {
                const s = spendById.get(v.id);
                return (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="td font-medium">
                      <EditableField value={v.name} readOnly={readOnly}
                        onSave={(x) => update("vendors", v.id, { name: x })} />
                    </td>
                    {/*
                      ⚠ M2 (עדי): ספק שמשויך לחוזים אינו ניתן למחיקה — נכון,
                      כי מחיקה הייתה שוברת את ההיסטוריה. אבל **ההיסטוריה צריכה
                      את השם, לא את הטלפון.** בלי הכפתור הזה טלפון של ספק
                      לא-פעיל היה נשמר לנצח בלי שום דרך להסירו — וזה הביטוי
                      המעשי היחיד של צמצום מידע במערכת.
                    */}
                    <td className="td tnum text-slate-600">
                      <div className="flex items-center gap-1">
                        <EditableField value={v.phone} readOnly={readOnly} placeholder="—"
                          onSave={(x) => update("vendors", v.id, { phone: x })} />
                        {v.phone && !readOnly && (
                          <button
                            onClick={() => update("vendors", v.id, { phone: "" })}
                            title="ניקוי הטלפון — השם וההיסטוריה נשמרים"
                            className="text-xs text-slate-400 hover:text-red-600"
                          >
                            ניקוי
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="td tnum text-slate-600">{s?.buildingCount ?? 0}</td>
                    <td className="td tnum">{s ? fmtILS(s.monthlySpend) : <span className="text-slate-300">—</span>}</td>
                    <td className="td">
                      <EditableField type="checkbox" value={v.vatExempt} readOnly={readOnly} placeholder="פטור"
                        title="הסכומים של הספק כוללים מע״מ רעיוני שנוסף להשוואה"
                        onSave={(x) => update("vendors", v.id, { vatExempt: x })} />
                    </td>
                    <td className="td text-left">
                      <button disabled={readOnly} onClick={() => askDelete("vendors", v.id, v.name)}
                        className="text-xs text-red-600 hover:underline disabled:text-slate-300 disabled:no-underline">
                        מחיקה
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
          <input value={newVendor} onChange={(e) => setNewVendor(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addVendor()}
            placeholder="שם ספק חדש…" disabled={readOnly}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
          <Button disabled={readOnly || !newVendor.trim()} onClick={addVendor}><IconPlus /> הוספה</Button>
        </div>
      </div>
    </div>
  );
}
