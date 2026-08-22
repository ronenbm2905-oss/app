import type { FormSlug, QuestionnaireConfig } from '../types/questionnaire';
import { masHachnasaConfig } from './mas-hachnasa';
import { masShevachConfig } from './mas-shevach';

/**
 * רישום הקונפיגים.
 *
 * ⚠️ הרישום הזה יושב כאן ולא ב-`lib/scoring.ts` בכוונה.
 * כשהוא ישב בשכבת הלוגיקה, כל דף ייבא דרכה גם את השאלון של הדף השני
 * ושלח אותו לדפדפן. דף בודד צריך לייבא את הקונפיג שלו ישירות;
 * ה-registry נועד לשרת, שאכן צריך את שניהם.
 */
export const CONFIGS: Record<FormSlug, QuestionnaireConfig> = {
  'mas-hachnasa': masHachnasaConfig,
  'mas-shevach': masShevachConfig,
};

export function getConfig(slug: FormSlug): QuestionnaireConfig {
  const config = CONFIGS[slug];
  if (!config) throw new Error(`Unknown form slug: ${slug}`);
  return config;
}

export { masHachnasaConfig, masShevachConfig };
