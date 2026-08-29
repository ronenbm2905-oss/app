// ============================================================================
// cloudScreens.test.tsx — שני המסכים החדשים, ומבחן השפה עליהם.
//
// אותו עיקרון כמו `screens.test.tsx`: המשתמשת היחידה של הכלי לא מבינה
// במחשוב, ומונח פנימי שדולף למסך גורם לה להפסיק לקרוא ולהתחיל לנחש.
// שכבת הענן מביאה איתה אוצר מילים שלם שאסור שיגיע למסך — `scope`, `token`,
// `OAuth`, `refresh` — **וגם את התרגומים המילוליים שלו לעברית**, שגרועים
// יותר כי הם *נראים* כמו עברית ואף אחד לא חושד בהם.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ConnectionBanner } from '../src/components/ConnectionBanner';
import { SupportModePanel } from '../src/components/SupportModePanel';
import { SUPPORT_MODE_OFF, enableSupportMode, type AccessLogEntry } from '../shared/lib/supportMode';

const NOW = new Date('2026-09-03T11:00:00.000Z');

const entries: AccessLogEntry[] = [
  {
    id: 'e1',
    at: '2026-09-03T11:20:00.000Z',
    actor: 'holder',
    action: 'orderContentOpened',
    targetKind: 'order',
    targetCount: 1,
    sourceMessageId: 'msg-101',
  },
];

const noop = async () => {};

const expiredHtml = renderToString(
  <ConnectionBanner state="expired" onConnect={() => {}} />,
);
const errorHtml = renderToString(<ConnectionBanner state="error" onConnect={() => {}} />);
const connectedHtml = renderToString(
  <ConnectionBanner state="connected" onConnect={() => {}} />,
);

const panelOffHtml = renderToString(
  <SupportModePanel
    state={SUPPORT_MODE_OFF}
    active={false}
    entries={entries}
    onToggle={noop}
    canToggle
  />,
);
const panelOnHtml = renderToString(
  <SupportModePanel
    state={enableSupportMode(NOW)}
    active
    entries={entries}
    onToggle={noop}
    canToggle
  />,
);

/**
 * ★ מילים אסורות — כולל התרגומים המילוליים.
 *
 * "אסימון רענון" ו"היקף הרשאה" הם התרגומים שנשמעים מקצועיים ואינם אומרים
 * כלום. הם ברשימה בדיוק כמו המקור האנגלי.
 */
const BANNED_WORDS = [
  'OAuth',
  'scope',
  'Scope',
  'token',
  'Token',
  'refresh',
  'grant',
  'Firestore',
  'אסימון',
  'טוקן',
  'היקף הרשאה',
  'רענון אסימון',
  'הרשאת גישה זמנית',
  'קוד שגיאה',
  'invalid_grant',
];

describe('★ באנר החיבור', () => {
  it('★★ "החיבור פג" אומר גם "שום דבר לא נמחק" — וגם מציג כפתור', () => {
    expect(expiredHtml).toContain('החיבור לגוגל פג');
    expect(expiredHtml).toContain('שום דבר לא נמחק');
    expect(expiredHtml).toContain('להתחבר מחדש');
  });

  it('★★ תקלה זמנית **אינה** מציגה כפתור — אין לה מה לעשות', () => {
    // כפתור כאן היה שולח אותה ללחוץ שוב ושוב על משהו שלא עוזר.
    expect(errorHtml).toContain('אין מה לעשות מצדך');
    expect(errorHtml).not.toContain('להתחבר מחדש');
  });

  it('מצב תקין אינו מציג שום דבר', () => {
    expect(connectedHtml).toBe('');
  });
});

describe('★★ פאנל מצב התמיכה', () => {
  it('כבוי: מסביר מה רונן רואה בלי המתג', () => {
    expect(panelOffHtml).toContain('רואה רק מספרים');
    expect(panelOffHtml).toContain('להדליק מצב תמיכה');
  });

  it('★★ דלוק: באנר גלוי, ונאמר שהוא נכבה לבד', () => {
    expect(panelOnHtml).toContain('מצב תמיכה דלוק');
    expect(panelOnHtml).toContain('נכבה לבד בסוף היום');
    expect(panelOnHtml).toContain('לכבות עכשיו');
  });

  it('★★★ המשפט שאסור שייעדר: המתג **מתעד ולא חוסם**', () => {
    // בלעדיו הפאנל טוען יותר ממה שהוא עושה. כתוב לה במסמך ההסכמה
    // "אין הגדרה שאפשר להדליק שתמנע ממנו את זה", והמסך חייב להסכים איתו.
    for (const html of [panelOffHtml, panelOnHtml]) {
      expect(html).toContain('מתעד');
      expect(html).toContain('לא חוסם');
      expect(html).toContain('אין הגדרה שאפשר להדליק שתמנע ממנו את זה');
    }
  });

  it('היומן מוצג בעברית ובלי מונחים', () => {
    expect(panelOffHtml).toContain('מה קרה עד עכשיו');
  });

  it('★ מבחן השפה — אף מונח טכני בשני המסכים', () => {
    for (const html of [expiredHtml, errorHtml, panelOffHtml, panelOnHtml]) {
      for (const word of BANNED_WORDS) {
        expect(html, `המילה "${word}" דלפה למסך`).not.toContain(word);
      }
    }
  });

  it('★ נגישות: `aria-pressed` על המתג, וגודל מגע 44px', () => {
    expect(panelOffHtml).toContain('aria-pressed="false"');
    expect(panelOnHtml).toContain('aria-pressed="true"');
    expect(panelOffHtml).toContain('min-h-[44px]');
  });
});
