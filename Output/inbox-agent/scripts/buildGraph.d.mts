// הצהרת טיפוסים להליכה על גרף הייבוא.
export declare const ROOT: string;
export declare const ENTRY: string;
export declare function importsOf(file: string): string[];
export declare function buildGraph(entry?: string): {
  files: string[];
  unresolved: { file: string; spec: string }[];
};
export declare function codeOf(rel: string): { line: string; n: number }[];
