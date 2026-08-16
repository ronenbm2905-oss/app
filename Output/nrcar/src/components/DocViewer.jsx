import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { openSensitiveDocument } from "../utils/files.js";
import { storage, isFirebaseConfigured } from "../firebase.js";


// ============================================================================
// DocViewer — מציג מסמך מלא-מסך.
//
// 🔴 N2 — **כל הגישה עוברת דרך `openSensitiveDocument()` בלבד.** התוצאה היא
// `blob:` URL שחי בזיכרון ומת ב-unmount. הכתובת החתומה של Firebase (עם
// הטוקן הקבוע שאינו פג) **לא מגיעה ל-DOM, לא ל-href, לא ל-window.open ולא
// לקונסול**. ההבדל המעשי: "בהיסטוריית הדפדפן, בסימניות ובתפריט השיתוף"
// מול "רק ב-devtools".
//
// ⚠️ **אין כאן "שתף" ואין "פתח בלשונית חדשה"** — זה הפיצ'ר היחיד שמעביר
// טוקן קבוע לוואטסאפ בלחיצה. "לשלוח את רישיון הרכב למוסך" ממתין
// ל-V4 signed URLs בפרוסה 2.
//
// נגישות: מלכודת פוקוס, Esc לסגירה, כפתור סגירה **עם טקסט**, ו-alt תיאורי.
// זום פינץ' עובד כי אין `user-scalable=no` — וזה בדיוק המסך שבשבילו.
// ============================================================================

export function DocViewer({ doc, title, onClose }) {
  const { t } = useI18n();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    let revoke = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await openSensitiveDocument(doc, {
          storage: isFirebaseConfigured ? storage : null,
          localData: doc?.localData,
        });
        if (cancelled) {
          res?.revoke?.();
          return;
        }
        if (!res) {
          setError(true);
          return;
        }
        revoke = res.revoke;
        setUrl(res.url);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      revoke?.(); // ← שחרור ה-blob. בלי זה הוא נשאר בזיכרון הלשונית.
    };
  }, [doc]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll("button, a[href]");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPdf = doc?.fileRef?.contentType === "application/pdf" || doc?.contentType === "application/pdf";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={title || t("doc.viewer.title")}
      className="fixed inset-0 z-50 flex flex-col bg-ink-strong/95 p-4"
    >
      <div className="mx-auto flex w-full max-w-app items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">{title || t("doc.viewer.title")}</h2>
        {/* כפתור סגירה **עם טקסט** — אייקון בלבד הוא בדיוק הכשל שנמנע כאן. */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface px-4 text-lg font-medium text-brand-600"
        >
          <X size={24} aria-hidden="true" />
          {t("common.close")}
        </button>
      </div>

      <div className="mx-auto mt-4 w-full max-w-app flex-1 overflow-auto">
        {error && (
          <p className="rounded-2xl bg-surface p-4 text-lg text-danger-700">{t("doc.viewer.failed")}</p>
        )}
        {!error && !url && <p className="text-lg text-white">{t("loading.generic")}</p>}
        {url &&
          (isPdf ? (
            <iframe src={url} title={title || t("doc.viewer.title")} className="h-full w-full rounded-2xl bg-surface" />
          ) : (
            <img src={url} alt={title || t("doc.viewer.title")} className="w-full rounded-2xl bg-surface" />
          ))}
      </div>

      <p className="mx-auto mt-2 w-full max-w-app text-base text-white">{t("doc.viewer.hint")}</p>
    </div>
  );
}

export default DocViewer;
