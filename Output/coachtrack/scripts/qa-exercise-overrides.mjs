/**
 * QA חי לעותקים הפרטיים של תרגילי הקטלוג — המסע של עמנואל, מקצה לקצה.
 *
 * הרצה:
 *   npm run qa:overrides
 * (מרים אמולטור Firestore, מריץ את הקובץ הזה, ומוריד אותו.)
 *
 * ## למה מול האמולטור ולא מול המסד האמיתי
 *
 * `qa-stage5` ו-`qa-stage6` רצים מול הייצור, אבל הם **קוראים בלבד**. הפיצר הזה
 * הוא ביסודו כתיבה: יצירת עותק, ביטולו, והחייאתו. QA שיריץ אותו על המסד של
 * רונן ייצר שם מסמכים אמיתיים בספרייה של מאמן אמיתי. לכן המסע רץ על אמולטור
 * נקי — אבל **דרך אותם כללים ואותו קוד ייצור**, לא סביבם:
 *
 *   • כל קריאה וכל כתיבה נעשות בזהות משתמש מחובר, כלומר עוברות דרך
 *     `firestore.rules` בדיוק כמו בדפדפן.
 *   • הרשימה על המסך מחושבת ב-`buildExerciseLibrary` **האמיתי**, שנארז מ-
 *     `src/lib/exercises.ts` דרך Vite. אין כאן חישוב שני שיכסה על באג.
 *   • שתי השאילתות הן בדיוק אלה שב-`hooks/useExerciseLibrary.ts`.
 *
 * ## מה נבדק
 *
 *  1. עמנואל נכנס ורואה 30 תרגילי קטלוג.
 *  2. הוא מתקן אחד מהם — נוצר עותק פרטי, והרשימה נשארת 30 (לא 60, לא 31).
 *  3. מאמן שני באותה אגודה ממשיך לראות את **המקור**, לא את הגרסה של עמנואל.
 *  4. המאמן השני מתקן את אותו תרגיל בעצמו — שני העותקים חיים זה לצד זה.
 *  5. עמנואל מוסיף תרגיל משלו — 31.
 *  6. "חזרה למקור" — הרשימה חוזרת ל-30 עם השם המקורי, **והעותק לא נמחק**.
 *  7. עריכה חוזרת מחיה את אותו מסמך — לא נוצר עותק שני.
 *  8. ⚠️ הבדיקה שהכול תלוי בה: **מסמך הקטלוג לא השתנה בבית אחד** לאורך כל המסע.
 *
 * ## אין כאן מחיקה
 *
 * `deleteDoc` אינו מיובא לקובץ הזה. אי אפשר לקרוא לפונקציה שלא ייבאת.
 */

import { rmSync } from 'node:fs';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

const BUNDLE_DIR = 'scripts/.qa-overrides-bundle';
const PROJECT_ID = 'coachtrack-qa-overrides';

const ORG = 'org_kiryat_ono';
const COACH_EMANUEL = 'uid_emanuel';
const COACH_SECOND = 'uid_second_coach';
const CATALOG_ID = 'shoot_form';

let failures = 0;
const ok = (label) => console.log(`  ✓ ${label}`);
const info = (label) => console.log(`      ${label}`);
const fail = (label) => {
  failures += 1;
  console.log(`  ✗ ${label}`);
};

function check(label, condition, detail) {
  if (condition) ok(label);
  else fail(`${label}${detail ? ` — ${detail}` : ''}`);
}

/** אורז את קוד הייצור ל-ESM זמני ומחזיר אותו. */
async function loadProductionCode() {
  const { build } = await import('vite');

  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      outDir: BUNDLE_DIR,
      emptyOutDir: true,
      minify: false,
      lib: { entry: { exercises: 'src/lib/exercises.ts' }, formats: ['es'] },
      rollupOptions: {
        external: [/^firebase(\/|$)/, /^date-fns(-tz)?(\/|$)/],
        output: { entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' },
      },
    },
  });

  return import(`../${BUNDLE_DIR}/exercises.mjs`);
}

