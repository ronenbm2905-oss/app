/**
 * CoachTrack — טיפוסי מודל הנתונים
 *
 * מקור האמת: CLAUDE.md → "מודל הנתונים" ו-docs/PRD.md §9.
 * כל קולקציה ב-Firestore מקבלת כאן interface. אין `any` בקובץ הזה ובשום מקום אחר.
 *
 * מוסכמה: הטיפוסים מתארים מסמך **כפי שהוא נקרא** מ-Firestore, ולכן שדות זמן הם
 * `Timestamp`. בכתיבה, `createdAt` נשלח כ-`serverTimestamp()` (ראה CLAUDE.md → פורמט תאריכים),
 * ולשם כך יש את `WriteModel<T>` בתחתית הקובץ.
 */

import type { FieldValue, Timestamp } from 'firebase/firestore';

/* ------------------------------------------------------------------ */
/* טיפוסי בסיס                                                        */
/* ------------------------------------------------------------------ */

/** תפקיד המשתמש. מקור ההרשאות — נשמר במסמך users/{uid}, לא ב-Custom Claims. */
export type Role = 'admin' | 'coach' | 'player';

/** יחידת מדידה של תרגיל. הערכים המותרים היחידים. */
export type Unit = 'count' | 'minutes' | 'sessions' | 'distance_km';

/**
 * למי שייך התרגיל.
 *
 * - `global` — הקטלוג. 30 תרגילים, נכתבים ב-`scripts/seed.js`, **לקריאה בלבד**
 *   לכל מי שאינו admin. תרגיל גלובלי נקרא בידי כל מחובר בכל ארגון, ולכן שינוי
 *   שלו הוא זליגה חוצת-ארגונים (ראה `firestore.rules`).
 * - `coach` — תרגיל של מאמן יחיד: או שיצר אותו בעצמו, או **עותק פרטי** שמחליף
 *   עבורו תרגיל קטלוג (`sourceExerciseId`). רק הבעלים קורא וכותב אותו.
 * - `org` — תרגיל משותף לארגון. נשאר בסכמה ובכללים לתאימות אחורה, אבל
 *   **האפליקציה אינה יוצרת אותו יותר**: מ-25.8.2026 הבעלות על תרגיל היא של
 *   המאמן ולא של הארגון, כדי ששני מאמנים באותה אגודה לא ידרכו זה על זה.
 */
export type ExerciseScope = 'global' | 'org' | 'coach';

/** מצב תוכנית מתמשכת. */
export type PlanStatus = 'active' | 'archived';

/**
 * שכבת גיל להצעת יעד ברירת מחדל.
 * ב-MVP קיים ערך אחד בקטלוג: `cadets_13_15`.
 */
export type Cohort = 'cadets_13_15';

/** יום תחילת שבוע: 0 = ראשון. ה-MVP מקבע 0 (CLAUDE.md → גבולות שבוע). */
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** מזהה מסמך Firestore — נשמר בנפרד מגוף המסמך. */
export interface WithId {
  id: string;
}

/* ------------------------------------------------------------------ */
/* organizations/{orgId}                                              */
/* ------------------------------------------------------------------ */

export interface OrganizationSettings {
  /** תמיד "Asia/Jerusalem" ב-MVP. */
  timezone: string;
  weekStartDay: WeekStartDay;
}

export interface Organization {
  name: string;
  createdAt: Timestamp;
  ownerUid: string;
  settings: OrganizationSettings;
}

export type OrganizationDoc = Organization & WithId;

/* ------------------------------------------------------------------ */
/* users/{uid}                                                        */
/* ------------------------------------------------------------------ */

export interface User {
  /** 🔒 מקור ההרשאות. עדכון-עצמי חסום ב-firestore.rules. */
  role: Role;
  /** 🔒 עדכון-עצמי חסום. */
  orgId: string;
  /** שם פרטי + אות ראשונה של משפחה בלבד (כלל 7 — נתוני קטינים). */
  displayName: string;
  /** שם המשתמש להתחברות. ממנו נגזר האימייל הסינתטי ב-Auth. */
  username: string;
  /** 🔒 עדכון-עצמי חסום. */
  teamIds: string[];
  /** 🔒 עדכון-עצמי חסום. אין מחיקה קשיחה — משביתים. */
  active: boolean;
  createdAt: Timestamp;
  /** סיסמה ראשונית שהמאמן יצר — המשתמש חייב להחליף בכניסה הראשונה. */
  mustChangePassword: boolean;
}

