// כפתור עם יעד-מגע גדול (מינימום 56px) — מותאם לילדים
export default function Button({ children, onClick, variant = "primary", className = "", ...rest }) {
  const variants = {
    primary: "bg-cardbackDark text-white hover:brightness-110 active:scale-95",
    soft: "bg-white text-cardbackDark border-2 border-cardbackDark hover:bg-cream active:scale-95",
    ghost: "bg-transparent text-cardbackDark hover:bg-white/60 active:scale-95",
    happy: "bg-happy text-white hover:brightness-105 active:scale-95",
  };
  return (
    <button
      onClick={onClick}
      className={`min-h-[56px] px-6 rounded-2xl text-xl font-bold shadow-md transition
        focus-visible:outline focus-visible:outline-3 ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
