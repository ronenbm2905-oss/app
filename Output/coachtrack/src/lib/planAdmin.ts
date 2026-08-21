/**
 * CoachTrack — הכתיבות של התוכנית המתמשכת.
 *
 * הקובץ הזה **לא מחליט** — הוא מבצע. כל חישוב (איזו תוכנית פעילה, מה המזהה של
 * המחזור, אילו שדות משתנים בכל אחת משתי אפשרויות העריכה) יושב ב-`lib/plans.ts`
 * כפונקציה טהורה עם טסטים. כאן נשארו רק שלושה דברים: קריאה, טרנזקציה, ו-batch.
 *
 * ## שתי ההחלטות שנושאות את כל הקובץ
 *
 * **טרנזקציה ביצירה עצלה.** `getOrCreateCurrentCycle` נקראת מכל מכשיר שנכנס
 * בתחילת שבוע. עם `addDoc` שני שחקנים שנכנסים באותה שנייה היו יוצרים שני
 * מחזורים לאותו שבוע — והדיווחים היו מתפצלים בין שניהם, כלומר האחוזים על המסך
 * היו יורדים בחצי בלי שאף אחד יבין למה. המזהה נגזר (`teamId_weekKey`),
 * והטרנזקציה מוודאת שהיצירה השנייה **לא כותבת בכלל** אלא נופלת על המסמך הקיים.
 * (זה גם מה שמונע `PERMISSION_DENIED`: כתיבה על מסמך קיים נבחנת ב-rules ככלל
 * `update`, שמותר למאמן בלבד — שחקן שהיה מנצח בתחרות היה מקבל שגיאה.)
 *
 * **batch לשני המסמכים.** "עדכון מהשבוע הנוכחי" נוגע ב-`plans.items` וב-
 * `planCycles.itemsSnapshot`. אם אחד נכתב והשני לא, השבוע הנוכחי מציג יעד אחד
 * והתוכנית אומרת אחר. `writeBatch` הופך את השניים לכתיבה אחת — או ששניהם
 * עוברים, או ששניהם לא. אותו דבר במעבר "מהשבוע הבא": סגירת הישנה ופתיחת
 * החדשה יוצאות יחד, כדי שלא ייווצר שבוע בלי תוכנית או שבוע עם שתיים.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getWeekBounds, nowInstant, type DateInput } from './dates';
import {
  activePlanFor,
  buildCurrentWeekEdit,
  buildCycleData,
  buildNewPlan,
  buildNextWeekSwitch,
  buildTemplate,
  cycleIdForDate,
} from './plans';
import type { PlanCycle, PlanCycleDoc, PlanDoc, PlanItem, WeekStartDay } from '../types/types';

/* ------------------------------------------------------------------ */
/* קריאה                                                               */
/* ------------------------------------------------------------------ */

/**
 * כל התוכניות של הקבוצה.
 *
 * שוויון בודד על `teamId` — בלי `status` ובלי `orderBy`. שני שדות באותה שאילתה
 * היו דורשים אינדקס מורכב, ו-`firebase deploy` חסום לסוכן (מלכודת 8). הסינון
 * והבחירה נעשים בלקוח ב-`activePlanFor`, על קומץ תוכניות לעונה.
 */
export async function fetchTeamPlans(teamId: string): Promise<PlanDoc[]> {
  const snapshot = await getDocs(query(collection(db, 'plans'), where('teamId', '==', teamId)));
  return snapshot.docs.map((document) => ({ ...(document.data() as PlanDoc), id: document.id }));
}

/* ------------------------------------------------------------------ */
/* יצירה עצלה של המחזור השבועי                                         */
/* ------------------------------------------------------------------ */

export interface CurrentCycleOptions {
  teamId: string;
  /**
   * הרגע שלפיו נקבע השבוע. **מוזרק ולא נלקח מהשעון** — כך אפשר לבדוק בקוד
   * מעבר שבוע (קריטריון הסיום של שלב 3) בלי לגעת בשעון המערכת.
   */
  now?: DateInput;
  weekStartDay?: WeekStartDay;
  /** תוכניות שכבר נטענו במסך. חוסך שאילתה — ולא משנה את התוצאה. */
  plans?: readonly PlanDoc[];
}

