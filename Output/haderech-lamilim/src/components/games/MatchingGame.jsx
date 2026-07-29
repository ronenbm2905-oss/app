import { useEffect, useMemo, useState } from "react";
import { CARDS } from "../../data/cards";
import { pickRandom, shuffle } from "../../utils/shuffle";
import ScreenHeader from "../ui/ScreenHeader";
import SpeakButton from "../ui/SpeakButton";
import Feedback from "../ui/Feedback";
import WinScreen from "../ui/WinScreen";
import Button from "../ui/Button";

const ROUNDS = 6;
const OPTIONS = 4;

// 3.1 משחק התאמות — מוצג משפט, בוחרים מבין 4 תמונות (גיל 5+)
export default function MatchingGame({ onHome, media }) {
  const { speech, sound } = media;
  const [seed, setSeed] = useState(0);
  const [round, setRound] = useState(0);
  const [fb, setFb] = useState(null);
  const [solvedThisRound, setSolved] = useState(false);

  // 6 קלפי-מטרה אקראיים; לכל סבב 3 מסיחים אקראיים נוספים
  const targets = useMemo(() => pickRandom(CARDS, ROUNDS), [seed]);
  const current = targets[round];

  const options = useMemo(() => {
    if (!current) return [];
    const distractors = pickRandom(
      CARDS.filter((c) => c.id !== current.id),
      OPTIONS - 1
    );
    return shuffle([current, ...distractors]);
  }, [current, seed]);

  useEffect(() => {
    // הקראת המשפט אוטומטית בתחילת כל סבב
    if (current) speech.speak(current.sentence);
    setSolved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, seed]);

  if (round >= ROUNDS) {
    return (
      <Screen onHome={onHome} onReset={() => restart()}>
        <WinScreen
          title="כל הכבוד! 🎉"
          subtitle="סיימת את כל ההתאמות"
          onAgain={() => restart()}
          onHome={onHome}
        />
      </Screen>
    );
  }

  function restart() {
    setSeed((s) => s + 1);
    setRound(0);
    setFb(null);
  }

  function choose(card) {
    if (solvedThisRound) return;
    if (card.id === current.id) {
      sound.playSuccess();
      setSolved(true);
      setFb({ id: Date.now(), type: "success", message: "כל הכבוד! לחץ על הבא ➡️" });
      speech.speak("כל הכבוד");
    } else {
      sound.playError();
      const id = Date.now();
      setFb({ id, type: "error", message: "קרוב אבל לא מדויק, נסה שנית" });
      speech.speak("קרוב אבל לא מדויק, נסה שנית");
      setTimeout(() => setFb((f) => (f && f.id === id ? null : f)), 2000);
    }
  }

  return (
    <Screen onHome={onHome} onReset={restart}>
      <div className="max-w-3xl mx-auto px-4 pb-10">
        <div className="text-center text-cardbackDark/70 font-bold mb-3">
          סבב {round + 1} מתוך {ROUNDS}
        </div>

        {/* המשפט + כפתור הקראה */}
        <div className="flex items-center gap-3 bg-white rounded-2xl shadow p-4 mb-6">
          <SpeakButton onSpeak={() => speech.speak(current.sentence)} label="הקראת המשפט" />
          <p className="flex-1 text-2xl sm:text-3xl font-bold text-cardbackDark leading-relaxed text-center">
            {current.sentence}
          </p>
        </div>

        {/* 4 אפשרויות תמונה */}
        <div className="grid grid-cols-2 gap-4">
          {options.map((c) => {
            const isCorrect = solvedThisRound && c.id === current.id;
            return (
              <button
                key={c.id}
                onClick={() => choose(c)}
                disabled={solvedThisRound}
                aria-label={c.name}
                className={`relative aspect-square rounded-2xl overflow-hidden shadow-md ring-1 ring-black/10 transition
                  ${isCorrect ? "ring-4 ring-green-500" : ""}
                  ${!solvedThisRound ? "hover:brightness-105 active:scale-95" : "opacity-90"}`}
              >
                <img src={c.img} alt={c.name} loading="lazy" className="w-full h-full object-cover" draggable={false} />
              </button>
            );
          })}
        </div>

        {solvedThisRound && (
          <div className="flex justify-center mt-6">
            <Button variant="happy" onClick={() => setRound((r) => r + 1)}>
              הבא ➡️
            </Button>
          </div>
        )}
      </div>

      {fb && <Feedback key={fb.id} type={fb.type} message={fb.message} />}
    </Screen>
  );
}

function Screen({ children, onHome, onReset }) {
  return (
    <div className="min-h-full">
      <ScreenHeader title="משחק התאמות" onBack={onHome} onReset={onReset} />
      {children}
    </div>
  );
}
