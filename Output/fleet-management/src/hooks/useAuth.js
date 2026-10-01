import { useState, useEffect, useCallback, useRef } from "react";
import { isFirebaseConfigured, isEmulator, auth, googleProvider } from "../firebase.js";
import { canonicalPhone } from "../utils/phone.js";

// LOCAL_USER — במצב מקומי אין התחברות: משתמש בודד שהוא admin.
const LOCAL_USER = {
  uid: "local-admin",
  displayName: "מנהל מקומי",
  email: "local@demo",
  emailVerified: true,
  phoneNumber: null,
  isLocal: true,
};

// ============================================================================
// PHONE_ERRORS — קוד השגיאה של Firebase → מפתח i18n.
//
// ⚠️ זה לא "נוחות". מסך כניסה שמציג "ההתחברות נכשלה" על **ארבע** תקלות שונות
// הוא מסך שהעובד נתקע בו: קוד שגוי, קוד שפג, מספר שאינו נייד ישראלי, ויותר
// מדי ניסיונות — כל אחד דורש פעולה אחרת מהמשתמש. מי שלא יודע מה קרה מתקשר
// לאדמין, וזה בדיוק מה שהמסלול הזה נועד למנוע.
// ============================================================================
const PHONE_ERRORS = {
  "auth/invalid-phone-number": "auth.phone.err.number",
  "auth/missing-phone-number": "auth.phone.err.number",
  "auth/invalid-verification-code": "auth.phone.err.code",
  "auth/missing-verification-code": "auth.phone.err.code",
  "auth/code-expired": "auth.phone.err.expired",
  "auth/session-expired": "auth.phone.err.expired",
  "auth/too-many-requests": "auth.phone.err.tooMany",
  "auth/quota-exceeded": "auth.phone.err.tooMany",
  "auth/captcha-check-failed": "auth.phone.err.captcha",
  // invalid-app-credential = אסימון ה-reCAPTCHA נדחה. מבחינת העובד זו אותה
  // תקלה כמו captcha-check-failed, ולכן אותה הודעה.
  "auth/invalid-app-credential": "auth.phone.err.captcha",
  "auth/operation-not-allowed": "auth.phone.err.disabled",
  // billing-not-enabled / unauthorized-domain — תקלות הגדרה בפרויקט, בדיוק
  // כמו ספק מכובה: העובד אינו יכול לעשות דבר, והפנייה היא לאדמין.
  "auth/billing-not-enabled": "auth.phone.err.disabled",
  "auth/unauthorized-domain": "auth.phone.err.disabled",
  "auth/app-not-authorized": "auth.phone.err.disabled",
  "auth/unsupported-country-code": "auth.phone.err.number",
};

const phoneErrorKey = (err) => PHONE_ERRORS[err?.code] || "auth.phone.err.failed";

// ============================================================================
// phoneErrorCode — הקוד הגולמי של Firebase, להצגה לצד ההודעה.
//
// ⚠️ זה לא "דליפת פרטי מימוש". ההודעה למשתמש היא **קטגוריה** — חמש הודעות
// מכסות עשרות קודים, ו-`auth.phone.err.failed` הוא ברירת מחדל לכל קוד שאינו
// ממופה. בלי הקוד, תקלת הגדרה בפרויקט נראית לעובד כ"בדקו חיבור לאינטרנט",
// והאדמין מקבל צילום מסך שאי אפשר לאבחן ממנו דבר.
//
// הקוד מוצג קטן ומעומעם, ורק בכישלון.
// ============================================================================
const phoneErrorCode = (err) => {
  const code = typeof err?.code === "string" ? err.code : "";
  return /^auth\/[a-z0-9-]{1,48}$/.test(code) ? code : null;
};

