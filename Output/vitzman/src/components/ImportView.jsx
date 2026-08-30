import { useRef, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { IconUpload, IconBuilding } from "./ui/icons.jsx";

/**
 * מסך הפתיחה. הייבוא הוא הדרך המעשית להתחיל — 131 בניינים ו-2,715 חוזים
 * הם לא משהו שמקלידים ביד.
 */
export default function ImportView({ onLoad }) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");

  const onFile = async (file) => {
    setError("");
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!Array.isArray(raw.buildings) || !raw.buildings.length) {
        setError("הקובץ לא מכיל בניינים. צפוי הפלט של `npm run import:vitzman`.");
        return;
      }
      onLoad(raw);
    } catch (e) {
      setError(`קריאת הקובץ נכשלה: ${e.message}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="card p-8 text-center">
        <IconBuilding className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-semibold">ויצמן — ניהול תקציב בניינים</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          אין עדיין נתונים במערכת. הרץ <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run import:vitzman</code>{" "}
          וטען כאן את <code className="rounded bg-slate-100 px-1.5 py-0.5">seed/vitzman.json</code>.
        </p>

        <div className="mt-6">
          <Button variant="primary" onClick={() => fileRef.current?.click()}>
            <IconUpload /> טעינת קובץ
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <p className="mt-6 text-xs leading-relaxed text-slate-400">
          הנתונים נשמרים בדפדפן הזה בלבד (localStorage). הם לא נשלחים לשום מקום
          ולא נכנסים ל-git.
        </p>
      </div>
    </div>
  );
}
