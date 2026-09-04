import { useState, useEffect, useRef, useCallback } from "react";
import {
  COURTS, PAD, MARK_KINDS, LINE_KINDS, TOOL_LABELS,
  courtOf, normalizeSketch, clampPoint, extendStroke, eraseAt,
  nextPlayerNumber, atCapacity, countElements, isEmptySketch,
} from "../utils/courtSketch";
import { CourtMarkings, SketchLayer, viewBoxOf } from "./CourtSketch";
import { svgToCanvas, withLogoHeader, canvasToPngBlob, shareOrDownloadBlob, loadImageDataUrl } from "../utils/imageExport";
import { IconX, IconEraser, IconUndo, IconTrash, IconShare } from "./ui/icons";

// The sketch editor: a court the coach draws on with a finger.
//
// Every change is applied to the plan draft immediately, so there is no second save button
// inside a form that already has one — closing this panel is not a decision, it just puts
// the court away. Undo and clear are what take a change back.

// The palette buttons draw the real element rather than an icon of it, so the button and
// the mark on the court can never disagree.
const GLYPHS = {
  player: { k: "player", x: 10, y: 10, n: 1 },
  defender: { k: "defender", x: 10, y: 10 },
  ball: { k: "ball", x: 10, y: 10 },
  cone: { k: "cone", x: 10, y: 10 },
  move: { k: "move", x1: 3, y1: 16, x2: 17, y2: 4 },
  pass: { k: "pass", x1: 3, y1: 16, x2: 17, y2: 4 },
  dribble: { k: "dribble", x1: 3, y1: 16, x2: 17, y2: 4 },
  screen: { k: "screen", x1: 3, y1: 16, x2: 16, y2: 5 },
  pen: { k: "pen", p: [3, 15, 7, 6, 11, 15, 15, 5, 18, 10] },
};

function ToolButton({ tool, active, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={tool === "player" && active ? "לחיצה נוספת מקדמת את המספר" : TOOL_LABELS[tool]}
      className={`relative flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md border text-[10px] leading-none ${
        active ? "bg-brand-100 border-brand-400 text-brand-900" : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
      }`}
    >
      <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
        <SketchLayer elements={[tool === "player" ? { ...GLYPHS.player, n: badge } : GLYPHS[tool]]} />
      </svg>
      {TOOL_LABELS[tool]}
    </button>
  );
}

