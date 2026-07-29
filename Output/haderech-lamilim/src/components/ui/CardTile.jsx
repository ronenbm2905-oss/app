// אריח קלף גנרי: תמונה או גב, עם מסגרת ירוקה כשהותאם, רעידה בשגיאה.
// משמש את משחקי הזיכרון, ההתאמות ומצא-את-הזוג.
export default function CardTile({
  img,
  faceUp,
  matched,
  wrong,
  onClick,
  back = "image",
  alt = "קלף",
  disabled,
  className = "",
}) {
  const backStyles = {
    image: { bg: "bg-cardback", emoji: "🃏", label: "הדרך למילים" },
    sentence: { bg: "bg-cardbackDark", emoji: "", label: "הדרך למילים" },
    chick: { bg: "bg-cardback", emoji: "🐣", label: "הדרך למילים" },
  };
  const b = backStyles[back] || backStyles.image;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      aria-label={faceUp ? alt : "קלף הפוך"}
      className={`relative aspect-[3/4] w-full rounded-2xl overflow-hidden shadow-md transition
        ${matched ? "ring-4 ring-green-500" : "ring-1 ring-black/10"}
        ${wrong ? "animate-shake" : ""}
        ${!disabled && !matched ? "active:scale-95 hover:brightness-105" : ""}
        ${className}`}
    >
      {faceUp ? (
        <img src={img} alt={alt} loading="lazy" className="w-full h-full object-cover animate-flip" draggable={false} />
      ) : (
        <div className={`w-full h-full ${b.bg} grid place-items-center text-white`}>
          <div className="text-center px-1">
            {b.emoji && <div className="text-4xl mb-1">{b.emoji}</div>}
            <div className={back === "sentence" ? "text-lg font-bold leading-tight" : "text-xs font-semibold opacity-90"}>
              {b.label}
            </div>
          </div>
        </div>
      )}
    </button>
  );
}
