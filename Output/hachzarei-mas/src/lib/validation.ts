import { z, type ZodTypeAny } from 'zod';
import type { LeadField, QuestionnaireConfig } from '@shared/types/questionnaire';

/**
 * סכמות Zod נבנות **מהקונפיג**, לא נכתבות ביד.
 *
 * כך שדה שנוסף ל-`leadFields` מקבל ולידציה אוטומטית, ואי אפשר שהאפיון
 * והוולידציה יסטו זה מזה. אותה פונקציה רצה גם בשרת.
 */

function fieldSchema(field: LeadField): ZodTypeAny {
  if (field.type === 'checkbox') {
    // הסכמה לדיוור אינה חובה (§9.3). אם אי פעם ייווסף צ'קבוקס שכן חובה,
    // `required: true` יאכוף אותו כאן.
    return field.required
      ? z.literal(true, { errorMap: () => ({ message: field.errorMessage ?? 'נדרש אישור' }) })
      : z.boolean().default(false);
  }

  if (field.type === 'number') {
    const base = z.coerce.number().int().min(0).max(30);
    return field.required ? base : base.optional();
  }

  if (field.type === 'select') {
    const values = field.options ?? [];
    const base = values.length
      ? z.enum(values as [string, ...string[]])
      : z.string().max(120);
    return field.required ? base : base.optional().or(z.literal(''));
  }

  let base = z.string().trim();

  if (field.type === 'email') {
    base = base.email(field.errorMessage ?? 'נא להזין כתובת דוא"ל תקינה');
  }
  if (field.pattern) {
    base = base.regex(new RegExp(field.pattern), field.errorMessage ?? 'הערך אינו תקין');
  }
  if (field.type === 'text') {
    base = base.min(2, 'שדה קצר מדי').max(80, 'שדה ארוך מדי');
  }
  if (field.type === 'date') {
    base = base.regex(/^\d{4}-\d{2}-\d{2}$/, 'תאריך לא תקין');
  }

  return field.required
    ? base.min(1, field.errorMessage ?? 'שדה חובה')
    : base.optional().or(z.literal(''));
}

export function leadSchema(config: QuestionnaireConfig, stage: 'primary' | 'secondary') {
  const shape: Record<string, ZodTypeAny> = {};
  for (const field of config.leadFields) {
    if (field.stage !== stage) continue;
    shape[field.id] = fieldSchema(field);
  }
  return z.object(shape);
}

export function primaryFields(config: QuestionnaireConfig): LeadField[] {
  return config.leadFields.filter((f) => f.stage === 'primary');
}

export function secondaryFields(config: QuestionnaireConfig): LeadField[] {
  return config.leadFields.filter((f) => f.stage === 'secondary');
}
