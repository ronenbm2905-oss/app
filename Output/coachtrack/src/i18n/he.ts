/**
 * CoachTrack — מחרוזות עברית
 *
 * כלל 8 ב-CLAUDE.md: **אין מחרוזות עברית מפוזרות ב-JSX.** כל טקסט שמוצג למשתמש
 * יושב כאן, ונקרא דרך `t('area.key')`. זה מה שיאפשר תרגום בעתיד.
 *
 * המבנה מקונן לפי אזורי המסך:
 *   common   — טקסטים חוצי-מסכים (כפתורים, מצבי טעינה)
 *   auth     — התחברות והחלפת סיסמה (שלב 1)
 *   player   — מסכי שחקן (שלב 4)
 *   coach    — מסכי מאמן (שלבים 2, 3, 5)
 *   units    — שמות יחידות המדידה
 *   errors   — הודעות שגיאה
 *
 * זהו **שלד**. קבוצות המפתחות של מסכים שטרם נבנו נשארות ריקות בכוונה,
 * ומתמלאות בשלב שבו המסך נבנה.
 */

export const he = {
  common: {
    appName: 'CoachTrack',
    tagline: 'מעקב אימונים לקבוצת כדורסל',
    loading: 'טוען…',
    save: 'שמירה',
    cancel: 'ביטול',
    edit: 'עריכה',
    delete: 'מחיקה',
    confirm: 'אישור',
    back: 'חזרה',
    close: 'סגירה',
    search: 'חיפוש',
    empty: 'אין מה להציג',
  },

  /** שלב 1 — מסך התחברות, החלפת סיסמה בכניסה ראשונה. */
  auth: {
    signIn: {
      title: 'התחברות',
    },
    changePassword: {
      title: 'החלפת סיסמה',
    },
  },

  /** שלב 4 — מסכי שחקן. */
  player: {
    myWeek: {
      title: 'השבוע שלי',
    },
    report: {
      title: 'דיווח',
    },
    history: {
      title: 'היסטוריה',
    },
  },

  /** שלבים 2, 3, 5 — מסכי מאמן. */
  coach: {
    dashboard: {
      title: 'דשבורד',
    },
    team: {
      title: 'הקבוצה',
    },
    exercises: {
      title: 'ספריית תרגילים',
    },
    plan: {
      title: 'תוכנית',
    },
  },

  /** יחידות המדידה של תרגיל — מקבילות ל-`Unit` ב-types/types.ts. */
  units: {
    count: 'חזרות',
    minutes: 'דקות',
    sessions: 'אימונים',
    distance_km: 'ק״מ',
  },

  errors: {
    generic: 'משהו השתבש. נסה שוב.',
    network: 'אין חיבור לשרת.',
    permission: 'אין לך הרשאה לפעולה הזו.',
    notFound: 'לא נמצא.',
  },
} as const;

/* ------------------------------------------------------------------ */
/* מנגנון ה-t()                                                        */
/* ------------------------------------------------------------------ */

type Dictionary = { readonly [key: string]: string | Dictionary };

/** בונה את איחוד כל הנתיבים המקוננים שמובילים למחרוזת, למשל `'player.myWeek.title'`. */
type LeafPaths<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`;
    }[keyof T & string];

/** כל מפתח תרגום חוקי. שגיאת כתיב במפתח נתפסת בזמן קומפילציה, לא בזמן ריצה. */
export type TranslationKey = LeafPaths<typeof he>;

/** ערכים להצבה בתוך מחרוזת, לפי תבנית `{name}`. */
export type TranslationParams = Record<string, string | number>;

/**
 * מחזירה את המחרוזת העברית לפי נתיב מקונן.
 * `t('common.loading')` → `'טוען…'`
 * `t('player.myWeek.daysLeft', { days: 3 })` → מציב `{days}` במחרוזת.
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  let current: string | Dictionary = he as Dictionary;

  for (const segment of key.split('.')) {
    if (typeof current === 'string') break;
    const next: string | Dictionary | undefined = current[segment];
    if (next === undefined) {
      // מפתח חסר — מחזירים את הנתיב עצמו כדי שהחוסר יהיה גלוי על המסך.
      return key;
    }
    current = next;
  }

  if (typeof current !== 'string') return key;
  if (!params) return current;

  return current.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
