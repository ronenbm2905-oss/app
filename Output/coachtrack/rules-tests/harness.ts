/**
 * תשתית לבדיקת firestore.rules מול האמולטור.
 *
 * למה הקובץ הזה קיים: בדיקות הכללים של שלב 1 נעשו ידנית ולא נשאר מהן דבר.
 * בדיקה שאי אפשר להריץ מחדש אינה בדיקה — היא זיכרון. הבאג B2 (מאמן שמקדם
 * שחקן ל-admin) שרד בדיוק בגלל זה: מה שנבדק ידנית היה הסלמה **עצמית**, ולא
 * נשאר קובץ שאפשר להריץ שוב עם מקרה נוסף.
 *
 * הנתונים כאן הם **שני ארגונים** ולא אחד, למרות שה-MVP הוא ארגון יחיד: רוב
 * כללי הבידוד (sameOrg) לא ניתנים לבדיקה בכלל כשיש ארגון אחד.
 */

import { readFileSync } from 'node:fs';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

export const ORG_A = 'org_a';
export const ORG_B = 'org_b';

export const TEAM_A1 = 'team_a1';
export const TEAM_A2 = 'team_a2';
export const TEAM_B = 'team_b';

/** המשתמשים שכל הבדיקות מתחזות אליהם. */
export const U = {
  /** מאמן של team_a1 בארגון א. */
  coachA: 'uid_coach_a',
  /** מאמן של team_a2 — אותו ארגון, קבוצה אחרת. */
  coachA2: 'uid_coach_a2',
  adminA: 'uid_admin_a',
  playerA1: 'uid_player_a1',
  playerA1b: 'uid_player_a1b',
  playerA2: 'uid_player_a2',
  coachB: 'uid_coach_b',
  playerB: 'uid_player_b',
  /** מאמן בארגון א עם active: false. */
  inactiveCoach: 'uid_inactive_coach',
  /** שחקן מושבת — הוא זה שיכול להרוויח מהפעלה עצמית מחדש. */
  inactivePlayer: 'uid_inactive_player',
  /** מחובר ל-Auth אבל אין לו מסמך users — מלכודת 5. */
  ghost: 'uid_ghost',
} as const;

export const PLAN_A1 = 'plan_a1';
/** תוכנית עם **שני** פריטים — בלעדיה אי אפשר לבדוק שסדר המערך נחשב. */
export const PLAN_A1_TWO = 'plan_a1_two';
/** תוכנית בארכיון — יצירת מחזור שמפנה אליה חייבת להיחסם (PRD §8.4). */
export const PLAN_A1_ARCHIVED = 'plan_a1_archived';
export const CYCLE_A1 = 'cycle_a1';
export const EX_GLOBAL = 'ex_global';
export const EX_ORG_A = 'ex_org_a';
export const EX_ORG_B = 'ex_org_b';
export const ENTRY_FRESH = 'entry_fresh';
export const ENTRY_OLD = 'entry_old';
export const ENTRY_A2 = 'entry_a2';
/** דיווח בן חודשיים — מחוץ לכל חלון. מאמן חייב להיות מסוגל לגעת בו בכל זאת. */
export const ENTRY_ANCIENT = 'entry_ancient';
export const TEMPLATE_A = 'template_a';
export const SUMMARY_A1 = 'summary_a1';

const DAY_MS = 24 * 60 * 60 * 1000;

/** פריטי התוכנית. planCycles.create דורש התאמה מדויקת מולם. */
export const PLAN_ITEMS = [
  {
    exerciseId: EX_GLOBAL,
    exerciseName: 'זריקות טכניקה מקרוב',
    unit: 'count',
    target: 300,
    notes: '',
  },
];

/** פריטי התוכנית הדו-פריטית. הסדר כאן הוא חלק מהבדיקה. */
export const PLAN_ITEMS_TWO = [
  PLAN_ITEMS[0],
  {
    exerciseId: EX_ORG_A,
    exerciseName: 'חיזוק ליבה',
    unit: 'minutes',
    target: 60,
    notes: 'שלוש פעמים בשבוע',
  },
];

export function daysAgo(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * DAY_MS);
}

export function daysAhead(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + days * DAY_MS);
}

