import { useI18n } from "../hooks/useI18n.jsx";
import { POLICY_VERSION } from "../constants.js";
import { hasAcknowledged } from "../schema.js";
import { formatDate } from "../utils/format.js";
import { Card, Notice } from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";

// ============================================================================
// NoticeScreen — מסך היידוע.
//
// ⚠️ **"קראתי", לא "אני מסכים"** — הכרעה של עדי, ולא לשנות בליטוש. הכפתור
// מתעד **יידוע**, לא הסכמה: הבסיס לעיבוד כאן הוא אספקת השירות שהמשתמש
// ביקש, ו"אני מסכים" היה מתאר מציאות משפטית אחרת.
//
// 🔴 N5 — הכתיבה היא **append ל-`users/{uid}.notices`**, לעולם לא דריסה.
// השאלה שתישאל בעוד שנתיים היא "איזו גרסה המשתמש הזה ראה בפועל, ומתי";
// שדה שנדרס מוחק את התשובה בלי אפשרות שחזור, ומדיניות של מוצר צרכני
// **תשתנה**, כמה פעמים.
//
// והנקודה שאסור "לתקן": הרשומה נכתבת ע"י **הנושא בלבד**. זה מה שיאפשר
// לקטין שהופך לבגיר לאשר את היידוע בעצמו.
// ============================================================================

export function NoticeScreen({ data, actions }) {
  const { t, lang } = useI18n();
  const profile = data.profile;
  const acknowledged = hasAcknowledged(profile, POLICY_VERSION);
  const history = profile?.notices || [];

  return (
    <>
      <h1 className="text-2xl font-bold text-ink-strong">{t("legal.notice.title")}</h1>
      <p className="max-w-prose text-lg text-ink">{t("legal.notice.body")}</p>

      <Card className="space-y-3 p-4">
        <h2 className="text-xl font-semibold text-ink">{t("legal.notice.privacy")}</h2>
        <ul className="space-y-2 text-lg text-ink">
          <li>{t("legal.disclaimer.docs")}</li>
          <li>{t("legal.disclaimer.personalDocs")}</li>
          <li>{t("legal.disclaimer.mot")}</li>
          <li>{t("legal.disclaimer.reminders")}</li>
          <li>{t("legal.disclaimer.emergency")}</li>
        </ul>
        {/* ⚠️ הנוסח המלא של מדיניות הפרטיות ותנאי השימוש הוא של עדי (⚖️ L2)
            ומחווט לפני deploy. **הוא לא יטען "קישורים חתומים וזמניים"** —
            בפרוסה 1 הטוקן של Firebase קבוע, וטענה כזאת היא מצג שווא. */}
      </Card>

      {acknowledged ? (
        <Notice tone="ok" title={t("legal.notice.hint")}>
          <ul className="space-y-1">
            {history.map((n, i) => (
              <li key={i} className="text-base text-ink">
                <span className="num">{n.policyVersion}</span> ·{" "}
                <span className="num">{formatDate(n.acknowledgedAt, lang)}</span>
              </li>
            ))}
          </ul>
        </Notice>
      ) : (
        <>
          <Button variant="primary" onClick={() => actions.acknowledgeNotice("inApp")}>
            {t("legal.notice.cta")}
          </Button>
          <p className="max-w-prose text-base text-ink-muted">{t("legal.notice.hint")}</p>
        </>
      )}
    </>
  );
}

export default NoticeScreen;
