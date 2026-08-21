/**
 * טסטים להערת המאמן.
 *
 * שני דברים שנבדקים כאן ואינם קוסמטיים: שהנתיב הוא **תת-קולקציה של הקבוצה**
 * (שם השחקן אינו רשאי לקרוא), ושהאורך המרבי זהה למה שכתוב ב-`firestore.rules`.
 * אם מישהו ישנה אחד מהם בלי השני, הכתיבה תיחסם בשרת בלי שהמסך יסביר למה.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  COACH_NOTE_MAX_LENGTH,
  coachNotePath,
  isCoachNoteDirty,
  normalizeCoachNote,
  validateCoachNote,
} from './coachNotes';

describe('coachNotePath', () => {
  it('ההערה יושבת תחת הקבוצה, ומזוהה לפי ה-uid של השחקן', () => {
    expect(coachNotePath('team_yeladim_a', 'uid_player')).toBe(
      'teams/team_yeladim_a/notes/uid_player',
    );
  });
});

describe('validateCoachNote', () => {
  it('טקסט רגיל וטקסט ריק — תקינים', () => {
    expect(validateCoachNote('')).toBeNull();
    expect(validateCoachNote('סוכם שיעלה לשלושה אימוני כוח.')).toBeNull();
  });

  it('בדיוק באורך המרבי — עובר; תו אחד מעבר — נחסם', () => {
    expect(validateCoachNote('א'.repeat(COACH_NOTE_MAX_LENGTH))).toBeNull();
    expect(validateCoachNote('א'.repeat(COACH_NOTE_MAX_LENGTH + 1))).toBe(
      'coach.player.note.errors.tooLong',
    );
  });

  it('אותו אורך מרבי אכוף גם ב-firestore.rules', () => {
    // מיתון הדגל של תיקון 13 חייב להיות בשני הצדדים. maxLength בשדה הוא נוחות;
    // הכלל הוא מה שמונע כתיבה של תיק אישי דרך הקונסולה.
    const rules = readFileSync('firestore.rules', 'utf8');
    expect(rules).toContain(`text.size() <= ${COACH_NOTE_MAX_LENGTH}`);
  });
});

describe('normalizeCoachNote / isCoachNoteDirty', () => {
  it('רווחים בקצוות אינם תוכן', () => {
    expect(normalizeCoachNote('  הערה  ')).toBe('הערה');
    expect(isCoachNoteDirty('הערה', '  הערה  ')).toBe(false);
  });

  it('שינוי אמיתי מזוהה, וכך גם ניקוי מלא', () => {
    expect(isCoachNoteDirty('הערה', 'הערה חדשה')).toBe(true);
    expect(isCoachNoteDirty('הערה', '')).toBe(true);
  });
});
