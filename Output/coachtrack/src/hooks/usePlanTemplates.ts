/**
 * תבניות התוכנית של הארגון.
 *
 * `query(collection(db, 'planTemplates'), where('orgId', '==', orgId))` — שוויון
 * בודד, בלי אינדקס מורכב. כלל הקריאה הוא `isCoach() && sameOrg(...)`, ולכן
 * השאילתה **חייבת** לשאת את `orgId` בעצמה (מלכודת 8).
 *
 * הסינון לפי `coachUid` לא נעשה כאן במכוון: תבנית היא נכס של המועדון, ומאמן
 * שני באותו ארגון אמור לראות את התבניות של הראשון. המחיקה, לעומת זאת, מוגבלת
 * ב-rules לבעלים בלבד — והמסך משקף את זה.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PlanTemplate, PlanTemplateDoc } from '../types/types';
import type { LoadStatus } from './loadStatus';

export interface PlanTemplatesState {
  status: LoadStatus;
  templates: PlanTemplateDoc[];
}

interface TemplatesSnapshot extends PlanTemplatesState {
  orgId: string;
}

const NO_TEMPLATES: PlanTemplateDoc[] = [];

export function usePlanTemplates(orgId: string | undefined): PlanTemplatesState {
  const [snapshotState, setSnapshotState] = useState<TemplatesSnapshot | null>(null);

  useEffect(() => {
    if (!orgId) return;

    return onSnapshot(
      query(collection(db, 'planTemplates'), where('orgId', '==', orgId)),
      (snapshot) => {
        setSnapshotState({
          orgId,
          status: 'ready',
          templates: snapshot.docs.map((document) => ({
            ...(document.data() as PlanTemplate),
            id: document.id,
          })),
        });
      },
      (error) => {
        console.error('[CoachTrack] טעינת התבניות נכשלה', error);
        setSnapshotState({ orgId, status: 'error', templates: [] });
      },
    );
  }, [orgId]);

  const fresh = orgId && snapshotState?.orgId === orgId ? snapshotState : null;
  const rawTemplates = fresh ? fresh.templates : NO_TEMPLATES;

  const templates = useMemo(
    () => [...rawTemplates].sort((a, b) => a.name.localeCompare(b.name, 'he')),
    [rawTemplates],
  );

  return { status: fresh ? fresh.status : 'loading', templates };
}
