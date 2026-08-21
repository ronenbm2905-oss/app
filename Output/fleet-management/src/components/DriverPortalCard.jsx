import { Smartphone, Link2Off, MailPlus, ShieldOff, Info } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import Pill from "./ui/Pill.jsx";
import { normalizeEmail } from "../utils/admins.js";

// ============================================================================
// DriverPortalCard — ניהול הגישה של עובד אחד לפורטל, בכרטיס הנהג.
//
// שלושה מצבים בלבד, כי יותר מזה אף אחד לא זוכר:
//   אין מייל   → אין דרך לקשר. אומרים את זה במפורש ולא מציגים כפתורים.
//   ממתין      → המייל הוזן, העובד עוד לא נכנס. **המערכת אינה שולחת מייל** —
//                מישהו צריך לשלוח לו את הקישור. זה כתוב על המסך.
//   מקושר      → נכנס. יש כפתור ניתוק.
//   נותק       → 'revoked'. הרשומה **אינה** ניתנת לתביעה מחדש עד פעולה
//                מפורשת, אחרת עובד שעזב היה מקשר את עצמו בחזרה בלחיצה.
//
// ⚠️ הכפתור הזה הוא **אמצעי הביטול היחיד שקיים** (3.3 בהכוונת עדי): לחברה
// אין חשבונות Google ארגוניים, ולכן אי אפשר לכבות את החשבון של מי שעזב.
// אפשר רק לחסום אותו אצלנו — ומכיוון שהחסימה נאכפת ב-firestore.rules ולא
// בקומפוננטה, היא תופסת גם כשהסשן שלו עדיין חי במכשיר.
// ============================================================================
export function DriverPortalCard({ driver, actions }) {
  const { t } = useI18n();
  if (!driver) return null;

  const email = normalizeEmail(driver.email);
  const status = driver.portalStatus || "none";
  const linked = Boolean(driver.userId) && status === "active";
  const revoked = status === "revoked";
  const archived = driver.status === "archived";

  return (
    <Card
      title={t("driverLink.title")}
      action={<Pill tone={linked ? "green" : revoked ? "red" : "slate"}>{t(`driver.portal.${status}`)}</Pill>}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Smartphone size={16} className={linked ? "mt-0.5 text-emerald-600" : "mt-0.5 text-slate-400"} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          {!email && <p className="text-amber-800">{t("driverLink.noEmail")}</p>}
          {email && linked && (
            <p className="num text-slate-700" dir="ltr">
              {t("driverLink.linked", { email: driver.portalLinkedEmail || email })}
            </p>
          )}
          {email && !linked && !revoked && (
            <p className="num text-slate-700" dir="ltr">
              {t("driverLink.waiting", { email })}
            </p>
          )}
          {email && revoked && <p className="text-slate-700">{t("driverLink.revoked")}</p>}
          {email && !linked && !revoked && (
            <p className="mt-1 text-xs text-slate-600">{t("driverLink.emailHint")}</p>
          )}
        </div>

        {!archived && (
          <div className="ms-auto flex gap-2">
            {linked && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (window.confirm(t("driverLink.unlinkConfirm"))) actions.unlinkDriverPortal(driver.id);
                }}
              >
                <Link2Off size={13} aria-hidden="true" /> {t("driverLink.unlink")}
              </Button>
            )}
            {revoked && email && (
              <Button size="sm" variant="secondary" onClick={() => actions.inviteDriverPortal(driver.id)}>
                <MailPlus size={13} aria-hidden="true" /> {t("driverLink.invite")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* למה זה כתוב ולא מובן מאליו: אדמין שלוחץ "ניתוק" ורואה שהעובד עדיין
          מחובר בטלפון שלו עלול להסיק שהכפתור לא עבד. הוא כן עבד — הבקשה
          הבאה שלו תידחה בשרת. */}
      <p className="mt-3 flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
        {revoked ? (
          <ShieldOff size={13} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        ) : (
          <Info size={13} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        )}
        <span>{t("driverLink.note")}</span>
      </p>
    </Card>
  );
}

export default DriverPortalCard;
