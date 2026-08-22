import { describe, it, expect } from 'vitest';
import {
  calculateScore,
  assertComplete,
  resolveTier,
  scoreBounds,
  tierDistribution,
  IncompleteAnswersError,
} from '../shared/lib/scoring';
import { masHachnasaConfig } from '../shared/config/mas-hachnasa';
import { masShevachConfig } from '../shared/config/mas-shevach';
import { CONFIGS } from '../shared/config';
import type { QuestionnaireConfig } from '../shared/types/questionnaire';

/**
 * הבדיקות האלה הן החוזה של מודל הניקוד.
 *
 * שני הבאגים המבניים של גרסה 1.0 — מקדם שהיה שער בפועל, ומדרג שהכיל
 * 4 צירופים מתוך 256 — היו נתפסים כאן. אם מקדם או סף משתנים והבדיקות
 * נופלות, זו לא בדיקה שבורה: זו התפלגות שהשתנתה, וצריך להסתכל עליה.
 */

describe('מודל הניקוד — דף החזר מס', () => {
  it('הפילוח הוא 56/25/47 מתוך מרחב של 128', () => {
    const dist = tierDistribution(masHachnasaConfig);
    expect(dist.total).toBe(128);
    expect(dist.counts).toEqual({ A: 56, B: 25, C: 47 });
  });

  it('הגבולות הם 0.225 עד 3.861', () => {
    expect(scoreBounds(masHachnasaConfig)).toEqual({ min: 0.225, max: 3.861 });
  });

  it('שכר מתחת ל-10K כבר אינו שער מוסווה — הענף מגיע ל-A', () => {
    // הרגרסיה של הבאג המרכזי בגרסה 1.0: במקדם 0.1 הענף הזה הגיע למקסימום
    // 0.322 מול רצפת C של 0.75, כלומר פסילה מוחלטת שנכתבה כהחלשה.
    const best = calculateScore(
      {
        job_change: 'yes',
        avg_salary: 'below_10k',
        sold_property: 'yes',
        self_employed: 'no',
        retired: 'yes',
        disability: 'yes',
        capital_market: 'yes',
        prior_claim: 'no',
      },
      masHachnasaConfig
    );
    expect(best.score).toBe(1.931);
    expect(best.tier.id).toBe('A');
  });

  it('הפרופיל השכיח ביותר יושב ב-B ורחוק מגבול המדרג', () => {
    // 0.75 × 1.2 = 0.89999999999999991 ב-IEEE-754. ברצפת B של 0.9 ההכרעה
    // בין B ל-C עבור הגולש הנפוץ ביותר נקבעה בשגיאת ייצוג בינארית.
    const modal = calculateScore(
      {
        job_change: 'no',
        avg_salary: 'above_10k',
        sold_property: 'no',
        self_employed: 'no',
        retired: 'no',
        disability: 'no',
        capital_market: 'no',
        prior_claim: 'no',
      },
      masHachnasaConfig
    );
    expect(modal.tier.id).toBe('B');
    // הציון הגולמי נמוך מ-0.9, ובכל זאת הוא ב-B — כי הרצפה היא 0.75
    expect(0.75 * 1.2).toBeLessThan(0.9);
  });

  it('resolveTier פועל על הציון הגולמי, לא על המעוגל', () => {
    const raw = 0.75 * 1.2; // 0.89999999999999991
    expect(raw).not.toBe(0.9);
    // ברצפה 0.9 שני אלה היו נותנים תשובות שונות. זה מה ששבר את גרסה 1.0.
    expect(resolveTier(raw, masHachnasaConfig).id).toBe(
      resolveTier(Math.round(raw * 1000) / 1000, masHachnasaConfig).id
    );
  });

  it('עצמאי הוא שער קשיח שחותך מיד ומחזיר נימוק ייעודי', () => {
    const result = calculateScore(
      { job_change: 'yes', avg_salary: 'above_10k', sold_property: 'yes', self_employed: 'yes' },
      masHachnasaConfig
    );
    expect(result.disqualified).toBe(true);
    expect(result.score).toBe(0);
    expect(result.tier.id).toBe('C');
    expect(result.disqualifiedBy?.questionId).toBe('self_employed');
    expect(result.disqualifiedBy?.reason).toContain('מסלול אחר');
    // נחתך — לא נאסף מידע על השאלות שאחרי
    expect(result.breakdown).toHaveLength(4);
  });
});

