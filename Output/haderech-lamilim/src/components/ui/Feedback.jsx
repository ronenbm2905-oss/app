// באנר משוב צף (נכון / קרוב אבל לא מדויק). נעלם אוטומטית דרך key מ-ההורה.
export default function Feedback({ type, message }) {
  if (!message) return null;
  const styles =
    type === "success"
      ? "bg-green-500 text-white"
      : type === "error"
      ? "bg-amber-400 text-amber-950"
      : "bg-white text-cardbackDark";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 top-20 z-30 mx-auto w-max max-w-[90%] px-6 py-3 rounded-full shadow-lg
        text-xl font-bold animate-pop ${styles}`}
    >
      {message}
    </div>
  );
}
