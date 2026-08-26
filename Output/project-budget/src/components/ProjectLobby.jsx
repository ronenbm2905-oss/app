import { useRef, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { Field } from "./ui/Field.jsx";
import { IconBuilding, IconPlus, IconUpload, IconDownload, IconWarning } from "./ui/icons.jsx";
import { fmtILS } from "../utils/money.js";
import { makeProject } from "../schema.js";
import { DEFAULT_VAT_RATE } from "../constants.js";
import { ROLE_OWNER, normalizeEmail } from "../utils/access.js";

/**
 * מסך הפתיחה: בחירת פרויקט, יצירת פרויקט חדש, וייבוא קובץ seed.
 * הייבוא הוא הדרך המעשית להתחיל — 91 סעיפי כתב כמויות ו-20 חודשי תזרים
 * הם לא משהו שמקלידים ביד.
 */
export default function ProjectLobby({ store, auth }) {
  const { data, setSettings, replaceAll } = store;
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const projects = data.projects || [];
  const myEmail = normalizeEmail(auth?.user?.email);

  const createProject = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");
    // היוצר הוא הבעלים. בענן הכללים דורשים זאת במפורש — פרויקט שנוצר בלי
    // בעלים הוא פרויקט שאיש לא יכול לערוך, כולל את ההרשאות שלו.
    const p = makeProject({
      name: trimmed,
      address: trimmed,
      vatRate: DEFAULT_VAT_RATE,
      memberRoles: myEmail ? { [myEmail]: ROLE_OWNER } : {},
    });
    try {
      await store.createProject(p);
      setSettings({ activeProjectId: p.id });
      setName("");
    } catch (e) {
      setError(`יצירת הפרויקט נכשלה: ${e.message}`);
    }
  };

  const load = (raw) => {
    if (!Array.isArray(raw.projects) || !raw.projects.length) {
      setError("הקובץ לא מכיל פרויקטים. צפוי פלט של `npm run import:pinsker`.");
      return false;
    }
    replaceAll(raw);
    return true;
  };

  const onFile = async (file) => {
    setError("");
    if (!file) return;
    try {
      load(JSON.parse(await file.text()));
    } catch (e) {
      setError(`קריאת הקובץ נכשלה: ${e.message}`);
    }
  };

  /**
   * טעינה ישירה מ-`seed/` שעל שרת הפיתוח — בלי לחפש את הקובץ בדיסק.
   * ה-localStorage הוא פר-דפדפן, ולכן ייבוא שנעשה בדפדפן אחד לא מופיע באחר;
   * זה המסלול שהופך "להריץ את הייבוא" ל"לראות את הנתונים" בלחיצה אחת.
   */
  const loadFromServer = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/seed/pinsker-9.json?t=${Date.now()}`);
      if (!res.ok) {
        setError(
          `לא נמצא seed/pinsker-9.json על השרת (${res.status}). הרץ: npm run import:pinsker`,
        );
        return;
      }
      load(await res.json());
    } catch (e) {
      setError(`הטעינה נכשלה: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold">ניהול תקציב פרויקט</h1>
      <p className="mb-8 text-sm text-ink-muted">
        תזרים תשלומים, פנקס חשבוניות, ומנות הגשה לרשות — על מודל אחד.
      </p>

      {projects.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-ink-body">הפרויקטים שלי</h2>
          <ul className="space-y-2">
            {projects.map((p) => {
              const budget = (data.costLines || [])
                .filter((c) => c.projectId === p.id)
                .reduce((s, c) => s + c.budgetGross, 0);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setSettings({ activeProjectId: p.id })}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3 text-right transition hover:border-accent"
                  >
                    <span className="flex items-center gap-2">
                      <IconBuilding size={18} className="text-accent" />
                      <span className="font-semibold text-navy">{p.name}</span>
                    </span>
                    {budget > 0 && <span className="num text-sm text-ink-muted">{fmtILS(budget)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mb-8 rounded-lg border border-border bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-body">פרויקט חדש</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Field label="שם הפרויקט" value={name} onChange={setName} placeholder="לדוגמה: פינסקר 9, תל אביב" />
          </div>
          <Button onClick={createProject} disabled={!name.trim()}>
            <IconPlus size={16} /> יצירה
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface-alt p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink-body">ייבוא מקובץ</h2>
        <p className="mb-3 text-xs text-ink-muted">
          טוען פלט של <code className="num">npm run import:pinsker</code> — כתב כמויות, שורות
          עלות, לוח תשלומים, מקורות מימון ומנות. <strong>מחליף את כל הנתונים הקיימים.</strong>
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={loadFromServer} disabled={busy}>
            <IconDownload size={16} /> {busy ? "טוען…" : "טעינת פינסקר 9 מהשרת"}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <IconUpload size={16} /> בחירת קובץ אחר
          </Button>
        </div>
        {error && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-danger-text">
            <IconWarning size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
