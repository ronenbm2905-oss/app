import { useEffect, useMemo, useState } from "react";
import { CARDS } from "../../data/cards";
import { pickRandom, shuffle } from "../../utils/shuffle";
import ScreenHeader from "../ui/ScreenHeader";
import CardTile from "../ui/CardTile";
import Feedback from "../ui/Feedback";
import WinScreen from "../ui/WinScreen";

// 3.3 זיכרון מתחת לגיל 6 — זוגות תמונות זהות. שלבים: 4 ← 6 ← 8 ← 12 ← 16 קלפים
const STAGES = [2, 3, 4, 6, 8]; // מספר זוגות (×2 = קלפים)

export default function MemoryImages({ onHome, media }) {
  const { sound, speech } = media;
  const [stageIdx, setStageIdx] = useState(0);
  const [seed, setSeed] = useState(0);
  const [fb, setFb] = useState(null);

  const pairs = STAGES[stageIdx];
  const deck = useMemo(() => buildDeck(pairs), [pairs, seed]);

  const [flipped, setFlipped] = useState([]); // אינדקסים פתוחים כרגע
  const [matched, setMatched] = useState([]); // אינדקסים שהותאמו
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
    setFb({
      id: Date.now(),
      type: "success",
      message: last ? "סיימת את כל השלבים! 🎉" : "כל הכבוד! עוברים לשלב הבא 🎈",
    });
    speech.speak(last ? "כל הכבוד, סיימת את כל השלבים" : "כל הכבוד, עוברים לשלב הבא");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatched]);

  function flip(i) {
    if (busy || flipped.includes(i) || matched.includes(i)) return;
    sound.playFlip();
    const next = [...flipped, i];
    setFlipped(next);
    if (next.length === 2) {
      setBusy(true);
      const [a, b] = next;
      if (deck[a].cardId === deck[b].cardId) {
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
        }, 900);
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

  const cols = pairs <= 3 ? "grid-cols-2" : pairs <= 4 ? "grid-cols-4" : "grid-cols-4";

  return (
    <div className="min-h-full">
      <ScreenHeader
        title="זיכרון תמונות"
        onBack={onHome}
        onReset={() => {
          setSeed((s) => s + 1);
          setFb(null);
        }}
      />
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <div className="text-center text-cardbackDark/70 font-bold my-3">
          שלב {stageIdx + 1} · {pairs} זוגות
        </div>

        {allMatched ? (
          <WinScreen
            title="כל הכבוד! 🎉"
            subtitle={stageIdx === STAGES.length - 1 ? "סיימת את כל השלבים" : "מוכן לשלב הבא?"}
            emoji="🐣"
            onAgain={nextStage}
            onHome={onHome}
          />
        ) : (
          <div className={`grid ${cols} gap-3`}>
            {deck.map((c, i) => (
              <CardTile
                key={i}
                img={c.img}
                alt={c.name}
                back="chick"
                faceUp={flipped.includes(i) || matched.includes(i)}
                matched={matched.includes(i)}
                onClick={() => flip(i)}
                disabled={busy}
              />
            ))}
          </div>
        )}
      </div>
      {fb && <Feedback key={fb.id} type={fb.type} message={fb.message} />}
    </div>
  );
}

function buildDeck(pairs) {
  const chosen = pickRandom(CARDS, pairs);
  const tiles = chosen.flatMap((c) => [
    { cardId: c.id, img: c.img, name: c.name },
    { cardId: c.id, img: c.img, name: c.name },
  ]);
  return shuffle(tiles);
}
