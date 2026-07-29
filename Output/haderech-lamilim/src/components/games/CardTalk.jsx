import { useEffect, useMemo, useState } from "react";
import { CARDS, EMOTIONS } from "../../data/cards";
import { randomItem } from "../../utils/shuffle";
import ScreenHeader from "../ui/ScreenHeader";
import SpeakButton from "../ui/SpeakButton";
import Button from "../ui/Button";

// תגובות חמות אחרי כל תשובה של הילד — מובנות, ללא API חיצוני
const WARM = [
  "איזה יופי ששיתפת 💛",
  "תודה שסיפרת לי",
  "מעניין מאוד!",
  "כל הכבוד על החשיבה",
  "אני שמח/ה לשמוע",
  "זו תשובה יפה מאוד",
];

// 3.5 שיח עם קלף — 4 שאלות מוכנות מראש לכל קלף; אחרי כל תשובה תגובה חמה + שאלה הבאה.
export default function CardTalk({ onHome, media }) {
  const { speech } = media;
  const [card, setCard] = useState(() => randomItem(CARDS));
  const [qIdx, setQIdx] = useState(0);
  const [warm, setWarm] = useState(null);
  const emotion = EMOTIONS[card.emotion];

  const questions = card.questions;
  const done = qIdx >= questions.length;

  useEffect(() => {
    // הקראת המשפט בפתיחת קלף
    speech.speak(card.sentence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  useEffect(() => {
    if (!done) speech.speak(questions[qIdx]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIdx, card]);

  function answered() {
    const w = randomItem(WARM);
    setWarm(w);
    speech.speak(w);
    setTimeout(() => {
      setWarm(null);
      setQIdx((i) => i + 1);
    }, 1200);
  }

  function pickNewCard() {
    let next = randomItem(CARDS);
    while (next.id === card.id) next = randomItem(CARDS);
    setCard(next);
    setQIdx(0);
    setWarm(null);
  }

  return (
    <div className="min-h-full">
      <ScreenHeader title="שיח עם קלף" onBack={onHome} onReset={pickNewCard} />
      <div className="max-w-2xl mx-auto px-4 pb-10">
        {/* הקלף */}
        <div className="bg-white rounded-3xl shadow-lg overflow-hidden mt-4">
          <div className="relative">
            <img src={card.img} alt={card.name} className="w-full max-h-72 object-cover" draggable={false} />
            <span
              className="absolute top-3 start-3 text-3xl bg-white/90 rounded-full w-12 h-12 grid place-items-center shadow"
              title={emotion.label}
            >
              {emotion.emoji}
            </span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <SpeakButton onSpeak={() => speech.speak(card.sentence)} label="הקראת המשפט" size="sm" />
            <p className="flex-1 text-xl font-bold text-cardbackDark leading-relaxed text-center">{card.sentence}</p>
          </div>
        </div>

        {/* אזור השיחה */}
        <div className="mt-6">
          {done ? (
            <div className="text-center animate-pop">
              <div className="text-5xl mb-3">💛</div>
              <p className="text-2xl font-bold text-cardbackDark mb-6">איזו שיחה יפה! רוצים קלף חדש?</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button variant="happy" onClick={pickNewCard}>
                  קלף חדש 🔀
                </Button>
                <Button variant="soft" onClick={onHome}>
                  לתפריט 🏠
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center text-cardbackDark/60 font-bold mb-2">
                שאלה {qIdx + 1} מתוך {questions.length}
              </div>
              <div className="flex items-center gap-3 bg-rose-50 border-2 border-rose-200 rounded-2xl p-5">
                <SpeakButton onSpeak={() => speech.speak(questions[qIdx])} label="הקראת השאלה" size="sm" />
                <p className="flex-1 text-2xl font-bold text-rose-900 leading-relaxed text-center">
                  {questions[qIdx]}
                </p>
              </div>

              {warm ? (
                <p className="text-center text-2xl font-bold text-green-600 mt-6 animate-pop">{warm}</p>
              ) : (
                <div className="flex justify-center mt-6">
                  <Button variant="happy" onClick={answered}>
                    ענינו — לשאלה הבאה ➡️
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-700 mt-8">
          השיחה מובנית ומיועדת להנחיה של מבוגר יחד עם הילד.
        </p>
      </div>
    </div>
  );
}
