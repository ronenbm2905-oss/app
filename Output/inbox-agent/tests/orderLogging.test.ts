// ============================================================================
// orderLogging.test.ts — הבדיקה מסעיף 6 של סקירת עדי, גם כמבחן.
//
// היא רצה גם ב-`npm run build` (דרך `scripts/check-order-logging.mjs`) וגם
// כאן, ובכוונה בשני המקומות: מי שמריץ רק מבחנים יראה אותה, ומי שמריץ רק
// build יראה אותה. בקרה שקיימת רק בצינור אחד היא בקרה שאפשר לעקוף בטעות.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { findViolations, GUARDED_FILES } from '../scripts/check-order-logging.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('★ אין כתיבה ללוג במודול ההזמנות', () => {
  it('אף קובץ שנוגע בהזמנה מפוענחת לא מדפיס לקונסולה', () => {
    // האובייקט שהיה נכתב שם הוא שם, טלפון וכתובת מגורים של לקוחה.
    expect(findViolations(root)).toEqual([]);
  });

  it('רשימת הקבצים השמורים מכסה את כל המודול', () => {
    for (const f of [
      'shared/lib/orderParse.ts',
      'shared/lib/orderRetention.ts',
      'src/utils/orderPipeline.ts',
      'src/hooks/useOrders.ts',
      'src/components/OrdersView.tsx',
    ]) {
      expect(GUARDED_FILES).toContain(f);
    }
  });
});
