import { useEffect, useRef, useState } from "react";
import { CARDS } from "../../data/cards";
import ScreenHeader from "../ui/ScreenHeader";
import Button from "../ui/Button";
import { Printer } from "lucide-react";

// 3.8 דפי צביעה — edge detection ב-canvas (Sobel) בזמן ריצה → קו שחור-לבן, ואז הדפסה.
export default function ColoringGame({ onHome }) {
  const [card, setCard] = useState(null);
  const [mode, setMode] = useState("line"); // line | original
  const [ready, setReady] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!card) return;
    setReady(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = 720;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      if (mode === "line") {
        applySobel(ctx, w, h);
      }
      setReady(true);
    };
    img.src = card.img;
  }, [card, mode]);

  if (!card) {
    return (
      <div className="min-h-full">
        <ScreenHeader title="דפי צביעה" onBack={onHome} />
        <div className="max-w-3xl mx-auto px-4 pb-10">
          <p className="text-center text-xl font-bold text-cardbackDark my-4">בחרו תמונה לצביעה</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {CARDS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCard(c)}
                aria-label={c.name}
                className="aspect-square rounded-xl overflow-hidden ring-2 ring-black/10 transition active:scale-95 hover:ring-cardbackDark"
              >
                <img src={c.img} alt={c.name} loading="lazy" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <ScreenHeader title="דפי צביעה" onBack={onHome} onReset={() => setCard(null)} />
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <div className="no-print flex flex-wrap gap-2 justify-center my-4">
          <Button variant={mode === "line" ? "primary" : "soft"} onClick={() => setMode("line")}>
            קו לצביעה ✏️
          </Button>
          <Button variant={mode === "original" ? "primary" : "soft"} onClick={() => setMode("original")}>
            תמונה מקורית 🎨
          </Button>
          <Button variant="happy" onClick={() => window.print()}>
            <span className="inline-flex items-center gap-2">
              <Printer className="w-5 h-5" /> הדפסה
            </span>
          </Button>
        </div>

        <div className="print-area bg-white rounded-2xl shadow-lg p-3">
          <canvas
            ref={canvasRef}
            className={`w-full h-auto rounded-lg ${ready ? "" : "opacity-0"}`}
            aria-label={`דף צביעה: ${card.name}`}
          />
          {!ready && <p className="text-center text-cardbackDark/60 py-8">מכין את הדף…</p>}
        </div>

        <p className="no-print text-center text-xs text-gray-700 mt-4">
          לחצו "הדפסה" כדי להדפיס את הדף ולצבוע על נייר.
        </p>
      </div>
    </div>
  );
}

// Sobel edge detection → קווים שחורים על רקע לבן
function applySobel(ctx, w, h) {
  const src = ctx.getImageData(0, 0, w, h);
  const s = src.data;
  // אפור
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * s[i * 4] + 0.587 * s[i * 4 + 1] + 0.114 * s[i * 4 + 2];
  }
  const out = ctx.createImageData(w, h);
  const o = out.data;
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const threshold = 90;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sx = 0;
      let sy = 0;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        let k = 0;
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const v = gray[(y + j) * w + (x + i)];
            sx += v * gx[k];
            sy += v * gy[k];
            k++;
          }
        }
      }
      const mag = Math.sqrt(sx * sx + sy * sy);
      const idx = (y * w + x) * 4;
      const edge = mag > threshold;
      const c = edge ? 30 : 255; // קו כהה על רקע לבן
      o[idx] = o[idx + 1] = o[idx + 2] = c;
      o[idx + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}