/**
 * מרים סביבת בדיקה מול האמולטור.
 *
 * הכתובת נלקחת מ-FIRESTORE_EMULATOR_HOST ש-emulators:exec מגדיר, עם נפילה
 * אחורה לברירת המחדל שב-firebase.json — כדי שאפשר יהיה להריץ גם מול אמולטור
 * שהורם ידנית בטרמינל אחר.
 */
export async function createTestEnv(): Promise<RulesTestEnvironment> {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');

  return initializeTestEnvironment({
    projectId: 'coachtrack-rules-test',
    firestore: {
      // COACHTRACK_RULES_FILE מאפשר להריץ את אותה חבילת בדיקות מול גרסה אחרת של
      // הכללים — כך בודקים שהבדיקה באמת תופסת את הבאג שהיא מתיימרת לתפוס.
      rules: readFileSync(process.env.COACHTRACK_RULES_FILE ?? 'firestore.rules', 'utf8'),
      host,
      port: Number(port),
    },
  });
}

function userDoc(
  role: 'admin' | 'coach' | 'player',
  orgId: string,
  teamIds: string[],
  overrides: Record<string, unknown> = {},
) {
  return {
    role,
    orgId,
    displayName: 'בדיקה א.',
    username: 'tester',
    teamIds,
    active: true,
    mustChangePassword: false,
    createdAt: daysAgo(30),
    ...overrides,
  };
}

/** מסמך דיווח תקין. משמש גם כזרע וגם כבסיס לניסיונות כתיבה. */
export function entryData(overrides: Record<string, unknown> = {}) {
  return {
    playerUid: U.playerA1,
    teamId: TEAM_A1,
    orgId: ORG_A,
    cycleId: CYCLE_A1,
    exerciseId: EX_GLOBAL,
    amount: 50,
    successAmount: null,
    date: daysAgo(1),
    note: '',
    createdAt: daysAgo(1),
    createdBy: U.playerA1,
    deleted: false,
    ...overrides,
  };
}

/** מסמך תרגיל תקין. */
export function exerciseData(overrides: Record<string, unknown> = {}) {
  return {
    scope: 'org',
    orgId: ORG_A,
    name: 'תרגיל',
    category: 'כושר',
    unit: 'minutes',
    description: '',
    videoUrl: null,
    tracksSuccess: false,
    successCapable: false,
    defaultTargets: {},
    active: true,
    ...overrides,
  };
}

