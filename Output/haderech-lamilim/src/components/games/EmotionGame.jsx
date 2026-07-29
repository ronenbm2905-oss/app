import { useEffect, useMemo, useState } from "react";
import { CARDS, EMOTION_LIST, EMOTIONS } from "../../data/cards";
import { pickRandom, randomItem, shuffle } from "../../utils/shuffle";
import ScreenHeader from "../ui/ScreenHeader";
import Feedback from "../ui/Feedback";

// 3.6 מה הרגש? — שלב 1: זיהוי רגש התמונה. שלב 2: מציאת קלף עם אותו רגש מבין 3.
export default function EmotionGame({ onHome, media }) {
  const { sound, speech } = media;
  const [stage, setStage] = useState(1);
  const [target, setTarget] = useState(() => randomItem(CARDS)); // קלף שלב 1
  const [wrongKey, setWrongKey] = useState(null);
  const [fb, setFb] = useState(null);

  // שלב 2: שלישיית קלפים — אחד תואם-רגש, שניים לא
  const [trio, setTrio] = useState([]);
  const emotion = EMOTIONS[target.emotion];

  useEffect(() => {
    if (stage === 1) speech.speak("איזה רגש מרגישה הדמות?");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, target]);

  function toast(type, message, spoken, auto = true) {
    const id = Date.now();
    setFb({ id, type, message });
    if (spoken) speech.speak(spoken);
    if (auto) setTimeout(() => setFb((f) => (f && f.id === id ? null : f)), 2000);
  }

  // --- שלב 1: בחירת הרגש הנכון ---
  function chooseEmotion(key) {
    if (key === target.emotion) {
      sound.playSuccess();
      const sameOthers = CARDS.filter((c) => c.emotion === target.emotion && c.id !== target.id);
      if (sameOthers.length >= 1) {
        // בונים שלישייה לשלב 2
        setTrio(buildTrio(target));
        setStage(2);
        toast("success", "נכון! עכשיו מצאו קלף עם אותו רגש", "נכון, עכשיו מצאו קלף עם אותו רגש");
      } else {
        // אין מספיק קלפים לאותו רגש (למשל כועס) — עוברים לסבב חדש
        toast("success", "נכון! כל הכבוד 🎉", "נכון, כל הכבוד");
        setTimeout(newRound, 1300);
      }
    } else {
      sound.playError();
      setWrongKey(key);
      setTimeout(() => setWrongKey(null), 450);
      toast("error", "לא מדויק, נסו שוב", "לא מדויק, נסו שוב");
    }
  }

  // --- שלב 2: מציאת אותו רגש ---
  function chooseTrio(card) {
    if (card.emotion === target.emotion) {
      sound.playSuccess();
      toast("success", "מצוין! מצאתם את אותו הרגש 🎉", "מצוין, מצאתם את אותו הרגש");
      setTimeout(newRound, 1400);
    } else {
      sound.playError();
      setWrongKey(card.id);
      setTimeout(() => setWrongKey(null), 450);
      // שני הלא-נכונים מתחלפים, הנכון נשאר
      setTrio((prev) => reshuffleWrong(prev, target.emotion));
      toast("error", "לא זה — הרגש שונה. נסו שוב", "הרגש שונה, נסו שוב");
    }
  }

  function newRound() {
    setTarget(randomItem(CARDS));
    setStage(1);
    setFb(null);
  }

  return (
    <div className="min-h-full">
      <ScreenHeader title="מה הרגש?" onBack={onHome} onReset={newRound} />
      <div className="max-w-2xl mx-auto px-4 pb-10">
        {stage === 1 ? (
          <>
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden mt-4">
              <img src={target.img} alt="דמות" className="w-full max-h-80 object-cover" draggable={false} />
            </div>
            <p className="text-center text-2xl font-bold text-cardbackDark my-5">איזה רגש מרגישה הדמות?</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {EMOTION_LIST.map((e) => (
                <button
                  key={e.key}
                  onClick={() => chooseEmotion(e.key)}
                  aria-label={e.label}
                  className={`flex flex-col items-center gap-1 rounded-2xl bg-white shadow-md py-4 ring-1 ring-black/10
                    transition hover:brightness-105 active:scale-95 ${wrongKey === e.key ? "animate-shake" : ""}`}
                >
                  <span className="text-5xl">{e.emoji}</span>
                  <span className="text-lg font-bold text-cardbackDark">{e.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 my-5">
              <span className="text-xl font-bold text-cardbackDark">מצאו קלף שמרגיש</span>
              <span className="text-4xl">{emotion.emoji}</span>
              <span className="text-xl font-bold" style={{ color: emotion.color }}>
                {emotion.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {trio.map((c) => (
                <button
                  key={c.id}
                  onClick={() => chooseTrio(c)}
                  aria-label={c.name}
                  className={`relative aspect-[3/4] rounded-2xl overflow-hidden shadow-md ring-1 ring-black/10
                    transition hover:brightness-105 active:scale-95 ${wrongKey === c.id ? "animate-shake" : ""}`}
                >
                  <img src={c.img} alt={c.name} loading="lazy" className="w-full h-full object-cover" draggable={false} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {fb && <Feedback key={fb.id} type={fb.type} message={fb.message} />}
    </div>
  );
}

// שלישייה: קלף נכון (אותו רגש, שונה מהמטרה) + 2 מסיחים מרגשות אחרים
function buildTrio(target) {
  const correct = randomItem(CARDS.filter((c) => c.emotion === target.emotion && c.id !== target.id));
  const distractors = pickRandom(CARDS.filter((c) => c.emotion !== target.emotion), 2);
  return shuffle([correct, ...distractors]);
}

// מחליף את שני הלא-נכונים, משאיר את הנכון
function reshuffleWrong(prev, targetEmotion) {
  const correct = prev.find((c) => c.emotion === targetEmotion);
  const usedIds = new Set(prev.map((c) => c.id));
  const pool = CARDS.filter((c) => c.emotion !== targetEmotion && !usedIds.has(c.id));
  const newDistractors = pickRandom(pool.length >= 2 ? pool : CARDS.filter((c) => c.emotion !== targetEmotion), 2);
  return shuffle([correct, ...newDistractors]);
}
