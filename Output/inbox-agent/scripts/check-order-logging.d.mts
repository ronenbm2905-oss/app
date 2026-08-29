// הצהרת טיפוסים לסקריפט הבדיקה, כדי שהמבחן יוכל לייבא אותו בלי `any`.
// הסקריפט עצמו נשאר `.mjs` כי הוא רץ ישירות ב-`npm run build`, לפני ה-build.
export interface LoggingViolation {
  file: string;
  line: number;
  text: string;
}
export declare const GUARDED_FILES: string[];
export declare function findViolations(baseDir?: string): LoggingViolation[];