/**
 * המחזור של השבוע הזה, אם הוא קיים — **בשאילתה ולא ב-`getDoc`**.
 *
 * ⚠️ זו לא בחירה סגנונית. `getDoc` על מסמך **שאינו קיים** מוחזר כ-
 * `PERMISSION_DENIED`: הכלל הוא `canSeeTeam(resource.data.teamId)`, ובמסמך חסר
 * `resource` הוא null — כל נגיעה ב-`resource.data` מפילה את ההערכה ל-deny.
 * אומת מול המסד החי (21.8.2026): `getDoc('planCycles/<לא קיים>')` ⛔,
 * ואילו `where('teamId','==',teamId)` ✅ ומחזירה רשימה ריקה.
 *
 * כלומר בדיוק השאלה שהיצירה העצלה **חייבת** לשאול — "האם כבר נפתח מחזור
 * לשבוע הזה?" — היא השאלה שאסור לשאול ב-`getDoc`. זו גם הסיבה שאין כאן
 * `runTransaction`: `transaction.get` הוא אותו `get` ונחסם באותה צורה.
 */
async function findCycle(teamId: string, cycleId: string): Promise<PlanCycleDoc | null> {
  const snapshot = await getDocs(
    query(collection(db, 'planCycles'), where('teamId', '==', teamId)),
  );
  const found = snapshot.docs.find((document) => document.id === cycleId);
  return found ? { ...(found.data() as PlanCycle), id: found.id } : null;
}

/**
 * מחזיר את המחזור של השבוע הנוכחי, ופותח אותו אם עוד לא קיים.
 *
 * **אין תוכנית פעילה → מחזיר `null` ולא יוצר מחזור** (PRD §8.4). זה לא מקרה
 * קצה תיאורטי: שבוע חופשה הוא בדיוק "אין תוכנית פעילה", ומחזור ריק היה מציג
 * לשחקן 0% במקום "אין תוכנית לשבוע זה".
 *
 * **המרוץ נסגר על ידי המזהה, לא על ידי נעילה.** המזהה נגזר
 * (`${teamId}_${weekKey}`), ולכן שני מכשירים שנכנסים באותה שנייה מכוונים
 * לאותו מסמך: או שהשני כותב עליו את אותו תוכן בדיוק, או — אם הוא שחקן —
 * נחסם, כי כתיבה על מסמך קיים נבחנת ככלל `update` שמותר למאמן בלבד. שני
 * המצבים תקינים, ובשניהם התוצאה היא **מחזור אחד** לשבוע. מה שאסור לקרות זה
 * להציג לשחקן "טעינה נכשלה" בגלל שהוא הפסיד במרוץ — ולכן החסימה נבלעת רק
 * אחרי שווידאנו שהמחזור אכן שם.
 */
export async function getOrCreateCurrentCycle({
  teamId,
  now = nowInstant(),
  weekStartDay = 0,
  plans,
}: CurrentCycleOptions): Promise<PlanCycleDoc | null> {
  const cycleId = cycleIdForDate(teamId, now, weekStartDay);

  const existing = await findCycle(teamId, cycleId);
  if (existing) return existing;

  const candidates = plans ?? (await fetchTeamPlans(teamId));
  const plan = activePlanFor(candidates, now);
  if (!plan) return null;

  const { data } = buildCycleData({ plan, now, createdAt: serverTimestamp(), weekStartDay });

  try {
    await setDoc(doc(db, 'planCycles', cycleId), data);
  } catch (error) {
    // הפסדנו במרוץ? אז המסמך כבר קיים וזה בסדר גמור. לא קיים — זו שגיאה אמיתית.
    const raced = await findCycle(teamId, cycleId);
    if (!raced) throw error;
    return raced;
  }

  return findCycle(teamId, cycleId);
}

/* ------------------------------------------------------------------ */
/* פרסום ועדכון                                                        */
/* ------------------------------------------------------------------ */

export interface PublishPlanInput {
  teamId: string;
  orgId: string;
  coachUid: string;
  items: readonly PlanItem[];
  now?: DateInput;
  weekStartDay?: WeekStartDay;
}

/**
 * פרסום תוכנית חדשה — והמחזור של השבוע הנוכחי נפתח מיד אחריה.
 *
 * פתיחת המחזור כאן ולא "כשמישהו ייכנס" היא נוחות בלבד: היא ממילא עצלה
 * ואידמפוטנטית, אבל בלעדיה המאמן היה מפרסם תוכנית ורואה מסך שאומר שאין עדיין
 * מחזור לשבוע הזה.
 */
