/**
 * טיפוסים משותפים למנוע השאלון.
 *
 * המנוע גנרי לחלוטין — הוא לא יודע דבר על מס הכנסה או מס שבח.
 * כל ההתנהגות הספציפית לדף מגיעה מקובץ קונפיגורציה שמממש QuestionnaireConfig.
 *
 * אסור לקודד מקדם, טקסט או סף כלשהו בתוך רכיבי המנוע.
 *
 * הקובץ הזה נצרך גם מהלקוח וגם מ-Cloud Function — ראה `scripts/sync-shared.mjs`.
 */

export type QuestionId = string;
export type TierId = 'A' | 'B' | 'C';
export type FormSlug = 'mas-hachnasa' | 'mas-shevach';

/** אפשרות תשובה בודדת */
export interface AnswerOption {
  id: string;
  /** הטקסט שהגולש רואה */
  label: string;
  /** מקדם כפל לחישוב הציון. 1 = ניטרלי */
  weight: number;
  /**
   * שער קשיח. בחירה באפשרות זו מאפסת את הציון,
   * מקבעת את המדרג ל-C ומדלגת ישירות למסך התוצאה.
   *
   * ⚠️ מקדם שאינו מאפשר לאף צירוף להגיע לסף המדרג הנמוך ביותר
   * הוא שער בפועל — ויש לכתוב אותו ככזה. ראה §4.2 באפיון.
   */
  disqualifies?: boolean;
  /**
   * כותרת מסך התוצאה כשהשער נסגר.
   * הכותרת הגנרית של מדרג C ("הסיכוי להחזר נמוך") מטעה כאן: מי שנחסם
   * לא נבדק ונמצא לא-זכאי — הוא פשוט לא במסלול הזה.
   */
  disqualifyHeadline?: string;
  /**
   * גוף מסך התוצאה כשהשער נסגר.
   * שער אינו "ציון נמוך": הגולש לא ענה על רוב השאלון ולעיתים גם לא מסר פרטים,
   * ולכן הנוסח הכללי של מדרג C לא מתאים לו.
   */
  disqualifyReason?: string;
  /** הערה פנימית — לא מוצגת לגולש */
  internalNote?: string;
}

export interface Question {
  id: QuestionId;
  title: string;
  /** הסבר קצר מתחת לשאלה. אופציונלי */
  subtitle?: string;
  options: AnswerOption[];
  /** האם השאלה מוצגת כבר במסך ה-Hero, מעל הקיפול */
  showInHero?: boolean;
}

export type LeadFieldType =
  | 'text'
  | 'tel'
  | 'email'
  | 'date'
  | 'select'
  | 'number'
  | 'checkbox';

export interface LeadField {
  id: string;
  label: string;
  type: LeadFieldType;
  required: boolean;
  placeholder?: string;
  /** לשדות מסוג select */
  options?: string[];
  /**
   * primary   = נאסף בקיר הפרטים, לפני שליחת הליד
   * secondary = נאסף אחרי שליחת הליד. אי-מילוי לא פוגע בליד
   */
  stage: 'primary' | 'secondary';
  /** ביטוי רגולרי לוולידציה. נאכף גם בצד השרת */
  pattern?: string;
  /** הודעת שגיאה כשהוולידציה נכשלת */
  errorMessage?: string;
}

export interface ResultTier {
  id: TierId;
  /** גבול תחתון — כולל */
  minScore: number;
  /** גבול עליון — לא כולל. השתמש ב-Infinity למדרג העליון */
  maxScore: number;

  // ── מה שהגולש רואה ──
  headline: string;
  body: string;
  /**
   * משפט שמובטחת בו פנייה שיווקית עתידית.
   * מוצג **רק** למי שסימן את צ'קבוקס ההסכמה. ראה §9.3 באפיון.
   */
  consentNote?: string;
  /** שורת עידוד נוספת מתחת ל-CTA. אופציונלי */
  ctaNote?: string;
  ctaType: 'whatsapp' | 'phone' | 'none';
  ctaLabel?: string;

  // ── מה שהמשרד רואה ──
  /** מופיע בשורת הנושא של המייל ובשדה המדרג ב-Firestore */
  internalLabel: string;
  /** SLA / פעולה נדרשת. מופיע בגוף מייל ההתראה */
  internalAction: string;

  // ── אופטימיזציית קמפיינים ──
  /**
   * ערך ההמרה שנשלח ל-GA4 ול-Meta. C תמיד 0.
   * זהו **המקור היחיד** לערך הזה — אין להעתיק אותו לקובץ נוסף.
   */
  conversionValue: number;
}

export interface QuestionnaireConfig {
  slug: FormSlug;

  /** מטא של העמוד */
  pageTitle: string;
  metaDescription: string;

  /** Hero */
  heroHeadline: string;
  heroSubline: string;

  /** כותרת קיר הפרטים */
  leadCaptureHeadline: string;
  leadCaptureSubline?: string;
  submitLabel: string;

  questions: Question[];
  leadFields: LeadField[];
  tiers: ResultTier[];

  scoringMode: 'multiplicative';

  /**
   * האם להציג לגולש את הציון או כל ייצוג מספרי שלו.
   * false בשני הדפים — הדירוג פנימי בלבד.
   */
  exposeScoreToVisitor: boolean;

  /** האם להציג מסך השלמת פרטים אחרי שליחה */
  enableSecondaryFields: boolean;

  faq: Array<{ question: string; answer: string }>;
}

// ─────────────────────────────────────────────
// טיפוסי זמן-ריצה
// ─────────────────────────────────────────────

export interface ScoreResult {
  /** מעוגל ל-3 ספרות. העיגול הוא לפלט בלבד — לא להשוואת מדרג */
  score: number;
  tier: ResultTier;
  disqualified: boolean;
  /** התשובה שסגרה את השער, אם נסגר */
  disqualifiedBy?: {
    questionId: QuestionId;
    answerId: string;
    headline?: string;
    reason?: string;
  };
  /** פירוט לכל שאלה — לניפוי שגיאות ולכיול מקדמים */
  breakdown: Array<{
    questionId: QuestionId;
    answerId: string;
    weight: number;
  }>;
}

export interface LeadData {
  fullName: string;
  phone: string;
  email: string;
  /** הסכמה לדיוור שיווקי. אופציונלית — ראה §9.3 באפיון */
  consent: boolean;
  // שדות secondary — כולם אופציונליים
  birthDate?: string;
  maritalStatus?: string;
  childrenUnder18?: number;
  address?: string;
}

export interface SubmissionMeta {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  landingPath: string;
  userAgent: string;
  timeOnPageMs: number;
}

export interface SubmitLeadRequest {
  formSlug: FormSlug;
  answers: Record<QuestionId, string>;
  lead: LeadData;
  meta: SubmissionMeta;
  /** honeypot — חייב להיות ריק */
  website?: string;
}

export interface SubmitLeadResponse {
  ok: boolean;
  tier?: TierId;
  submissionId?: string;
  error?: string;
}

export interface EngineState {
  currentStep: number;
  answers: Record<QuestionId, string>;
  leadData: Partial<LeadData>;
  status: 'hero' | 'questions' | 'lead-capture' | 'result' | 'secondary';
  result: ScoreResult | null;
  submissionId: string | null;
  startedAt: number;
}
