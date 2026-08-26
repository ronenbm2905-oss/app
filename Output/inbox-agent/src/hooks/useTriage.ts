// ============================================================================
// useTriage.ts — מריץ את הצינור על ה-fixtures ומחזיק את התוצאה.
//
// ה-fixtures מיובאים סטטית (`resolveJsonModule`) ולא נטענים ברשת: פרוסה 0
// חייבת לרוץ בלי שום בקשת רשת, וזה כולל `fetch` לקובץ מקומי.
//
// מה שכן נשמר בין רענונים: **רק** אילו פריטים סומנו כטופלו — מזהים בלבד.
// לא הנושא, לא השולח, לא הסיכום. הפריטים עצמם נבנים מחדש מה-fixture בכל
// טעינה, ולכן מחיקת ה-localStorage לא משאירה שריד של תוכן מייל.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import fixtureJson from '../fixtures/inbox.sample.json';
import { runPipeline, type InboxFixture, type PipelineResult } from '../utils/pipeline';
import { EMPTY_ITEMS, EMPTY_STATS, STORAGE_KEYS } from '../constants';
import { isClassified, type TriageItem } from '../../shared/types';

function loadHandled(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.handledItems);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function persistHandled(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.handledItems, JSON.stringify([...ids]));
  } catch {
    /* מכסה מלאה — הסימון פשוט לא ישרוד רענון. */
  }
}

export interface UseTriage {
  items: TriageItem[];
  stats: PipelineResult['stats'];
  bodies: Map<string, string>;
  loading: boolean;
  canEdit: boolean;
  toggleHandled: (id: string) => void;
}

export function useTriage(): UseTriage {
  const [handled, setHandled] = useState<Set<string>>(() => new Set<string>());
  const [loading, setLoading] = useState(true);

  // הריצה עצמה טהורה ודטרמיניסטית, ולכן `useMemo` בלי תלויות הוא נכון: אותו
  // fixture ייתן תמיד אותה תוצאה, ואין טעם להריץ את המסנן בכל רינדור.
  const result = useMemo<PipelineResult>(
    () => runPipeline(fixtureJson as unknown as InboxFixture),
    [],
  );

  useEffect(() => {
    setHandled(loadHandled());
    setLoading(false);
  }, []);

  const toggleHandled = useCallback((id: string) => {
    setHandled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistHandled(next);
      return next;
    });
  }, []);

  const items = useMemo(
    () =>
      result.items.length === 0
        ? EMPTY_ITEMS
        : result.items.map((it) =>
            // רק פריט מסווג יכול להיות "טופל". פריט רעש אינו נושא `handled`
            // בכלל — הוא לא ממתין לכלום, ואין מה לסמן עליו.
            //
            // הגרסה הראשונה כאן פרשה `{ ...it, handled: true }` על כל פריט,
            // כולל רעש. הקומפיילר עצר את זה: בדיוק הכתיבה השקטה של שדה לפריט
            // רעש שה-union נועד למנוע, ובמקרה הזה הוא תפס אותה תוך דקה.
            isClassified(it) && handled.has(it.id) ? { ...it, handled: true } : it,
          ),
    [result.items, handled],
  );

  return {
    items,
    stats: result.stats ?? EMPTY_STATS,
    bodies: result.bodies,
    loading,
    canEdit: true,
    toggleHandled,
  };
}
