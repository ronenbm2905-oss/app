/**
 * בדיקות firestore.rules מול האמולטור.
 *
 * ## שני עקרונות שהקובץ הזה נשען עליהם
 *
 * 1. **לכל חסימה יש ביקורת חיובית לצידה.** כלל שחוסם הכול עובר כל בדיקת חסימה
 *    בעולם. רק הזוג — "זה נחסם, וזה עובר" — מוכיח שהכלל מבחין בין השניים.
 * 2. **נבדקת הסלמה בשני כיוונים.** עצמית (משתמש מקדם את עצמו) ובתיווך (בעל
 *    הרשאה גבוהה יותר מקדם מישהו אחר). הבאג B2 חי בדיוק בפער הזה.
 *
 * הרצה: `npm run test:rules` (מרים אמולטור Firestore ומריץ את הקובץ).
 */

import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import {
  CYCLE_A1,
  ENTRY_A2,
  ENTRY_ANCIENT,
  ENTRY_FRESH,
  ENTRY_OLD,
  EX_GLOBAL,
  EX_ORG_A,
  EX_ORG_B,
  ORG_A,
  ORG_B,
  PLAN_A1,
  PLAN_A1_ARCHIVED,
  PLAN_A1_TWO,
  PLAN_ITEMS,
  PLAN_ITEMS_TWO,
  SUMMARY_A1,
  TEAM_A1,
  TEAM_A2,
  TEAM_B,
  TEMPLATE_A,
  U,
  createTestEnv,
  daysAgo,
  daysAhead,
  entryData,
  exerciseData,
  seed,
} from './harness';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await seed(env);
});

/** מסד בזהות משתמש מחובר. */
function as(uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

/** מסד בלי משתמש מחובר. */
function anonymous(): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

describe('users — קריאה', () => {
  it('כל אחד קורא את עצמו', async () => {
    await assertSucceeds(getDoc(doc(as(U.playerA1), 'users', U.playerA1)));
  });

  it('שחקן לא קורא מסמך של שחקן אחר — גם באותה קבוצה', async () => {
    await assertFails(getDoc(doc(as(U.playerA1), 'users', U.playerA1b)));
  });

  it('מאמן קורא שחקן בארגון שלו', async () => {
    await assertSucceeds(getDoc(doc(as(U.coachA), 'users', U.playerA1)));
  });

  it('מאמן לא קורא משתמש בארגון אחר', async () => {
    await assertFails(getDoc(doc(as(U.coachA), 'users', U.playerB)));
  });

  it('משתמש בלי מסמך פרופיל לא קורא כלום (מלכודת 5)', async () => {
    await assertFails(getDoc(doc(as(U.ghost), 'users', U.playerA1)));
  });

  it('אנונימי לא קורא כלום', async () => {
    await assertFails(getDoc(doc(anonymous(), 'users', U.playerA1)));
  });

  it('שאילתה מסוננת ב-orgId עוברת למאמן; בלי סינון — נחסמת', async () => {
    const db = as(U.coachA);
    await assertSucceeds(getDocs(query(collection(db, 'users'), where('orgId', '==', ORG_A))));
    await assertFails(getDocs(collection(db, 'users')));
  });

  it('שאילתה מסוננת לארגון אחר נחסמת גם היא', async () => {
    const db = as(U.coachA);
    await assertFails(getDocs(query(collection(db, 'users'), where('orgId', '==', ORG_B))));
  });
});

describe('users — הסלמה עצמית (ההגנה הנושאת של המערכת)', () => {
  it('שחקן מקדם את עצמו ל-admin — נחסם', async () => {
    await assertFails(updateDoc(doc(as(U.playerA1), 'users', U.playerA1), { role: 'admin' }));
  });

  it('שחקן משנה את ה-orgId של עצמו — נחסם', async () => {
    await assertFails(updateDoc(doc(as(U.playerA1), 'users', U.playerA1), { orgId: ORG_B }));
  });

  it('שחקן מצרף את עצמו לקבוצה אחרת — נחסם', async () => {
    await assertFails(
      updateDoc(doc(as(U.playerA1), 'users', U.playerA1), { teamIds: [TEAM_A1, TEAM_A2] }),
    );
  });

  it('שחקן מושבת מפעיל את עצמו מחדש — נחסם', async () => {
    // חייב להיבדק על שחקן שבאמת מושבת. הבדיקה הראשונה שכתבתי הרצתה את זה על
    // שחקן פעיל, והיא עברה — לא כי הכלל חלש, אלא כי לא היה שם שינוי בכלל.
    await assertFails(
      updateDoc(doc(as(U.inactivePlayer), 'users', U.inactivePlayer), { active: true }),
    );
  });

  it('כתיבת אותו ערך אינה שינוי — וזו התנהגות Firestore, לא חור בכלל', async () => {
    // diff() משווה ערכים ולא שדות: כתיבת active: true על מסמך שכבר פעיל מחזירה
    // affectedKeys ריק, ולכן unchanged() מרוצה. אין כאן הסלמה — המצב לא זז.
    // רושם את זה כטסט כדי שמי שיראה את זה בפעם הבאה לא יחשוב שמצא באג.
    await assertSucceeds(
      updateDoc(doc(as(U.playerA1), 'users', U.playerA1), { active: true }),
    );
  });

  it('שחקן מושבת לא יכול גם לשנות תפקיד תוך כדי', async () => {
    await assertFails(
      updateDoc(doc(as(U.inactivePlayer), 'users', U.inactivePlayer), {
        active: true,
        role: 'coach',
      }),
    );
  });

  it('אבל עדכון-עצמי של שדה לא-רגיש עובר — אחרת מסך החלפת הסיסמה היה שבור', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.playerA1), 'users', U.playerA1), { mustChangePassword: false }),
    );
    await assertSucceeds(
      updateDoc(doc(as(U.playerA1), 'users', U.playerA1), { displayName: 'בדיקה ב.' }),
    );
  });

  it('שחקן לא נוגע במסמך של שחקן אחר', async () => {
    await assertFails(
      updateDoc(doc(as(U.playerA1), 'users', U.playerA1b), { displayName: 'שינוי' }),
    );
  });
});

