import { useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { EditableField } from "./ui/EditableField.jsx";
import { IconUsers, IconWarning, IconPlus } from "./ui/icons.jsx";
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
export default function SettingsView({ data, contractIndex, asOf = todayISO(), readOnly = false, update, add, remove }) {
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
                    <td className="td tnum text-slate-600">
                      <EditableField value={v.phone} readOnly={readOnly} placeholder="—"
                        onSave={(x) => update("vendors", v.id, { phone: x })} />
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
