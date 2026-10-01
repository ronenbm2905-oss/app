// הצהרת טיפוסים לשער "אין בריפו נתון מהקובץ האמיתי", כדי שהמבחן — כולל
// המבחן השלילי שמריץ אותו על קובץ פיתיון — יוכל לייבא אותו בלי `any`.
export interface RealDataViolation {
  file: string;
  line: number;
  value: string;
  why: string;
}
export declare const WATCHED_FILES: string[];
export declare const ALLOWED_DIGITS: Map<string, string>;
export declare function findRealDataViolations(files?: string[]): RealDataViolation[];