describe('users — הסלמה בתיווך מאמן (דגל B2)', () => {
  it('מאמן מקדם שחקן ל-admin — נחסם', async () => {
    // זה הבאג: הכלל בדק resource.data.role (התפקיד הקיים) ולא את הערך הנשלח,
    // ולכן ברגע ההערכה השחקן עדיין player והבדיקה עברה.
    await assertFails(updateDoc(doc(as(U.coachA), 'users', U.playerA1), { role: 'admin' }));
  });

  it('מאמן מקדם שחקן ל-coach — נחסם', async () => {
    await assertFails(updateDoc(doc(as(U.coachA), 'users', U.playerA1), { role: 'coach' }));
  });

  it('מאמן מעביר שחקן לארגון אחר — נחסם', async () => {
    await assertFails(updateDoc(doc(as(U.coachA), 'users', U.playerA1), { orgId: ORG_B }));
  });

  it('מאמן משנה role ו-orgId יחד — נחסם', async () => {
    await assertFails(
      updateDoc(doc(as(U.coachA), 'users', U.playerA1), { role: 'admin', orgId: ORG_B }),
    );
  });

  it('גם כשהשינוי מוסתר בתוך עדכון לגיטימי — נחסם', async () => {
    await assertFails(
      updateDoc(doc(as(U.coachA), 'users', U.playerA1), {
        displayName: 'בדיקה ד.',
        role: 'admin',
      }),
    );
  });

  it('מאמן לא נוגע במסמך של מאמן אחר', async () => {
    await assertFails(
      updateDoc(doc(as(U.coachA), 'users', U.coachA2), { displayName: 'שינוי' }),
    );
  });

  it('מאמן לא נוגע בשחקן של ארגון אחר', async () => {
    await assertFails(
      updateDoc(doc(as(U.coachA), 'users', U.playerB), { displayName: 'שינוי' }),
    );
  });
});

describe('users — מה שהתיקון חייב היה להשאיר עובד', () => {
  it('מאמן משנה שם תצוגה של שחקן', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'users', U.playerA1), { displayName: 'בדיקה ה.' }),
    );
  });

  it('מאמן משנה שם משתמש של שחקן', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'users', U.playerA1), { username: 'player_new' }),
    );
  });

  it('מאמן מעביר שחקן בין קבוצות באותו ארגון (PRD §7.3ד)', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'users', U.playerA1), { teamIds: [TEAM_A2] }),
    );
  });

  it('מאמן משבית שחקן — הפעולה שמחליפה מחיקה', async () => {
    await assertSucceeds(updateDoc(doc(as(U.coachA), 'users', U.playerA1), { active: false }));
  });

  it('מאמן מפעיל שחקן מושבת מחדש', async () => {
    await assertSucceeds(updateDoc(doc(as(U.coachA), 'users', U.playerA1), { active: true }));
  });

  it('מאמן מפעיל מחדש שחקן שהיה באמת מושבת', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'users', U.inactivePlayer), { active: true }),
    );
  });

  it('מאמן מאפס דגל החלפת סיסמה', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'users', U.playerA1), { mustChangePassword: true }),
    );
  });

  it('השבתה והעברת קבוצה יחד — עדיין עוברות', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'users', U.playerA1), {
        teamIds: [TEAM_A2],
        active: false,
        displayName: 'בדיקה ו.',
      }),
    );
  });
});

describe('users — יצירה ומחיקה', () => {
  it('מאמן יוצר שחקן בארגון שלו — המסלול של adminClient', async () => {
    await assertSucceeds(
      setDoc(doc(as(U.coachA), 'users', 'new_player'), {
        role: 'player',
        orgId: ORG_A,
        displayName: 'בדיקה ז.',
        username: 'new_player',
        teamIds: [TEAM_A1],
        active: true,
        mustChangePassword: true,
        createdAt: daysAgo(0),
      }),
    );
  });

  it('מאמן יוצר מאמן — נחסם', async () => {
    await assertFails(
      setDoc(doc(as(U.coachA), 'users', 'new_coach'), {
        role: 'coach',
        orgId: ORG_A,
        displayName: 'בדיקה ח.',
        username: 'new_coach',
        teamIds: [TEAM_A1],
        active: true,
        mustChangePassword: true,
        createdAt: daysAgo(0),
      }),
    );
  });

  it('מאמן יוצר admin — נחסם', async () => {
    await assertFails(
      setDoc(doc(as(U.coachA), 'users', 'new_admin'), {
        role: 'admin',
        orgId: ORG_A,
        displayName: 'בדיקה ט.',
        username: 'new_admin',
        teamIds: [],
        active: true,
        mustChangePassword: true,
        createdAt: daysAgo(0),
      }),
    );
  });

  it('מאמן יוצר שחקן בארגון אחר — נחסם', async () => {
    await assertFails(
      setDoc(doc(as(U.coachA), 'users', 'foreign_player'), {
        role: 'player',
        orgId: ORG_B,
        displayName: 'בדיקה י.',
        username: 'foreign',
        teamIds: [TEAM_B],
        active: true,
        mustChangePassword: true,
        createdAt: daysAgo(0),
      }),
    );
  });

  it('מאמן מושבת לא יוצר שחקן', async () => {
    await assertFails(
      setDoc(doc(as(U.inactiveCoach), 'users', 'another_player'), {
        role: 'player',
        orgId: ORG_A,
        displayName: 'בדיקה כ.',
        username: 'another',
        teamIds: [TEAM_A1],
        active: true,
        mustChangePassword: true,
        createdAt: daysAgo(0),
      }),
    );
  });

  it('שחקן לא יוצר משתמשים בכלל', async () => {
    await assertFails(
      setDoc(doc(as(U.playerA1), 'users', 'player_made_this'), {
        role: 'player',
        orgId: ORG_A,
        displayName: 'בדיקה ל.',
        username: 'made',
        teamIds: [TEAM_A1],
        active: true,
        mustChangePassword: true,
        createdAt: daysAgo(0),
      }),
    );
  });

  it('admin כן רשאי לשנות תפקיד — הוא הדרך הלגיטימית למנות מאמן', async () => {
    await assertSucceeds(updateDoc(doc(as(U.adminA), 'users', U.playerA1), { role: 'coach' }));
  });

  it('אין מחיקה קשיחה — גם ל-admin', async () => {
    await assertFails(deleteDoc(doc(as(U.adminA), 'users', U.playerA1)));
    await assertFails(deleteDoc(doc(as(U.coachA), 'users', U.playerA1)));
  });
});

