import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "./ui/Button.jsx";
import { IconUpload, IconBuilding, IconWarning } from "./ui/icons.jsx";
import { importWorkbook } from "../utils/importWorkbook.js";
import { validateBackup } from "../utils/backup.js";

/**
 * מסך הפתיחה.
 *
 * מקבל **את קובץ האקסל עצמו** — אותו `importWorkbook` שרץ ב-CLI רץ כאן בדפדפן,
 * ולכן אין שני מסלולי ייבוא שיכולים להיפרד. זה מה שמאפשר להשתמש במערכת בלי
 * להתקין Node: לוחצים על הקובץ, גוררים אקסל, וזהו.
 *
 * מקבל גם קובץ גיבוי או `seed/vitzman.json`, למי שכן מריץ מהטרמינל.
 */
export default function ImportView({ onLoad }) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handle = async (file) => {
    setError(""); setChecks(null);
    if (!file) return;
    setBusy(true);
    try {
      if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) {
        const wb = XLSX.read(await file.arrayBuffer(), { cellFormula: true, bookFiles: true });
        const result = importWorkbook(wb, file.name);
        setChecks(result.checks);
        if (!result.ok) {
          setError(
            `${result.failed.length} מבחני התאמה נכשלו — הנתונים לא נטענו. ` +
            `הייבוא לא מייצר תמונה חלקית שנראית תקינה.`
          );
          return;
        }
        onLoad(result.payload);
        return;
      }
      const check = validateBackup(JSON.parse(await file.text()));
      if (!check.ok) { setError(check.reason); return; }
      onLoad(check.data);
    } catch (e) {
      setError(`קריאת הקובץ נכשלה: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files?.[0]); }}
        className={`card p-8 text-center transition ${dragging ? "border-slate-900 bg-slate-50" : ""}`}
      >
        <IconBuilding className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-semibold">ויצמן — ניהול תקציב בניינים</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          גרור לכאן את <b>קובץ האקסל של הבניינים</b>, או לחץ לבחירה.
          <br />
          <span className="text-slate-400">
            מתקבל גם קובץ גיבוי (<code>.json</code>) שנשמר קודם.
          </span>
        </p>

        <div className="mt-6">
          <Button variant="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <IconUpload /> {busy ? "קורא…" : "בחירת קובץ"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm,.xls,application/json,.json"
            className="hidden"
            onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-right text-sm text-red-700">{error}</p>
        )}

        {checks && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-right">
            <div className="text-xs font-semibold text-slate-600">מבחני התאמה מול הגיליון</div>
            <ul className="mt-1 space-y-0.5 text-xs">
              {checks.map((c) => (
                <li key={c.name} className={c.ok ? "text-emerald-700" : "text-red-700"}>
                  {c.ok ? "✓" : "✗"} {c.name}:{" "}
                  <span className="tnum">
                    {typeof c.actual === "number" ? c.actual.toLocaleString("he-IL") : String(c.actual)}
                  </span>
                  {!c.ok && (
                    <span className="tnum"> (צפוי: {typeof c.expected === "number"
                      ? c.expected.toLocaleString("he-IL") : String(c.expected)})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-right">
          <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-xs leading-relaxed text-amber-900">
            הנתונים נשמרים <b>בדפדפן הזה בלבד</b> ולא נשלחים לשום מקום. אחרי כל סבב
            הזנה — שמור גיבוי מלשונית ״גיבוי״, אחרת ניקוי היסטוריית גלישה מוחק הכל.
          </p>
        </div>
      </div>
    </div>
  );
}
