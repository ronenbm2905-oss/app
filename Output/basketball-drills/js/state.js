/* המצב המשתנה של האפליקציה, במקום אחד.
   מודולי ES לא מאפשרים להשים ערך לבינדינג מיובא, ולכן מצב שחוצה מודולים חייב לשבת
   על אובייקט משותף. השם ST ולא S — האות S תפוסה בקוד כקנה מידה (פיקסלים למטר). */
export const ST = {
  D: null,                                   // התרגיל הפתוח; נקבע ב-main.js
  cur: 0,                                    // שלב נוכחי
  sel: null,                                 // שחקן מסומן
  mode: "move",                              // move | path
  play: {on:false, seg:0, t:0, last:0},
  uid: 1,
  V: {S:20, padX:0, padY:0, rot:false, w:0, h:0},
  undoStack: [],
  drag: null,
  drawing: null,
  nar: null
};