describe('organizations', () => {
  it('חבר בארגון קורא אותו; משתמש מארגון אחר — לא', async () => {
    await assertSucceeds(getDoc(doc(as(U.playerA1), 'organizations', ORG_A)));
    await assertFails(getDoc(doc(as(U.playerA1), 'organizations', ORG_B)));
  });

  it('admin כותב לארגון שלו; מאמן — לא', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.adminA), 'organizations', ORG_A), { name: 'שם חדש' }),
    );
    await assertFails(updateDoc(doc(as(U.coachA), 'organizations', ORG_A), { name: 'שם חדש' }));
  });

  it('אין מחיקת ארגון — גם ל-admin שלו', async () => {
    // allow write כלל גם delete, וזו הייתה הפרצה היחידה בכלל 5.
    await assertFails(deleteDoc(doc(as(U.adminA), 'organizations', ORG_A)));
  });

  it('admin לא כותב לארגון אחר', async () => {
    await assertFails(updateDoc(doc(as(U.adminA), 'organizations', ORG_B), { name: 'שם חדש' }));
  });
});

describe('teams', () => {
  it('חבר בארגון קורא קבוצה; משתמש מארגון אחר — לא', async () => {
    await assertSucceeds(getDoc(doc(as(U.playerA1), 'teams', TEAM_A1)));
    await assertFails(getDoc(doc(as(U.playerB), 'teams', TEAM_A1)));
  });

  it('שחקן רואה גם קבוצה אחרת באותו ארגון — הבידוד הוא ארגוני, לא קבוצתי', async () => {
    await assertSucceeds(getDoc(doc(as(U.playerA1), 'teams', TEAM_A2)));
  });

  it('מאמן הקבוצה מעדכן אותה; מאמן אחר באותו ארגון — לא', async () => {
    await assertSucceeds(updateDoc(doc(as(U.coachA), 'teams', TEAM_A1), { name: 'ילדים א+' }));
    await assertFails(updateDoc(doc(as(U.coachA2), 'teams', TEAM_A1), { name: 'ילדים א+' }));
  });

  it('מאמן משנה את coachUid של הקבוצה שלו — נחסם', async () => {
    // אותו דפוס: הכלל בדק בעלות קיימת, לא את הערך הנשלח.
    await assertFails(updateDoc(doc(as(U.coachA), 'teams', TEAM_A1), { coachUid: U.coachA2 }));
  });

  it('מאמן מעביר את הקבוצה לארגון אחר — נחסם', async () => {
    await assertFails(updateDoc(doc(as(U.coachA), 'teams', TEAM_A1), { orgId: ORG_B }));
  });

  it('admin כן מעביר בעלות על קבוצה — פעולת ניהול לגיטימית', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.adminA), 'teams', TEAM_A1), { coachUid: U.coachA2 }),
    );
  });

  it('מאמן ממשיך לשנות שם, עונה, הגדרות ומצב פעיל', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'teams', TEAM_A1), {
        name: 'ילדים א 2027',
        season: '2027',
        active: false,
        settings: { leaderboardEnabled: false, streakThreshold: 70, weekStartDay: 0 },
      }),
    );
  });

  it('שחקן לא מעדכן קבוצה', async () => {
    await assertFails(updateDoc(doc(as(U.playerA1), 'teams', TEAM_A1), { name: 'שלי' }));
  });

  it('אין מחיקת קבוצה', async () => {
    await assertFails(deleteDoc(doc(as(U.coachA), 'teams', TEAM_A1)));
  });
});

describe('exercises — כללים הם לא מסננים', () => {
  it('שאילתה בלי where נחסמת, עם where(scope) עוברת, ומסמך בודד עובר', async () => {
    // בדיוק שלוש השורות שמתועדות ב-CLAUDE.md, עכשיו כבדיקה שאפשר להריץ מחדש.
    const db = as(U.coachA);
    await assertFails(getDocs(collection(db, 'exercises')));
    await assertSucceeds(
      getDocs(query(collection(db, 'exercises'), where('scope', '==', 'global'))),
    );
    await assertSucceeds(getDoc(doc(db, 'exercises', EX_GLOBAL)));
  });

  it('שאילתת תרגילי הארגון עוברת; של ארגון אחר — נחסמת', async () => {
    const db = as(U.coachA);
    await assertSucceeds(getDocs(query(collection(db, 'exercises'), where('orgId', '==', ORG_A))));
    await assertFails(getDocs(query(collection(db, 'exercises'), where('orgId', '==', ORG_B))));
  });

  it('שחקן קורא את הקטלוג הגלובלי', async () => {
    await assertSucceeds(getDoc(doc(as(U.playerA1), 'exercises', EX_GLOBAL)));
  });

  it('מאמן לא קורא תרגיל של ארגון אחר', async () => {
    await assertFails(getDoc(doc(as(U.coachA), 'exercises', EX_ORG_B)));
  });
});

describe('exercises — כתיבה', () => {
  it('מאמן יוצר תרגיל של הארגון שלו', async () => {
    await assertSucceeds(
      setDoc(doc(as(U.coachA), 'exercises', 'new_org_ex'), exerciseData({ orgId: ORG_A })),
    );
  });

  it('מאמן לא יוצר תרגיל גלובלי — הקטלוג הוא admin-only', async () => {
    await assertFails(
      setDoc(
        doc(as(U.coachA), 'exercises', 'new_global'),
        exerciseData({ scope: 'global', orgId: null }),
      ),
    );
  });

  it('admin כן יוצר תרגיל גלובלי', async () => {
    await assertSucceeds(
      setDoc(
        doc(as(U.adminA), 'exercises', 'new_global'),
        exerciseData({ scope: 'global', orgId: null }),
      ),
    );
  });

  it('מאמן לא יוצר תרגיל לארגון אחר', async () => {
    await assertFails(
      setDoc(doc(as(U.coachA), 'exercises', 'foreign_ex'), exerciseData({ orgId: ORG_B })),
    );
  });

  it('מאמן עורך תרגיל של הארגון; תרגיל קטלוג — נחסם', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'exercises', EX_ORG_A), { description: 'הנחיות חדשות' }),
    );
    await assertFails(
      updateDoc(doc(as(U.coachA), 'exercises', EX_GLOBAL), { description: 'הנחיות חדשות' }),
    );
  });

  it('מאמן משנה scope של תרגיל מועדון ל-global — נחסם', async () => {
    // הזליגה החוצת-ארגונים: תרגיל עם scope גלובלי נקרא בידי **כל** מחובר,
    // בכל ארגון. זה היה הופך תרגיל פנימי של מועדון לחלק מהקטלוג של כולם.
    await assertFails(
      updateDoc(doc(as(U.coachA), 'exercises', EX_ORG_A), { scope: 'global' }),
    );
  });

  it('מאמן מעביר תרגיל לארגון אחר — נחסם', async () => {
    await assertFails(updateDoc(doc(as(U.coachA), 'exercises', EX_ORG_A), { orgId: ORG_B }));
  });

  it('גם admin לא משנה scope — קידום לקטלוג נעשה ב-seed, לא מהאפליקציה', async () => {
    await assertFails(
      updateDoc(doc(as(U.adminA), 'exercises', EX_ORG_A), { scope: 'global', orgId: null }),
    );
  });

  it('אבל עריכת תוכן התרגיל ממשיכה לעבוד — שם, קטגוריה, יעד והשבתה', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'exercises', EX_ORG_A), {
        name: 'תרגיל בשם חדש',
        category: 'זריקה',
        defaultTargets: { cadets_13_15: 250 },
        active: false,
      }),
    );
  });

  it('שחקן לא עורך תרגילים', async () => {
    await assertFails(
      updateDoc(doc(as(U.playerA1), 'exercises', EX_ORG_A), { description: 'שלי' }),
    );
  });

  it('אין מחיקת תרגיל', async () => {
    await assertFails(deleteDoc(doc(as(U.coachA), 'exercises', EX_ORG_A)));
    await assertFails(deleteDoc(doc(as(U.adminA), 'exercises', EX_GLOBAL)));
  });
});

