import { Button } from "./ui/Button.jsx";
import { IconBuilding, IconWarning } from "./ui/icons.jsx";

export default function LoginPage({ onSignIn, error }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-brand">
        <IconBuilding size={36} className="mx-auto text-accent" />
        <h1 className="mt-4 text-xl font-bold">ניהול תקציב פרויקט</h1>
        <p className="mt-2 text-sm text-ink-muted">
          תזרים תשלומים, פנקס חשבוניות, ומנות הגשה לרשות.
        </p>

        <Button className="mt-6 w-full justify-center" onClick={onSignIn}>
          כניסה עם Google
        </Button>

        <p className="mt-4 text-xs text-ink-muted">
          הגישה נקבעת לפי כתובת המייל שלך. בעל הפרויקט מוסיף אותך לרשימת החברים —
          אין הרשמה עצמאית.
        </p>

        {error && (
          <p className="mt-4 flex items-start gap-1.5 rounded-sm bg-danger-fill p-2 text-right text-sm text-danger-text">
            <IconWarning size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
