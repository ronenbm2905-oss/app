import { useState } from "react";
import Home from "./components/Home";
import { useSpeech } from "./hooks/useSpeech";
import { useSound } from "./hooks/useSound";

import MatchingGame from "./components/games/MatchingGame";
import MemoryPairs from "./components/games/MemoryPairs";
import MemoryImages from "./components/games/MemoryImages";
import FindPair from "./components/games/FindPair";
import CardTalk from "./components/games/CardTalk";
import EmotionGame from "./components/games/EmotionGame";
import PuzzleGame from "./components/games/PuzzleGame";
import ColoringGame from "./components/games/ColoringGame";

const SCREENS = {
  matching: MatchingGame,
  "memory-pairs": MemoryPairs,
  "memory-images": MemoryImages,
  "find-pair": FindPair,
  talk: CardTalk,
  emotion: EmotionGame,
  puzzle: PuzzleGame,
  coloring: ColoringGame,
};

// מאפשר פתיחה ישירה של מצב משחק דרך ה-hash (למשל #puzzle) — נוח לשיתוף ולבדיקה
function initialScreen() {
  if (typeof window === "undefined") return "home";
  const h = window.location.hash.replace("#", "");
  return SCREENS[h] ? h : "home";
}

export default function App() {
  const [screen, setScreen] = useState(initialScreen);
  const speech = useSpeech();
  const sound = useSound();

  const media = { speech, sound };
  const goHome = () => {
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setScreen("home");
  };

  if (screen === "home") {
    return (
      <div className="min-h-full">
        <Home
          onSelect={setScreen}
          speechWarning={speech.supported && !speech.hasHebrewVoice}
        />
      </div>
    );
  }

  const Game = SCREENS[screen];
  if (!Game) return null;
  return <Game onHome={goHome} media={media} />;
}