describe('plans', () => {
  it('חבר הקבוצה קורא את התוכנית; שחקן מקבוצה אחרת — לא', async () => {
    await assertSucceeds(getDoc(doc(as(U.playerA1), 'plans', PLAN_A1)));
    await assertFails(getDoc(doc(as(U.playerA2), 'plans', PLAN_A1)));
  });

  it('מאמן הקבוצה יוצר תוכנית; מאמן אחר — לא', async () => {
    const planDoc = {
      teamId: TEAM_A1,
      orgId: ORG_A,
      status: 'active',
      effectiveFrom: daysAgo(0),
      effectiveTo: null,
      createdBy: U.coachA,
      createdAt: daysAgo(0),
      items: PLAN_ITEMS,
    };
    await assertSucceeds(setDoc(doc(as(U.coachA), 'plans', 'new_plan'), planDoc));
    await assertFails(
      setDoc(doc(as(U.coachA2), 'plans', 'new_plan_2'), { ...planDoc, createdBy: U.coachA2 }),
    );
  });

  it('שחקן לא יוצר תוכנית', async () => {
    await assertFails(
      setDoc(doc(as(U.playerA1), 'plans', 'player_plan'), {
        teamId: TEAM_A1,
        orgId: ORG_A,
        status: 'active',
        effectiveFrom: daysAgo(0),
        effectiveTo: null,
        createdBy: U.playerA1,
        createdAt: daysAgo(0),
        items: PLAN_ITEMS,
      }),
    );
  });

  it('מאמן הקבוצה מעדכן; שחקן — לא', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'plans', PLAN_A1), { status: 'archived' }),
    );
    await assertFails(updateDoc(doc(as(U.playerA1), 'plans', PLAN_A1), { status: 'archived' }));
  });

  it('מאמן מעביר תוכנית קיימת לקבוצה אחרת או לארגון אחר — נחסם', async () => {
    await assertFails(updateDoc(doc(as(U.coachA), 'plans', PLAN_A1), { teamId: TEAM_A2 }));
    await assertFails(updateDoc(doc(as(U.coachA), 'plans', PLAN_A1), { orgId: ORG_B }));
  });

  it('אבל עריכת תוכן התוכנית ממשיכה לעבוד — פריטים, יעדים וסטטוס', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'plans', PLAN_A1), {
        items: [{ ...PLAN_ITEMS[0], target: 500, notes: 'הנחיה חדשה' }],
        effectiveTo: daysAhead(7),
      }),
    );
  });

  it('אין מחיקת תוכנית', async () => {
    await assertFails(deleteDoc(doc(as(U.coachA), 'plans', PLAN_A1)));
  });
});

describe('planCycles — יצירה עצלה בלי לרמות', () => {
  const cycleDoc = (overrides: Record<string, unknown> = {}) => ({
    planId: PLAN_A1,
    teamId: TEAM_A1,
    orgId: ORG_A,
    weekStart: daysAgo(0),
    weekEnd: daysAhead(6),
    itemsSnapshot: PLAN_ITEMS,
    createdAt: daysAgo(0),
    ...overrides,
  });

  it('שחקן פותח מחזור עם צילום זהה לתוכנית', async () => {
    await assertSucceeds(setDoc(doc(as(U.playerA1), 'planCycles', 'new_cycle'), cycleDoc()));
  });

  it('שחקן שמנמיך את היעד בצילום — נחסם', async () => {
    // בלי הבדיקה הזו שחקן פותח מחזור עם target: 1 ומקבל 100%.
    await assertFails(
      setDoc(
        doc(as(U.playerA1), 'planCycles', 'cheat_cycle'),
        cycleDoc({ itemsSnapshot: [{ ...PLAN_ITEMS[0], target: 1 }] }),
      ),
    );
  });

  it('צילום ריק — נחסם גם הוא', async () => {
    await assertFails(
      setDoc(doc(as(U.playerA1), 'planCycles', 'empty_cycle'), cycleDoc({ itemsSnapshot: [] })),
    );
  });

  it('שחקן מקבוצה אחרת לא פותח מחזור לקבוצה הזו', async () => {
    await assertFails(setDoc(doc(as(U.playerA2), 'planCycles', 'other_cycle'), cycleDoc()));
  });

  it('חבר הקבוצה קורא את המחזור; מי שאינו חבר — לא', async () => {
    await assertSucceeds(getDoc(doc(as(U.playerA1), 'planCycles', CYCLE_A1)));
    await assertFails(getDoc(doc(as(U.playerA2), 'planCycles', CYCLE_A1)));
  });

  it('מאמן משנה את זהות המחזור — קבוצה, תוכנית או גבולות השבוע — נחסם', async () => {
    // שינוי weekStart משכתב למפרע לאיזה שבוע כל הדיווחים משתייכים.
    const db = as(U.coachA);
    await assertFails(updateDoc(doc(db, 'planCycles', CYCLE_A1), { teamId: TEAM_A2 }));
    await assertFails(updateDoc(doc(db, 'planCycles', CYCLE_A1), { orgId: ORG_B }));
    await assertFails(updateDoc(doc(db, 'planCycles', CYCLE_A1), { planId: 'plan_other' }));
    await assertFails(updateDoc(doc(db, 'planCycles', CYCLE_A1), { weekStart: daysAgo(30) }));
    await assertFails(updateDoc(doc(db, 'planCycles', CYCLE_A1), { weekEnd: daysAhead(30) }));
  });

  it('itemsSnapshot נשאר פתוח לשינוי — זה "עדכון תוכנית מהשבוע הנוכחי" (PRD §7.4)', async () => {
    // הפיצ'ר שהתיקון הכי עלול לשבור. אם הבדיקה הזו נופלת, נעלתי יותר מדי.
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'planCycles', CYCLE_A1), {
        itemsSnapshot: [{ ...PLAN_ITEMS[0], target: 450, notes: 'העלינו את היעד' }],
      }),
    );
  });

  it('מאמן הקבוצה מעדכן צילום; שחקן — לא', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'planCycles', CYCLE_A1), {
        itemsSnapshot: [{ ...PLAN_ITEMS[0], target: 400 }],
      }),
    );
    await assertFails(
      updateDoc(doc(as(U.playerA1), 'planCycles', CYCLE_A1), {
        itemsSnapshot: [{ ...PLAN_ITEMS[0], target: 1 }],
      }),
    );
  });
});


