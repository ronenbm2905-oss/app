import { useRef, useState } from "react";
import { IconBuilding, IconChevronDown, IconDownload, IconUpload } from "./ui/icons.jsx";
import { downloadBackup, validateBackup } from "../utils/backup.js";
import { ROLE_LABEL } from "../constants.js";

export default function TopBar({ project, store, auth, role, onSwitchProject, cloudMode }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  const save = () => {
    const name = downloadBackup(store.data, project.name);
    setMsg({ tone: "ok", text: `נשמר: ${name}` });
    setTimeout(() => setMsg(null), 5000);
  };

  const restore = async (file) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const err = validateBackup(raw);
      if (err) {
        setMsg({ tone: "bad", text: err });
        return;
      }
      const counts = `${raw.projects.length} פרויקטים · ${raw.invoices?.length ?? 0} חשבוניות`;
      if (!confirm(`לשחזר מהגיבוי (${counts})?\n\nכל הנתונים הקיימים יימחקו.`)) return;
      store.replaceAll(raw);
      setMsg({ tone: "ok", text: "שוחזר מהגיבוי" });
      setTimeout(() => setMsg(null), 5000);
    } catch (e) {
      setMsg({ tone: "bad", text: `קריאת הקובץ נכשלה: ${e.message}` });
    }
  };

  return (
    <header className="bg-navy text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={onSwitchProject}
          className="flex items-center gap-2 rounded-sm px-2 py-1 text-right transition hover:bg-navy-surface"
          title="החלפת פרויקט"
        >
          <IconBuilding size={20} className="shrink-0 text-accent" />
          <span className="text-base font-semibold">{project.name}</span>
          <IconChevronDown size={16} className="text-onnavy-muted" />
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {msg && (
            <span
              className={`rounded-sm px-2 py-1 text-xs ${
                msg.tone === "ok" ? "bg-success-solid text-white" : "bg-danger-solid text-white"
              }`}
            >
              {msg.text}
            </span>
          )}

          {!cloudMode ? (
            <span
              className="rounded-sm bg-navy-surface px-2 py-1 text-xs text-onnavy-muted"
              title="הנתונים נשמרים בדפדפן הזה בלבד. נקה היסטוריה — והם נמחקים. גבה."
            >
              מצב מקומי — בדפדפן הזה בלבד
            </span>
          ) : (
            <span className="flex items-center gap-2 text-xs text-onnavy-muted">
              <span className="num">{auth?.user?.email}</span>
              {role && (
                <span className="rounded-sm bg-navy-surface px-2 py-1 font-semibold">
                  {ROLE_LABEL[role]}
                </span>
              )}
              <button onClick={auth?.signOut} className="underline hover:text-white" title="יציאה">
                יציאה
              </button>
            </span>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              restore(e.target.files?.[0]);
              e.target.value = ""; // כדי שבחירת אותו קובץ שוב תפעיל את onChange
            }}
          />
          <BarButton onClick={save} title="הורדת קובץ גיבוי של כל הנתונים">
            <IconDownload size={15} /> גיבוי
          </BarButton>
          <BarButton onClick={() => fileRef.current?.click()} title="שחזור מקובץ גיבוי">
            <IconUpload size={15} /> שחזור
          </BarButton>
        </div>
      </div>
    </header>
  );
}

const BarButton = ({ children, onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    className="inline-flex items-center gap-1.5 rounded-sm border border-navy-border px-2.5 py-1 text-xs font-semibold text-onnavy transition hover:bg-navy-surface"
  >
    {children}
  </button>
);
