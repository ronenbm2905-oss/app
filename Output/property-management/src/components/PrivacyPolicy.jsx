import { useI18n } from "../hooks/useI18n.jsx";
import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";

// ============================================================================
// PrivacyPolicy — מדיניות פרטיות + הודעת דייר, מתוך טיוטות השלד של עדי (שער
// עדי, 2026-08-04, סעיף 4). B-PP + B-AI-3.
//
// ⚠️ אלה טיוטות שלד בלבד — נקודת פתיחה לעו"ד רשומה, לא מסמך סופי לפרסום.
// הבאנר בראש הקומפוננטה מסמן זאת בבירור. הנוסח המשפטי הסופי, הבסיס החוקי,
// וחתימת ה-DPA מסומנים ⚖️ ומצריכים עו"ד — ראה `adi/Outputs/2026-08-04-...`.
//
// התוכן הדו-לשוני יושב כאן בקומפוננטה (ולא ב-i18n.js) כי זהו מסמך-טיוטה
// עצמאי, לא מחרוזות-ממשק — כדי לשמור על הטיוטה כיחידה אחת ברורה.
// ============================================================================

const DRAFT = {
  he: {
    policyTitle: "מדיניות פרטיות (טיוטה)",
    policy: [
      ["מי אחראי למידע", "בעל הנכסים הוא האחראי (controller) על נתוני הדיירים. פרטי קשר יושלמו ע\"י המפעיל."],
      ["מעבדי משנה", "Google/Firebase (אחסון, region me-west1) לצורך המערכת; Anthropic — לסריקת מסמכים ב-AI (בכפוף לחתימת DPA + ZDR)."],
      ["אילו נתונים נאספים", "פרטי נכס, פרטי דייר (שם, ת.ז. אופציונלי, טלפון, אימייל), חוזים, תנועות כספיות, חובות, תקלות ומסמכים — לרבות מסמכים שנסרקים ב-AI."],
      ["מטרות ובסיס חוקי ⚖️", "ניהול השכירות (צורך חוזי); מעקב חוב (חובה חוקית/אינטרס לגיטימי). הבסיס החוקי הסופי — לאישור עו\"ד."],
      ["סריקת מסמכים ב-AI ⚖️", "מסמכים סטרוקטורים (ארנונה/חשמל/מים/חוזה) עשויים להיסרק ע\"י מעבד חיצוני (Anthropic) לחילוץ פרטים, בהעברה לארה\"ב ובהסכם ZDR. מסמכי זיהוי (ת.ז.) אינם נסרקים אוטומטית."],
      ["העברת מידע לחו\"ל ⚖️", "אחסון ב-Firebase (Google) וסריקה ב-Anthropic (ארה\"ב) מבוססים על התחייבות חוזית לתנאי הדין הישראלי (תקנות תשס\"א-2001)."],
      ["תקופות שמירה ומחיקה", "נתוני דייר נמחקים לבקשה או בתום תקופת השמירה שתיקבע לאחר סוף החוזה (זמין דרך 'מחיקת דייר')."],
      ["זכויות נושא המידע", "עיון, תיקון ומחיקה. דייר רואה את נתוניו בפורטל; מחיקה מתבצעת ע\"י הבעלים."],
      ["אבטחת מידע", "בקרת גישה ברמת ה-rules (deny-by-default, בידוד פר-בעלים/דייר), region me-west1, מזעור נתונים בזרימת ה-AI."],
    ],
    tenantTitle: "הודעת פרטיות לדייר (טיוטה)",
    tenant: [
      ["מי מנהל את המידע שלך", "בעל הנכס, במערכת לניהול נכסים."],
      ["אילו פרטים ולמה", "שם, ת.ז. (אם נמסר), טלפון, אימייל, חוזה ותשלומים — לצורך ניהול השכירות והתחזוקה."],
      ["סריקת מסמכים ב-AI ⚖️", "מסמכים שלך (למעט מסמכי זיהוי) עשויים להיסרק אוטומטית ע\"י מעבד חיצוני (Anthropic), כולל העברה לארה\"ב, בהסכם ZDR."],
      ["בסיס חוקי ⚖️", "צורך חוזי לניהול השכירות / חובה חוקית."],
      ["שמירה, זכויות וקשר", "המידע נשמר לתקופת ההתקשרות ובהתאם למדיניות; לך זכות עיון/תיקון/מחיקה — פנה לבעל הנכס."],
      ["ערוץ תקשורת", "וואטסאפ/טלפון משמשים לתקשורת תפעולית בלבד (לא שיווק)."],
    ],
  },
  en: {
    policyTitle: "Privacy Policy (draft)",
    policy: [
      ["Who is responsible", "The property owner is the controller of tenant data. Contact details to be completed by the operator."],
      ["Sub-processors", "Google/Firebase (storage, region me-west1) for the system; Anthropic — for AI document scanning (subject to a signed DPA + ZDR)."],
      ["What data is collected", "Property details, tenant details (name, optional ID, phone, email), leases, transactions, debts, tickets and documents — including AI-scanned documents."],
      ["Purposes & legal basis ⚖️", "Tenancy management (contractual necessity); debt tracking (legal obligation / legitimate interest). Final legal basis — pending lawyer approval."],
      ["AI document scanning ⚖️", "Structured documents (municipal tax/electricity/water/contract) may be scanned by an external processor (Anthropic) for field extraction, transferred to the US under a ZDR agreement. Identity documents are not scanned automatically."],
      ["Cross-border transfer ⚖️", "Storage on Firebase (Google) and scanning on Anthropic (US) rely on a contractual commitment to Israeli-law terms (2001 regulations)."],
      ["Retention & deletion", "Tenant data is deleted on request or at the end of the retention period set after lease end (available via 'Delete tenant')."],
      ["Data subject rights", "Access, rectification, erasure. Tenants view their data in the portal; deletion is performed by the owner."],
      ["Security", "Rule-level access control (deny-by-default, per-owner/tenant isolation), region me-west1, data minimization in the AI flow."],
    ],
    tenantTitle: "Tenant Privacy Notice (draft)",
    tenant: [
      ["Who manages your data", "The property owner, in a property-management system."],
      ["What details & why", "Name, ID (if provided), phone, email, lease and payments — for tenancy management and maintenance."],
      ["AI document scanning ⚖️", "Your documents (except identity documents) may be scanned automatically by an external processor (Anthropic), including transfer to the US, under a ZDR agreement."],
      ["Legal basis ⚖️", "Contractual necessity for tenancy management / legal obligation."],
      ["Retention, rights & contact", "Data is kept for the engagement period and per policy; you have access/rectification/erasure rights — contact the owner."],
      ["Communication channel", "WhatsApp/phone are used for operational communication only (not marketing)."],
    ],
  },
};

function Section({ title, rows }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-sm font-bold text-navy">{title}</h3>
      <dl className="space-y-2">
        {rows.map(([term, desc]) => (
          <div key={term}>
            <dt className="text-sm font-semibold text-ink-body">{term}</dt>
            <dd className="text-sm text-ink-body">{desc}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// mode: "policy" (מדיניות מלאה, ברירת מחדל) | "tenant" (הודעת דייר בלבד).
export function PrivacyPolicy({ onClose, mode = "policy" }) {
  const { t, lang } = useI18n();
  const doc = DRAFT[lang === "en" ? "en" : "he"];

  return (
    <Modal
      title={t("privacy.title")}
      onClose={onClose}
      footer={<Button onClick={onClose}>{t("common.close")}</Button>}
    >
      <p className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
        {t("privacy.draftBanner")}
      </p>
      {mode !== "tenant" && <Section title={doc.policyTitle} rows={doc.policy} />}
      <Section title={doc.tenantTitle} rows={doc.tenant} />
    </Modal>
  );
}