describe('planCycles — מזהה דטרמיניסטי, סדר וצילום (שלב 3)', () => {
  /** אותו מזהה שהקוד מחשב: `${teamId}_${weekKey}`. */
  const DERIVED_ID = `${TEAM_A1}_2026-08-16`;

  // גבולות השבוע מוקפאים פעם אחת: שתי קריאות ל-daysAgo(0) מחזירות חותמות
  // שונות באלפית, וכתיבה חוזרת עם ערך "זהה" הייתה נראית לכללים כהזזת שבוע.
  const WEEK_START = daysAgo(0);
  const WEEK_END = daysAhead(6);

  const cycleDoc = (overrides: Record<string, unknown> = {}) => ({
    planId: PLAN_A1,
    teamId: TEAM_A1,
    orgId: ORG_A,
    weekStart: WEEK_START,
    weekEnd: WEEK_END,
    itemsSnapshot: PLAN_ITEMS,
    createdAt: daysAgo(0),
    ...overrides,
  });

  it('יצירה במזהה נגזר עוברת כרגיל — הכללים לא מתעניינים בצורת המזהה', async () => {
    await assertSucceeds(setDoc(doc(as(U.playerA1), 'planCycles', DERIVED_ID), cycleDoc()));
  });

  it('כתיבה שנייה על אותו מזהה היא כבר update — ולכן שחקן שני נחסם', async () => {
    // זו הסיבה ש-getOrCreateCurrentCycle עוטף את היצירה בטרנזקציה שמוותרת
    // כשהמסמך כבר קיים: שחקן שני שהיה מנצח את המרוץ וכותב שוב היה מקבל
    // PERMISSION_DENIED על מסך הבית שלו, בלי שום סיבה נראית לעין.
    await assertSucceeds(setDoc(doc(as(U.playerA1), 'planCycles', DERIVED_ID), cycleDoc()));
    await assertFails(setDoc(doc(as(U.playerA1b), 'planCycles', DERIVED_ID), cycleDoc()));

    // ביקורת חיובית: אותה כתיבה בדיוק מהמאמן עוברת, כי update מותר לו.
    await assertSucceeds(setDoc(doc(as(U.coachA), 'planCycles', DERIVED_ID), cycleDoc()));
  });

  it('גם למאמן, כתיבה חוזרת שמזיזה את גבולות השבוע — נחסמת', async () => {
    // זהות המחזור נעולה: שינוי weekStart היה משכתב למפרע לאיזה שבוע כל
    // הדיווחים משתייכים. לכן הקוד לא כותב מחדש מחזור קיים אלא מעדכן שדה.
    await assertSucceeds(setDoc(doc(as(U.playerA1), 'planCycles', DERIVED_ID), cycleDoc()));
    await assertFails(
      setDoc(
        doc(as(U.coachA), 'planCycles', DERIVED_ID),
        cycleDoc({ weekStart: daysAgo(7), weekEnd: daysAgo(1) }),
      ),
    );
  });

  it('קריאת מחזור שאינו קיים נחסמת — הממצא שקבע איך היצירה העצלה שואלת', async () => {
    // במסמך חסר `resource` הוא null, וכל נגיעה ב-resource.data מפילה את הכלל
    // ל-deny. כלומר "האם כבר נפתח מחזור לשבוע הזה?" — השאלה שהיצירה העצלה
    // חייבת לשאול — אסור שתישאל ב-getDoc. אומת גם מול המסד החי (21.8.2026).
    await assertFails(getDoc(doc(as(U.playerA1), 'planCycles', `${TEAM_A1}_2099-01-04`)));

    // ביקורת חיובית: אותה שאלה בדיוק, בשאילתה מסוננת — עוברת ומחזירה ריק.
    await assertSucceeds(
      getDocs(
        query(collection(as(U.playerA1), 'planCycles'), where('teamId', '==', TEAM_A1)),
      ),
    );
  });

  it('סדר האיברים במערך נחשב: אותו צילום הפוך — נחסם', async () => {
    // ההשוואה itemsSnapshot == plan.items היא השוואת מערכים, ומערך הוא סדור.
    // בגלל זה buildCycleData מעביר את plan.items כמות שהוא, בלי map ובלי sort.
    const forPlanTwo = (items: unknown) =>
      cycleDoc({ planId: PLAN_A1_TWO, itemsSnapshot: items });

    await assertSucceeds(
      setDoc(doc(as(U.coachA), 'planCycles', 'cycle_order_ok'), forPlanTwo(PLAN_ITEMS_TWO)),
    );
    await assertFails(
      setDoc(
        doc(as(U.coachA), 'planCycles', 'cycle_order_bad'),
        forPlanTwo([PLAN_ITEMS_TWO[1], PLAN_ITEMS_TWO[0]]),
      ),
    );
  });

  it('שדה עודף או חסר בפריט — נחסם', async () => {
    // undefined שנופל בכתיבה, או שדה מחושב שנוסף בדרך, מפילים את ההשוואה.
    await assertFails(
      setDoc(
        doc(as(U.coachA), 'planCycles', 'cycle_extra_field'),
        cycleDoc({ itemsSnapshot: [{ ...PLAN_ITEMS[0], computedPct: 0 }] }),
      ),
    );

    const { notes: _dropped, ...withoutNotes } = PLAN_ITEMS[0];
    await assertFails(
      setDoc(
        doc(as(U.coachA), 'planCycles', 'cycle_missing_field'),
        cycleDoc({ itemsSnapshot: [withoutNotes] }),
      ),
    );
  });

  it('מחזור שמפנה לתוכנית בארכיון — נחסם; לתוכנית פעילה — עובר', async () => {
    // PRD §8.4: אין תוכנית פעילה → לא נוצר מחזור. הכלל אוכף את זה גם כשהלקוח
    // מנסה בכל זאת — למשל שחקן שנכנס בשבוע חופשה עם קוד ישן במטמון.
    await assertFails(
      setDoc(
        doc(as(U.coachA), 'planCycles', 'cycle_archived'),
        cycleDoc({ planId: PLAN_A1_ARCHIVED }),
      ),
    );
    await assertSucceeds(
      setDoc(doc(as(U.coachA), 'planCycles', 'cycle_active'), cycleDoc()),
    );
  });
});

