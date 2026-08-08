import { LegalFooter } from "../legal/LegalFooter";

// A brand-neutral mark for the one screen that cannot know which club it is serving.
function BallMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="mx-auto w-20 h-20 text-brand-600"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="24" cy="24" r="19" />
      <path d="M24 5v38M5 24h38" />
      <path d="M11 11c8 3 14 9 17 17M37 11c-8 3-14 9-17 17" />
    </svg>
  );
}

export function LoginPage({ onSignIn, authError }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4 py-8" dir="rtl">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 max-w-sm w-full text-center space-y-5">
        {/* The club's own logo cannot be shown here: club data is only readable after
            sign-in. It used to fall back to the bundled crest, which meant every club's
            coaches and parents met Kiryat Ono's logo — and trademark — on the way in.
            A neutral mark until a small publicly-readable branding document exists. */}
        <BallMark />
        <div>
          <h1 className="text-xl font-bold text-stone-900">מערכת שעות אימוני כדורסל</h1>
          <p className="text-sm text-stone-600 mt-1">התחבר כדי להמשיך</p>
        </div>

        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 font-medium text-sm"
        >
          <GoogleGlyph /> התחבר עם Google
        </button>

        {authError && <p className="text-xs text-red-600">{authError}</p>}

        <p className="text-xs text-stone-600 leading-relaxed">
          בהתחברות אתה מאשר את מדיניות הפרטיות ותנאי השימוש שלנו. נאסוף את כתובת הדוא"ל
          והשם מחשבון ה-Google שלך לצורך זיהוי והרשאות בלבד.
        </p>

        <p className="text-xs text-stone-600">
          מנהלים יכולים לערוך; מאמנים רואים את הלוח במצב צפייה בלבד.
        </p>
      </div>

      <LegalFooter className="mt-6" />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