export type UserDoc = User & { uid: string };

/* ------------------------------------------------------------------ */
/* teams/{teamId}                                                     */
/* ------------------------------------------------------------------ */

export interface TeamSettings {
  /** תשתית בלבד ב-MVP — לוח המובילים נדחה לשלב 2 (הכרעה 19.8.2026). */
  leaderboardEnabled: boolean;
  /** אחוז שמעליו שבוע נחשב "רצף התמדה". */
  streakThreshold: number;
  weekStartDay: WeekStartDay;
}

export interface Team {
  orgId: string;
  coachUid: string;
  name: string;
  season: string;
  active: boolean;
  settings: TeamSettings;
}

export type TeamDoc = Team & WithId;

/* ------------------------------------------------------------------ */
/* exercises/{exerciseId}                                             */
/* ------------------------------------------------------------------ */

/** הצעת יעד לפי שכבת גיל, מתוך הקטלוג. למשל `{ cadets_13_15: 300 }`. */
export type DefaultTargets = Partial<Record<Cohort, number>>;

export interface Exercise {
  /** 🔒 נעול בעדכון ב-firestore.rules — שדה זהות, לא שדה תוכן. */
  scope: ExerciseScope;
  /** null כשה-scope הוא global. 🔒 נעול בעדכון. */
  orgId: string | null;
  /**
   * בעל התרגיל כש-`scope === 'coach'`. 🔒 נעול בעדכון.
   *
   * לא קיים כלל במסמכי הקטלוג שבמסד — ובכוונה: הקטלוג נשאר בדיוק כפי שהוא,
   * בלי מיגרציה. שאילתת `where('coachUid','==',uid)` פשוט לא מתאימה למסמך
   * שאין בו את השדה.
   */
  coachUid?: string | null;
  /**
   * המזהה של התרגיל שהעותק הזה **מחליף** בספרייה של המאמן. 🔒 נעול בעדכון.
   *
   * `null` (או חסר) = תרגיל מקורי, לא עותק. כשיש ערך, הספרייה מציגה את העותק
   * במקום המקור — עדיין 30 תרגילים, לא 60.
   *
   * ⚠️ עותק עם `active: false` הוא עותק ש**בוטל** ("חזרה למקור"), והמקור חוזר
   * להופיע. ראה `lib/exercises.ts` → `buildExerciseLibrary`.
   */
  sourceExerciseId?: string | null;
  name: string;
  /** קטגוריה בעברית מהקטלוג: זריקה, כדרור, מסירה, כושר, הגנה, טכניקה, למידה. */
  category: string;
  unit: Unit;
  /** הנחיות ביצוע שהשחקן רואה. */
  description: string;
  /** שלב 2 — null ב-MVP. */
  videoUrl: string | null;
  /** תשתית ליחס הצלחה — false ב-MVP. */
  tracksSuccess: boolean;
  /** האם התרגיל בכלל מתאים למדידת דיוק. */
  successCapable: boolean;
  defaultTargets: DefaultTargets;
  active: boolean;
}

export type ExerciseDoc = Exercise & WithId;

/* ------------------------------------------------------------------ */
/* plans/{planId} — תוכנית מתמשכת                                     */
/* ------------------------------------------------------------------ */

/**
 * פריט בתוכנית. מכיל שכפול (denormalization) של שם התרגיל והיחידה,
 * כדי שהצגת תוכנית לא תדרוש קריאה לכל תרגיל.
 */
export interface PlanItem {
  exerciseId: string;
  exerciseName: string;
  unit: Unit;
  /** היעד השבועי. נטען מראש מ-defaultTargets אך המאמן דורס בחופשיות. */
  target: number;
  notes: string;
}

export interface Plan {
  teamId: string;
  orgId: string;
  status: PlanStatus;
  effectiveFrom: Timestamp;
  /** null = התוכנית עדיין פעילה. */
  effectiveTo: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  items: PlanItem[];
}

export type PlanDoc = Plan & WithId;

/* ------------------------------------------------------------------ */
/* planCycles/{cycleId} — מחזור שבועי                                 */
/* ------------------------------------------------------------------ */

