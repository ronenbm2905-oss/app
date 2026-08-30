import { useRef, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { IconDownload, IconUpload, IconWarning } from "./ui/icons.jsx";
import { fmtDate, todayISO } from "../utils/dates.js";
import {
  makeBackup, validateBackup, backupFilename, downloadText,
  profitabilityCsv, inspectionsCsv, priceHistoryCsv,
} from "../utils/backup.js";

/**
 * גיבוי, שחזור וייצוא.
 *
 * כל הנתונים יושבים ב-localStorage של דפדפן אחד. בלי הפאנל הזה, ניקוי היסטוריית
 * גלישה מוחק חודשים של עבודה בלי אזהרה ובלי דרך חזרה.
 *
 * **השחזור מאמת לפני שהוא דורס**, ומראה מה עומד להיטען — שחזור הוא פעולה
 * הרסנית, ופעולה הרסנית חייבת להיות ניתנת לבדיקה מראש.
 */
export default function BackupBar({ data, asOf, onRestore }) {
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null); // { data, counts, filename }
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const saveBackup = () => {
    downloadText(backupFilename(), JSON.stringify(makeBackup(data), null, 2), "application/json");
    setFlash(`הגיבוי ירד כ-${backupFilename()}`);
    setTimeout(() => setFlash(""), 6000);
  };

  const pickFile = async (file) => {
    setError(""); setPending(null);
    if (!file) return;
    try {
      const check = validateBackup(JSON.parse(await file.text()));
      if (!check.ok) { setError(check.reason); return; }
      setPending({ data: check.data, counts: check.counts, filename: file.name });
    } catch (e) {
      setError(`קריאת הקובץ נכשלה: ${e.message}`);
    }
  };

  const confirmRestore = () => {
    onRestore(pending.data);
    setFlash(`שוחזר מ-${pending.filename}`);
    setPending(null);
    setTimeout(() => setFlash(""), 6000);
  };

  // שמות קבצים ב-ASCII: דפדפנים לא משמרים שם עברי בהורדה מ-`file://`, והקובץ
  // היה נוחת בשם "download" בלי סיומת. גם על Windows זה פשוט יותר.
  const csv = (name, text) => downloadText(`vitzman-${name}-${asOf}.csv`, text, "text/csv;charset=utf-8");

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="card border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="text-sm leading-relaxed text-amber-900">
            <b>הנתונים שמורים בדפדפן הזה בלבד.</b> ניקוי היסטוריית גלישה, מעבר למחשב
            אחר או חלון פרטי — והכל נעלם בלי אזהרה. <b>שמור גיבוי אחרי כל סבב הזנה.</b>
          </div>
        </div>
      </div>

      {flash && <div className="card border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">✓ {flash}</div>}

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-700">גיבוי ושחזור</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          הגיבוי הוא <b>המצב המלא</b> — אפשר לטעון אותו חזרה ולקבל בדיוק את מה שהיה.
          קובצי ה-CSV למטה הם לקריאה ולדוחות; <b>אי אפשר לשחזר מהם</b>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={saveBackup}><IconDownload /> שמירת גיבוי</Button>
          <Button onClick={() => fileRef.current?.click()}><IconUpload /> טעינת גיבוי</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <span className="self-center text-xs text-slate-500">ייצוא לאקסל (CSV):</span>
          <Button onClick={() => csv("profitability", profitabilityCsv(data, asOf))}>רווחיות</Button>
          <Button onClick={() => csv("inspections", inspectionsCsv(data, asOf))}>ביקורות</Button>
          <Button onClick={() => csv("price-history", priceHistoryCsv(data))}>היסטוריית מחירים</Button>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {pending && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <div className="text-sm font-medium text-amber-900">
              לשחזר מ-<code>{pending.filename}</code>?
            </div>
            <div className="mt-1 text-xs leading-relaxed text-amber-800">
              ייטענו: {pending.counts.buildings} בניינים · {pending.counts.contracts} חוזים ·{" "}
              {pending.counts.feeAgreements} הסכמי ניהול · {pending.counts.inspections} ביקורות ·{" "}
              {pending.counts.notes} הערות.
              <br />
              <b>המצב הנוכחי בדפדפן יידרס.</b> אם עוד לא שמרת גיבוי — שמור עכשיו לפני שתאשר.
            </div>
            <div className="mt-2 flex gap-2">
              <Button variant="danger" onClick={confirmRestore}>שחזור ודריסה</Button>
              <Button onClick={() => setPending(null)}>ביטול</Button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-700">מצב נוכחי</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["בניינים", data.buildings.length],
            ["חוזים", data.contracts.length],
            ["הסכמי ניהול", (data.feeAgreements || []).length],
            ["ספקים", data.vendors.length],
            ["ביקורות", data.inspections.length],
            ["הערות", data.notes.length],
          ].map(([label, n]) => (
            <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">{label}</div>
              <div className="text-lg font-semibold tnum">{n}</div>
            </div>
          ))}
        </div>
        {data.meta?.importedAt && (
          <p className="mt-3 text-xs text-slate-400">
            יובא מ-{data.meta.sourceFile || "אקסל"} בתאריך {fmtDate(data.meta.importedAt.slice(0, 10))}
          </p>
        )}
      </div>
    </div>
  );
}
