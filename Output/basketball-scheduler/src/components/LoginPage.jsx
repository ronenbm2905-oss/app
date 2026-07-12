import { IconTrophy } from "./ui/icons";

export function LoginPage({ onSignIn, authError }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4" dir="rtl">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 max-w-sm w-full text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center">
          <IconTrophy size={28} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-900">מערכת שעות אימוני כדורסל</h1>
          <p className="text-sm text-stone-500 mt-1">התחבר כדי להמשיך</p>
        </div>

        <button
          onClick={onSignIn}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 font-medium text-sm"
        >
          <GoogleGlyph /> התחבר עם Google
        </button>

        {authError && <p className="text-xs text-red-600">{authError}</p>}

        <p className="text-xs text-stone-400">
          מנהלים יכולים לערוך; מאמנים רואים את הלוח במצב צפייה בלבד.
        </p>
      </div>
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
