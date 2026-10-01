import { useState } from "react";
import { Car, Smartphone, KeyRound, ArrowRight } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import { formatPhoneIl, isLinkablePhone } from "../utils/phone.js";

// ============================================================================
// LoginPage — **שני מסלולי כניסה, לשתי אוכלוסיות.**
//
//   נהג  → נייד + קוד SMS. זה המסלול הראשי, והוא למעלה.
//   אדמין → Google, כמו קודם. כפתור משני בתחתית, מתחת לקו מפריד.
//
// ============================================================================
// למה הנהג עבר ממייל לנייד (1.10.2026)
// ============================================================================
// מסלול המייל היה תקין ועבר 328 בדיקות כללים — ובכל זאת **אף נהג לא נקשר**.
// אין לחברה חשבונות Google ארגוניים, ולכן הכניסה דרשה גימייל **פרטי**, ואף
// עובד לא נתן אותו. הנייד כבר יושב בכרטיס הנהג. מסלול המייל **הוסר** ולא
// נשמר במקביל (ראה utils/driverLink.js).
//
// ============================================================================
// שלושה דברים שהמסך הזה חייב לעשות נכון, אחרת העובד לא ייכנס
// ============================================================================
// 1. **יעדי מגע גדולים.** זה מסך מובייל, ביד אחת, ליד רכב. השדות והכפתורים
//    הם \`min-h-12\` (48px) — מתחת לזה מקישים על הכפתור הלא נכון.
// 2. **שגיאות מובנות.** "ההתחברות נכשלה" על ארבע תקלות שונות = העובד מתקשר
//    לאדמין. כל קוד שגיאה של Firebase ממופה למשפט שאומר מה לעשות
//    (hooks/useAuth.js:PHONE_ERRORS).
// 3. **קוד שגוי אינו מאפס את המסלול.** טעות הקלדה בקוד משאירה את המשתמש
//    במסך הקוד; היא אינה שולחת SMS נוסף ואינה זורקת אותו למספר מחדש.
//
// ⚠️ ה-\`div\` של ה-reCAPTCHA חייב להיות **ב-DOM לפני** הקריאה שמייצרת את
// ה-verifier. הוא invisible ואין בו מה לראות, אבל בלעדיו
// \`signInWithPhoneNumber\` נכשלת ב-\`auth/argument-error\`.
// ============================================================================
export function LoginPage({
  onSignIn,
  onSignInFresh,
  onSignInEmail,
  onStartPhone,
  onConfirmCode,
  onResetPhone,
  phoneStep = "number",
  phoneSentTo = null,
  isEmulator = false,
  error,
}) {
  const { t, toggleLang } = useI18n();
  const [devEmail, setDevEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errKey, setErrKey] = useState(null);
  // errCode — הקוד הגולמי של Firebase לצד ההודעה. חמש ההודעות הן קטגוריות,
  // ו-`auth.phone.err.failed` הוא ברירת מחדל לכל קוד שאינו ממופה — כלומר
  // תקלת הגדרה בפרויקט נראית לעובד כ"בדקו חיבור לאינטרנט". הקוד הוא מה
  // שהופך צילום מסך אחד לאבחנה, במקום סבב שאלות מול האדמין.
  const [errCode, setErrCode] = useState(null);

  const onCode = phoneStep === "code";
  // ⚠️ חסימה מקומית לפני שליחת SMS: מספר שאינו נייד ישראלי לא יקבל הודעה
  // בכלל (ה-region policy נעולה לישראל), והעובד היה ממתין לשווא.
  const phoneReady = isLinkablePhone(phone);
  const codeReady = String(code).replace(/[^0-9]/g, "").length >= 6;

  const run = async (fn) => {
    setBusy(true);
    setErrKey(null);
    setErrCode(null);
    try {
      const res = await fn();
      if (res && !res.ok) {
        setErrKey(res.errorKey || "auth.phone.err.failed");
        setErrCode(res.errorCode || null);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => run(() => onStartPhone?.(phone));
  const verify = () => run(() => onConfirmCode?.(code));

  const backToNumber = () => {
    setCode("");
    setErrKey(null);
    onResetPhone?.();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-brand-600 text-white">
            <Car size={20} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900">{t("app.title")}</h1>
            <p className="text-xs text-slate-500">{t("app.subtitle")}</p>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-slate-800">{t("auth.signInTitle")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("auth.signInSub")}</p>

        {/* שגיאה — אחת, במקום אחד, עם aria-live כדי שקורא מסך יקריא אותה. */}
        <div aria-live="polite">
          {(errKey || error) && (
            <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {t(errKey || error)}
              {errCode && (
                <span className="num mt-1 block text-[11px] text-red-600/80" dir="ltr">
                  {errCode}
                </span>
              )}
            </p>
          )}
        </div>

        {/* ================= מסלול הנהג: נייד + קוד ================= */}
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            if (onCode) {
              if (codeReady) verify();
            } else if (phoneReady) sendCode();
          }}
        >
          {!onCode && (
            <>
              <label htmlFor="login-phone" className="block text-xs font-medium text-slate-700">
                {t("auth.phone.label")}
              </label>
              <input
                id="login-phone"
                dir="ltr"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                data-testid="login-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("auth.phone.placeholder")}
                className="num min-h-12 w-full rounded border border-slate-300 px-3 py-2 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <p className="text-xs text-slate-500">{t("auth.phone.hint")}</p>
              {/* ⚠️ **גילוי התכלית, בנקודת האיסוף** (עדי §4.4). מסך הכניסה הוא
                  המקום שבו המספר נאסף, ולכן המשפט הזה יושב **לפני** השדה
                  ובגודל גוף רגיל (text-sm) — ולא ב-text-[11px] בתחתית, שזו
                  בדיוק הנחיתה של A8 על אותו פיקסל בפעם השנייה. שלושת החלקים
                  נחוצים: מה המספר עושה · מה הוא לא עושה · **ושיש דרך אחרת.**
                  בחירה שהעובד אינו יודע עליה אינה בחירה. */}
              <p className="rounded border border-slate-200 bg-slate-50 p-2 text-sm leading-relaxed text-slate-700">
                {t("portalLogin.purposeNote")}
              </p>
              <Button
                type="submit"
                className="min-h-12 w-full"
                size="lg"
                disabled={!phoneReady || busy}
              >
                <Smartphone size={16} aria-hidden="true" />
                {busy ? t("auth.phone.sending") : t("auth.phone.send")}
              </Button>
            </>
          )}

          {onCode && (
            <>
              <p className="text-xs text-slate-700">
                {t("auth.phone.sentTo", { phone: formatPhoneIl(phoneSentTo) })}
              </p>
              <label htmlFor="login-code" className="block text-xs font-medium text-slate-700">
                {t("auth.phone.codeLabel")}
              </label>
              <input
                id="login-code"
                dir="ltr"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                autoFocus
                data-testid="login-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="num min-h-12 w-full rounded border border-slate-300 px-3 py-2 text-center text-lg tracking-widest focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <Button
                type="submit"
                className="min-h-12 w-full"
                size="lg"
                disabled={!codeReady || busy}
              >
                <KeyRound size={16} aria-hidden="true" />
                {busy ? t("auth.phone.verifying") : t("auth.phone.verify")}
              </Button>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={backToNumber}
                  className="inline-flex min-h-12 items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                >
                  <ArrowRight size={13} aria-hidden="true" />
                  {t("auth.phone.changeNumber")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={sendCode}
                  className="min-h-12 text-xs text-brand-700 hover:text-brand-800 disabled:text-slate-400"
                >
                  {t("auth.phone.resend")}
                </button>
              </div>
            </>
          )}
        </form>

        {/* ⚠️ invisible reCAPTCHA — חייב להיות ב-DOM לפני יצירת ה-verifier. */}
        <div id="recaptcha-container" />

        {/* ================= מסלול האדמין: Google, כמו שהיה ================= */}
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">{t("auth.adminSection")}</p>
          <Button variant="secondary" className="mt-2 min-h-12 w-full" onClick={onSignIn}>
            {t("auth.signInGoogle")}
          </Button>
        </div>

        {/* פיתוח מול אמולטור בלבד — לא קיים בבנייה לפרודקשן (ראה firebase.js). */}
        {isEmulator && (
          <div className="mt-2 space-y-2 rounded border border-dashed border-amber-400 bg-amber-50 p-2">
            <button
              type="button"
              onClick={onSignInFresh}
              className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900"
            >
              אמולטור: כניסה כמשתמש חדש (אנונימי)
            </button>
            {/* כניסה עם **מייל מאומת** — מסלול ה**אדמין**. נשאר כדי שאפשר
                יהיה לבדוק את ה-allowlist בלי חשבון Google אמיתי. כניסת הנהג
                בנייד עוברת באמולטור דרך הזרימה האמיתית למעלה (ה-reCAPTCHA
                מדולגת אוטומטית, והקוד מופיע בלוג האמולטור). */}
            <input
              dir="ltr"
              type="email"
              data-testid="emu-email"
              value={devEmail}
              onChange={(e) => setDevEmail(e.target.value)}
              placeholder="admin@example.com"
              aria-label="אמולטור: כתובת מייל של אדמין"
              className="w-full rounded border border-amber-300 px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              data-testid="emu-signin"
              onClick={() => onSignInEmail?.(devEmail)}
              className="w-full rounded border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900"
            >
              אמולטור: כניסה עם המייל הזה (מאומת)
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={toggleLang}
          className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-700"
        >
          {t("nav.language")}
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
