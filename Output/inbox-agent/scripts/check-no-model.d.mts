// הצהרת טיפוסים לסקריפט הבדיקה, כדי שהמבחן יוכל לייבא אותו בלי `any`.
// הסקריפט עצמו נשאר `.mjs` כי הוא רץ ישירות ב-`npm run build`, לפני ה-build.
export interface ModelPathViolation {
  file: string;
  line: number;
  text: string;
  why: string;
}
export declare function findViolations(): ModelPathViolation[];
export declare function buildFiles(): string[];
