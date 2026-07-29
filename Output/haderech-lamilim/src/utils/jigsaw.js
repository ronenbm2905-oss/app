// מחולל צורות פאזל אמיתיות (SVG path עם עקומות bezier).
// מייצר לכל חתיכה מתאר עם לשוניות/שקעים שמשתלבים בשכנים.
//
// עיקרון ההשתלבות: כל קצה פנימי משותף לשתי חתיכות. אנו קובעים לכל קצה "סימן בליטה"
// אחד (−1/+1) ומשרטטים אותו בכיוון נורמל פיזי קבוע (אופקי→למטה, אנכי→ימינה), כך ששתי
// החתיכות מציירות בדיוק את אותה עקומה במרחב המוחלט — ולכן משתלבות.

function rand2() {
  return Math.random() < 0.5 ? -1 : 1;
}

// מייצר מטריצות סימני-קצה לרשת rows×cols
export function makeEdges(rows, cols) {
  // קצוות אופקיים: (rows+1) שורות × cols. שורות 0 ו-rows הן גבול (0).
  const h = Array.from({ length: rows + 1 }, (_, r) =>
    Array.from({ length: cols }, () => (r === 0 || r === rows ? 0 : rand2()))
  );
  // קצוות אנכיים: rows × (cols+1). עמודות 0 ו-cols הן גבול (0).
  const v = Array.from({ length: rows }, () =>
    Array.from({ length: cols + 1 }, (_, c) => (c === 0 || c === cols ? 0 : rand2()))
  );
  return { h, v };
}

// עקומת קצה בין שתי פינות P0→P1, נורמל פיזי N, סימן בליטה b, עומק d.
// מחזירה מחרוזת פקודות path (ללא ה-M ההתחלתי).
function side(P0, P1, N, b, d) {
  if (b === 0) return ` L ${P1[0]} ${P1[1]}`;
  const lerp = (t) => [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t];
  const off = (p, k) => [p[0] + N[0] * b * d * k, p[1] + N[1] * b * d * k];
  const a = lerp(0.36);
  const bb = lerp(0.64);
  const c1 = off(lerp(0.42), 1.15);
  const c2 = off(lerp(0.58), 1.15);
  // קו עד תחילת הלשונית, עקומת הבליטה, ואז קו עד הפינה
  return (
    ` L ${a[0]} ${a[1]}` +
    ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${bb[0]} ${bb[1]}` +
    ` L ${P1[0]} ${P1[1]}`
  );
}

// מתאר חתיכה (r,c) בקואורדינטות מקומיות של תיבת החתיכה (עם ריפוד pad לכל הצדדים).
// cellW/cellH — גודל התא; d — עומק הלשונית; pad — ריפוד (≥ d).
export function piecePath(r, c, edges, cellW, cellH, d, pad) {
  const x0 = pad;
  const y0 = pad;
  const x1 = pad + cellW;
  const y1 = pad + cellH;
  const TL = [x0, y0];
  const TR = [x1, y0];
  const BR = [x1, y1];
  const BL = [x0, y1];
  const Ndown = [0, 1]; // נורמל אופקי
  const Nright = [1, 0]; // נורמל אנכי

  let dpath = `M ${TL[0]} ${TL[1]}`;
  dpath += side(TL, TR, Ndown, edges.h[r][c], d); // עליון (L→R)
  dpath += side(TR, BR, Nright, edges.v[r][c + 1], d); // ימני (T→B)
  dpath += side(BR, BL, Ndown, edges.h[r + 1][c], d); // תחתון (R→L)
  dpath += side(BL, TL, Nright, edges.v[r][c], d); // שמאלי (B→T)
  dpath += " Z";
  return dpath;
}
