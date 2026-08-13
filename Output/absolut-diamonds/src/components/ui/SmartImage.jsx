import { useState } from "react";

// ============================================================================
// SmartImage — תמונות תכשיטים הן כבדות, וזו דרישת ביצועים מפורשת באפיון.
//
//   • `loading="lazy"` + `decoding="async"` — לא טוענים 40 תמונות בקטלוג.
//   • `aspect-square` + שלד shimmer — שומר על מקום קבוע. בלי זה הגריד קופץ
//     בזמן הטעינה (CLS), וזה נראה כמו באג.
//   • כישלון טעינה → fallback שקט במקום אייקון תמונה שבורה.
//   • `sizes` — נותן לדפדפן לבחור גודל כשה-src הוא srcSet.
// ============================================================================

export default function SmartImage({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  fallback = null,
  priority = false,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}) {
  const [state, setState] = useState(src ? "loading" : "empty");

  if (!src || state === "error") {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden bg-sand ${className}`}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      >
        {fallback}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      {state === "loading" ? <div className="skeleton absolute inset-0" aria-hidden="true" /> : null}
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={priority ? "high" : undefined}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          state === "loaded" ? "opacity-100" : "opacity-0"
        } ${imgClassName}`}
      />
    </div>
  );
}
