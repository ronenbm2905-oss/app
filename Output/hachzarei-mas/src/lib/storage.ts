import type { FormSlug, QuestionId } from '@shared/types/questionnaire';

/**
 * שמירת התקדמות ב-sessionStorage, כדי שרענון באמצע השאלון לא ימחק אותה.
 *
 * ⚠️ **תשובות בלבד.** שם, טלפון ודוא"ל הם PII ואין להם מה לחפש באחסון
 * הדפדפן — גרסה 1.0 שמרה את כל ה-EngineState כולל leadData. ראה §6.2 באפיון.
 */

interface StoredProgress {
  answers: Record<QuestionId, string>;
  startedAt: number;
}

const key = (slug: FormSlug) => `qz:${slug}`;

export function loadProgress(slug: FormSlug): StoredProgress | null {
  try {
    const raw = sessionStorage.getItem(key(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProgress;
    if (!parsed || typeof parsed !== 'object' || !parsed.answers) return null;
    return { answers: parsed.answers, startedAt: parsed.startedAt || Date.now() };
  } catch {
    return null;
  }
}

export function saveProgress(slug: FormSlug, progress: StoredProgress): void {
  try {
    sessionStorage.setItem(key(slug), JSON.stringify(progress));
  } catch {
    /* מצב פרטי / אחסון מלא — ההתקדמות פשוט לא נשמרת */
  }
}

export function clearProgress(slug: FormSlug): void {
  try {
    sessionStorage.removeItem(key(slug));
  } catch {
    /* ignore */
  }
}