/** מסמך תרגיל קטלוג — בדיוק כמו ב-data/exercise-catalog.json: בלי coachUid. */
function catalogDoc(id, name, category) {
  return {
    scope: 'global',
    orgId: null,
    name,
    category,
    unit: 'count',
    description: `הנחיות הביצוע של ${name}`,
    videoUrl: null,
    tracksSuccess: false,
    successCapable: false,
    defaultTargets: { cadets_13_15: 300 },
    active: true,
  };
}

function userDoc(role, teamIds = []) {
  return {
    role,
    orgId: ORG,
    displayName: 'בדיקה א.',
    username: 'qa',
    teamIds,
    active: true,
    mustChangePassword: false,
    createdAt: new Date(),
  };
}

/** שתי השאילתות של hooks/useExerciseLibrary.ts — אחת לאחת. */
async function readLibrary(db, uid, lib) {
  const catalogSnapshot = await getDocs(
    query(collection(db, 'exercises'), where('scope', '==', 'global')),
  );
  const mineSnapshot = await getDocs(
    query(collection(db, 'exercises'), where('coachUid', '==', uid)),
  );

  const toDocs = (snapshot) => snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
  const mine = toDocs(mineSnapshot);

  return { entries: lib.buildExerciseLibrary(toDocs(catalogSnapshot), mine), mine };
}

function entryFor(entries, sourceId) {
  return entries.find((entry) => entry.sourceId === sourceId) ?? null;
}

