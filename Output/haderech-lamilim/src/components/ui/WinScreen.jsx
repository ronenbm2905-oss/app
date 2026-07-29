import Button from "./Button";

// מסך ניצחון משותף לכל המשחקים
export default function WinScreen({ title = "כל הכבוד!", subtitle, onAgain, onHome, emoji = "🎉" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 px-6 text-center animate-pop">
      <div className="text-7xl">{emoji}</div>
      <h2 className="text-4xl font-bold text-cardbackDark">{title}</h2>
      {subtitle && <p className="text-xl text-cardbackDark/80">{subtitle}</p>}
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        <Button variant="happy" onClick={onAgain}>
          עוד פעם 🔁
        </Button>
        <Button variant="soft" onClick={onHome}>
          לתפריט 🏠
        </Button>
      </div>
    </div>
  );
}