describe('מודל הניקוד — דף מס שבח', () => {
  it('הפילוח הוא 7/7/10 מתוך מרחב של 24', () => {
    const dist = tierDistribution(masShevachConfig);
    expect(dist.total).toBe(24);
    expect(dist.counts).toEqual({ A: 7, B: 7, C: 10 });
  });

  it('הגבולות הם 0.243 עד 4.032 — ולא 0.219 כפי שנכתב בגרסה 1.0', () => {
    expect(scoreBounds(masShevachConfig)).toEqual({ min: 0.243, max: 4.032 });
  });

  it('השער הקשיח נסגר על השאלה הראשונה ומחזיר נימוק ייעודי', () => {
    const result = calculateScore({ sold_property: 'no' }, masShevachConfig);
    expect(result.disqualified).toBe(true);
    expect(result.tier.id).toBe('C');
    expect(result.disqualifiedBy?.reason).toContain('מכר נכס');
  });

  it('סף A דורש שילוב של מס גבוה עם גורם מחזק', () => {
    const onlyHighTax = calculateScore(
      {
        sold_property: 'yes',
        shevach_paid: 'above_30k',
        age_at_sale: 'no',
        monthly_income: 'above_6k',
        capital_market: 'no',
      },
      masShevachConfig
    );
    expect(onlyHighTax.score).toBe(1.215);
    expect(onlyHighTax.tier.id).toBe('B'); // לא מספיק לבדו

    const withAge = calculateScore(
      {
        sold_property: 'yes',
        shevach_paid: 'above_30k',
        age_at_sale: 'yes',
        monthly_income: 'above_6k',
        capital_market: 'no',
      },
      masShevachConfig
    );
    expect(withAge.score).toBe(2.16);
    expect(withAge.tier.id).toBe('A');
  });

  it('"לא ידוע" ממקם ב-B ולא פוסל', () => {
    const result = calculateScore(
      {
        sold_property: 'yes',
        shevach_paid: 'unknown',
        age_at_sale: 'yes',
        monthly_income: 'above_6k',
        capital_market: 'no',
      },
      masShevachConfig
    );
    expect(result.tier.id).toBe('B');
  });
});

describe('assertComplete — הרגרסיה של חור האימות בשרת', () => {
  it('שלוש שאלות Hero חיוביות בלבד נדחות, למרות שהן מחשבות מדרג A', () => {
    const partial = {
      job_change: 'yes',
      avg_salary: 'above_10k',
      sold_property: 'yes',
    };
    // זה בדיוק מה שהשרת היה מקבל בגרסה 1.0 — ומאשר
    expect(calculateScore(partial, masHachnasaConfig).tier.id).toBe('A');
    // ומכאן והלאה הוא נדחה
    expect(() => assertComplete(partial, masHachnasaConfig)).toThrow(IncompleteAnswersError);
  });

  it('שאלון מלא עובר', () => {
    expect(() =>
      assertComplete(
        {
          job_change: 'no',
          avg_salary: 'above_10k',
          sold_property: 'no',
          self_employed: 'no',
          retired: 'no',
          disability: 'no',
          capital_market: 'no',
          prior_claim: 'no',
        },
        masHachnasaConfig
      )
    ).not.toThrow();
  });

  it('שאלון שנחתך בשער עובר — עם התשובות שקדמו לו בדיוק', () => {
    expect(() => assertComplete({ sold_property: 'no' }, masShevachConfig)).not.toThrow();
  });

  it('תשובה שנשלחה אחרי השער נדחית', () => {
    expect(() =>
      assertComplete({ sold_property: 'no', shevach_paid: 'above_30k' }, masShevachConfig)
    ).toThrow(/after hard gate/);
  });

  it('מזהה תשובה שאינו קיים נדחה', () => {
    expect(() => assertComplete({ sold_property: 'maybe' }, masShevachConfig)).toThrow(
      /Invalid answer/
    );
  });

  it('שאלה שאינה בקונפיג נדחית', () => {
    expect(() =>
      assertComplete({ sold_property: 'yes', injected: 'yes' }, masShevachConfig)
    ).toThrow(/Unknown question/);
  });
});

