import { useState } from "react";
import { ShieldAlert, MailWarning } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import AuthShell from "./ui/AuthShell.jsx";
import Button from "./ui/Button.jsx";

// ============================================================================
// NoAccessScreen — "אין לך גישה. פנה למנהל המערכת."
//
// ⚠️ זה **התיקון המרכזי** של באג 17.8. עד עכשיו משתמש בלי ארגון קיבל מסך
// **הקמה ראשונית**, ואם היה משלים אותו היה נוצר ארגון שני נפרד עם אפס
// רכבים — בלי שאף אחד יבין מה קרה. זה בדיוק מה שכמעט קרה למנהלת הכספים.
//
// המסך הזה אומר את הדבר הנכון: "המייל שלך אינו מורשה, בקש מהמנהל להוסיף
// אותו". ההקמה **לא נעלמה** — אחרת אי אפשר היה להתקין את המערכת מאפס — אבל
// היא ירדה מברירת-מחדל לבחירה מפורשת, אחרי אזהרה ואישור. אין דרך להיתקל בה
// בטעות, ולכן אין דרך ליצור ארגון שני בטעות.
// ============================================================================
export function NoAccessScreen({ user, emailVerified = true, staleInvite = null, onCreateOrg, onSignOut, onRetry }) {
  const { t, toggleLang } = useI18n();
  const [confirming, setConfirming] = useState(false);

  return (
    <AuthShell
      footer={
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <button type="button" onClick={onSignOut} className="text-xs text-slate-500 hover:text-slate-700">
            {t("nav.signOut")}
          </button>
          <button type="button" onClick={toggleLang} className="text-xs text-slate-500 hover:text-slate-700">
            {t("nav.language")}
          </button>
        </div>
      }
    >
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <ShieldAlert size={20} />
      </span>
      <h2 className="text-base font-semibold text-slate-900">{t("noAccess.title")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("noAccess.body")}</p>

      <p className="num mt-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" dir="ltr">
        {user?.email || user?.uid || "—"}
      </p>

      {/* הזמנה שפג תוקפה היא מצב שצריך להסביר, לא "נעלמה". התוקף קצר
          בכוונה: מייל עבודה עובר בין עובדים. */}
      {staleInvite && (
        <p className="mt-3 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <MailWarning size={14} className="mt-0.5 shrink-0" />
          {t("noAccess.inviteExpired")}
        </p>
      )}
      {!emailVerified && (
        <p className="mt-3 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <MailWarning size={14} className="mt-0.5 shrink-0" />
          {t("join.err.unverified")}
        </p>
      )}

      <Button className="mt-4 w-full" variant="secondary" onClick={onRetry}>
        {t("noAccess.recheck")}
      </Button>

      {/* -- ההקמה: בחירה מפורשת, אחרי אזהרה ------------------------------- */}
      <div className="mt-5 border-t border-slate-100 pt-3">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs text-slate-500 underline decoration-dotted hover:text-slate-700"
          >
            {t("noAccess.createLink")}
          </button>
        ) : (
          <div className="rounded border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-800">{t("noAccess.createWarnTitle")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-red-700">{t("noAccess.createWarnBody")}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" variant="danger" onClick={onCreateOrg}>
                {t("noAccess.createConfirm")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export default NoAccessScreen;
