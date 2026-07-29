import { Volume2 } from "lucide-react";

// כפתור 🔊 להקראת טקסט. מקבל את הפונקציה speak ואת הטקסט.
export default function SpeakButton({ onSpeak, label = "הקראה", size = "md" }) {
  const sizes = { sm: "w-12 h-12", md: "w-14 h-14", lg: "w-16 h-16" };
  return (
    <button
      onClick={onSpeak}
      aria-label={label}
      className={`${sizes[size]} shrink-0 grid place-items-center rounded-full bg-happy text-white shadow-lg
        hover:brightness-105 active:scale-90 transition`}
    >
      <Volume2 className="w-7 h-7" />
    </button>
  );
}
