// ============================================================================
// usePlannedActions.ts — התוכנית של הסוכן + הנעיצות של בעלת העסק.
//
// ★ הנעיצה היא **ההחזרה**. מרגע שהיא לחצה "להשאיר", הפריט יוצא מרשימת
// הארכוב בכל ריצה עתידית — לא רק בפעם הזאת. זו הסיבה שהיא נשמרת ב-
// localStorage ולא ב-state: "החזרתי ומחר זה ירד שוב" הורס את האמון מהר
// יותר מארכוב שגוי אחד.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { mergedInbox, SEEDED_BRIEF_HISTORY } from '../fixtures';
import { buildPlan, type PlanResult } from '../utils/plannedActions';
import { hydrateLedger } from '../utils/pipeline';
import { STORAGE_KEYS } from '../constants';

function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pinnedItems);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function persistPinned(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.pinnedItems, JSON.stringify([...ids]));
  } catch {
    /* מכסה מלאה. */
  }
}

export interface UsePlannedActions {
  plan: PlanResult;
  pinned: ReadonlySet<string>;
  loading: boolean;
  canEdit: boolean;
  /** ★ "להשאיר" — לחיצה אחת, ולתמיד. */
  keepInInbox: (itemId: string) => void;
  /** ביטול הנעיצה, אם היא נעצה בטעות. */
  releaseItem: (itemId: string) => void;
}

export function usePlannedActions(): UsePlannedActions {
  const [pinned, setPinned] = useState<Set<string>>(() => new Set<string>());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPinned(loadPinned());
    setLoading(false);
  }, []);

  const plan = useMemo<PlanResult>(() => {
    const merged = mergedInbox();
    return buildPlan({
      messages: merged.messages,
      senders: hydrateLedger(merged.senders),
      sentAddresses: merged.sentAddresses,
      signalThreadIds: merged.signalThreadIds,
      briefHistory: SEEDED_BRIEF_HISTORY,
      pinnedIds: pinned,
    });
  }, [pinned]);

  const keepInInbox = useCallback((itemId: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      persistPinned(next);
      return next;
    });
  }, []);

  const releaseItem = useCallback((itemId: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      persistPinned(next);
      return next;
    });
  }, []);

  return { plan, pinned, loading, canEdit: true, keepInInbox, releaseItem };
}
