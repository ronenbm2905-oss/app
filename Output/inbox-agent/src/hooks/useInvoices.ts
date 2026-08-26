// ============================================================================
// useInvoices.ts — מריץ את צינור החשבוניות ומחזיק את התוצאה.
//
// אותה תבנית כמו `useTriage`: הריצה טהורה ודטרמיניסטית, ולכן `useMemo` בלי
// תלויות הוא נכון. מה שנשמר בין רענונים הוא **רק מזהים** של חשבוניות שסומנו
// כנבדקו — לא ספק, לא סכום, לא שם קובץ.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { mergedInbox } from '../fixtures';
import { runInvoicePipeline, type InvoiceRunResult } from '../utils/invoicePipeline';
import { hydrateLedger } from '../utils/pipeline';
import { STORAGE_KEYS } from '../constants';
import type { Invoice } from '../../shared/types';

function loadReviewed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.reviewedInvoices);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function persistReviewed(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.reviewedInvoices, JSON.stringify([...ids]));
  } catch {
    /* מכסה מלאה — הסימון פשוט לא ישרוד רענון. */
  }
}

export interface UseInvoices {
  result: InvoiceRunResult;
  invoices: Invoice[];
  loading: boolean;
  canEdit: boolean;
  toggleReviewed: (id: string) => void;
}

export function useInvoices(): UseInvoices {
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set<string>());
  const [loading, setLoading] = useState(true);

  const result = useMemo<InvoiceRunResult>(() => {
    const merged = mergedInbox();
    const senders = hydrateLedger(merged.senders);
    return runInvoicePipeline(merged.messages, {
      triage: {
        senders,
        sentAddresses: merged.sentAddresses ?? [],
        signalThreadIds: merged.signalThreadIds ?? [],
        userRules: merged.userRules ?? [],
      },
      senders,
    });
  }, []);

  useEffect(() => {
    setReviewed(loadReviewed());
    setLoading(false);
  }, []);

  const toggleReviewed = useCallback((id: string) => {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistReviewed(next);
      return next;
    });
  }, []);

  const invoices = useMemo(
    () => result.invoices.map((inv) => (reviewed.has(inv.id) ? { ...inv, reviewed: true } : inv)),
    [result.invoices, reviewed],
  );

  return { result, invoices, loading, canEdit: true, toggleReviewed };
}
