import { useCallback, useRef } from "react";

// hook לצלילים מסונתזים דרך Web Audio API — בלי קבצי אודיו חיצוניים.
// AudioContext נוצר עצל (בלחיצה הראשונה) כדי לעמוד במדיניות autoplay של דפדפנים.
export function useSound() {
  const ctxRef = useRef(null);

  const getCtx = () => {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctxRef.current) ctxRef.current = new AC();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };

  const tone = (ctx, freq, start, dur, type = "sine", gain = 0.18) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur);
  };

  // הצלחה — אקורד C-E-G (523/659/784Hz), עולה
  const playSuccess = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => tone(ctx, f, t + i * 0.09, 0.35, "sine"));
  }, []);

  // ניצחון — ארפג'יו ארוך יותר
  const playWin = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ctx, f, t + i * 0.12, 0.4, "triangle", 0.2));
  }, []);

  // שגיאה — שני צלילים נמוכים עדינים (לא מפחיד, זה לילדים)
  const playError = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(ctx, 311.13, t, 0.18, "sine", 0.12);
    tone(ctx, 261.63, t + 0.14, 0.22, "sine", 0.12);
  }, []);

  // קליק עדין
  const playFlip = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    tone(ctx, 440, ctx.currentTime, 0.08, "sine", 0.08);
  }, []);

  return { playSuccess, playWin, playError, playFlip };
}