describe('שתי אפשרויות העריכה — הכתיבות יוצאות יחד (שלב 3)', () => {
  it('"מהשבוע הנוכחי": plans.items ו-planCycles.itemsSnapshot ב-batch אחד', async () => {
    // אם אחד ייכתב והשני לא, השבוע הנוכחי מציג יעד אחד והתוכנית אומרת אחר.
    const items = [{ ...PLAN_ITEMS[0], target: 500 }];
    const db = as(U.coachA);
    const batch = writeBatch(db);
    batch.update(doc(db, 'plans', PLAN_A1), { items });
    batch.update(doc(db, 'planCycles', CYCLE_A1), { itemsSnapshot: items });

    await assertSucceeds(batch.commit());
  });

  it('אותו batch בדיוק, משחקן — נחסם כולו', async () => {
    const items = [{ ...PLAN_ITEMS[0], target: 1 }];
    const db = as(U.playerA1);
    const batch = writeBatch(db);
    batch.update(doc(db, 'plans', PLAN_A1), { items });
    batch.update(doc(db, 'planCycles', CYCLE_A1), { itemsSnapshot: items });

    await assertFails(batch.commit());
  });

  it('"מהשבוע הבא": סגירת הישנה ופתיחת החדשה ב-batch אחד', async () => {
    const db = as(U.coachA);
    const batch = writeBatch(db);
    batch.update(doc(db, 'plans', PLAN_A1), {
      status: 'archived',
      effectiveTo: daysAhead(3),
    });
    batch.set(doc(db, 'plans', 'plan_next_week'), {
      teamId: TEAM_A1,
      orgId: ORG_A,
      status: 'active',
      effectiveFrom: daysAhead(4),
      effectiveTo: null,
      createdBy: U.coachA,
      createdAt: daysAgo(0),
      items: [{ ...PLAN_ITEMS[0], target: 500 }],
    });

    await assertSucceeds(batch.commit());
  });

  it('מאמן של קבוצה אחרת לא יכול לבצע את אותו מעבר', async () => {
    const db = as(U.coachA2);
    const batch = writeBatch(db);
    batch.update(doc(db, 'plans', PLAN_A1), { status: 'archived', effectiveTo: daysAhead(3) });
    batch.set(doc(db, 'plans', 'plan_hijack'), {
      teamId: TEAM_A1,
      orgId: ORG_A,
      status: 'active',
      effectiveFrom: daysAhead(4),
      effectiveTo: null,
      createdBy: U.coachA2,
      createdAt: daysAgo(0),
      items: PLAN_ITEMS,
    });

    await assertFails(batch.commit());
  });

  it('הפסקת תוכנית (שבוע בלי יעדים) — מאמן כן, שחקן לא', async () => {
    await assertFails(
      updateDoc(doc(as(U.playerA1), 'plans', PLAN_A1), {
        status: 'archived',
        effectiveTo: daysAhead(3),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'plans', PLAN_A1), {
        status: 'archived',
        effectiveTo: daysAhead(3),
      }),
    );
  });
});

describe('entries — יצירה', () => {
  it('שחקן מדווח על עצמו', async () => {
    await assertSucceeds(
      setDoc(doc(as(U.playerA1), 'entries', 'e_new'), entryData({ date: daysAgo(0) })),
    );
  });

  it('דיווח מלפני 10 ימים — נחסם; מלפני 3 ימים — עובר', async () => {
    await assertFails(
      setDoc(doc(as(U.playerA1), 'entries', 'e_old'), entryData({ date: daysAgo(10) })),
    );
    await assertSucceeds(
      setDoc(doc(as(U.playerA1), 'entries', 'e_ok'), entryData({ date: daysAgo(3) })),
    );
  });

  it('דיווח על מחר — נחסם', async () => {
    await assertFails(
      setDoc(doc(as(U.playerA1), 'entries', 'e_future'), entryData({ date: daysAhead(2) })),
    );
  });

  it('כמות אפס, שלילית או לא-מספר — נחסמות; חיובית — עוברת', async () => {
    await assertFails(
      setDoc(doc(as(U.playerA1), 'entries', 'e_zero'), entryData({ amount: 0 })),
    );
    await assertFails(
      setDoc(doc(as(U.playerA1), 'entries', 'e_neg'), entryData({ amount: -5 })),
    );
    await assertFails(
      setDoc(doc(as(U.playerA1), 'entries', 'e_str'), entryData({ amount: '50' })),
    );
    await assertSucceeds(
      setDoc(doc(as(U.playerA1), 'entries', 'e_pos'), entryData({ amount: 1 })),
    );
  });

  it('שחקן מדווח בשם שחקן אחר — נחסם', async () => {
    await assertFails(
      setDoc(
        doc(as(U.playerA1), 'entries', 'e_impostor'),
        entryData({ playerUid: U.playerA1b, date: daysAgo(0) }),
      ),
    );
  });

  it('שחקן מדווח לקבוצה שאינו חבר בה — נחסם', async () => {
    await assertFails(
      setDoc(
        doc(as(U.playerA1), 'entries', 'e_other_team'),
        entryData({ teamId: TEAM_A2, date: daysAgo(0) }),
      ),
    );
  });

  it('מאמן מדווח על שחקן שאינו בקבוצה — נחסם, גם באותו ארגון', async () => {
    // player_a2 שייך ל-team_a2. בלי הבדיקה, coach_a היה רושם עליו דיווח
    // שנספר בקבוצה שלו ומזהם את הנתונים של שחקן שאינו שלו.
    await assertFails(
      setDoc(
        doc(as(U.coachA), 'entries', 'e_not_my_player'),
        entryData({ playerUid: U.playerA2, createdBy: U.coachA, date: daysAgo(0) }),
      ),
    );
  });

  it('מאמן מדווח על uid שאין לו מסמך משתמש — נחסם', async () => {
    await assertFails(
      setDoc(
        doc(as(U.coachA), 'entries', 'e_ghost_player'),
        entryData({ playerUid: U.ghost, createdBy: U.coachA, date: daysAgo(0) }),
      ),
    );
  });

  it('דיווח שנולד מחוק — נחסם', async () => {
    await assertFails(
      setDoc(
        doc(as(U.playerA1), 'entries', 'e_deleted'),
        entryData({ deleted: true, date: daysAgo(0) }),
      ),
    );
  });

  it('מאמן מדווח עבור שחקן בקבוצתו; מאמן של קבוצה אחרת — נחסם', async () => {
    await assertSucceeds(
      setDoc(
        doc(as(U.coachA), 'entries', 'e_by_coach'),
        entryData({ createdBy: U.coachA, date: daysAgo(0) }),
      ),
    );
    await assertFails(
      setDoc(
        doc(as(U.coachA2), 'entries', 'e_by_other_coach'),
        entryData({ createdBy: U.coachA2, date: daysAgo(0) }),
      ),
    );
  });
});