describe('שלמות הקונפיגים — כללים שאסור להפר', () => {
  const configs = Object.values(CONFIGS) as QuestionnaireConfig[];

  it.each(configs)('$slug: המדרגים מכסים את כל ציר המספרים בלי חורים', (config) => {
    const sorted = [...config.tiers].sort((a, b) => a.minScore - b.minScore);
    expect(sorted[0].minScore).toBe(-Infinity);
    expect(sorted[sorted.length - 1].maxScore).toBe(Infinity);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].maxScore).toBe(sorted[i + 1].minScore);
    }
  });

  /**
   * חריגים מאושרים לכלל "אין מקדם שהוא שער בפועל".
   *
   * מקדם שאף צירוף שכולל אותו לא מגיע לרצפת המדרג הנמוך-אך-לא-C הוא
   * `disqualifies` שנכתב כמספר. בדף החזר מס זה היה באג (שתי שאלות),
   * ותוקן. במס שבח נשאר מקרה אחד שהוא **כנראה** מכוון — אבל טרם אושר.
   */
  const ACKNOWLEDGED_DE_FACTO_GATES: Record<string, string> = {
    'mas-shevach/shevach_paid/below_30k':
      'מקסימום 0.806 מול רצפת B של 1.0 — כלומר מי ששילם פחות מ-30K הוא תמיד C. ' +
      'ככל הנראה מכוון (הדף כולו נועד לסנן לטובת מס שבח משמעותי), אבל אז עדיף שער ' +
      'מפורש: הוא חוסך לגולש שלוש שאלות ומייצר hard_gate_exit שמלמד על איכות הטירגוט. ' +
      'החלטה פתוחה — ראה §11.8 באפיון.',
  };

  it.each(configs)('$slug: אין מקדם שהוא שער בפועל', (config) => {
    const floorAboveC = Math.min(
      ...config.tiers.filter((t) => t.id !== 'C').map((t) => t.minScore)
    );

    for (const question of config.questions) {
      for (const option of question.options) {
        if (option.disqualifies) continue;
        if (ACKNOWLEDGED_DE_FACTO_GATES[`${config.slug}/${question.id}/${option.id}`]) continue;

        let best = option.weight;
        for (const other of config.questions) {
          if (other.id === question.id) continue;
          const usable = other.options.filter((o) => !o.disqualifies);
          if (usable.length === 0) continue;
          best *= Math.max(...usable.map((o) => o.weight));
        }

        expect(
          best,
          `${config.slug}/${question.id}/${option.id}: מקסימום ${best.toFixed(3)} < רצפה ${floorAboveC} — זהו שער, יש לכתוב אותו כ-disqualifies`
        ).toBeGreaterThanOrEqual(floorAboveC);
      }
    }
  });

  it.each(configs)('$slug: כל שער נושא כותרת ונימוק משלו', (config) => {
    for (const question of config.questions) {
      for (const option of question.options) {
        if (!option.disqualifies) continue;
        expect(option.disqualifyHeadline, `${question.id}/${option.id}`).toBeTruthy();
        expect(option.disqualifyReason, `${question.id}/${option.id}`).toBeTruthy();
      }
    }
  });

  it.each(configs)('$slug: מדרג C תמיד שווה 0 בפיקסל', (config) => {
    expect(config.tiers.find((t) => t.id === 'C')!.conversionValue).toBe(0);
  });

  it.each(configs)('$slug: הציון לעולם לא נחשף לגולש', (config) => {
    expect(config.exposeScoreToVisitor).toBe(false);
  });

  it.each(configs)('$slug: ההסכמה לדיוור קיימת, אופציונלית, ומסוג checkbox', (config) => {
    const consent = config.leadFields.find((f) => f.id === 'consent');
    expect(consent, 'שדה consent חסר בקונפיג').toBeDefined();
    expect(consent!.type).toBe('checkbox');
    // §9.3 — התניית קבלת התוצאה בהסכמה שיווקית היא התניית שירות בהסכמה
    expect(consent!.required).toBe(false);
  });

  it.each(configs)('$slug: אין סכומי החזר מספריים בשום טקסט לגולש', (config) => {
    // §9.2 — הצגת סכום לפני בדיקת מסמכים חושפת לטענת הטעיה
    const visible = [
      config.heroHeadline,
      config.heroSubline,
      config.pageTitle,
      config.metaDescription,
      ...config.tiers.flatMap((t) => [t.headline, t.body, t.ctaNote ?? '', t.consentNote ?? '']),
      ...config.faq.flatMap((f) => [f.question, f.answer]),
    ].join(' ');

    // סכום בשקלים בן 4 ספרות ומעלה, עם או בלי פסיק
    expect(visible).not.toMatch(/d{1,3},d{3}s*₪/);
    expect(visible).not.toMatch(/d{4,}s*₪/);
  });

  /**
   * §9.2 נאכף עד היום על **ספרות** בלבד, ולכן היה אפשר לעקוף אותו במילים:
   * "קיימת סבירות גבוהה שאתה זכאי להחזר" עבר את הבדיקה בלי בעיה.
   * שער משפטי 22.8.2026 הפך אותו לכלל שנאכף.
   */
  const BANNED_EVERYWHERE = ['מובטח', 'בוודאות', 'תקבל החזר', 'מגיע לך בוודאות'];

  /**
   * אסורים בטקסט המדרגים בלבד.
   *
   * ההבחנה מכוונת: בכותרת ה-Hero "בדוק אם **מגיע לך** החזר" זו שאלה
   * שמזמינה בדיקה — וזו כל הצעת הערך של הדף. באותן מילים במסך התוצאה,
   * **אחרי** שהגולש מסר נתונים, זו כבר קביעה לגביו אישית לפני שנראה מסמך.
   */
  const BANNED_IN_TIERS = ['סבירות גבוהה', 'ההחזר הצפוי', 'מגיע לך', 'אתה זכאי', 'את זכאית'];

  it.each(configs)('$slug: אין הבטחת זכאות בשום טקסט לגולש', (config) => {
    const everywhere = [
      config.heroHeadline,
      config.heroSubline,
      config.pageTitle,
      config.metaDescription,
      ...config.tiers.flatMap((t) => [t.headline, t.body, t.ctaNote ?? '', t.consentNote ?? '']),
      ...config.faq.flatMap((f) => [f.question, f.answer]),
    ].join(' ');

    for (const phrase of BANNED_EVERYWHERE) {
      expect(everywhere, `"${phrase}" אסור בכל טקסט לגולש — §8.4`).not.toContain(phrase);
    }

    const tierText = config.tiers
      .flatMap((t) => [t.headline, t.body, t.ctaNote ?? '', t.consentNote ?? ''])
      .join(' ');

    for (const phrase of BANNED_IN_TIERS) {
      expect(
        tierText,
        `"${phrase}" במסך התוצאה הוא קביעת זכאות אישית לפני בדיקת מסמכים — §9.2`
      ).not.toContain(phrase);
    }
  });

  it.each(configs)('$slug: מודל התמחור מגולה — לא רק "חינם"', (config) => {
    // ח-3 בשער המשפטי: האתר אמר "חינם" ארבע פעמים ומעולם לא אמר
    // שהטיפול הוא שירות בתשלום. חוק הגנת הצרכן §2(א) ו-§4.
    const faq = config.faq.map((f) => f.question + ' ' + f.answer).join(' ');
    expect(faq, 'חסר גילוי שהטיפול עצמו בתשלום').toMatch(/בתשלום|שכר טרחה|שכר הטרחה/);
  });

  it.each(configs)('$slug: לכל מדרג יש מסלול פנייה', (config) => {
    // ח-5: מדרג C היה `ctaType: 'none'` — מסך ללא שום מסלול — בזמן
    // ששורת האמון הבטיחה מענה לכל גולש. משה הכריע: מי שפונה מקבל מענה.
    for (const tier of config.tiers) {
      expect(tier.ctaType, `מדרג ${tier.id} בלי מסלול פנייה`).not.toBe('none');
    }
  });

});
