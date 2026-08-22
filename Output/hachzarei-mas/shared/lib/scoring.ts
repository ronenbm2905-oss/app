import type {
  QuestionnaireConfig,
  QuestionId,
  ScoreResult,
  ResultTier,
} from '../types/questionnaire';

/**
 * מנוע הניקוד.
 *
 * רץ פעמיים: בצד הלקוח להצגה מיידית, ובצד השרת ב-submitLead.
 * הערך הנשמר הוא תמיד זה של השרת — הלקוח לא נאמן.
 *
 * ⚠️ הקובץ הזה לא מייבא אף קונפיג. רישום הקונפיגים יושב ב-`config/index.ts`,
 * אחרת כל דף שולח לדפדפן גם את השאלון של הדף השני.
 */

/** נזרקת כשהשאלון שהגיע מהלקוח אינו שלם או אינו עקבי. השרת מתרגם ל-400. */
export class IncompleteAnswersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncompleteAnswersError';
  }
}

/**
 * מאתר את המדרג שהציון נופל לתוכו. הטווח הוא [minScore, maxScore).
 *
 * ⚠️ **מקבל את הציון הגולמי, לא מעוגל.**
 * עיגול לפני ההשוואה הזיז את הפרופיל הנפוץ ביותר בדף החזר מס בין שני מדרגים:
 * `0.75 × 1.2` שווה ב-IEEE-754 בדיוק 0.89999999999999991, ולכן ברצפה 0.9
 * הציון נפל ל-C בלי עיגול ול-B עם עיגול. ראה §3.2 באפיון.
 */
export function resolveTier(rawScore: number, config: QuestionnaireConfig): ResultTier {
  const tier = config.tiers.find((t) => rawScore >= t.minScore && rawScore < t.maxScore);
  if (tier) return tier;

  // רשת ביטחון — לא אמור לקרות אם הטווחים מכסים את כל הציר
  const fallback = config.tiers.find((t) => t.id === 'C');
  if (!fallback) throw new Error(`No tier matched score ${rawScore} in ${config.slug}`);
  return fallback;
}

/**
 * מאמת שהשאלון שהגיע מהלקוח שלם ועקבי. **חובה בשרת לפני calculateScore.**
 *
 * הרקע: calculateScore מדלגת על שאלה שלא נענתה (מכפילה ב-1), וזה נכון —
 * כך נראה שאלון שנחתך בשער קשיח. אבל בלי האימות הזה אפשר לקנות מדרג A
 * פשוט בהשמטת השאלות המחלישות: שלוש שאלות ה-Hero החיוביות בדף החזר מס
 * נותנות 1.25 × 1.2 × 1.3 = 1.95, והשרת מחשב בדיוק אותו דבר ולכן לא תופס.
 *
 * הכלל: או שכל השאלות נענו, או שנסגר שער — ואז נענו **בדיוק** אלה שקדמו לו.
 */
export function assertComplete(
  answers: Record<QuestionId, string>,
  config: QuestionnaireConfig
): void {
  const known = new Set(config.questions.map((q) => q.id));
  for (const key of Object.keys(answers)) {
    if (!known.has(key)) {
      throw new IncompleteAnswersError(`Unknown question "${key}" in ${config.slug}`);
    }
  }

  let gateIndex = -1;

  for (let i = 0; i < config.questions.length; i++) {
    const question = config.questions[i];
    const answerId = answers[question.id];

    if (answerId === undefined) {
      throw new IncompleteAnswersError(`Missing answer for "${question.id}"`);
    }

    const option = question.options.find((o) => o.id === answerId);
    if (!option) {
      throw new IncompleteAnswersError(
        `Invalid answer "${answerId}" for question "${question.id}"`
      );
    }

    if (option.disqualifies) {
      gateIndex = i;
      break;
    }
  }

  if (gateIndex >= 0) {
    for (let i = gateIndex + 1; i < config.questions.length; i++) {
      if (answers[config.questions[i].id] !== undefined) {
        throw new IncompleteAnswersError(
          `Answer supplied after hard gate: "${config.questions[i].id}"`
        );
      }
    }
  }
}

