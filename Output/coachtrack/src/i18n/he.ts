/**
 * CoachTrack — מחרוזות עברית
 *
 * כלל 8 ב-CLAUDE.md: **אין מחרוזות עברית מפוזרות ב-JSX.** כל טקסט שמוצג למשתמש
 * יושב כאן, ונקרא דרך `t('area.key')`. זה מה שיאפשר תרגום בעתיד.
 *
 * המבנה מקונן לפי אזורי המסך:
 *   common   — טקסטים חוצי-מסכים (כפתורים, מצבי טעינה)
 *   auth     — התחברות והחלפת סיסמה (שלב 1)
 *   roles    — שמות התפקידים
 *   player   — מסכי שחקן (שלב 4)
 *   coach    — מסכי מאמן (שלבים 2, 3, 5)
 *   admin    — מסך ניהול (שלב 2)
 *   units    — שמות יחידות המדידה
 *   errors   — הודעות שגיאה
 *
 * קבוצות המפתחות של מסכים שטרם נבנו נשארות מינימליות בכוונה,
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
    retry: 'נסה שוב',
    signOut: 'התנתקות',
    show: 'הצג',
    hide: 'הסתר',
    /** מסכים שהשלד שלהם קיים אבל התוכן נבנה בשלב מאוחר יותר. */
    comingSoon: 'המסך הזה ייבנה בשלב הבא.',
  },

  /** שלב 1 — מסך התחברות, החלפת סיסמה בכניסה ראשונה, ומצבי הפרופיל. */
  auth: {
    signIn: {
      title: 'התחברות',
      subtitle: 'הזן את שם המשתמש והסיסמה שקיבלת מהמאמן.',
      username: 'שם משתמש',
      usernamePlaceholder: 'לדוגמה: emanuel',
      password: 'סיסמה',
      submit: 'כניסה',
      submitting: 'מתחבר…',
      forgotHelp: 'שכחת סיסמה? פנה למאמן — הוא יאפס אותה עבורך.',
    },

    changePassword: {
      title: 'החלפת סיסמה',
      forcedNotice: 'זו הכניסה הראשונה שלך. בחר סיסמה חדשה כדי להמשיך.',
      newPassword: 'סיסמה חדשה',
      confirmPassword: 'אימות הסיסמה',
      hint: 'לפחות {min} תווים.',
      submit: 'שמירת הסיסמה',
      submitting: 'שומר…',
      keepItSafe: 'שמור את הסיסמה במקום בטוח — אין אימייל לשחזור.',
    },

    session: {
      signedInAs: 'מחובר בתור {name}',
    },

    /** מצבי ביניים ותקלות בטעינת מסמך users/{uid}. */
    profile: {
      loading: 'טוען את הפרופיל…',
      missingTitle: 'החשבון עדיין לא מוכן',
      missingBody:
        'המשתמש קיים אבל אין לו פרופיל במערכת, ולכן אי אפשר לדעת מה ההרשאות שלו. פנה למאמן.',
      inactiveTitle: 'החשבון מושבת',
      inactiveBody: 'החשבון הזה הושבת. פנה למאמן כדי להפעיל אותו מחדש.',
      errorTitle: 'טעינת הפרופיל נכשלה',
      errorBody: 'לא הצלחנו לקרוא את פרטי המשתמש. בדוק את החיבור לאינטרנט ונסה שוב.',
    },

    errors: {
      missingUsername: 'הזן שם משתמש.',
      invalidUsername: 'שם משתמש יכול להכיל אותיות באנגלית, ספרות, נקודה, מקף וקו תחתון.',
      missingPassword: 'הזן סיסמה.',
      invalidCredentials: 'שם המשתמש או הסיסמה שגויים.',
      userDisabled: 'החשבון הזה מושבת. פנה למאמן.',
      usernameTaken: 'שם המשתמש הזה כבר תפוס. בחר שם אחר.',
      tooManyAttempts: 'יותר מדי ניסיונות כניסה. המתן כמה דקות ונסה שוב.',
      network: 'אין חיבור לשרת. בדוק את האינטרנט ונסה שוב.',
      weakPassword: 'הסיסמה קצרה מדי.',
      passwordMismatch: 'שתי הסיסמאות אינן זהות.',
      requiresRecentLogin: 'מטעמי אבטחה צריך להתחבר מחדש לפני החלפת הסיסמה.',
      generic: 'ההתחברות נכשלה. נסה שוב.',
    },
  },

  /** שמות התפקידים כפי שהם מוצגים למשתמש. */
  roles: {
    admin: 'מנהל מערכת',
    coach: 'מאמן',
    player: 'שחקן',
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
    /** תפריט הניווט העליון של המאמן. */
    nav: {
      dashboard: 'דשבורד',
      team: 'הקבוצה',
      plan: 'תוכנית',
      exercises: 'ספריית תרגילים',
    },

    dashboard: {
      title: 'דשבורד',
    },

    /** שלב 2 — ניהול קבוצה. */
    team: {
      title: 'ניהול הקבוצה',
      teamSelectLabel: 'קבוצה',
      noTeam: 'לא משויכת אליך קבוצה, ולכן אי אפשר להוסיף שחקנים. פנה למנהל המערכת.',
      loading: 'טוען את רשימת השחקנים…',
      loadError: 'טעינת רשימת השחקנים נכשלה. בדוק את החיבור לאינטרנט ונסה שוב.',
      playersTitle: 'שחקנים',
      playersCount: '{active} פעילים מתוך {total}',
      empty: 'אין עדיין שחקנים בקבוצה.',
      noResults: 'אין שחקן שתואם לחיפוש.',
      searchLabel: 'חיפוש שחקן',
      searchPlaceholder: 'שם או שם משתמש',
      usernameLine: 'שם משתמש: {username}',
      inactiveBadge: 'מושבת',
      pendingPasswordBadge: 'טרם החליף סיסמה',

      actions: {
        deactivate: 'השבתה',
        activate: 'הפעלה מחדש',
        resetPassword: 'איפוס סיסמה',
      },

      /** טופס הוספת שחקן. ארבעה שדות בלבד — כלל 7, מזעור נתונים על קטינים. */
      add: {
        toggle: 'הוספת שחקן',
        title: 'שחקן חדש',
        close: 'סגירת הטופס',
        displayName: 'שם השחקן',
        displayNameHint: 'שם פרטי ואות ראשונה של שם המשפחה. לדוגמה: יונתן ב.',
        username: 'שם משתמש',
        usernameHint: 'אותיות באנגלית, ספרות, נקודה או מקף. זה מה שהשחקן יקליד בכניסה.',
        password: 'סיסמה ראשונית',
        passwordHint: 'לפחות {min} תווים. השחקן יתבקש להחליף אותה בכניסה הראשונה.',
        generatePassword: 'הגרלת סיסמה',
        teamNotice: 'השחקן יצורף לקבוצה {team}.',
        consentReminder:
          'לפני צירוף שחקן קטין נדרשת הסכמת הורה או אפוטרופוס. ודא שהתקבלה לפני יצירת החשבון.',
        minimalDataNotice:
          'נשמרים שם ושם משתמש בלבד. אין להזין ת.ז., טלפון, תאריך לידה או כתובת בשדות האלה.',
        submit: 'יצירת השחקן',
        submitting: 'יוצר…',
        success: 'השחקן {name} נוצר. מסור לו את שם המשתמש ואת הסיסמה הראשונית.',
      },

      /** אין איפוס סיסמה בצד לקוח — המסך מסביר למה ומה כן לעשות. */
      reset: {
        title: 'איפוס סיסמה',
        body: 'אין איפוס סיסמה מתוך האפליקציה: לשחקנים יש כתובת דואר פנימית שאין אליה גישה, ושינוי סיסמה של משתמש אחר אפשרי רק מהמחשב שבו מותקן הפרויקט.',
        instruction: 'הרץ בתיקיית הפרויקט:',
        copy: 'העתקת הפקודה',
        copied: 'הפקודה הועתקה',
        note: 'הפקודה מגרילה סיסמה זמנית ומדפיסה אותה, והשחקן יתבקש להחליף אותה בכניסה הבאה.',
      },

      errors: {
        nameRequired: 'הזן את שם השחקן.',
        nameTooLong: 'השם ארוך מדי.',
        nameHasNumbers: 'שם השחקן לא אמור להכיל מספרים — שם פרטי ואות ראשונה של המשפחה בלבד.',
        createFailed: 'יצירת השחקן נכשלה. נסה שוב.',
        profileWriteFailed:
          'חשבון ההתחברות של {username} נוצר, אבל הפרופיל לא נשמר והשחקן לא יוכל להשתמש באפליקציה. פנה למי שהתקין את המערכת.',
        updateFailed: 'עדכון השחקן נכשל. נסה שוב.',
      },
    },

    /** שלב 2 — ספריית תרגילים. */
    exercises: {
      title: 'ספריית תרגילים',
      loading: 'טוען את ספריית התרגילים…',
      loadError: 'טעינת ספריית התרגילים נכשלה. בדוק את החיבור לאינטרנט ונסה שוב.',
      count: 'מוצגים {shown} מתוך {total} תרגילים',
      empty: 'אין תרגילים להצגה.',
      noResults: 'אין תרגיל שתואם לחיפוש.',
      searchLabel: 'חיפוש תרגיל',
      searchPlaceholder: 'שם, קטגוריה או הנחיה',
      categoryLabel: 'קטגוריה',
      allCategories: 'כל הקטגוריות',
      globalBadge: 'קטלוג',
      orgBadge: 'של המועדון',
      inactiveBadge: 'מושבת',
      targetSuggestion: 'יעד שבועי מוצע: {target} {unit}',
      noDescription: 'אין עדיין הנחיות ביצוע.',
      globalReadOnly: 'תרגילי הקטלוג פתוחים לקריאה בלבד. כדי להנחות אחרת, צור תרגיל של המועדון.',

      actions: {
        create: 'תרגיל חדש',
        edit: 'עריכה',
        deactivate: 'השבתה',
        activate: 'הפעלה מחדש',
      },

      form: {
        createTitle: 'תרגיל חדש של המועדון',
        editTitle: 'עריכת תרגיל',
        name: 'שם התרגיל',
        category: 'קטגוריה',
        categoryHint: 'בחר קטגוריה קיימת מהרשימה או הקלד חדשה.',
        unit: 'יחידת מדידה',
        description: 'הנחיות ביצוע',
        descriptionHint: 'מה השחקן צריך לעשות בפועל — זה הטקסט שהוא יראה במסך שלו.',
        target: 'יעד שבועי מוצע',
        targetHint: 'לא חובה. אפשר לשנות אותו בכל תוכנית.',
        submitCreate: 'יצירת התרגיל',
        submitEdit: 'שמירת השינויים',
        submitting: 'שומר…',
        createSuccess: 'התרגיל {name} נוסף לספרייה.',
        editSuccess: 'התרגיל {name} עודכן.',
      },

      errors: {
        nameRequired: 'הזן שם לתרגיל.',
        nameTooLong: 'שם התרגיל ארוך מדי.',
        nameTaken: 'כבר קיים תרגיל בשם הזה.',
        categoryRequired: 'בחר או הקלד קטגוריה.',
        descriptionTooLong: 'ההנחיות ארוכות מדי.',
        targetInvalid: 'היעד חייב להיות מספר גדול מאפס.',
        saveFailed: 'שמירת התרגיל נכשלה. נסה שוב.',
      },
    },

    /** שלב 3 — תוכנית מתמשכת, מחזורים ותבניות. */
    plan: {
      title: 'תוכנית האימונים',
      loading: 'טוען את התוכנית…',
      loadError: 'טעינת התוכנית נכשלה. בדוק את החיבור לאינטרנט ונסה שוב.',
      noTeam: 'לא משויכת אליך קבוצה, ולכן אין למי לבנות תוכנית. פנה למנהל המערכת.',
      teamSelectLabel: 'קבוצה',

      /** מצב התוכנית והמחזור — "מה רץ עכשיו" (PRD §7.4). */
      status: {
        title: 'מצב התוכנית',
        none: 'אין תוכנית פעילה, ולכן השחקנים רואים במסך שלהם — אין תוכנית לשבוע זה.',
        activeSince: 'תוכנית פעילה מאז {date}',
        week: 'השבוע הנוכחי: {start} עד {end}',
        itemsCount: '{count} תרגילים בתוכנית',
        cycleOpen: 'המחזור של השבוע הזה פתוח — הדיווחים נספרים אליו.',
        cyclePending: 'המחזור של השבוע הזה עוד לא נפתח. הוא נפתח לבד ברגע שנכנסים.',
        cycleFailed: 'פתיחת המחזור השבועי נכשלה. רענן את הדף ונסה שוב.',
        snapshotNote:
          'היעדים של השבוע הנוכחי שמורים במחזור עצמו, ולכן היסטוריה של שבועות קודמים לא משתנה כשמעדכנים יעד.',
        endsAt: 'התוכנית תסתיים ב-{date}.',
      },

      /** טופס בניית התוכנית. */
      editor: {
        title: 'תרגילי התוכנית',
        empty: 'עדיין לא נבחרו תרגילים. הוסף תרגיל מהספרייה.',
        addToggle: 'הוספת תרגיל מהספרייה',
        addClose: 'סגירת הספרייה',
        addTitle: 'בחירת תרגיל',
        add: 'הוספה',
        alreadyAdded: 'כבר בתוכנית',
        target: 'יעד שבועי ({unit})',
        targetSuggestion: 'הצעה מהקטלוג: {target}',
        noSuggestion: 'לתרגיל הזה אין יעד מוצע בקטלוג — קבע יעד בעצמך.',
        notes: 'הנחיות ביצוע',
        notesHint: 'זה הטקסט שהשחקן יראה בכרטיס התרגיל.',
        remove: 'הסרה',
        moveUp: 'הזזה למעלה',
        moveDown: 'הזזה למטה',
        position: 'תרגיל {index} מתוך {total}',
        dirty: 'יש שינויים שעדיין לא נשמרו.',
        reset: 'ביטול השינויים',
        removalWarning:
          'הסרת תרגיל שכבר דווח בו: הדיווחים נשמרים בהיסטוריה אבל מפסיקים להיספר לאחוזים.',
      },

      /** תצוגה מקדימה של מסך השחקן. */
      preview: {
        title: 'מה השחקן יראה',
        overall: 'אחוז השלמה כללי: 0%',
        progress: '0 מתוך {target} {unit}',
        empty: 'אין תרגילים להצגה.',
        note: 'זו תצוגה מקדימה בלבד — המונים מתאפסים בכל תחילת שבוע.',
      },

      publish: {
        button: 'פרסום התוכנית',
        busy: 'מפרסם…',
        hint: 'התוכנית תתחיל השבוע ותמשיך מעצמה שבוע אחר שבוע, עד שתשנה אותה.',
        success: 'התוכנית פורסמה, והמחזור של השבוע הנוכחי נפתח.',
      },

      /** שתי אפשרויות העריכה — הלב של PRD §7.4. */
      update: {
        title: 'עדכון התוכנית',
        hint: 'בחר ממתי השינוי חל.',
        currentWeek: 'עדכון מהשבוע הנוכחי',
        currentWeekHint:
          'היעדים החדשים חלים כבר על השבוע הזה, והאחוזים של השחקנים יחושבו מחדש מולם.',
        currentWeekConfirm: 'האחוזים של השבוע הנוכחי יחושבו מחדש מול היעדים החדשים. להמשיך?',
        currentWeekSuccess: 'התוכנית והשבוע הנוכחי עודכנו.',
        nextWeek: 'עדכון מהשבוע הבא',
        nextWeekHint: 'השבוע הנוכחי נשאר בדיוק כמו שהוא. התוכנית החדשה תתחיל ב-{date}.',
        nextWeekSuccess: 'התוכנית החדשה תיכנס לתוקף ב-{date}. השבוע הנוכחי לא זז.',
        busy: 'שומר…',
        noChanges: 'אין שינויים לשמור.',
      },

      stop: {
        button: 'הפסקת התוכנית',
        hint: 'התוכנית תסתיים בסוף השבוע הנוכחי, ומהשבוע הבא לא ייפתח מחזור — כך נותנים שבוע בלי יעדים.',
        confirm: 'להפסיק את התוכנית בסוף השבוע הנוכחי?',
        busy: 'מפסיק…',
        success: 'התוכנית תסתיים בסוף השבוע הנוכחי.',
      },

      templates: {
        title: 'תבניות',
        loading: 'טוען תבניות…',
        loadError: 'טעינת התבניות נכשלה.',
        empty: 'אין עדיין תבניות שמורות.',
        nameLabel: 'שם התבנית',
        namePlaceholder: 'לדוגמה: שבוע לפני משחק',
        save: 'שמירה כתבנית',
        saving: 'שומר…',
        load: 'טעינה',
        delete: 'מחיקה',
        deleteConfirm: 'למחוק את התבנית {name}?',
        itemsCount: '{count} תרגילים',
        ownerOnly: 'תבנית של מאמן אחר — אפשר לטעון, אי אפשר למחוק.',
        saveSuccess: 'התבנית {name} נשמרה.',
        loadSuccess: 'התבנית {name} נטענה לטופס. עוד לא פורסם דבר.',
        loadDropped:
          'התבנית {name} נטענה, ו-{count} תרגילים הושמטו כי הם כבר לא קיימים בספרייה.',
        deleteSuccess: 'התבנית נמחקה.',
      },

      errors: {
        noItems: 'הוסף לפחות תרגיל אחד לתוכנית.',
        tooManyItems: 'אפשר עד {max} תרגילים בתוכנית.',
        duplicate: 'אותו תרגיל מופיע פעמיים בתוכנית.',
        targetInvalid: 'היעד חייב להיות מספר גדול מאפס.',
        targetOutOfRange: 'היעד חייב להיות מספר שלם, עד {max}.',
        notesTooLong: 'ההנחיות ארוכות מדי.',
        templateNameRequired: 'הזן שם לתבנית.',
        templateNameTooLong: 'שם התבנית ארוך מדי.',
        templateNameTaken: 'כבר קיימת תבנית בשם הזה.',
        saveFailed: 'שמירת התוכנית נכשלה. נסה שוב.',
        publishFailed: 'פרסום התוכנית נכשל. נסה שוב.',
        stopFailed: 'הפסקת התוכנית נכשלה. נסה שוב.',
        templateSaveFailed: 'שמירת התבנית נכשלה. נסה שוב.',
        templateDeleteFailed: 'מחיקת התבנית נכשלה. נסה שוב.',
      },
    },
  },

  /** שלב 2 — מסך ניהול לארגון ולספרייה הגלובלית. */
  admin: {
    home: {
      title: 'ניהול מערכת',
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
    /** הקונפיג של Firebase חסר — .env.local לא קיים או שה-build ישן. */
    configMissing: 'האפליקציה לא מוגדרת מול Firebase. פנה למי שהתקין אותה.',
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
 * `t('auth.changePassword.hint', { min: 8 })` → מציב `{min}` במחרוזת.
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