describe('entries — קריאה, עריכה ומחיקה', () => {
  it('שחקן קורא את הדיווח שלו, ולא של אחר', async () => {
    await assertSucceeds(getDoc(doc(as(U.playerA1), 'entries', ENTRY_FRESH)));
    await assertFails(getDoc(doc(as(U.playerA2), 'entries', ENTRY_FRESH)));
  });

  it('מאמן הקבוצה קורא דיווח של שחקן שלו; מאמן אחר — לא', async () => {
    await assertSucceeds(getDoc(doc(as(U.coachA), 'entries', ENTRY_FRESH)));
    await assertFails(getDoc(doc(as(U.coachA2), 'entries', ENTRY_FRESH)));
  });

  it('כל מאמן רואה רק את הדיווחים של הקבוצה שלו', async () => {
    // entry_a2 שייך לשחקן של team_a2. ההפרדה היא לפי קבוצה, לא לפי ארגון.
    await assertSucceeds(getDoc(doc(as(U.coachA2), 'entries', ENTRY_A2)));
    await assertFails(getDoc(doc(as(U.coachA), 'entries', ENTRY_A2)));
  });

  it('שאילתת דיווחים מסוננת ב-playerUid עוברת; בלי סינון — נחסמת', async () => {
    const db = as(U.playerA1);
    await assertSucceeds(
      getDocs(query(collection(db, 'entries'), where('playerUid', '==', U.playerA1))),
    );
    await assertFails(getDocs(collection(db, 'entries')));
  });

  it('שחקן לא שולף את הדיווחים של חברו לקבוצה', async () => {
    const db = as(U.playerA1);
    await assertFails(
      getDocs(query(collection(db, 'entries'), where('playerUid', '==', U.playerA1b))),
    );
  });

  it('שחקן עורך דיווח בתוך חלון 7 הימים; אחריו — נחסם', async () => {
    // שני החלונות שונים: כאן נמדד createdAt (מתי נרשם), לא date (מתי בוצע).
    await assertSucceeds(updateDoc(doc(as(U.playerA1), 'entries', ENTRY_FRESH), { amount: 60 }));
    await assertFails(updateDoc(doc(as(U.playerA1), 'entries', ENTRY_OLD), { amount: 60 }));
  });

  it('מאמן עורך דיווח ישן — לו אין חלון', async () => {
    await assertSucceeds(updateDoc(doc(as(U.coachA), 'entries', ENTRY_OLD), { amount: 60 }));
  });

  it('עריכה לכמות אפס, שלילית או לא-מספר — נחסמת', async () => {
    // עד התיקון, הוולידציות האלה חלו ביצירה בלבד: אפשר היה ליצור דיווח תקין
    // ומיד לעדכן אותו ל-amount שלילי.
    const db = as(U.playerA1);
    await assertFails(updateDoc(doc(db, 'entries', ENTRY_FRESH), { amount: 0 }));
    await assertFails(updateDoc(doc(db, 'entries', ENTRY_FRESH), { amount: -5 }));
    await assertFails(updateDoc(doc(db, 'entries', ENTRY_FRESH), { amount: '60' }));
  });

  it('הזזת תאריך אל מחוץ לחלון — נחסמת; לתוך החלון — עוברת', async () => {
    const db = as(U.playerA1);
    await assertFails(updateDoc(doc(db, 'entries', ENTRY_FRESH), { date: daysAgo(30) }));
    await assertFails(updateDoc(doc(db, 'entries', ENTRY_FRESH), { date: daysAhead(5) }));
    await assertSucceeds(updateDoc(doc(db, 'entries', ENTRY_FRESH), { date: daysAgo(3) }));
  });

  it('מאמן עורך דיווח בן חודשיים בלי לגעת בתאריך — עדיין עובד', async () => {
    // הסיבה שגבולות התאריך נבדקים רק כשהוא משתנה: אחרת "מאמן תמיד" בטבלת
    // ההרשאות היה נשבר, ודיווח ישן היה הופך לבלתי ניתן לתיקון ולמחיקה רכה.
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'entries', ENTRY_ANCIENT), { amount: 80 }),
    );
  });

  it('מחיקה רכה של דיווח בן חודשיים — עדיין עובדת', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'entries', ENTRY_ANCIENT), { deleted: true }),
    );
  });

  it('מאמן שמזיז דיווח ישן לתאריך חוקי — מותר; לתאריך לא חוקי — לא', async () => {
    const db = as(U.coachA);
    await assertSucceeds(updateDoc(doc(db, 'entries', ENTRY_ANCIENT), { date: daysAgo(2) }));
    await assertFails(updateDoc(doc(db, 'entries', ENTRY_ANCIENT), { date: daysAgo(45) }));
  });

  it('שינוי בעלות על דיווח — נחסם', async () => {
    await assertFails(
      updateDoc(doc(as(U.playerA1), 'entries', ENTRY_FRESH), { playerUid: U.playerA1b }),
    );
    await assertFails(
      updateDoc(doc(as(U.coachA), 'entries', ENTRY_FRESH), { teamId: TEAM_A2 }),
    );
    await assertFails(updateDoc(doc(as(U.coachA), 'entries', ENTRY_FRESH), { orgId: ORG_B }));
  });

  it('מחיקה רכה עוברת, מחיקה קשיחה נחסמת', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.playerA1), 'entries', ENTRY_FRESH), { deleted: true }),
    );
    await assertFails(deleteDoc(doc(as(U.playerA1), 'entries', ENTRY_FRESH)));
    await assertFails(deleteDoc(doc(as(U.coachA), 'entries', ENTRY_FRESH)));
  });

  it('שחקן לא עורך דיווח של שחקן אחר', async () => {
    await assertFails(updateDoc(doc(as(U.playerA2), 'entries', ENTRY_FRESH), { amount: 1000 }));
  });
});

