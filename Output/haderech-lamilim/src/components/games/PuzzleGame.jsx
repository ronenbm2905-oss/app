import { useEffect, useMemo, useRef, useState } from "react";
import { CARDS } from "../../data/cards";
import { shuffle } from "../../utils/shuffle";
import { makeEdges, piecePath } from "../../utils/jigsaw";
import ScreenHeader from "../ui/ScreenHeader";
import Button from "../ui/Button";
import WinScreen from "../ui/WinScreen";

const LEVELS = [
  { n: 3, label: "קל · 3×3" },
  { n: 4, label: "בינוני · 4×4" },
  { n: 5, label: "קשה · 5×5" },
];

// 3.7 פאזל — בחירת תמונה + רמה, חתיכות בצורת פאזל אמיתית (clip-path bezier).
export default function PuzzleGame({ onHome, media }) {
  const { sound, speech } = media;
  const [card, setCard] = useState(null);
  const [n, setN] = useState(null);

  if (!card || !n) {
    return (
      <div className="min-h-full">
        <ScreenHeader title="פאזל" onBack={onHome} />
        <Setup card={card} n={n} setCard={setCard} setN={setN} />
      </div>
    );
  }
  return (
    <Board
      card={card}
      n={n}
      media={{ sound, speech }}
      onHome={onHome}
      onRestart={() => {
        setN(null);
      }}
    />
  );
}