// `clubLogo` is a prop, not an import. The single-club branch bundles one crest as a
// static asset; that file was deleted here on purpose, along with 418KB and every other
// trace of one club's identity, and the logo comes from the club's own settings as a data
// URI. Empty is a normal state — a club that has not uploaded one shares a diagram with a
// title and no crest, which is better than another club's.
export function CourtSketchEditor({ sketch, onChange, onClose, heading, subheading, clubLogo }) {
  const stored = normalizeSketch(sketch);
  const elements = stored?.el || [];

  // The court lives in the editor rather than being read back off the sketch: an empty
  // sketch is stored as nothing at all, so a coach who picks the full court before drawing
  // would otherwise be bounced straight back to the half.
  const [court, setCourt] = useState(stored?.court || "half");
  const [tool, setTool] = useState("player");
  const [playerNo, setPlayerNo] = useState(() => nextPlayerNumber(sketch));
  const [drag, setDrag] = useState(null); // live line preview
  const [stroke, setStroke] = useState(null); // live freehand preview
  const [history, setHistory] = useState([]);
  const [sharing, setSharing] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Every mutation stacks the previous state, which is what makes undo cheap: the sketch
  // is small enough that keeping whole snapshots beats reversing individual gestures.
  //
  // The change itself goes up as an updater, not a value. Two taps can land in the same
  // React batch, and a version built from `elements` would then be one mark behind.
  const apply = useCallback(
    (fn) => {
      setHistory((h) => [...h.slice(-29), stored]);
      onChange((prev) => fn(normalizeSketch(prev)));
    },
    [stored, onChange]
  );

  const add = (el) => {
    if (atCapacity(stored)) return;
    apply((prev) => ({ court, el: [...(prev?.el || []), el] }));
  };

  const point = (e) => {
    const box = svgRef.current.getBoundingClientRect();
    const c = courtOf(court);
    const w = c.w + PAD * 2;
    const h = c.h + PAD * 2;
    return clampPoint(((e.clientX - box.left) / box.width) * w - PAD, ((e.clientY - box.top) / box.height) * h - PAD, court);
  };

  const onDown = (e) => {
    // Capture keeps a stroke alive when the finger leaves the court mid-drag. It is a
    // convenience, not a precondition — a browser that refuses it must not take the
    // drawing down with it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* keep drawing without capture */
    }
    const { x, y } = point(e);
    if (tool === "erase") {
      if (eraseAt(stored, x, y).erased) apply((prev) => eraseAt(prev, x, y).sketch);
      return;
    }
    if (MARK_KINDS.includes(tool)) {
      add(tool === "player" ? { k: "player", x, y, n: playerNo } : { k: tool, x, y });
      if (tool === "player") setPlayerNo((n) => (n % 5) + 1);
      return;
    }
    if (tool === "pen") setStroke([x, y]);
    // The kind is stamped on the drag rather than read back off `tool` when it is drawn:
    // releasing the pointer off the court leaves the drag open, and picking a different
    // tool would otherwise repaint that half-finished line as something it is not.
    else setDrag({ k: tool, x1: x, y1: y, x2: x, y2: y });
  };

  const onMove = (e) => {
    if (!drag && !stroke) return;
    const { x, y } = point(e);
    if (stroke) setStroke((p) => extendStroke(p, x, y));
    else setDrag((d) => ({ ...d, x2: x, y2: y }));
  };

  const onUp = () => {
    if (stroke) {
      if (stroke.length >= 4) add({ k: "pen", p: stroke });
      setStroke(null);
      return;
    }
    if (drag) {
      // A tap with a line tool is not a line. Anything shorter than about a stride is
      // treated as a miss rather than stored as a dot with an arrowhead on it.
      if (Math.hypot(drag.x2 - drag.x1, drag.y2 - drag.y1) >= 4) add(drag);
      setDrag(null);
    }
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    onChange(() => prev);
    if (prev?.court) setCourt(prev.court);
    setHistory((h) => h.slice(0, -1));
  };

  const clear = () => {
    if (isEmptySketch(stored)) return;
    apply(() => null);
  };

  const switchCourt = (id) => {
    if (id === court) return;
    // The two courts do not share a coordinate space, so carrying marks across would move
    // every one of them to the wrong place. Better to say so than to silently mangle it.
    if (isEmptySketch(stored)) {
      setCourt(id);
      return;
    }
    if (!window.confirm("החלפת המגרש תמחק את השרטוט הנוכחי. להמשיך?")) return;
    apply(() => null);
    setCourt(id);
  };

  // Hand the diagram to the OS share sheet — WhatsApp on a phone, a download on a desktop
  // where sharing files is not offered. Same path the weekly report already takes, so the
  // coach gets the picker they know.
  //
  // Note it shares what is drawn right now, saved or not: a coach who wants to send a
  // diagram is thinking about the chat, not about the form behind it.
  async function share() {
    if (!svgRef.current || sharing || isEmptySketch(stored)) return;
    setSharing(true);
    try {
      const logo = clubLogo ? (await loadImageDataUrl(clubLogo)) || clubLogo : "";
      const framed = await withLogoHeader(await svgToCanvas(svgRef.current, 1200), logo, heading || "שרטוט תרגיל", subheading);
      const blob = await canvasToPngBlob(framed);
      // Windows and the share sheet both choke on path characters in a file name.
      const safe = (heading || "תרגיל").replace(/[\\/:*?"<>|]/g, "").slice(0, 40);
      await shareOrDownloadBlob(blob, `שרטוט-${safe}.png`, heading || "שרטוט תרגיל");
    } catch {
      alert("לא הצלחנו להפיק את התמונה. נסה שוב, או שלח אותה מהמחשב.");
    } finally {
      setSharing(false);
    }
  }

  const preview = [
    ...elements,
    ...(drag ? [drag] : []),
    ...(stroke && stroke.length >= 4 ? [{ k: "pen", p: stroke }] : []),
  ];
  const full = court === "full";

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-stone-900/50 p-2 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading || "שרטוט תרגיל"}
        /* Capped in viewport units, not percentages: an ancestor with a transform makes
           itself the containing block for a fixed element, and the overlay would then take
           its width from the page instead of the screen — pushing the dialog off a phone. */
        className="bg-white rounded-xl shadow-xl w-full max-w-[min(32rem,calc(100vw-1rem))] my-auto"
      >
        <div className="flex items-start gap-2 px-3 py-2 border-b border-stone-200">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-stone-800">{heading || "שרטוט תרגיל"}</h4>
            {subheading && <p className="text-xs text-stone-500 truncate">{subheading}</p>}
          </div>
          <div className="flex rounded-md border border-stone-200 overflow-hidden shrink-0">
            {Object.values(COURTS).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => switchCourt(c.id)}
                aria-pressed={court === c.id}
                className={`text-[11px] px-2.5 py-2 ${court === c.id ? "bg-brand-600 text-white" : "bg-white text-stone-600"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="p-2 text-stone-500 hover:text-stone-800" aria-label="סגור">
            <IconX size={16} />
          </button>
        </div>

        <div className="p-3 space-y-2">
          <div className="mx-auto" style={{ maxWidth: full ? "min(100%, 30vh)" : "min(100%, 24rem)" }}>
            <svg
              ref={svgRef}
              viewBox={viewBoxOf(court)}
              className="block w-full h-auto rounded-md border border-stone-200 bg-white cursor-crosshair"
              style={{ touchAction: "none" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <CourtMarkings court={court} />
              <SketchLayer elements={preview} />
            </svg>
          </div>

          <div className="flex flex-wrap gap-1 justify-center">
            {MARK_KINDS.map((t) => (
              <ToolButton
                key={t}
                tool={t}
                badge={playerNo}
                active={tool === t}
                onClick={() => (tool === "player" && t === "player" ? setPlayerNo((n) => (n % 5) + 1) : setTool(t))}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            {[...LINE_KINDS, "pen"].map((t) => (
              <ToolButton key={t} tool={t} active={tool === t} onClick={() => setTool(t)} />
            ))}
            <button
              type="button"
              onClick={() => setTool("erase")}
              aria-pressed={tool === "erase"}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md border text-[10px] leading-none ${
                tool === "erase" ? "bg-red-100 border-red-300 text-red-800" : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              <span className="flex items-center justify-center" style={{ width: 22, height: 22 }}>
                <IconEraser size={15} />
              </span>
              {TOOL_LABELS.erase}
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-stone-200">
            <button
              type="button"
              onClick={undo}
              disabled={!history.length}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 px-2 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 disabled:opacity-40"
            >
              <IconUndo size={13} /> בטל
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={!elements.length}
              className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 px-2 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 disabled:opacity-40"
            >
              <IconTrash size={13} /> נקה
            </button>
            <span className="text-[11px] text-stone-500 flex-1 text-left">
              {atCapacity(stored) ? "הגעת למספר הסימונים המרבי" : `${countElements(stored)} סימונים`}
            </span>
            <button
              type="button"
              onClick={share}
              disabled={!elements.length || sharing}
              title="שליחה בוואטסאפ או שמירה כתמונה"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-800 bg-brand-100 hover:bg-brand-200 px-2.5 py-1.5 rounded-md disabled:opacity-40"
            >
              <IconShare size={13} /> {sharing ? "מכין…" : "שיתוף"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md"
            >
              סיום
            </button>
          </div>
          <p className="text-[11px] text-stone-500">
            הסימונים נשמרים יחד עם מערך האימון — לחיצה על "שמור" בטופס.
          </p>
        </div>
      </div>
    </div>
  );
}
