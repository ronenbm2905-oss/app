// ============================================================================
// money.js — אריתמטיקה של כסף + פורמט תצוגה.
//
// כל הסכומים במודל הם **שקלים כמספר עשרוני**. חובה לעגל אחרי כל פעולה, אחרת
// שאריות float מצטברות ו"סה\"כ" מפסיק להיות שווה לסכום השורות — בדיוק הבאג
// שיושב בגיליון המקור: 423914.07999999996 ו-148932.91999999998.
//
// מועתק מ-Output/project-budget/src/utils/money.js (דפוס מוכח), עם התאמה
// אחת: `imputedVat` שנדרשת למצב "עוסק פטור" של ויצמן.
// ============================================================================

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const sum = (arr, pick = (x) => x) =>
  round2(arr.reduce((acc, x) => acc + (Number(pick(x)) || 0), 0));

/** נטו + שיעור מע"מ → { amountNet, vatAmount, amountGross } מעוגלים ועקביים. */
export function withVat(amountNet, vatRate) {
  const net = round2(amountNet);
  const vat = round2(net * (Number(vatRate) || 0));
  // ברוטו נגזר מהמעוגלים, לא מהגולמיים — כך net + vat === gross תמיד.
  return { amountNet: net, vatAmount: vat, amountGross: round2(net + vat) };
}

/** ברוטו + שיעור מע"מ → פירוק חזרה לנטו/מע"מ. */
export function fromGross(amountGross, vatRate) {
  const gross = round2(amountGross);
  const net = round2(gross / (1 + (Number(vatRate) || 0)));
  return { amountNet: net, vatAmount: round2(gross - net), amountGross: gross };
}

const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
const ILS_EXACT = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtILS = (n) => ILS.format(round2(n));
export const fmtILSExact = (n) => ILS_EXACT.format(round2(n));

/** אחוז לתצוגה. `null` כשאין בסיס — לא 0, כי 0% ו"לא ניתן לחשב" אינם אותו דבר. */
export const fmtPct = (ratio, digits = 2) =>
  ratio == null || !Number.isFinite(ratio) ? "—" : `${(ratio * 100).toFixed(digits)}%`;
