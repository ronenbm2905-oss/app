// הצהרת טיפוסים לסקריפט הבדיקה של אתר הקריאה היחיד (B12).
export interface SourceViolation {
  file: string;
  line: number;
  text: string;
}
export declare const READ_SITE: string;
export declare const PARSER: string;
export declare function findViolations(): SourceViolation[];
