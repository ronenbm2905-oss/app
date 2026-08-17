import { useState } from "react";
import { UserPlus, Trash2, ShieldCheck, AlertTriangle, Lock } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import Field, { TextInput } from "./ui/Field.jsx";
import Pill from "./ui/Pill.jsx";
import { adminEmails, normalizeEmail } from "../utils/admins.js";

// ============================================================================
// TeamCard — ניהול האדמינים: הוספת מייל, הסרה, ורשימת המורשים הנוכחיים.
//
// זו הפעולה שהמשתמש חיפש ולא מצא. בלעדיה הדרך היחידה "להוסיף אדמין" הייתה
// לשלוח את הקישור ולקוות — ומי שקיבלה אותו קיבלה מסך הקמה ראשונית.
//
// למה **מייל** ולא uid: אדמין אינו יכול לדעת את ה-uid של מי שעוד לא נכנס
// למערכת. המייל הוא הדבר היחיד שהוא כן יודע.
// ⚠️ הגבול, ודרישת F1 של עדי: זה **לאדמינים בלבד**. הבידוד של הנהגים בפרוסה 2
// יישאר לפי `uid` — שם יושב ה-PII הפרטני, ושם החלפת מייל עבודה אינה סיכון
// מקובל. כאן מדובר בקבוצה קטנה ומוכרת.
//
// אין כאן שליחת מייל: התוכנית על Spark, אין Cloud Functions ואין שרת שישלח.
// האדמין מוסיף כתובת ו**מוסר את הקישור בעצמו** — וזה בדיוק מה שקרה בפועל.
// ============================================================================
export function TeamCard({ data, user, team }) {
  const { t } = useI18n();
  const org = data?.org || null;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const list = adminEmails(org);
  const selfEmail = normalizeEmail(user?.email);
  // ⚠️ המצב שאחרי ה-deploy הראשון: המסמך בענן עדיין בלי `adminEmails`, והגישה
  // מגיעה ממסלול ה-legacy (`org.members[uid]`). אם לא נאמר את זה בפירוש,
  // האדמין רואה רשימה ריקה, מניח שהמסך שבור, ולא מוסיף את עצמו.
  const selfMissing = Boolean(selfEmail) && !list.includes(selfEmail);

  const run = async (fn) => {
    setBusy(true);
    setErrorKey(null);
    setOkMsg(null);
    const res = await fn();
    setBusy(false);
    if (res?.ok === false) setErrorKey(res.errorKey || "team.err.failed");
    return res;
  };

  const add = async (value) => {
    const res = await run(() => team.add({ email: value }));
    if (res?.ok) {
      setEmail("");
      setOkMsg("team.added");
    }
  };

  return (
    <Card title={t("team.title")}>
      <p className="text-xs leading-relaxed text-slate-600">{t("team.intro")}</p>

      {selfMissing && (
        <p className="mt-3 flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            {t("team.selfMissing")}{" "}
            <button
              type="button"
              className="font-semibold underline"
              disabled={busy}
              onClick={() => add(selfEmail)}
            >
              {t("team.addSelf")}
            </button>
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label={t("team.emailLabel")} className="flex-1">
          <TextInput
            dir="ltr"
            type="email"
            value={email}
            placeholder="name@company.co.il"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add(email);
            }}
          />
        </Field>
        <Button onClick={() => add(email)} disabled={busy || !email.trim()}>
          <UserPlus size={14} /> {t("team.add")}
        </Button>
      </div>

      {errorKey && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t(errorKey)}
        </p>
      )}
      {okMsg && (
        <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {t(okMsg)}
        </p>
      )}

      {/* -- הרשימה הנוכחית ------------------------------------------------ */}
      <h3 className="mt-5 text-xs font-semibold text-slate-700">
        {t("team.current", { n: list.length })}
      </h3>
      {list.length ? (
        <ul className="mt-2 divide-y divide-slate-100 rounded border border-slate-200">
          {list.map((e) => {
            // האדמין האחרון אינו ניתן להסרה — לא כנימוס אלא כי ארגון בלי
            // אדמין הוא ארגון אבוד. אותה בדיקה נאכפת ב-firestore.rules.
            const isLast = list.length <= 1;
            return (
              <li key={e} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="num truncate text-xs font-medium text-slate-800" dir="ltr">
                    {e}
                  </p>
                  {e === selfEmail && <p className="mt-0.5 text-[11px] text-slate-500">{t("team.you")}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Pill className="gap-1" tone="green">
                    <ShieldCheck size={11} />
                    {t("role.admin")}
                  </Pill>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t("team.remove")}
                    disabled={busy || isLast}
                    title={isLast ? t("team.err.lastAdmin") : undefined}
                    onClick={() => {
                      if (window.confirm(t("team.removeConfirm", { email: e }))) run(() => team.remove(e));
                    }}
                  >
                    {isLast ? <Lock size={13} /> : <Trash2 size={13} />}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 rounded border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          {t("team.empty")}
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t("team.linkNote")}</p>
    </Card>
  );
}

export default TeamCard;
