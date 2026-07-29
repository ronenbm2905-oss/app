import { useEffect, useMemo, useState } from "react";
import { CARDS } from "../../data/cards";
import { pickRandom, shuffle } from "../../utils/shuffle";
import ScreenHeader from "../ui/ScreenHeader";
import Feedback from "../ui/Feedback";
import WinScreen from "../ui/WinScreen";

const ROUNDS = 8;
const OPTIONS = 4;

// 3.4 משחק גילאי 2–4 — קלף הפוך למעלה (לחיצה חושפת), 4 תמונות למטה, מציאת הזוג.
export default function FindPair({ onHome, media }) {
  const { sound, speech } = media;
  const [seed, setSeed] = useState(0);
  const [round, setRound] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [wrongId, setWrongId] = useState(null);
  const [solved, setSolved] = useState(false);
  const [fb, setFb] = useState(null);

  const targets = useMemo(() => pickRandom(CARDS, ROUNDS), [seed]);
  const current = targets[round];
  const options = useMemo(() => {
    if (!current) return [];
    const d = pickRandom(CARDS.filter((c) => c.id !== current.id), OPTIONS - 1);
    return shuffle([current, ...d]);
  }, [current, seed]);

  useEffect(() => {
    setRevealed(false);
    setSolved(false);
    setWrongId(null);
  }, [round, seed]);

  if (round >= ROUNDS) {
    return (
      <div className="min-h-full">
        <ScreenHeader title="מצא את הזוג" onBack={onHome} onReset={() => restart()} />
        <WinScreen title="כל הכבוד! 🎉" subtitle="מצאת את כל הזוגות" emoji="👀" onAgain={restart} onHome={onHome} />
      </div>
    );
  }

  function restart() {
    setSeed((s) => s + 1);
    setRound(0);
    setFb(null);
  }

  function reveal() {
    if (revealed) return;
    setRevealed(true);
    sound.playFlip();
  }

  function choose(card) {
    if (solved) return;
    if (!revealed) reveal();
    if (card.id === current.id) {
      sound.playSuccess();
      setSolved(true);
      setFb({ id: Date.now(), type: "success", message: "מצאת! כל הכבוד 🎉" });
      speech.speak("מצאת, כל הכבוד");
      setTimeout(() => setRound((r) => r + 1), 1300);
    } else {
      sound.playError();
      setWrongId(card.id);
      const id = Date.now();
      setFb({ id, type: "error", message: "אופס, נסה שוב" });
      setTimeout(() => setWrongId(null), 450);
      setTimeout(() => setFb((f) => (f && f.id === id ? null : f)), 1500);
    }
  }

  return (
    <div className="min-h-full">
      <ScreenHeader title="מצא את הזוג" onBack={onHome} onReset={restart} />
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <div className="text-center text-cardbackDark/70 font-bold my-3">
          סבב {round + 1} מתוך {ROUNDS}
        </div>

        {/* הקלף הנסתר למעלה */}
        <div className="flex justify-center mb-6">
          <button
            onClick={reveal}
            aria-label={revealed ? current.name : "לחץ לגילוי הקלף"}
            className="w-40 aspect-[3/4] rounded-2xl overflow-hidden shadow-lg ring-2 ring-cardbackDark active:scale-95 transition"
          >
            {revealed ? (
              <img src={current.img} alt={current.name} className="w-full h-full object-cover animate-flip" draggable={false} />
            ) : (
              <div className="w-full h-full bg-cardback grid place-items-center text-white">
                <div className="text-center">
                  <div className="text-5xl mb-2">👆</div>
                  <div className="text-sm font-bold opacity-90">לחצו לגילוי</div>
                </div>
              </div>
            )}
          </button>
        </div>

        <p className="text-center text-cardbackDark font-bold mb-3">איזו תמונה זהה לקלף?</p>

        <div className="grid grid-cols-2 gap-4">
          {options.map((c) => {
            const isCorrect = solved && c.id === current.id;
            return (
              <button
                key={c.id}
                onClick={() => choose(c)}
                aria-label={c.name}
                className={`relative aspect-square rounded-2xl overflow-hidden shadow-md ring-1 ring-black/10 transition
                  ${isCorrect ? "ring-4 ring-green-500" : ""}
                  ${wrongId === c.id ? "animate-shake" : ""}
                  hover:brightness-105 active:scale-95`}
              >
                <img src={c.img} alt={c.name} loading="lazy" className="w-full h-full object-cover" draggable={false} />
              </button>
            );
          })}
        </div>
      </div>
      {fb && <Feedback key={fb.id} type={fb.type} message={fb.message} />}
    </div>
  );
}
