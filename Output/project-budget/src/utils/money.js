// ============================================================================
// money.js — אריתמטיקה של כסף + פורמט תצוגה.
//
// כל הסכומים במודל הם **שקלים כמספר עשרוני** (לא אגורות שלמות). זה מספיק כאן:
// הסכומים בפרויקט הם מאות אלפים, ו-double נותן דיוק מלא הרבה מעבר לאגורה.
// מה שכן חובה — לעגל אחרי כל פעולה, אחרת שאריות float מצטברות ו"סה\"כ" מפסיק
// להיות שווה לסכום השורות (בדיוק הבאג שראינו באקסל: 8377844.2400000002).
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

/** ברוטו + שיעור מע"מ → פירוק חזרה לנטו/מע"מ (לחשבונית שמגיעה עם ברוטו בלבד). */
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

export const fmtILS = (n) => ILS.format(Number(n) || 0);
export const fmtILSExact = (n) => ILS_EXACT.format(Number(n) || 0);
export const fmtNum = (n) => new Intl.NumberFormat("he-IL").format(Number(n) || 0);

/** סכום עם סימן מפורש — לחריגות. מציג "+" על חיובי כדי שהכיוון יהיה חד. */
export const fmtSigned = (n) => {
  const v = Number(n) || 0;
  return (v > 0 ? "+" : "") + fmtILS(v);
};

export const fmtPct = (n) =>
  new Intl.NumberFormat("he-IL", { style: "percent", maximumFractionDigits: 1 }).format(
    Number(n) || 0,
  );
