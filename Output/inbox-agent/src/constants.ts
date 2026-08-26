// ============================================================================
// constants.ts — קבועים ומצב התחלתי.
// ============================================================================

import type { RunStats, Task, TriageItem } from '../shared/types';

/**
 * מזהה המשתמש בפרוסה 0.
 *
 * קבוע, כי אין Auth — ובכל זאת **קיים**, ובכל רשומה שנכתבת. הטיפוס
 * `TenantScoped<T>` מחייב אותו, וזה בדיוק העניין: כשפרוסה 1 תחליף אותו ב-uid
 * אמיתי, שום מבנה נתונים לא ישתנה. `local-` בתחילית כדי שרשומה מקומית שתגיע
 * בטעות לענן תזדקר לעין.
 */
export const LOCAL_USER_ID = 'local-single-user';

/** מפתחות `localStorage`. עם תחילית, כדי לא להתנגש בכלום. */
export const STORAGE_KEYS = {
  tasks: 'inboxAgent.tasks.v1',
  handledItems: 'inboxAgent.handled.v1',
  userRules: 'inboxAgent.userRules.v1',
  // פרוסה 0.5 — **מזהים בלבד**. לא ספק, לא סכום, לא שם קובץ.
  reviewedInvoices: 'inboxAgent.reviewedInvoices.v1',
  pinnedItems: 'inboxAgent.pinnedItems.v1',
} as const;

/**
 * ★ `EMPTY` ולא `SAMPLE`.
 *
 * לוח המשימות מתחיל **ריק**. ה-fixtures מזינים את דוח הבוקר בלבד — שם הם
 * הדגמה של תיבה נכנסת, וזה תפקידם. משימות דמו הן דבר אחר: הן נראות כמו עבודה
 * אמיתית, והמשתמשת תמחק אותן אחת-אחת ותתהה למה הכלי המציא לה משימות.
 */
export const EMPTY_TASKS: Task[] = [];

export const EMPTY_ITEMS: TriageItem[] = [];

export const EMPTY_STATS: RunStats = {
  fetched: 0,
  filteredOut: 0,
  llmCalls: 0,
  filterRate: 0,
  estSavedUsd: 0,
};

/** ברירת מחדל למשך אירוע ביומן, כשלא נאמר אחרת. */
export const DEFAULT_TASK_DURATION_MINUTES = 30;

/** 90 יום — חלון ה-retention על `subject`, שהוא PII של צד שלישי. */
export const RETENTION_DAYS = 90;

/**
 * עלות משוערת לקריאת LLM אחת, לחישוב "כמה המסנן חסך".
 *
 * המספר גס בכוונה ומוצג כאומדן. הוא נגזר מהטבלה בתוכנית: ≈$83 לחודש עבור
 * ~3,600 מיילים בלי מסנן, כלומר בערך 2.3 סנט לקריאה. הוא לא נועד לחיוב אלא
 * כדי שהמסך יגיד משהו שאפשר להרגיש, במקום "סוננו 30 פריטים".
 */
export const EST_COST_PER_LLM_CALL_USD = 0.023;
