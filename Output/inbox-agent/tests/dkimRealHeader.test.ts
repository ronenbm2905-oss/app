// ============================================================================
// ★★ הכותרת האמיתית. לא fixture — הטקסט שגוגל כתבה על הודעה אמיתית של הספק.
//
// הבדיקות כאן נכתבו **אחרי** שהפרסר חסם 60 הזמנות אמיתיות של המשתמשת עם
// ההודעה "ככל הנראה מישהו מנסה להתחזות". כל המבחנים היו ירוקים באותו רגע,
// כי כולם רצו מול כותרת ש**אנחנו** המצאנו — ובה `header.d=`, שגוגל אינה
// כותבת. זהו ההבדל בין "נבדק" לבין "נבדק מול המציאות".
// ============================================================================

import { describe, expect, it } from 'vitest';
import { isOrderSignatureValid, parseDkim } from '../shared/lib/orderParse';

/** ★ הועתק מילה במילה מהודעה אמיתית של ספק הסליקה. אין לערוך. */
const REAL =
  'mx.google.com; dkim=pass header.i=@tranzila.com header.s=default header.b=Gw8Sjv7L; ' +
  'spf=pass (google.com: domain of pay@tranzila.com designates 80.244.167.10 as permitted sender) ' +
  'smtp.mailfrom=pay@tranzila.com; dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=tranzila.com';

describe('★★ הכותרת האמיתית של ספק הסליקה', () => {
  it('★★ header.i= — הכתיב שגוגל באמת כותבת, ושחסם 60 הזמנות', () => {
    const v = parseDkim(REAL);
    expect(v.present).toBe(true);
    expect(v.pass).toBe(true);
    expect(v.domain).toBe('tranzila.com');
    expect(isOrderSignatureValid(REAL)).toBe(true);
  });

  it('header.d= ממשיך לעבוד, והוא הקודם כשיש שניהם', () => {
    expect(parseDkim('x; dkim=pass header.d=tranzila.com').domain).toBe('tranzila.com');
    expect(
      parseDkim('x; dkim=pass header.d=tranzila.com header.i=@spoof.example').domain,
    ).toBe('tranzila.com');
  });

  it('★ דומיין אחר עדיין נדחה — התיקון לא החליש את הבדיקה', () => {
    expect(isOrderSignatureValid('mx.google.com; dkim=pass header.i=@spoof.example')).toBe(false);
    expect(isOrderSignatureValid('mx.google.com; dkim=fail header.i=@tranzila.com')).toBe(false);
    expect(isOrderSignatureValid('mx.google.com; spf=pass')).toBe(false);
  });

  it('★ תת-דומיין של הספק מתקבל; דומיין שרק מסתיים בשמו — לא', () => {
    expect(isOrderSignatureValid('x; dkim=pass header.i=@mail.tranzila.com')).toBe(true);
    expect(isOrderSignatureValid('x; dkim=pass header.i=@nottranzila.com')).toBe(false);
  });
});
