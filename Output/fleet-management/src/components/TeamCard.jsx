import { useState } from "react";
import { UserPlus, Trash2, ShieldCheck, Clock, AlertTriangle, XCircle } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import Field, { TextInput } from "./ui/Field.jsx";
import Pill from "./ui/Pill.jsx";
import { formatDate } from "../utils/format.js";
import { listInvites, listMembers, INVITE_TTL_DAYS } from "../utils/invites.js";

// ============================================================================
// TeamCard — ניהול האדמינים: הוספת מייל להזמנה, הממתינים, הקיימים, ביטול.
//
// למה **מייל** ולא uid: אדמין אינו יכול לדעת את ה-uid של מי שעוד לא נכנס
// למערכת. המייל הוא הדבר היחיד שהוא כן יודע.
// ⚠️ ובכל זאת **הבידוד עצמו נשאר לפי uid בלבד** (F1 של עדי): המייל הוא מפתח
// חד-פעמי לתביעת ההזמנה, והרשומה נמחקת ברגע שנתבעה. הטבלה למטה מציגה uid-ים,
// כי זו הזהות שההרשאות באמת נשענות עליה.
//
// אין כאן שליחת מייל: התוכנית על Spark, אין Cloud Functions ואין שרת שישלח.
// האדמין מוסיף את הכתובת ו**מוסר את הקישור בעצמו** — וזה בדיוק מה שקרה בפועל
// (המשתמש שלח את הקישור ב-WhatsApp). המסך אומר את זה במפורש.
// ============================================================================
export function TeamCard({ data, user, team }) {
  const { t, lang } = useI18n();
  const org = data?.org || null;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  const invites = listInvites(org);
  const members = listMembers(org);
  const selfUid = user?.uid || null;

  const run = async (fn) => {
    setBusy(true);
    setErrorKey(null);
    setOkMsg(null);
    const res = await fn();
    setBusy(false);
    if (res?.ok === false) setErrorKey(res.errorKey || "team.err.failed");
    return res;
  };

  const add = async () => {
    const res = await run(() => team.invite({ email, role: "admin" }));
    if (res?.ok) {
      setEmail("");
      setOkMsg("team.added");
    }
  };

  return (
    <Card title={t("team.title")}>
      <p className="text-xs leading-relaxed text-slate-600">
        {t("team.intro", { days: INVITE_TTL_DAYS })}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label={t("team.emailLabel")} className="flex-1">
          <TextInput
            dir="ltr"
            type="email"
            value={email}
            placeholder="name@company.co.il"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
        </Field>
        <Button onClick={add} disabled={busy || !email.trim()}>
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

      {/* -- ממתינים ------------------------------------------------------- */}
      <h3 className="mt-5 text-xs font-semibold text-slate-700">{t("team.pending")}</h3>
      {invites.length ? (
        <ul className="mt-2 divide-y divide-slate-100 rounded border border-slate-200">
          {invites.map((inv) => (
            <li key={inv.email} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="num truncate text-xs font-medium text-slate-800" dir="ltr">
                  {inv.email}
                </p>
                <p className="num mt-0.5 text-[11px] text-slate-500">
                  {inv.expired
                    ? t("team.expiredAt", { date: formatDate(new Date(inv.expiresAt || 0).toISOString(), lang) })
                    : t("team.expiresAt", { date: formatDate(new Date(inv.expiresAt || 0).toISOString(), lang) })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Pill className="gap-1" tone={inv.expired ? "red" : "amber"}>
                  {inv.expired ? <XCircle size={11} /> : <Clock size={11} />}
                  {inv.expired ? t("team.expired") : t(`role.${inv.role || "admin"}`)}
                </Pill>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("team.revoke")}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t("team.revokeConfirm"))) run(() => team.revoke(inv.email));
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
          {t("team.noPending")}
        </p>
      )}

      {/* -- החברים הקיימים ------------------------------------------------ */}
      <h3 className="mt-5 text-xs font-semibold text-slate-700">{t("team.members")}</h3>
      <ul className="mt-2 divide-y divide-slate-100 rounded border border-slate-200">
        {members.map((m) => (
          <li key={m.uid} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="num truncate text-xs font-medium text-slate-800" dir="ltr">
                {m.uid}
                {m.uid === selfUid && (
                  <span className="ms-1.5 font-normal text-slate-500">({t("team.you")})</span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">{t(`role.${m.role}`)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Pill className="gap-1" tone={m.role === "admin" ? "green" : "slate"}>
                <ShieldCheck size={11} />
                {t(`role.${m.role}`)}
              </Pill>
              {/* ההסרה העצמית חסומה בכוונה: ארגון בלי אף אדמין הוא מצב שאין
                  ממנו דרך חזרה, ו-firestore.rules אוכפות את זה בכל עדכון. */}
              <Button
                size="sm"
                variant="ghost"
                aria-label={t("team.remove")}
                disabled={busy || m.uid === selfUid}
                title={m.uid === selfUid ? t("team.err.selfRemove") : undefined}
                onClick={() => {
                  if (window.confirm(t("team.removeConfirm"))) run(() => team.remove(m.uid));
                }}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{t("team.linkNote")}</p>
    </Card>
  );
}

export default TeamCard;