describe('planTemplates', () => {
  it('מאמן קורא תבניות של הארגון; שחקן — לא', async () => {
    await assertSucceeds(getDoc(doc(as(U.coachA), 'planTemplates', TEMPLATE_A)));
    await assertFails(getDoc(doc(as(U.playerA1), 'planTemplates', TEMPLATE_A)));
  });

  it('מאמן מארגון אחר לא קורא', async () => {
    await assertFails(getDoc(doc(as(U.coachB), 'planTemplates', TEMPLATE_A)));
  });

  it('מאמן משנה בעלות או ארגון של תבנית — נחסם', async () => {
    const db = as(U.coachA);
    await assertFails(updateDoc(doc(db, 'planTemplates', TEMPLATE_A), { coachUid: U.coachA2 }));
    await assertFails(updateDoc(doc(db, 'planTemplates', TEMPLATE_A), { orgId: ORG_B }));
  });

  it('שינוי שם ותוכן של תבנית ממשיך לעבוד', async () => {
    await assertSucceeds(
      updateDoc(doc(as(U.coachA), 'planTemplates', TEMPLATE_A), {
        name: 'תבנית מעודכנת',
        items: [{ ...PLAN_ITEMS[0], target: 200 }],
      }),
    );
  });

  it('מאמן שומר תבנית חדשה בשם עצמו; בשם מאמן אחר — נחסם', async () => {
    const template = {
      orgId: ORG_A,
      coachUid: U.coachA,
      name: 'שבוע לפני משחק',
      items: PLAN_ITEMS_TWO,
    };
    await assertSucceeds(setDoc(doc(as(U.coachA), 'planTemplates', 'tpl_new'), template));
    await assertFails(
      setDoc(doc(as(U.playerA1), 'planTemplates', 'tpl_player'), {
        ...template,
        coachUid: U.playerA1,
      }),
    );
  });

  it('מאמן אחר באותו ארגון קורא וטוען תבנית — היא נכס של המועדון', async () => {
    await assertSucceeds(getDoc(doc(as(U.coachA2), 'planTemplates', TEMPLATE_A)));
  });

  it('הבעלים מוחק תבנית; מאמן אחר — לא. כאן מחיקה אמיתית מותרת בכוונה', async () => {
    await assertFails(deleteDoc(doc(as(U.coachA2), 'planTemplates', TEMPLATE_A)));
    await assertSucceeds(deleteDoc(doc(as(U.coachA), 'planTemplates', TEMPLATE_A)));
  });
});

describe('weeklySummaries — סכמה בלבד עד שלב 2', () => {
  it('חבר הקבוצה קורא; מי שאינו — לא', async () => {
    await assertSucceeds(getDoc(doc(as(U.playerA1), 'weeklySummaries', SUMMARY_A1)));
    await assertFails(getDoc(doc(as(U.playerA2), 'weeklySummaries', SUMMARY_A1)));
  });

  it('אף אחד לא כותב — גם לא admin', async () => {
    await assertFails(
      updateDoc(doc(as(U.adminA), 'weeklySummaries', SUMMARY_A1), { overallPct: 100 }),
    );
    await assertFails(
      updateDoc(doc(as(U.coachA), 'weeklySummaries', SUMMARY_A1), { overallPct: 100 }),
    );
  });
});

describe('ברירת מחדל: חסום', () => {
  it('קולקציה שלא הוגדרה חסומה לקריאה ולכתיבה — גם ל-admin', async () => {
    await assertFails(getDoc(doc(as(U.adminA), 'secrets', 'x')));
    await assertFails(setDoc(doc(as(U.adminA), 'secrets', 'x'), { a: 1 }));
  });
});

describe('מה שנשאר פתוח — ממתין להחלטה', () => {
  // שבעת הדגלים מסקירת 21.8.2026 תוקנו, וכל אחד מהם מכוסה עכשיו בבדיקה עם
  // ביקורת חיובית לצידה. מה שנשאר כאן הוא מה שהתגלה תוך כדי, ולא הוכרע.

  // cycleId אינו מאומת מול date — לא ביצירה ולא בעריכה. **הכרעה: לא לנעול**
  // (ראה דיווח). נעילת cycleId בעדכון הייתה שוברת עריכת תאריך רטרואקטיבית
  // לגיטימית שחוצה גבול שבוע, ולא הייתה סוגרת כלום — הערך חופשי כבר ביצירה.
  // האכיפה האמיתית היא get() על המחזור ובדיקת weekStart <= date <= weekEnd,
  // בשני המקומות יחד, וזה שייך לשלב 3 שבו נבנה מנגנון המחזורים.
  it.todo('entries: cycleId מול date — אכיפה עם get() על המחזור, בשלב 3');

  // isAdmin() אינו מוגבל לארגון של ה-admin עצמו. בכל אלה admin של ארגון א
  // יכול לגעת בתוכן של ארגון ב (השיוך עצמו כבר נעול אחרי התיקונים). היום יש
  // ארגון אחד ו-admin אחד, אבל זו התשתית הרב-ארגונית.
  it.todo('users.update: allow update: if isAdmin() — בלי sameOrg');
  it.todo('exercises.update / plans.update / planCycles.update / entries.update: ענף admin בלי sameOrg');
});
