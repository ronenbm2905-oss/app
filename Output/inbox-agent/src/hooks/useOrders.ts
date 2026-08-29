// ============================================================================
// useOrders.ts — מריץ את צינור ההזמנות ומחזיק את מצב הסימונים.
//
// ---------------------------------------------------------------------------
// ★ מה נשמר ב-localStorage, ולמה זה כל כך מעט
// ---------------------------------------------------------------------------
// **מזהה הודעה + חותמת זמן.** זהו. אין שם, אין טלפון, אין כתובת, אין סכום.
//
// זו לא קמצנות אלא מבנה: אילו היינו שומרים את הכרטיס המוכן, היה נוצר **עותק
// שני של אותן כתובות מגורים** — כזה שלא יושב ב-`orders`, שלא עובר את
// `applyRetention`, ושאף אחד לא יזכור למחוק. סקירת עדי סימנה בדיוק את זה
// כמלכודת המחיקה: מוחקים את המקור ונשאר עותק.
//
// כאן זה בלתי אפשרי מבנית: כל פרט מפוענח מחדש מההודעה בכל טעינה, ועובר את
// המדיניות בדרך. הדבר היחיד ששורד רענון הוא "ההזמנה הזאת יצאה, בתאריך הזה".
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { orderMessages, SEEDED_SHIPMENTS } from '../fixtures';
import { runOrderPipeline, type OrderRunResult, type ShipmentMark } from '../utils/orderPipeline';
import { matchesDataSubject } from '../../shared/lib/orderRetention';
import { STORAGE_KEYS } from '../constants';

type Shipments = Record<string, ShipmentMark>;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* מכסה מלאה — הסימון פשוט לא ישרוד רענון. */
  }
}

export interface UseOrders {
  result: OrderRunResult;
  loading: boolean;
  canEdit: boolean;
  /** סימון "נשלח" / ביטולו. הפיכות היא הבקרה. */
  toggleShipped: (messageId: string) => void;
  /** ★ מחיקה מיידית לבקשת לקוחה. מחזירה משפט להצגה. */
  purgeForDataSubject: (query: string) => string;
}

export function useOrders(): UseOrders {
  const [shipments, setShipments] = useState<Shipments>({});
  const [manuallyPurgedIds, setManuallyPurgedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ★ ה-fixture מזריע שתי הזמנות שכבר יצאו, כדי שמסלול המחיקה יהיה גלוי
    // על המסך ולא רק במבחן. סימון אמיתי של המשתמשת גובר עליו.
    const seeded = loadJson<Shipments>(STORAGE_KEYS.shippedOrders, {});
    setShipments({ ...SEEDED_SHIPMENTS, ...seeded });
    setManuallyPurgedIds(loadJson<string[]>(STORAGE_KEYS.purgedOrders, []));
    setLoading(false);
  }, []);

  const result = useMemo(
    () => runOrderPipeline(orderMessages, { shipments, manuallyPurgedIds }),
    [shipments, manuallyPurgedIds],
  );

  const toggleShipped = useCallback((messageId: string) => {
    setShipments((prev) => {
      const next = { ...prev };
      if (next[messageId]) delete next[messageId];
      else next[messageId] = { shippedAt: new Date().toISOString() };
      saveJson(STORAGE_KEYS.shippedOrders, next);
      return next;
    });
  }, []);

  /**
   * ★ מחיקה לפי בקשת לקוחה.
   *
   * ההתאמה נעשית על ההזמנות **המפוענחות בזיכרון**, והמזהים בלבד נשמרים.
   * כלומר גם הפעולה הזאת לא מייצרת עותק: מה שנשמר הוא "אל תציג את זה", ולא
   * "מי זה היה".
   */
  const purgeForDataSubject = useCallback(
    (query: string): string => {
      const q = String(query ?? '').trim();
      if (!q) return 'צריך למלא מייל או שם מלא כדי שאדע מה למחוק';

      const matched = result.orders.filter((o) => matchesDataSubject(o, q)).map((o) => o.id);
      if (matched.length === 0) {
        return 'לא מצאתי הזמנה עם המייל או השם הזה. אם היא מלפני חצי שנה, ייתכן שהפרטים כבר נמחקו מעצמם';
      }

      setManuallyPurgedIds((prev) => {
        const next = Array.from(new Set([...prev, ...matched]));
        saveJson(STORAGE_KEYS.purgedOrders, next);
        return next;
      });

      return matched.length === 1
        ? 'מחקתי את פרטי המשלוח בהזמנה אחת. נשארו התאריך, המוצר, הכמות והסכום'
        : `מחקתי את פרטי המשלוח ב-${matched.length} הזמנות. נשארו התאריך, המוצר, הכמות והסכום`;
    },
    [result.orders],
  );

  return { result, loading, canEdit: true, toggleShipped, purgeForDataSubject };
}
