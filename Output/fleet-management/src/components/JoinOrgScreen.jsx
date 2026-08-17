import { useState } from "react";
import { UserPlus, Check, AlertTriangle } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import AuthShell from "./ui/AuthShell.jsx";
import Button from "./ui/Button.jsx";
import { formatDate } from "../utils/format.js";
import { claimOutcome } from "../utils/invites.js";

// ============================================================================
// JoinOrgScreen — "יש לך הזמנה מחכה".
//
// זה המסך שמנהלת הכספים הייתה צריכה לראות, ובמקומו קיבלה **מסך הקמה
// ראשונית**. הוא לא מקים כלום: הוא תובע את ההזמנה הקיימת ומצרף את ה-uid
// שלה לארגון שכבר קיים, עם 36 הרכבים ו-27 הנהגים שבו.
//
// ⚠️ הכפתור לא מכריז "צורפת" — הוא ממתין לתוצאת הכתיבה. אם ה-rules דחו
// (הזמנה שפגה, מייל לא מאומת, כבר נתבעה) מוצגת הסיבה, לא באנר אדום כללי.
// ============================================================================
export function JoinOrgScreen({ user, invite, joining = false, onJoin, onSignOut }) {
  const { t, lang, toggleLang } = useI18n();
  const [errorKey, setErrorKey] = useState(null);
  const [done, setDone] = useState(false);

  // אותם תנאים שה-rules אוכפות — כדי להסביר במקום להיכשל.
  const pre = claimOutcome({ user, invite });

  const join = async () => {
    setErrorKey(null);
    const res = await onJoin();
    if (res?.ok === false) {
      setErrorKey(res.errorKey || "join.err.failed");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={26} />
          </span>
          <h2 className="text-base font-semibold text-slate-900">{t("join.doneTitle")}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("join.doneBody", { org: invite?.orgName || t("join.thisOrg") })}
          </p>
        </div>
      </AuthShell>
    );
  }

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
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <UserPlus size={20} />
      </span>
      <h2 className="text-base font-semibold text-slate-900">{t("join.title")}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {t("join.body", { org: invite?.orgName || t("join.thisOrg") })}
      </p>

      <dl className="mt-4 space-y-1.5 rounded border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">{t("join.email")}</dt>
          <dd className="num font-medium text-slate-800" dir="ltr">
            {user?.email || "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">{t("join.role")}</dt>
          <dd className="font-medium text-slate-800">{t(`role.${invite?.role || "admin"}`)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">{t("join.expires")}</dt>
          <dd className="num font-medium text-slate-800">
            {invite?.expiresAt ? formatDate(new Date(invite.expiresAt).toISOString(), lang) : "—"}
          </dd>
        </div>
      </dl>

      {/* המייל **המאומת** הוא כל המנגנון: בלעדיו כל אחד היה נרשם עם כתובת
          שאינה שלו ותובע הזמנה של אחר. אם הוא אינו מאומת — אומרים למה. */}
      {!pre.ok && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t(pre.errorKey)}
        </p>
      )}
      {errorKey && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t(errorKey)}
        </p>
      )}

      <Button className="mt-4 w-full" size="lg" onClick={join} disabled={joining || !pre.ok}>
        {joining ? t("common.saving") : t("join.cta")}
      </Button>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t("join.note")}</p>
    </AuthShell>
  );
}

export default JoinOrgScreen;
