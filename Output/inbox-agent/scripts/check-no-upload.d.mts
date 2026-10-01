// הצהרת טיפוסים לשער "שום דבר לא יוצא ולא נשמר", כדי שהמבחן — כולל המבחן
// השלילי שמריץ אותו על קובץ פיתיון — יוכל לייבא אותו בלי `any`.
export interface UploadViolation {
  file: string;
  line: number;
  text: string;
  why: string;
}
export declare const WATCHED_ENTRIES: string[];
export declare const FORBIDDEN_MARKERS: { marker: string; why: string }[];
export declare function findUploadViolations(entries?: string[]): UploadViolation[];
export declare function uploadGraphFiles(entries?: string[]): string[];
