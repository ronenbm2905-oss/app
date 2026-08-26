// ============================================================================
// proposal.ts — הצעות הסוכן, ממתינות לאישור אדם.
//
// חוק הברזל: **הסוכן מציע, לא מבצע.** כל תוצר LLM נוחת כאן ולא ב-`tasks/`.
// זה חוק הברזל של מאיה ("מכינה — לא שולחת"), וגם הלקח שנרשם ב-
// `Output/basketball-scheduler/docs/nightly-federation-sync.md`: תהליך רקע
// לא כותב לתוך מה שהמשתמש עורך. משימה נוצרת רק מ-`onCall` שהמשתמשת יזמה,
// ולכן היא תמיד נושאת `updatedBy: 'user'`.
//
// אוסף נפרד ולא שדה `pending` על המשימה: שדה היה מחייב כל שאילתה, כל תצוגה
// וכל מבחן לזכור לסנן אותו — ומי ששוכח מקבל הצעה שנראית כמו משימה מאושרת.
// ============================================================================

import type { TenantScoped, Timestamped } from './tenant';

export type ProposalKind =
  | 'task' // משימה שחולצה ממייל
  | 'reply' // טיוטת תשובה (פרוסה 4 — מוצגת להעתקה, לא נשלחת)
  | 'calendarConflict'; // שני הצדדים השתנו (פרוסה 3)

export type ProposalStatus = 'pending' | 'approved' | 'rejected';

interface ProposalFields extends Timestamped {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;

  /** פריט הטריאז' שהוליד את ההצעה. */
  sourceItemId: string | null;

  /** מה שהסוכן מציע. שדות חופשיים לפי `kind`. */
  payload: {
    title?: string;
    notes?: string;
    scheduledAt?: string | null;
    dueDate?: string | null;
    /** ל-`calendarConflict`: שתי הגרסאות נשמרות, אף אחת לא נדרסת בשקט. */
    appVersion?: unknown;
    calendarVersion?: unknown;
  };

  /**
   * הצעה שנולדה ממייל עם דגל בטיחות דלוק — הממשק מציג אותה אבל **בלי**
   * כפתורי פעולה מהירה. אישור דורש פתיחה מפורשת של המקור.
   */
  blockedQuickAction: boolean;
  modelId: string;
}

export type Proposal = TenantScoped<ProposalFields>;
