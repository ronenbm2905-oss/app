import { useEffect, useMemo, useState } from "react";
import { CARDS } from "../../data/cards";
import { pickRandom, shuffle } from "../../utils/shuffle";
import ScreenHeader from "../ui/ScreenHeader";
import Feedback from "../ui/Feedback";
import WinScreen from "../ui/WinScreen";

// 3.2 זיכרון תמונה+משפט — כל זוג = קלף תמונה + קלף המשפט התואם.
// שלבים: 2 ← 3 ← 4 ← 6 ← 8 זוגות.
const STAGES = [2, 3, 4, 6, 8];

export default function MemoryPairs({ onHome, media }) {
  const { sound, speech } = media;
  const [stageIdx, setStageIdx] = useState(0);
  const [seed, setSeed] = useState(0);
  const [fb, setFb] = useState(null);

  const pairs = STAGES[stageIdx];
  const deck = useMemo(() => buildDeck(pairs), [pairs, seed]);

  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFlipped([]);
    setMatched([]);
  }, [deck]);

  const allMatched = deck.length > 0 && matched.length === deck.length;

  useEffect(() => {
    if (!allMatched) return;
    sound.playWin();
    const last = stageIdx === STAGES.length - 1;
    speech.speak(last ? "כל הכבוד, סיימת את כל השלבים" : "כל הכבוד, עוברים לשלב הבא");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatched]);

  function flip(i) {
    if (busy || flipped.includes(i) || matched.includes(i)) return;
    sound.playFlip();
    const t = deck[i];
    if (t.type === "sentence") speech.speak(t.sentence);
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      setBusy(true);
      const [a, b] = next;
      // התאמה = אותו cardId אך סוגים שונים (תמונה מול משפט)
      if (deck[a].cardId === deck[b].cardId && deck[a].type !== deck[b].type) {
        setTimeout(() => {
          sound.playSuccess();
          setMatched((m) => [...m, a, b]);
          setFlipped([]);
          setBusy(false);
        }, 500);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setBusy(false);
        }, 1100);
      }
    }
  }

  function nextStage() {
    if (stageIdx < STAGES.length - 1) setStageIdx((s) => s + 1);
    else {
      setStageIdx(0);
      setSeed((s) => s + 1);
    }
    setFb(null);
  }

  const cols = deck.length <= 4 ? "grid-cols-2" : deck.length <= 8 ? "grid-cols-4" : "grid-cols-4";

  return (
    <div className="min-h-full">
      <ScreenHeader
        title="זיכרון: תמונה ומשפט"
        onBack={onHome}
        onReset={() => {
          setSeed((s) => s + 1);
          setFb(null);
        }}
      />
      <div className="max-w-3xl mx-auto px-4 pb-10">
        <div className="text-center text-cardbackDark/70 font-bold my-3">
          שלב {stageIdx + 1} · {pairs} זוגות
        </div>

        {allMatched ? (
          <WinScreen
            title="כל הכבוד! 🎉"
            subtitle={stageIdx === STAGES.length - 1 ? "סיימת את כל השלבים" : "מוכן לשלב הבא?"}
            emoji="🃏"
            onAgain={nextStage}
            onHome={onHome}
          />
        ) : (
          <div className={`grid ${cols} gap-3`}>
            {deck.map((t, i) => {
              const open = flipped.includes(i) || matched.includes(i);
              const isMatched = matched.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => flip(i)}
                  disabled={busy}
                  aria-label={open ? (t.type === "image" ? t.name : t.sentence) : "קלף הפוך"}
                  className={`relative aspect-[3/4] rounded-2xl overflow-hidden shadow-md transition
                    ${isMatched ? "ring-4 ring-green-500" : "ring-1 ring-black/10"}
                    ${!busy && !isMatched ? "active:scale-95 hover:brightness-105" : ""}`}
                >
                  {open ? (
                    t.type === "image" ? (
                      <img src={t.img} alt={t.name} loading="lazy" className="w-full h-full object-cover animate-flip" draggable={false} />
                    ) : (
                      <div className="w-full h-full bg-white grid place-items-center p-2 animate-flip">
                        <p className="text-base sm:text-lg font-bold text-cardbackDark leading-snug text-center">
                          {t.sentence}
                        </p>
                      </div>
                    )
                  ) : (
                    <BackFace type={t.type} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {fb && <Feedback key={fb.id} type={fb.type} message={fb.message} />}
    </div>
  );
}

function BackFace({ type }) {
  if (type === "sentence") {
    return (
      <div className="w-full h-full bg-cardbackDark grid place-items-center text-white">
        <span className="text-lg font-bold leading-tight text-center px-1">הדרך למילים</span>
      </div>
    );
  }
  return (
    <div className="w-full h-full bg-cardback grid place-items-center text-white">
      <div className="text-center">
        <div className="text-4xl mb-1">🃏</div>
        <div className="text-xs font-semibold opacity-90">הדרך למילים</div>
      </div>
    </div>
  );
}

function buildDeck(pairs) {
  const chosen = pickRandom(CARDS, pairs);
  const tiles = chosen.flatMap((c) => [
    { cardId: c.id, type: "image", img: c.img, name: c.name },
    { cardId: c.id, type: "sentence", sentence: c.sentence, name: c.name },
  ]);
  return shuffle(tiles);
}