export async function publishPlan({
  teamId,
  orgId,
  coachUid,
  items,
  now = nowInstant(),
  weekStartDay = 0,
}: PublishPlanInput): Promise<{ planId: string; cycleId: string | null }> {
  const planRef = doc(collection(db, 'plans'));
  const planData = buildNewPlan({
    teamId,
    orgId,
    coachUid,
    items,
    now,
    createdAt: serverTimestamp(),
    weekStartDay,
  });

  await setDoc(planRef, planData);

  // המסמך נכתב זה עתה ו-`createdAt` שלו עוד לא חזר מהשרת. `buildCycleData`
  // משתמש רק ב-id/teamId/orgId/items, ולכן הערך שנשתל כאן אינו נקרא לעולם.
  const plan: PlanDoc = {
    id: planRef.id,
    teamId,
    orgId,
    status: 'active',
    effectiveFrom: planData.effectiveFrom,
    effectiveTo: null,
    createdBy: coachUid,
    createdAt: Timestamp.fromMillis(0),
    items: planData.items,
  };

  const cycle = await getOrCreateCurrentCycle({ teamId, now, weekStartDay, plans: [plan] });
  return { planId: planRef.id, cycleId: cycle?.id ?? null };
}

/**
 * "מהשבוע הנוכחי" — היעדים החדשים חלים גם על השבוע שכבר רץ.
 *
 * שני מסמכים, batch אחד. אם אין עדיין מחזור לשבוע הזה (למשל אף אחד לא נכנס),
 * מתעדכנת התוכנית בלבד — והמחזור ייפתח בהמשך ממילא עם היעדים החדשים.
 */
export async function updatePlanCurrentWeek(
  plan: PlanDoc,
  cycle: PlanCycleDoc | null,
  items: readonly PlanItem[],
): Promise<void> {
  const { planUpdate, cycleUpdate } = buildCurrentWeekEdit(cycle, items);

  const batch = writeBatch(db);
  batch.update(doc(db, 'plans', plan.id), planUpdate);
  if (cycleUpdate) {
    batch.update(doc(db, 'planCycles', cycleUpdate.cycleId), {
      itemsSnapshot: cycleUpdate.itemsSnapshot,
    });
  }
  await batch.commit();
}

/**
 * "מהשבוע הבא" — השבוע הנוכחי נשאר בדיוק כמו שהוא.
 *
 * ⚠️ הסדר כאן הוא לא שרירותי: **קודם מוודאים שהמחזור של השבוע הנוכחי קיים**,
 * ורק אז סוגרים את התוכנית. אחרת נוצר חלון שבו התוכנית כבר `archived`, המחזור
 * של השבוע הנוכחי עוד לא נפתח, ו-`firestore.rules` חוסמים את פתיחתו
 * (`plan.status == 'active'`) — כלומר השבוע שאמור היה "לא לזוז" היה נמחק.
 */
export async function switchPlanNextWeek(
  plan: PlanDoc,
  items: readonly PlanItem[],
  now: DateInput = nowInstant(),
  weekStartDay: WeekStartDay = 0,
): Promise<{ planId: string }> {
  await getOrCreateCurrentCycle({ teamId: plan.teamId, now, weekStartDay, plans: [plan] });

  const { closeUpdate, nextPlan } = buildNextWeekSwitch({
    plan,
    items,
    now,
    createdAt: serverTimestamp(),
    weekStartDay,
  });

  const nextRef = doc(collection(db, 'plans'));
  const batch = writeBatch(db);
  batch.update(doc(db, 'plans', closeUpdate.planId), {
    status: closeUpdate.status,
    effectiveTo: closeUpdate.effectiveTo,
  });
  batch.set(nextRef, nextPlan);
  await batch.commit();

  return { planId: nextRef.id };
}

/**
 * הפסקת התוכנית מסוף השבוע הנוכחי — "שבוע בלי יעדים" (PRD §8.4, חופשות).
 *
 * אין מנגנון "שבוע מושהה" ב-MVP; הדרך היחידה היא להסיר את התוכנית הפעילה.
 * השבוע הנוכחי נשאר שלם, ומהשבוע הבא פשוט לא ייפתח מחזור.
 */
export async function stopPlan(
  plan: PlanDoc,
  now: DateInput = nowInstant(),
  weekStartDay: WeekStartDay = 0,
): Promise<void> {
  const { weekEnd } = getWeekBounds(now, weekStartDay);
  await updateDoc(doc(db, 'plans', plan.id), {
    status: 'archived',
    effectiveTo: Timestamp.fromDate(weekEnd),
  });
}

/* ------------------------------------------------------------------ */
/* תבניות                                                              */
/* ------------------------------------------------------------------ */

export async function savePlanTemplate(
  name: string,
  items: readonly PlanItem[],
  orgId: string,
  coachUid: string,
): Promise<string> {
  const ref = doc(collection(db, 'planTemplates'));
  await setDoc(ref, buildTemplate(name, items, orgId, coachUid));
  return ref.id;
}

/** תבנית היא נוחות ולא היסטוריה — כאן מחיקה אמיתית מותרת (כך גם ב-rules). */
export async function deletePlanTemplate(templateId: string): Promise<void> {
  await deleteDoc(doc(db, 'planTemplates', templateId));
}