export interface PlanCycle {
  planId: string;
  teamId: string;
  orgId: string;
  /** ראשון 00:00:00 בשעון ישראל. */
  weekStart: Timestamp;
  /** שבת 23:59:59 בשעון ישראל. */
  weekEnd: Timestamp;
  /**
   * צילום היעדים בזמן פתיחת המחזור — **לא רפרנס לתוכנית**.
   * שינוי יעד היום לא ישכתב היסטוריה (מלכודת #2 ב-TASKS.md).
   */
  itemsSnapshot: PlanItem[];
  createdAt: Timestamp;
}

export type PlanCycleDoc = PlanCycle & WithId;

/* ------------------------------------------------------------------ */
/* entries/{entryId} — דיווח ביצוע                                    */
/* ------------------------------------------------------------------ */

export interface Entry {
  playerUid: string;
  teamId: string;
  orgId: string;
  /** null כשהדיווח לא משויך למחזור (אין תוכנית פעילה לאותו שבוע). */
  cycleId: string | null;
  exerciseId: string;
  amount: number;
  /** תשתית ליחס הצלחה — null ב-MVP. */
  successAmount: number | null;
  /**
   * תאריך **הביצוע**, מקובע ל-12:00 בשעון ישראל (CLAUDE.md → פורמט תאריכים).
   * לא חצות, ולא מחרוזת. השיוך למחזור נקבע לפיו — לא לפי createdAt.
   */
  date: Timestamp;
  note: string;
  /** serverTimestamp בכתיבה. עליו נשען חלון העריכה של 7 ימים. */
  createdAt: Timestamp;
  /** שונה מ-playerUid כשמאמן מזין במקום שחקן. */
  createdBy: string;
  /** מחיקה רכה בלבד — מחיקה קשיחה חסומה ב-firestore.rules. */
  deleted: boolean;
}

export type EntryDoc = Entry & WithId;

/* ------------------------------------------------------------------ */
/* planTemplates/{templateId}                                         */
/* ------------------------------------------------------------------ */

export interface PlanTemplate {
  orgId: string;
  coachUid: string;
  name: string;
  items: PlanItem[];
}

export type PlanTemplateDoc = PlanTemplate & WithId;

/* ------------------------------------------------------------------ */
/* teams/{teamId}/notes/{playerUid} — הערות מאמן                      */
/* ------------------------------------------------------------------ */

/**
 * הערת מאמן על שחקן (PRD §7.3ג) — **פרטית, לא נראית לשחקן**.
 *
 * המסמך אינו נושא `teamId`, `playerUid` או `orgId`: כולם נגזרים מהנתיב, וזה
 * מה שמאפשר ל-`firestore.rules` להחליט בלי לגעת ב-`resource.data` — כולל על
 * מסמך שעדיין לא קיים. ראה `lib/coachNotes.ts` להסבר המלא, ולדגל תיקון 13.
 */
export interface CoachNote {
  text: string;
  updatedAt: Timestamp;
  /** ה-uid של המאמן שכתב אחרון. */
  updatedBy: string;
}

/* ------------------------------------------------------------------ */
/* weeklySummaries/{summaryId} — מחושב, שלב 2                         */
/* ------------------------------------------------------------------ */

export interface WeeklySummaryExercise {
  total: number;
  target: number;
  pct: number;
}

/**
 * מסמך מחושב לאופטימיזציה. **הסכמה מוגדרת עכשיו, המימוש בשלב 2** (PRD §9).
 * ב-MVP הכל מחושב בצד לקוח מתוך entries, ו-firestore.rules חוסמים כתיבה לקולקציה.
 */
export interface WeeklySummary {
  teamId: string;
  cycleId: string;
  playerUid: string;
  weekStart: Timestamp;
  perExercise: Record<string, WeeklySummaryExercise>;
  overallPct: number;
  updatedAt: Timestamp;
}

export type WeeklySummaryDoc = WeeklySummary & WithId;

/* ------------------------------------------------------------------ */
/* עזרי כתיבה                                                          */
/* ------------------------------------------------------------------ */

/**
 * גרסת-כתיבה של מסמך: כל שדה `Timestamp` יכול להישלח גם כ-`FieldValue`
 * (כלומר `serverTimestamp()`), כי בזמן הכתיבה עוד אין ערך.
 */
export type WriteModel<T> = {
  [K in keyof T]: Timestamp extends T[K] ? T[K] | FieldValue : T[K];
};