/**
 * מאפס את המסד וזורע מצב התחלתי זהה לכל בדיקה.
 * הזריעה עוקפת את הכללים (withSecurityRulesDisabled) — אחרת אי אפשר היה
 * ליצור את המצב שהכללים אמורים להגן עליו.
 */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.clearFirestore();

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    const put = (path: string, data: Record<string, unknown>) => setDoc(doc(db, path), data);

    await Promise.all([
      put(`organizations/${ORG_A}`, {
        name: 'מועדון א',
        createdAt: daysAgo(60),
        ownerUid: U.adminA,
        settings: { timezone: 'Asia/Jerusalem', weekStartDay: 0 },
      }),
      put(`organizations/${ORG_B}`, {
        name: 'מועדון ב',
        createdAt: daysAgo(60),
        ownerUid: 'someone_else',
        settings: { timezone: 'Asia/Jerusalem', weekStartDay: 0 },
      }),

      put(`users/${U.coachA}`, userDoc('coach', ORG_A, [TEAM_A1], { username: 'coach_a' })),
      put(`users/${U.coachA2}`, userDoc('coach', ORG_A, [TEAM_A2], { username: 'coach_a2' })),
      put(`users/${U.adminA}`, userDoc('admin', ORG_A, [], { username: 'admin_a' })),
      put(`users/${U.playerA1}`, userDoc('player', ORG_A, [TEAM_A1], { username: 'player_a1' })),
      put(`users/${U.playerA1b}`, userDoc('player', ORG_A, [TEAM_A1], { username: 'player_a1b' })),
      put(`users/${U.playerA2}`, userDoc('player', ORG_A, [TEAM_A2], { username: 'player_a2' })),
      put(`users/${U.coachB}`, userDoc('coach', ORG_B, [TEAM_B], { username: 'coach_b' })),
      put(`users/${U.playerB}`, userDoc('player', ORG_B, [TEAM_B], { username: 'player_b' })),
      put(
        `users/${U.inactiveCoach}`,
        userDoc('coach', ORG_A, [TEAM_A1], { username: 'inactive', active: false }),
      ),

      put(
        `users/${U.inactivePlayer}`,
        userDoc('player', ORG_A, [TEAM_A1], { username: 'inactive_player', active: false }),
      ),

      put(`teams/${TEAM_A1}`, {
        orgId: ORG_A,
        coachUid: U.coachA,
        name: 'ילדים א',
        season: '2026',
        active: true,
        settings: { leaderboardEnabled: false, streakThreshold: 80, weekStartDay: 0 },
      }),
      put(`teams/${TEAM_A2}`, {
        orgId: ORG_A,
        coachUid: U.coachA2,
        name: 'ילדים ב',
        season: '2026',
        active: true,
        settings: { leaderboardEnabled: false, streakThreshold: 80, weekStartDay: 0 },
      }),
      put(`teams/${TEAM_B}`, {
        orgId: ORG_B,
        coachUid: U.coachB,
        name: 'קבוצה של מועדון ב',
        season: '2026',
        active: true,
        settings: { leaderboardEnabled: false, streakThreshold: 80, weekStartDay: 0 },
      }),

      put(`exercises/${EX_GLOBAL}`, exerciseData({ scope: 'global', orgId: null, name: 'זריקות' })),
      put(`exercises/${EX_ORG_A}`, exerciseData({ orgId: ORG_A })),
      put(`exercises/${EX_ORG_B}`, exerciseData({ orgId: ORG_B })),

      put(`plans/${PLAN_A1}`, {
        teamId: TEAM_A1,
        orgId: ORG_A,
        status: 'active',
        effectiveFrom: daysAgo(14),
        effectiveTo: null,
        createdBy: U.coachA,
        createdAt: daysAgo(14),
        items: PLAN_ITEMS,
      }),

      put(`plans/${PLAN_A1_TWO}`, {
        teamId: TEAM_A1,
        orgId: ORG_A,
        status: 'active',
        effectiveFrom: daysAgo(14),
        effectiveTo: null,
        createdBy: U.coachA,
        createdAt: daysAgo(14),
        items: PLAN_ITEMS_TWO,
      }),

      put(`plans/${PLAN_A1_ARCHIVED}`, {
        teamId: TEAM_A1,
        orgId: ORG_A,
        status: 'archived',
        effectiveFrom: daysAgo(60),
        effectiveTo: daysAgo(20),
        createdBy: U.coachA,
        createdAt: daysAgo(60),
        items: PLAN_ITEMS,
      }),

      put(`planCycles/${CYCLE_A1}`, {
        planId: PLAN_A1,
        teamId: TEAM_A1,
        orgId: ORG_A,
        weekStart: daysAgo(3),
        weekEnd: daysAhead(3),
        itemsSnapshot: PLAN_ITEMS,
        createdAt: daysAgo(3),
      }),

      put(`entries/${ENTRY_FRESH}`, entryData()),
      put(`entries/${ENTRY_OLD}`, entryData({ createdAt: daysAgo(10), date: daysAgo(6) })),
      put(
        `entries/${ENTRY_ANCIENT}`,
        entryData({ createdAt: daysAgo(60), date: daysAgo(60) }),
      ),
      put(
        `entries/${ENTRY_A2}`,
        entryData({ playerUid: U.playerA2, teamId: TEAM_A2, createdBy: U.playerA2 }),
      ),

      put(`planTemplates/${TEMPLATE_A}`, {
        orgId: ORG_A,
        coachUid: U.coachA,
        name: 'תבנית',
        items: PLAN_ITEMS,
      }),

      put(`weeklySummaries/${SUMMARY_A1}`, {
        teamId: TEAM_A1,
        cycleId: CYCLE_A1,
        playerUid: U.playerA1,
        weekStart: daysAgo(3),
        perExercise: {},
        overallPct: 0,
        updatedAt: daysAgo(1),
      }),
    ]);
  });
}
