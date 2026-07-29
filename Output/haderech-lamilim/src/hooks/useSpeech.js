import { useCallback, useEffect, useRef, useState } from "react";

// hook להקראת טקסט בעברית דרך Web Speech API.
// טוען קולות דרך onvoiceschanged (Chrome טוען אסינכרונית), בוחר קול עברי אם קיים,
// ואם אין קול עברי — לא קורס: מחזיר supported=true אך ההקראה עשויה להיות בקול ברירת מחדל.
export function useSpeech() {
  const [voices, setVoices] = useState([]);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const heVoiceRef = useRef(null);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      setVoices(list);
      heVoiceRef.current =
        list.find((v) => v.lang === "he-IL") ||
        list.find((v) => v.lang && v.lang.toLowerCase().startsWith("he")) ||
        null;
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const speak = useCallback(
    (text) => {
      if (!supported || !text) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "he-IL";
        if (heVoiceRef.current) u.voice = heVoiceRef.current;
        u.rate = 0.95;
        u.pitch = 1.05;
        window.speechSynthesis.speak(u);
      } catch {
        /* אם ההקראה נכשלה — מתעלמים בשקט, הטקסט ממילא מוצג על המסך */
      }
    },
    [supported]
  );

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const hasHebrewVoice = !!heVoiceRef.current;

  return { speak, stop, supported, hasHebrewVoice, voices };
}
