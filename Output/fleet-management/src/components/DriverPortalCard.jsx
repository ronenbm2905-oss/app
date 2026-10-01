import { Smartphone, Link2Off, MessageSquarePlus, ShieldOff, Info } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import Pill from "./ui/Pill.jsx";
import { canonicalPhone, formatPhoneIl } from "../utils/phone.js";

// ============================================================================
// DriverPortalCard — ניהול הגישה של עובד אחד לפורטל, בכרטיס הנהג.
//
// ⚠️ 1.10.2026 — **העוגן הוא הנייד, לא המייל.** מסלול המייל הוסר מפורטל הנהג
// (ראה utils/driverLink.js): הוא היה תקין ועבר 328 בדיקות, אבל אף נהג לא
// נקשר בפועל, כי אין לחברה חשבונות Google ארגוניים והעובדים לא נתנו גימייל
// פרטי. הנייד כבר יושב בכרטיס. האדמינים ממשיכים ב-Google ובמייל.
//
// שלושה מצבים בלבד, כי יותר מזה אף אחד לא זוכר:
//   אין נייד   → אין דרך לקשר. אומרים את זה במפורש ולא מציגים כפתורים.
//   ממתין      → המספר הוזן, העובד עוד לא נכנס. **המערכת אינה שולחת כלום** —
//                העובד נכנס מעצמו ומקיש קוד SMS שהוא מבקש במסך הכניסה. זה
//                כתוב על המסך, כי אדמין שמחכה ש"תישלח הזמנה" מחכה לנצח.
//   מקושר      → נכנס. יש כפתור ניתוק.
//   נותק       → 'revoked'. הרשומה **אינה** ניתנת לתביעה מחדש עד פעולה
//                מפורשת, אחרת עובד שעזב היה מקשר את עצמו בחזרה בלחיצה.
//
// ⚠️ הכפתור הזה הוא **אמצעי הביטול היחיד שקיים** (3.3 בהכוונת עדי): לחברה
// אין שליטה על מספר הנייד הפרטי של העובד, בדיוק כפי שלא הייתה לה שליטה על
// חשבון הגימייל שלו. אפשר רק לחסום אותו אצלנו — ומכיוון שהחסימה נאכפת
// ב-firestore.rules ולא בקומפוננטה, היא תופסת גם כשהסשן שלו עדיין חי במכשיר.
// ============================================================================
export function DriverPortalCard({ driver, actions }) {
  const { t } = useI18n();
  if (!driver) return null;

  // ⚠️ הקישור אפשרי **רק** למספר שעובר נרמול: מספר קווי או חסר ספרה אינו
  // מקבל SMS בכלל (ה-region policy נעולה לישראל), ולכן הוא שקול ל"אין נייד".
  // זה אותו תנאי בדיוק שהכלל בודק (canonPhone != '').
  const phone = canonicalPhone(driver.phone);
  const status = driver.portalStatus || "none";
  const linked = Boolean(driver.userId) && status === "active";
  const revoked = status === "revoked";
  const archived = driver.status === "archived";
  const shown = formatPhoneIl(driver.portalLinkedPhone || phone);

  return (
    <Card
      title={t("driverLink.title")}
      action={<Pill tone={linked ? "green" : revoked ? "red" : "slate"}>{t(`driver.portal.${status}`)}</Pill>}
    >
      <div className="flex flex-wrap items-start gap-3">
        <Smartphone size={16} className={linked ? "mt-0.5 text-emerald-600" : "mt-0.5 text-slate-400"} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          {!phone && <p className="text-amber-800">{t("driverLink.noPhone")}</p>}
          {phone && linked && (
            <p className="num text-slate-700">{t("driverLink.linked", { phone: shown })}</p>
          )}
          {phone && !linked && !revoked && (
            <p className="num text-slate-700">{t("driverLink.waiting", { phone: shown })}</p>
          )}
          {phone && revoked && <p className="text-slate-700">{t("driverLink.revoked")}</p>}
          {phone && !linked && !revoked && (
            <p className="mt-1 text-xs text-slate-600">{t("driverLink.phoneHint")}</p>
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
            {revoked && phone && (
              <Button size="sm" variant="secondary" onClick={() => actions.inviteDriverPortal(driver.id)}>
                <MessageSquarePlus size={13} aria-hidden="true" /> {t("driverLink.invite")}
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
