import { ArrowRight, RotateCcw } from "lucide-react";

// כותרת מסך אחידה: כפתור חזרה (חץ ימינה ב-RTL), כותרת, וכפתור איפוס אופציונלי
export default function ScreenHeader({ title, onBack, onReset, right }) {
  return (
    <header className="no-print sticky top-0 z-20 flex items-center gap-3 bg-cream/95 backdrop-blur px-4 py-3 border-b border-black/5">
      <button
        onClick={onBack}
        aria-label="חזרה לתפריט"
        className="min-w-[48px] min-h-[48px] grid place-items-center rounded-xl bg-white shadow active:scale-95"
      >
        <ArrowRight className="w-7 h-7 text-cardbackDark" />
      </button>
      <h1 className="flex-1 text-2xl font-bold text-cardbackDark truncate">{title}</h1>
      {right}
      {onReset && (
        <button
          onClick={onReset}
          aria-label="התחלה מחדש"
          className="min-w-[48px] min-h-[48px] grid place-items-center rounded-xl bg-white shadow active:scale-95"
        >
          <RotateCcw className="w-6 h-6 text-cardbackDark" />
        </button>
      )}
    </header>
  );
}
