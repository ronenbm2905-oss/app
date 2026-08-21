/**
 * התוכניות והמחזורים של קבוצה — **שני מאזינים ויצירה עצלה אחת.**
 *
 * ```ts
 * query(collection(db, 'plans'),      where('teamId', '==', teamId))
 * query(collection(db, 'planCycles'), where('teamId', '==', teamId))
 * ```
 *
 * שוויון בודד בכל אחת, בלי `status`, בלי `orderBy` ובלי `where` שני — כלומר
 * **אפס אינדקסים מורכבים חדשים** (מלכודת 8 + `firebase deploy` חסום לסוכן).
 * "איזו תוכנית פעילה" ו"איזה מחזור הוא של השבוע הזה" מחושבים בלקוח
 * (`lib/plans.ts`), על קומץ מסמכים לעונה.
 *
 * ⚠️ שני דברים שקל להחמיץ כאן:
 *
 * 1. **ה-effect תלוי ב-`teamId` בלבד ורץ רק אחרי שיש פרופיל.** המסכים שמשתמשים
 *    בו נטענים אחרי שה-`AuthProvider` סיים; מאזין שנרשם לפני זה מקבל
 *    `PERMISSION_DENIED` מה-rules ומציג "טעינה נכשלה" בלי סיבה נראית לעין.
 *
 * 2. **היצירה העצלה רצה פעם אחת לכל (קבוצה, שבוע).** היא אידמפוטנטית ממילא
 *    (מזהה דטרמיניסטי + טרנזקציה), אבל בלי הנעילה כל רינדור היה מייצר קריאה
 *    לרשת. הנעילה מוחזקת ב-`ref` ולא ב-state — היא לא אמורה לגרום לרינדור.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getWeekKey } from '../lib/dates';
import { getOrCreateCurrentCycle } from '../lib/planAdmin';
import { activePlanFor, cycleForDate } from '../lib/plans';
import type { PlanCycle, PlanCycleDoc, PlanDoc, WeekStartDay } from '../types/types';
import type { LoadStatus } from './loadStatus';

export interface TeamPlanningState {
  status: LoadStatus;
  /** כל התוכניות של הקבוצה — כולל ארכיון, לתצוגת היסטוריה. */
  plans: PlanDoc[];
  cycles: PlanCycleDoc[];
  /** התוכנית שרצה עכשיו, או null (שבוע בלי יעדים — PRD §8.4). */
  activePlan: PlanDoc | null;
  /** המחזור של השבוע הנוכחי, או null כשעוד לא נפתח / אין תוכנית. */
  currentCycle: PlanCycleDoc | null;
  /** נכשלה **פתיחת** המחזור (להבדיל מטעינה שנכשלה). */
  cycleError: boolean;
}

interface PlanningSnapshot {
  teamId: string;
  plans: PlanDoc[] | null;
  cycles: PlanCycleDoc[] | null;
  failed: boolean;
}

const NO_PLANS: PlanDoc[] = [];
const NO_CYCLES: PlanCycleDoc[] = [];

export function useTeamPlanning(
  teamId: string | undefined,
  now: Date,
  weekStartDay: WeekStartDay = 0,
): TeamPlanningState {
  const [snapshotState, setSnapshotState] = useState<PlanningSnapshot | null>(null);
  const [cycleError, setCycleError] = useState(false);
  const ensuredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!teamId) return;

    const patch = (changes: Partial<Omit<PlanningSnapshot, 'teamId'>>) => {
      setSnapshotState((previous) =>
        previous && previous.teamId === teamId
          ? { ...previous, ...changes }
          : { teamId, plans: null, cycles: null, failed: false, ...changes },
      );
    };

    const unsubscribePlans = onSnapshot(
      query(collection(db, 'plans'), where('teamId', '==', teamId)),
      (snapshot) => {
        patch({
          plans: snapshot.docs.map((document) => ({
            ...(document.data() as PlanDoc),
            id: document.id,
          })),
        });
      },
      (error) => {
        console.error('[CoachTrack] טעינת התוכניות נכשלה', error);
        patch({ failed: true });
      },
    );

    const unsubscribeCycles = onSnapshot(
      query(collection(db, 'planCycles'), where('teamId', '==', teamId)),
      (snapshot) => {
        patch({
          cycles: snapshot.docs.map((document) => ({
            ...(document.data() as PlanCycle),
            id: document.id,
          })),
        });
      },
      (error) => {
        console.error('[CoachTrack] טעינת המחזורים נכשלה', error);
        patch({ failed: true });
      },
    );

    return () => {
      unsubscribePlans();
      unsubscribeCycles();
    };
  }, [teamId]);

  const fresh = teamId && snapshotState?.teamId === teamId ? snapshotState : null;
  const plans = fresh?.plans ?? NO_PLANS;
  const cycles = fresh?.cycles ?? NO_CYCLES;
  const ready = Boolean(fresh?.plans && fresh?.cycles) && !fresh?.failed;

  const activePlan = useMemo(() => activePlanFor(plans, now), [plans, now]);
  const currentCycle = useMemo(
    () => (teamId ? cycleForDate(cycles, teamId, now, weekStartDay) : null),
    [cycles, teamId, now, weekStartDay],
  );

  // יצירה עצלה: אין מחזור לשבוע הזה אבל יש תוכנית פעילה → פותחים אותו.
  // המאזין למעלה יביא אותו חזרה מעצמו, ולכן אין כאן setState עם התוצאה.
  useEffect(() => {
    if (!teamId || !ready || !activePlan || currentCycle) return;

    const lock = `${teamId}_${getWeekKey(now, weekStartDay)}`;
    if (ensuredRef.current === lock) return;
    ensuredRef.current = lock;

    getOrCreateCurrentCycle({ teamId, now, weekStartDay, plans }).catch((error: unknown) => {
      console.error('[CoachTrack] פתיחת המחזור השבועי נכשלה', error);
      setCycleError(true);
    });
  }, [teamId, ready, activePlan, currentCycle, now, weekStartDay, plans]);

  return {
    status: !fresh ? 'loading' : fresh.failed ? 'error' : ready ? 'ready' : 'loading',
    plans,
    cycles,
    activePlan,
    currentCycle,
    cycleError,
  };
}
