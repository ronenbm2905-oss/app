import { useState } from "react";

// ============================================================================
// SmartImage — תמונות תכשיטים הן כבדות, וזו דרישת ביצועים מפורשת באפיון.
//
//   • `loading="lazy"` + `decoding="async"` — לא טוענים 40 תמונות בקטלוג.
//   • יחס קבוע — שומר על מקום קבוע. בלי זה הגריד קופץ בטעינה (CLS).
//   • `sizes` — נותן לדפדפן לבחור גודל כשה-src הוא srcSet.
//
// מה השתנה בשפה החדשה:
//   • **ה-shimmer ירד.** אנימציה מסחרית שסותרת את השקט. במקומה מילוי `alt`
//     סטטי + fade-in 250ms.
//   • כשל טעינה / אין תמונה → **הפס האלכסוני** של השפה + כיתוב mono 11px
//     עם תיאור הצילום המיועד — בדיוק דפוס ה-placeholder של מסמך המקור.
//   • radius 0 בכל השימושים.
// ============================================================================

export default function SmartImage({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  fallback = null,
  caption = null,
  priority = false,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}) {
  const [state, setState] = useState(src ? "loading" : "empty");

  if (!src || state === "error") {
    return (
      <div
        className={`stripe flex flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center ${className}`}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      >
        {fallback}
        {/* תיאור הצילום המיועד. לא `micro-en` — הטקסט כאן עברי, ו-mono
            + uppercase + ls .14em הוא מנגנון לטיני בלבד (§2.5). */}
        {caption || alt ? <span className="text-eyebrow text-muted">{caption || alt}</span> : null}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-alt ${className}`}>
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={priority ? "high" : undefined}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        className={`h-full w-full object-cover transition-opacity duration-[250ms] ${
          state === "loaded" ? "opacity-100" : "opacity-0"
        } ${imgClassName}`}
      />
    </div>
  );
}
