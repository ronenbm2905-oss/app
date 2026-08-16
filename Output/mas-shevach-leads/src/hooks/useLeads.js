// ============================================================================
// useLeads.js — שכבת הנתונים של הקונסולה.
//
// שני מימושים מאחורי ממשק אחד, לפי `isFirebaseConfigured`:
//   · מצב מקומי  — localStorage. **בדיקה בלבד**, בלי נתוני אדם אמיתי.
//   · מצב ענן    — onSnapshot לקריאה; **כל כתיבה עוברת ב-Cloud Function.**
//
// 🔴 למה אין כאן `updateDoc`: ה-rules קובעות `update, delete: if false` —
//    גם למשה (עדי R-1). דפדפן שנפרץ, או session גנוב, לא יכול לדרוס נתונים,
//    לזייף סטטוס או למחוק את המאגר. הוא יכול רק לקרוא. כל מוטציה עוברת
//    ב-callable שרצה ב-Admin SDK, מוגבלת-שדות ומתועדת ב-opsLog.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit as qLimit,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, isFirebaseConfigured } from "../firebase";
import { LEADS_COLLECTION, EMPTY_LEADS, LEAD_STATUS } from "../constants";
import { retentionClassFor, purgeAfterMillis } from "../utils/retention";

const LOCAL_KEY = "masShevachLeads.local.v1";
const PAGE_LIMIT = 500;

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : EMPTY_LEADS;
  } catch {
    return EMPTY_LEADS;
  }
}

function writeLocal(leads) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(leads));
  } catch (err) {
    console.error("[useLeads] כתיבה מקומית נכשלה", err);
  }
}

export function useLeads(user) {
  const [leads, setLeads] = useState(EMPTY_LEADS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // -- מצב מקומי ------------------------------------------------------------
  useEffect(() => {
    if (isFirebaseConfigured) return; // הענן מטופל ב-effect הנפרד
    setLeads(readLocal());
    setLoading(false);
  }, []);

  // -- מצב ענן --------------------------------------------------------------
  // ⚠️ ה-effect תלוי ב-`user?.uid` ולא ב-`[]`. זה הבאג שחוזר: onSnapshot
  //    שנרשם ב-mount רץ **לפני** שההתחברות הושלמה (`request.auth == null`),
  //    ה-rules חוסמות, מופיע "טעינה נכשלה" — ואין re-subscribe אחרי login.
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, LEADS_COLLECTION),
      orderBy("createdAt", "desc"),
      qLimit(PAGE_LIMIT)
    );

    return onSnapshot(
      q,
      (snap) => {
        setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("[useLeads] onSnapshot", err);
        setError(err);
        setLoading(false);
      }
    );
  }, [user?.uid]);

  // -- שינוי סטטוס ----------------------------------------------------------
  const setStatus = useCallback(
    async (leadId, status) => {
      setBusyId(leadId);
      try {
        if (!isFirebaseConfigured) {
          // מצב מקומי: מדמה את מה שה-Function עושה בענן, כולל מחיקת ה-PII
          // בסטטוסים שמחייבים מחיקה מיידית. כך המסך מתנהג זהה בשני המצבים.
          const next = readLocal().map((l) => {
            if (l.id !== leadId) return l;
            const merged = {
              ...l,
              status,
              lastContactAt:
                status === LEAD_STATUS.CONTACTED ? Date.now() : l.lastContactAt ?? null,
              contactAttempts:
                status === LEAD_STATUS.ATTEMPTED
                  ? (l.contactAttempts ?? 0) + 1
                  : l.contactAttempts ?? 0,
            };
            merged.retentionClass = retentionClassFor(merged);
            merged.purgeAfter = purgeAfterMillis(merged);
            if (status === LEAD_STATUS.REFUSED || status === LEAD_STATUS.CONVERTED) {
              delete merged.firstName;
              delete merged.phone;
              delete merged.email;
              merged.purgedAt = Date.now();
            }
            return merged;
          });
          writeLocal(next);
          setLeads(next);
          return { ok: true };
        }

        const fn = httpsCallable(functions, "setLeadStatus");
        await fn({ leadId, status });
        return { ok: true };
      } catch (err) {
        console.error("[useLeads] setStatus", err);
        setError(err);
        return { ok: false, error: err };
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  // -- ליד בדיקה, מצב מקומי בלבד --------------------------------------------
  // 🔴 מכוון: בענן אין לזה מקבילה. "אין ליד אמיתי עד ששער עדי נפתח", ולכן
  //    גם אין כלי שמזריק נתונים למאגר האמיתי. הנתונים כאן מומצאים לחלוטין.
  const addTestLead = useCallback(() => {
    if (isFirebaseConfigured) return;
    const n = readLocal().length + 1;
    const lead = {
      id: `local-${Date.now()}`,
      firstName: ["דנה", "יוסי", "מירי", "אבי"][n % 4],
      phone: `05${(n % 9) + 1}${String(1000000 + n * 7919).slice(0, 7)}`,
      email: n % 3 === 0 ? undefined : `test${n}@example.com`,
      screened: n % 4 !== 0,
      source: { policyVersion: "1.0-draft", utmSource: "google", utmMedium: "cpc" },
      createdAt: Date.now() - n * 36e5,
      status: LEAD_STATUS.NEW,
      retentionClass: "unanswered",
      contactAttempts: 0,
      lastContactAt: null,
    };
    lead.purgeAfter = purgeAfterMillis(lead);
    const next = [lead, ...readLocal()];
    writeLocal(next);
    setLeads(next);
  }, []);

  const clearLocal = useCallback(() => {
    if (isFirebaseConfigured) return;
    writeLocal([]);
    setLeads([]);
  }, []);

  const dueForPurgeCount = useMemo(
    () => leads.filter((l) => !l.purgedAt && (purgeAfterMillis(l) ?? Infinity) <= Date.now()).length,
    [leads]
  );

  return {
    leads,
    loading,
    error,
    busyId,
    setStatus,
    addTestLead,
    clearLocal,
    dueForPurgeCount,
    isLocal: !isFirebaseConfigured,
  };
}