export function calculateScore(
  answers: Record<QuestionId, string>,
  config: QuestionnaireConfig
): ScoreResult {
  let score = 1;
  let disqualifiedBy: ScoreResult['disqualifiedBy'];
  const breakdown: ScoreResult['breakdown'] = [];

  for (const question of config.questions) {
    const answerId = answers[question.id];

    // שאלה שלא נענתה — מדלגים. קורה כשהופעל שער קשיח ונחתך המשך השאלון.
    // בשרת assertComplete כבר ווידאה שהדילוג מוצדק.
    if (!answerId) continue;

    const option = question.options.find((o) => o.id === answerId);
    if (!option) {
      throw new IncompleteAnswersError(
        `Invalid answer "${answerId}" for question "${question.id}"`
      );
    }

    breakdown.push({ questionId: question.id, answerId, weight: option.weight });

    if (option.disqualifies) {
      disqualifiedBy = {
        questionId: question.id,
        answerId,
        headline: option.disqualifyHeadline,
        reason: option.disqualifyReason,
      };
      break; // אין טעם להמשיך — הציון מאולץ ל-0
    }

    score *= option.weight;
  }

  const disqualified = disqualifiedBy !== undefined;

  // ⚠️ המדרג נקבע על הציון **הגולמי**. round3 הוא לשמירה ולתצוגה בלבד.
  const tier = disqualified
    ? tierById(config, 'C')
    : resolveTier(score, config);

  return {
    score: disqualified ? 0 : round3(score),
    tier,
    disqualified,
    disqualifiedBy,
    breakdown,
  };
}

export function tierById(config: QuestionnaireConfig, id: ResultTier['id']): ResultTier {
  const tier = config.tiers.find((t) => t.id === id);
  if (!tier) throw new Error(`Config ${config.slug} is missing tier "${id}"`);
  return tier;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * האם התשובה חותכת את השאלון.
 * המנוע קורא לזה אחרי כל בחירה כדי להחליט אם לקפוץ למסך התוצאה.
 */
export function isDisqualifying(
  questionId: QuestionId,
  answerId: string,
  config: QuestionnaireConfig
): boolean {
  const question = config.questions.find((q) => q.id === questionId);
  return question?.options.find((o) => o.id === answerId)?.disqualifies === true;
}

/** גבולות תיאורטיים למי שעבר את כל השערים — לכיול מקדמים ולבדיקות */
export function scoreBounds(config: QuestionnaireConfig): { min: number; max: number } {
  let min = 1;
  let max = 1;
  for (const q of config.questions) {
    const usable = q.options.filter((o) => !o.disqualifies).map((o) => o.weight);
    if (usable.length === 0) continue;
    min *= Math.min(...usable);
    max *= Math.max(...usable);
  }
  return { min: round3(min), max: round3(max) };
}

/**
 * כלי כיול: מונה את **כל** צירופי התשובות שעוברים את השערים, ומחזיר את
 * ההתפלגות בין המדרגים.
 *
 * ⚠️ **להריץ לפני כל שינוי מקדם או סף.** שני הבאגים המבניים שנמצאו בגרסה 1.0
 * — מקדם שהוא שער בפועל, ומדרג שמכיל 4 צירופים מתוך 256 — היו נראים מיד כאן.
 */
export function tierDistribution(config: QuestionnaireConfig): {
  total: number;
  counts: Record<string, number>;
  min: number;
  max: number;
} {
  let combos: Array<{ score: number }> = [{ score: 1 }];

  for (const question of config.questions) {
    const usable = question.options.filter((o) => !o.disqualifies);
    if (usable.length === 0) continue;
    const next: Array<{ score: number }> = [];
    for (const combo of combos) {
      for (const option of usable) {
        next.push({ score: combo.score * option.weight });
      }
    }
    combos = next;
  }

  const counts: Record<string, number> = {};
  for (const tier of config.tiers) counts[tier.id] = 0;
  for (const combo of combos) counts[resolveTier(combo.score, config).id]++;

  const scores = combos.map((c) => c.score);
  return {
    total: combos.length,
    counts,
    min: round3(Math.min(...scores)),
    max: round3(Math.max(...scores)),
  };
}