export function useAuth() {
  const [user, setUser] = useState(isFirebaseConfigured ? null : LOCAL_USER);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState(null);
  // הסשן של אימות ה-SMS. ref ולא state: הוא אינו נרנדר, ושינוי שלו אינו
  // אמור לגרום ל-re-render באמצע הקלדת הקוד.
  const confirmationRef = useRef(null);
  const verifierRef = useRef(null);
  // ה-step של זרימת הטלפון כן נרנדר: 'number' → הקלדת מספר, 'code' → קוד.
  const [phoneStep, setPhoneStep] = useState("number");
  const [phoneSentTo, setPhoneSentTo] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    let cancelled = false;
    let unsub = () => {};
    import("firebase/auth")
      .then(({ onAuthStateChanged }) => {
        if (cancelled) return;
        unsub = onAuthStateChanged(
          auth,
          (u) => {
            // emailVerified — **התנאי שהופך מייל למפתח** בתביעת הזמנה. ה-rules
            // דורשות `email_verified == true`, ולכן המסך חייב לדעת אותו כדי
            // להסביר "המייל שלך אינו מאומת" במקום להיכשל באדום. כניסת Google
            // תמיד מאומתת; כניסה אנונימית (אמולטור) — לא, וגם אין לה מייל.
            setUser(
              u
                ? {
                    uid: u.uid,
                    displayName: u.displayName,
                    email: u.email,
                    emailVerified: Boolean(u.emailVerified),
                    // ⚠️ **עוגן הזהות של הנהג** (1.10.2026). מאוכלס **רק**
                    // אחרי אימות קוד SMS — ב-Firebase Auth אין טלפון
                    // לא-מאומת, ולכן אין כאן שדה `phoneVerified` מקביל
                    // ל-`emailVerified`. הערך חוזר תמיד בפורמט E.164, וזה
                    // בדיוק מה שיגיע לכלל כ-`token.phone_number`.
                    phoneNumber: u.phoneNumber || null,
                  }
                : null
            );
            setAuthLoading(false);
          },
          (err) => {
            console.error("auth error", err);
            setAuthError("auth.error");
            setAuthLoading(false);
          }
        );
      })
      .catch((err) => {
        console.error("auth import failed", err);
        setAuthLoading(false);
      });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const signIn = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    setAuthError(null);
    try {
      const { signInWithPopup } = await import("firebase/auth");
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("signIn failed", err);
      setAuthError("auth.signInFailed");
    }
  }, []);

  // signInFresh — **פיתוח מול אמולטור בלבד** (ראה firebase.js: הבלוק מת
  // בבנייה לפרודקשן). כניסה אנונימית נותנת uid חדש בכל פעם, וזה בדיוק
  // "משתמש חדש שאין לו עדיין ארגון" — התרחיש שהתפוצץ ב-16.8 ושאי אפשר
  // היה לשחזר בדפדפן בלי לגעת בפרויקט אמיתי.
  const signInFresh = useCallback(async () => {
    if (!isEmulator || !auth) return;
    setAuthError(null);
    try {
      const { signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(auth);
    } catch (err) {
      console.error("anonymous signIn failed", err);
      setAuthError("auth.signInFailed");
    }
  }, []);

  // ==========================================================================
  // signInAsEmulatorEmail — **פיתוח מול אמולטור בלבד**, כמו signInFresh.
  //
  // למה זה נחוץ: `signInFresh` נותן משתמש אנונימי — בלי מייל ובלי
  // `email_verified`. כלומר **אי אפשר לבדוק בדפדפן את הזרימה המרכזית של
  // פרוסה 2** (עובד נכנס עם המייל שבכרטיס שלו ונקשר) בלי לגעת בפרויקט אמיתי,
  // ובלי חשבון Google אמיתי לכל נהג בדיקה. זו בדיוק סוג הפרצה שבה התחבא באג
  // הפרודקשן של 16.8: מסלול שלא היה ניתן להרצה בדפדפן.
  //
  // אמולטור ה-Auth מקבל "טוקן זהות" שהוא JSON פשוט, ולכן אפשר לייצר משתמש
  // עם כל כתובת ועם `email_verified: true` בלי ספק חיצוני. **וזה גם מדגים
  // את הנקודה**: הקישור נשען על שני שדות שקיימים בכל ספק, ולא על Google.
  //
  // הבלוק מת בבנייה לפרודקשן — `isEmulator` מתקמפל ל-false מילולי
  // (ראה vite.config.js / firebase.js).
  // ==========================================================================
  const signInAsEmulatorEmail = useCallback(async (email, { verified = true } = {}) => {
    if (!isEmulator || !auth) return;
    setAuthError(null);
    try {
      const { signInWithCredential, GoogleAuthProvider } = await import("firebase/auth");
      const sub = `emu-${String(email).replace(/[^a-z0-9]/gi, "-")}`;
      const token = JSON.stringify({ sub, email, email_verified: verified });
      await signInWithCredential(auth, GoogleAuthProvider.credential(token));
    } catch (err) {
      console.error("emulator signIn failed", err);
      setAuthError("auth.signInFailed");
    }
  }, []);

  // ==========================================================================
  // ======================  כניסת נהג: נייד + קוד SMS  =======================
  // ==========================================================================
  //
  // ⚠️ **שתי פעולות, לא אחת.** `signInWithPhoneNumber` **שולח SMS** — כלומר
  // היא עולה כסף ויש לה מגבלת קצב. לכן:
  //   • המספר נבדק **מקומית** לפני הקריאה (canonicalPhone). מספר קווי או
  //     חסר ספרה מקבל שגיאה מיד, בלי SMS ובלי המתנה. ה-SMS region policy
  //     בפרויקט נעולה לישראל ממילא, וקריאה למספר זר הייתה נדחית בשרת
  //     בשגיאה גנרית שהמשתמש אינו יכול לפעול לפיה.
  //   • המספר נשלח ל-Firebase **בצורה הקנונית** E.164, ולא כפי שהוקלד.
  //
  // reCAPTCHA: `invisible`, ונוצרת **מחדש בכל ניסיון**. verifier שמומש פעם
  // אחת אינו ניתן למימוש שני, וזה הכשל הקלאסי של המסך הזה — "נסה שוב" שלא
  // עובד יותר אחרי טעות אחת בקוד.
  // ==========================================================================
  const clearVerifier = useCallback(() => {
    try {
      verifierRef.current?.clear();
    } catch {
      // clear() על verifier שה-DOM שלו כבר הוסר זורק. זה לא כלום.
    }
    verifierRef.current = null;
  }, []);

  const startPhoneSignIn = useCallback(
    async (rawPhone, containerId = "recaptcha-container") => {
      if (!isFirebaseConfigured || !auth) return { ok: false, errorKey: "auth.phone.err.failed" };
      const phone = canonicalPhone(rawPhone);
      if (!phone) return { ok: false, errorKey: "auth.phone.err.number" };
      setAuthError(null);
      try {
        const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
        clearVerifier();
        verifierRef.current = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
        confirmationRef.current = await signInWithPhoneNumber(auth, phone, verifierRef.current);
        setPhoneSentTo(phone);
        setPhoneStep("code");
        return { ok: true, errorKey: null };
      } catch (err) {
        console.error("phone sign-in start failed", err?.code || err);
        clearVerifier();
        confirmationRef.current = null;
        return { ok: false, errorKey: phoneErrorKey(err), errorCode: phoneErrorCode(err) };
      }
    },
    [clearVerifier]
  );

  // confirmPhoneCode — אימות הקוד. **לא מאפס את ה-step בכישלון**: קוד שגוי
  // משאיר את המשתמש במסך הקוד עם הודעה, ולא זורק אותו חזרה להקלדת המספר
  // (שהיה שולח SMS נוסף על כל טעות הקלדה).
  const confirmPhoneCode = useCallback(async (code) => {
    const digits = String(code ?? "").replace(/[^0-9]/g, "");
    if (!confirmationRef.current) return { ok: false, errorKey: "auth.phone.err.expired" };
    if (digits.length < 6) return { ok: false, errorKey: "auth.phone.err.code" };
    setAuthError(null);
    try {
      await confirmationRef.current.confirm(digits);
      // ההצלחה מגיעה ל-state דרך onAuthStateChanged, לא מכאן.
      confirmationRef.current = null;
      clearVerifier();
      return { ok: true, errorKey: null };
    } catch (err) {
      console.error("phone code confirm failed", err?.code || err);
      const errorKey = phoneErrorKey(err);
      const errorCode = phoneErrorCode(err);
      // קוד שפג תוקף = הסשן מת. חוזרים להקלדת מספר, אחרת המשתמש מקיש
      // לנצח קודים לסשן שאינו קיים.
      if (errorKey === "auth.phone.err.expired") {
        confirmationRef.current = null;
        clearVerifier();
        setPhoneStep("number");
      }
      return { ok: false, errorKey, errorCode };
    }
  }, [clearVerifier]);

  const resetPhoneSignIn = useCallback(() => {
    confirmationRef.current = null;
    clearVerifier();
    setPhoneSentTo(null);
    setPhoneStep("number");
    setAuthError(null);
  }, [clearVerifier]);

  const signOutUser = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    // ⚠️ מאפסים גם את זרימת ה-SMS: בלי זה, מי שיצא ונכנס שוב היה חוזר
    // למסך "הקלד קוד" של סשן אימות שכבר מת.
    resetPhoneSignIn();
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  }, [resetPhoneSignIn]);

  return {
    user,
    authLoading,
    authError,
    signIn,
    signInFresh,
    signInAsEmulatorEmail,
    // -- כניסת נהג בנייד ----------------------------------------------------
    startPhoneSignIn,
    confirmPhoneCode,
    resetPhoneSignIn,
    phoneStep,
    phoneSentTo,
    signOut: signOutUser,
    isLocal: !isFirebaseConfigured,
    isEmulator,
  };
}