async function main() {
  console.log('\nQA — עותקים פרטיים של תרגילי קטלוג\n');

  const lib = await loadProductionCode();
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');

  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: (await import('node:fs')).readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });

  await env.clearFirestore();

  // זריעה בעקיפת כללים — אחרת אי אפשר ליצור את המצב שהכללים מגנים עליו.
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations', ORG), {
      name: 'קרית אונו',
      createdAt: new Date(),
      ownerUid: 'uid_admin',
      settings: { timezone: 'Asia/Jerusalem', weekStartDay: 0 },
    });
    await setDoc(doc(db, 'users', COACH_EMANUEL), userDoc('coach'));
    await setDoc(doc(db, 'users', COACH_SECOND), userDoc('coach'));

    // קטלוג מוקטן — שלושה תרגילים. מה שנבדק הוא ההחלפה, לא הגודל.
    await setDoc(doc(db, 'exercises', CATALOG_ID), catalogDoc(CATALOG_ID, 'זריקות טכניקה', 'זריקה'));
    await setDoc(doc(db, 'exercises', 'dribble_low'), catalogDoc('dribble_low', 'כדרור נמוך', 'כדרור'));
    await setDoc(doc(db, 'exercises', 'core_plank'), catalogDoc('core_plank', 'פלאנק', 'כושר'));
  });

  const emanuelDb = env.authenticatedContext(COACH_EMANUEL).firestore();
  const secondDb = env.authenticatedContext(COACH_SECOND).firestore();

  /** צילום מסמך הקטלוג לפני שנוגעים בכלום — בדיקה 8 נשענת עליו. */
  const catalogBefore = JSON.stringify(
    (await getDoc(doc(emanuelDb, 'exercises', CATALOG_ID))).data(),
  );

  /* 1 ------------------------------------------------------------------ */
  console.log('1. עמנואל נכנס לספרייה');
  let emanuel = await readLibrary(emanuelDb, COACH_EMANUEL, lib);
  check('רואה 3 תרגילי קטלוג', emanuel.entries.length === 3, `קיבל ${emanuel.entries.length}`);
  check(
    'כולם מסומנים כקטלוג, בלי תג "נערך"',
    emanuel.entries.every((entry) => entry.origin === 'catalog'),
  );

  /* 2 ------------------------------------------------------------------ */
  console.log('2. עמנואל מתקן תרגיל קטלוג לעצמו');
  const source = entryFor(emanuel.entries, CATALOG_ID).exercise;
  const editedValues = {
    name: 'זריקות טכניקה — הגרסה של עמנואל',
    category: 'זריקה',
    unit: 'count',
    description: 'מקרוב בלבד, 5 סדרות של 20.',
    target: '250',
  };

  const copyRef = await addDoc(
    collection(emanuelDb, 'exercises'),
    lib.buildExerciseOverride(source, editedValues, ORG, COACH_EMANUEL),
  );
  info(`נוצר עותק: ${copyRef.id}`);

  emanuel = await readLibrary(emanuelDb, COACH_EMANUEL, lib);
  check('הרשימה נשארה 3 — העותק החליף, לא נוסף', emanuel.entries.length === 3, `קיבל ${emanuel.entries.length}`);

  const editedEntry = entryFor(emanuel.entries, CATALOG_ID);
  check('הכרטיס מסומן "נערך"', editedEntry?.origin === 'edited');
  check('ומציג את השם שעמנואל נתן', editedEntry?.exercise.name === editedValues.name);
  check('והוא מצביע על תרגיל הקטלוג כמקור', editedEntry?.exercise.sourceExerciseId === CATALOG_ID);

  /* 3 ------------------------------------------------------------------ */
  console.log('3. מאמן שני באותה אגודה');
  let second = await readLibrary(secondDb, COACH_SECOND, lib);
  check('רואה 3 תרגילים', second.entries.length === 3, `קיבל ${second.entries.length}`);
  check(
    'ורואה את המקור, לא את הגרסה של עמנואל',
    entryFor(second.entries, CATALOG_ID)?.exercise.name === 'זריקות טכניקה',
  );
  check('לא נשלף לו אף עותק פרטי', second.mine.length === 0, `קיבל ${second.mine.length}`);

  /* 4 ------------------------------------------------------------------ */
  console.log('4. המאמן השני מתקן את אותו תרגיל בעצמו');
  await addDoc(
    collection(secondDb, 'exercises'),
    lib.buildExerciseOverride(
      entryFor(second.entries, CATALOG_ID).exercise,
      { ...editedValues, name: 'זריקות טכניקה — הגרסה השנייה', target: '400' },
      ORG,
      COACH_SECOND,
    ),
  );

  second = await readLibrary(secondDb, COACH_SECOND, lib);
  emanuel = await readLibrary(emanuelDb, COACH_EMANUEL, lib);
  check('לכל אחד 3 תרגילים', second.entries.length === 3 && emanuel.entries.length === 3);
  check(
    'וכל אחד רואה את הגרסה שלו בלבד',
    entryFor(second.entries, CATALOG_ID)?.exercise.name === 'זריקות טכניקה — הגרסה השנייה' &&
      entryFor(emanuel.entries, CATALOG_ID)?.exercise.name === editedValues.name,
  );
  check('אף אחד לא רואה את העותק של השני', emanuel.mine.length === 1 && second.mine.length === 1);

  /* 5 ------------------------------------------------------------------ */
  console.log('5. עמנואל מוסיף תרגיל משלו');
  await addDoc(
    collection(emanuelDb, 'exercises'),
    lib.buildCoachExercise(
      { name: 'קפיצות חבל', category: 'כושר', unit: 'minutes', description: '', target: '20' },
      ORG,
      COACH_EMANUEL,
    ),
  );
  emanuel = await readLibrary(emanuelDb, COACH_EMANUEL, lib);
  check('הרשימה גדלה ל-4', emanuel.entries.length === 4, `קיבל ${emanuel.entries.length}`);
  check(
    'התרגיל החדש מסומן "שלי"',
    emanuel.entries.find((entry) => entry.exercise.name === 'קפיצות חבל')?.origin === 'mine',
  );
  check('והמאמן השני לא רואה אותו', (await readLibrary(secondDb, COACH_SECOND, lib)).entries.length === 3);

  /* 6 ------------------------------------------------------------------ */
  console.log('6. חזרה למקור');
  await updateDoc(doc(emanuelDb, 'exercises', copyRef.id), { active: false });

  emanuel = await readLibrary(emanuelDb, COACH_EMANUEL, lib);
  check('הרשימה נשארה 4 — התרגיל לא נעלם', emanuel.entries.length === 4, `קיבל ${emanuel.entries.length}`);
  check(
    'ותרגיל הקטלוג חזר בשמו המקורי',
    entryFor(emanuel.entries, CATALOG_ID)?.exercise.name === 'זריקות טכניקה',
  );
  check('הכרטיס כבר לא מסומן "נערך"', entryFor(emanuel.entries, CATALOG_ID)?.origin === 'catalog');

  const copyAfterRevert = await getDoc(doc(emanuelDb, 'exercises', copyRef.id));
  check('⚠️ העותק לא נמחק — הוא רק כבוי', copyAfterRevert.exists() && copyAfterRevert.data().active === false);

  /* 7 ------------------------------------------------------------------ */
  console.log('7. עמנואל עורך שוב את אותו תרגיל');
  const existing = lib.findOverrideFor(emanuel.mine, CATALOG_ID);
  check('נמצא העותק הכבוי — ולא ייווצר שני', existing?.id === copyRef.id);

  await updateDoc(
    doc(emanuelDb, 'exercises', existing.id),
    lib.overrideRevivalFromForm({ ...editedValues, name: 'זריקות טכניקה — שוב שלי' }),
  );

  emanuel = await readLibrary(emanuelDb, COACH_EMANUEL, lib);
  check('הרשימה 4, והעותק חזר להציג', emanuel.entries.length === 4);
  check(
    'עם השם החדש ותג "נערך"',
    entryFor(emanuel.entries, CATALOG_ID)?.exercise.name === 'זריקות טכניקה — שוב שלי' &&
      entryFor(emanuel.entries, CATALOG_ID)?.origin === 'edited',
  );
  const copiesForSource = emanuel.mine.filter((e) => e.sourceExerciseId === CATALOG_ID);
  check('ורק מסמך עותק אחד למקור הזה', copiesForSource.length === 1, `נמצאו ${copiesForSource.length}`);

  /* 8 ------------------------------------------------------------------ */
  console.log('8. מסמך הקטלוג עצמו');
  const catalogAfter = JSON.stringify((await getDoc(doc(emanuelDb, 'exercises', CATALOG_ID))).data());
  check('⚠️ לא השתנה בבית אחד לאורך כל המסע', catalogAfter === catalogBefore);
  if (catalogAfter !== catalogBefore) {
    info(`לפני: ${catalogBefore}`);
    info(`אחרי: ${catalogAfter}`);
  }

  /* 9 ------------------------------------------------------------------ */
  console.log('9. הכללים חוסמים גם כשהממשק לא מציע');
  const denied = async (label, action) => {
    try {
      await action();
      fail(`${label} — עבר, והיה צריך להיחסם`);
    } catch (error) {
      if (String(error?.code ?? error).includes('permission-denied')) ok(label);
      else fail(`${label} — נכשל מסיבה אחרת: ${error}`);
    }
  };

  await denied('עמנואל לא עורך את מסמך הקטלוג', () =>
    updateDoc(doc(emanuelDb, 'exercises', CATALOG_ID), { description: 'שלי' }),
  );
  await denied('עמנואל לא עורך את העותק של המאמן השני', () =>
    updateDoc(doc(emanuelDb, 'exercises', second.mine[0].id), { description: 'שלי' }),
  );
  await denied('עמנואל לא קורא את העותק של המאמן השני', () =>
    getDoc(doc(emanuelDb, 'exercises', second.mine[0].id)),
  );

  await env.cleanup();

  console.log(
    failures === 0
      ? '\nהכול עבר.\n'
      : `\n${failures} בדיקות נכשלו.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

try {
  await main();
} finally {
  rmSync(BUNDLE_DIR, { recursive: true, force: true });
}
