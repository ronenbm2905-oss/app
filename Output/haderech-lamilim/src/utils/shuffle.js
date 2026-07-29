// ערבוב Fisher–Yates — מחזיר מערך חדש (לא מוטציה)
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// בחירת n פריטים אקראיים ייחודיים
export function pickRandom(arr, n) {
  return shuffle(arr).slice(0, n);
}

// פריט אקראי בודד
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// הסרת ניקוד ממחרוזת עברית (לשם/חיפוש; לא לתצוגה)
export function stripNiqqud(s) {
  return s.replace(/[֑-ׇ]/g, "");
}