function Setup({ card, n, setCard, setN }) {
  return (
    <div className="max-w-3xl mx-auto px-4 pb-10">
      <p className="text-center text-xl font-bold text-cardbackDark my-4">1. בחרו תמונה</p>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {CARDS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCard(c)}
            aria-label={c.name}
            className={`aspect-square rounded-xl overflow-hidden ring-2 transition active:scale-95
              ${card?.id === c.id ? "ring-cardbackDark ring-4" : "ring-black/10"}`}
          >
            <img src={c.img} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {card && (
        <>
          <p className="text-center text-xl font-bold text-cardbackDark my-4">2. בחרו רמה</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {LEVELS.map((l) => (
              <Button key={l.n} variant={n === l.n ? "primary" : "soft"} onClick={() => setN(l.n)}>
                {l.label}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Board({ card, n, media, onHome, onRestart }) {
  const { sound, speech } = media;
  const wrapRef = useRef(null);
  const [boardSize, setBoardSize] = useState(340);

  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth || 360;
      setBoardSize(Math.max(240, Math.min(w - 8, 420)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const edges = useMemo(() => makeEdges(n, n), [n, card.id]);
  const cell = boardSize / n;
  const d = cell * 0.2;
  const pad = d;

  const pieces = useMemo(() => {
    const arr = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) arr.push({ r, c, idx: r * n + c });
    return arr;
  }, [n, card.id]);

  const [placed, setPlaced] = useState({}); // idx -> true
  const [tray, setTray] = useState(() => shuffle(pieces.map((p) => p.idx)));
  const [selected, setSelected] = useState(null);
  const [wrongCell, setWrongCell] = useState(null);

  useEffect(() => {
    setPlaced({});
    setTray(shuffle(pieces.map((p) => p.idx)));
    setSelected(null);
  }, [pieces]);

  const total = n * n;
  const done = Object.keys(placed).length === total;

  useEffect(() => {
    if (done) {
      sound.playWin();
      speech.speak("כל הכבוד, הרכבת את הפאזל");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function clickCell(idx) {
    if (placed[idx]) return;
    if (selected == null) return;
    if (selected === idx) {
      // הנחה נכונה
      sound.playSuccess();
      setPlaced((p) => ({ ...p, [idx]: true }));
      setTray((t) => t.filter((x) => x !== selected));
      setSelected(null);
    } else {
      sound.playError();
      setWrongCell(idx);
      setTimeout(() => setWrongCell(null), 450);
    }
  }

  const clip = (idx) => `pz-${card.id}-${n}-${idx}`;

  return (
    <div className="min-h-full">
      <ScreenHeader title="פאזל" onBack={onHome} onReset={onRestart} />

      {/* הגדרות clipPath לכל החתיכות */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          {pieces.map((p) => (
            <clipPath key={p.idx} id={clip(p.idx)} clipPathUnits="userSpaceOnUse">
              <path d={piecePath(p.r, p.c, edges, cell, cell, d, pad)} />
            </clipPath>
          ))}
        </defs>
      </svg>

      {done ? (
        <WinScreen title="כל הכבוד! 🎉" subtitle="הרכבת את הפאזל" emoji="🧩" onAgain={onRestart} onHome={onHome} />
      ) : (
        <div className="max-w-4xl mx-auto px-3 pb-10">
          <div className="flex flex-col lg:flex-row gap-4 items-start justify-center mt-3">
            {/* הלוח */}
            <div ref={wrapRef} className="w-full lg:max-w-md">
              <div
                className="relative mx-auto rounded-xl bg-white/70 ring-1 ring-black/10"
                style={{ width: boardSize, height: boardSize }}
              >
                {pieces.map((p) => {
                  const left = p.c * cell - pad;
                  const top = p.r * cell - pad;
                  const isPlaced = placed[p.idx];
                  return (
                    <div key={p.idx}>
                      {/* מתאר עדין של מיקום החתיכה */}
                      {!isPlaced && (
                        <svg
                          className={`absolute ${wrongCell === p.idx ? "animate-shake" : ""}`}
                          style={{ left, top, width: cell + 2 * pad, height: cell + 2 * pad, overflow: "visible" }}
                          onClick={() => clickCell(p.idx)}
                        >
                          <path
                            d={piecePath(p.r, p.c, edges, cell, cell, d, pad)}
                            fill={selected != null ? "rgba(62,124,140,0.12)" : "rgba(0,0,0,0.03)"}
                            stroke="rgba(62,124,140,0.4)"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                          />
                        </svg>
                      )}
                      {/* חתיכה שהונחה */}
                      {isPlaced && (
                        <div
                          className="absolute animate-pop"
                          style={{
                            left,
                            top,
                            width: cell + 2 * pad,
                            height: cell + 2 * pad,
                            backgroundImage: `url(${card.img})`,
                            backgroundSize: `${boardSize}px ${boardSize}px`,
                            backgroundPosition: `${pad - p.c * cell}px ${pad - p.r * cell}px`,
                            clipPath: `url(#${clip(p.idx)})`,
                            WebkitClipPath: `url(#${clip(p.idx)})`,
                            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.25))",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* תמונת עזר */}
            <div className="shrink-0 mx-auto lg:mx-0">
              <p className="text-center text-sm font-bold text-cardbackDark/70 mb-1">תמונת עזר</p>
              <img
                src={card.img}
                alt={card.name}
                className="w-40 h-40 object-cover rounded-xl ring-2 ring-cardbackDark/30 opacity-90"
              />
            </div>
          </div>

          {/* מגש חתיכות */}
          <p className="text-center text-cardbackDark/70 font-bold mt-5 mb-2">
            בחרו חתיכה ואז לחצו על המקום שלה בלוח
          </p>
          <div className="flex flex-wrap gap-2 justify-center bg-white/60 rounded-2xl p-3 min-h-[90px]">
            {tray.map((idx) => {
              const p = pieces[idx];
              return (
                <button
                  key={idx}
                  onClick={() => setSelected(selected === idx ? null : idx)}
                  aria-label="חתיכת פאזל"
                  className={`relative transition ${selected === idx ? "scale-110 z-10" : "hover:scale-105"}`}
                  style={{ width: cell + 2 * pad, height: cell + 2 * pad }}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `url(${card.img})`,
                      backgroundSize: `${boardSize}px ${boardSize}px`,
                      backgroundPosition: `${pad - p.c * cell}px ${pad - p.r * cell}px`,
                      clipPath: `url(#${clip(idx)})`,
                      WebkitClipPath: `url(#${clip(idx)})`,
                      filter: selected === idx
                        ? "drop-shadow(0 0 3px #3E7C8C)"
                        : "drop-shadow(0 1px 1px rgba(0,0,0,0.3))",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
