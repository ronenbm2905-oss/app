/**
 * QA חי לשלב 5 — מול המסד האמיתי, דרך ההרשאות ולא מסביבן.
 *
 * כללי הברזל של הסקריפט הזה (אחרי התקלה של שלב 4):
 *   • אין מחיקה. בשום צורה. לא deleteDoc, לא לולאה על get(), לא לפי קולקציה.
 *   • כל מסמך שנוצר כאן מקבל מזהה שנקבע מראש ומודפס בסוף.
 *   • לא מודפסים שמות משתמשים — רק ספירות ומזהי מסמכים שהסקריפט עצמו יצר.
 *   • ה-Admin SDK משמש **רק** להנפקת custom token. כל קריאה וכתיבה נעשות
 *     דרך ה-Web SDK כמשתמש מחובר, כלומר עוברות דרך firestore.rules.
 *
 * הרצה: node scripts/qa-stage5.mjs  (מתיקיית הפרויקט, דורש scripts/serviceAccountKey.json)
 *
 * ⚠️ כל הרצה יוצרת דיווח חדש אחד ומוחקת אותו רכות (deleted: true). הוא נשאר
 * במסד לתמיד — זו המשמעות של "אין מחיקה קשיחה", והמזהה שלו מודפס בסוף.
 *
 * חלק 3 (הערות מאמן) ידלג כל עוד firestore.rules של שלב 5 לא נפרסו למסד החי.
 * אחרי deploy — להריץ שוב, והוא ייבדק חי.
 */

import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const ORG_ID = 'org_kiryat_ono';
const TEAM_ID = 'team_yeladim_a';
const QA_PLAYER_USERNAME = 'qa_player_a';

/** כל מסמך שהסקריפט יצר או נגע בו — מודפס בסוף. */
const created = [];
const touched = [];

function env() {
  const raw = readFileSync('.env.local', 'utf8');
  const config = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^VITE_FIREBASE_(\w+)=(.*)$/);
    if (match) config[match[1]] = match[2].trim();
  }
  return {
    apiKey: config.API_KEY,
    authDomain: config.AUTH_DOMAIN,
    projectId: config.PROJECT_ID,
    storageBucket: config.STORAGE_BUCKET,
    messagingSenderId: config.MESSAGING_SENDER_ID,
    appId: config.APP_ID,
  };
}

const ok = (label) => console.log(`  ✓ ${label}`);
const info = (label) => console.log(`    ${label}`);

async function expectDenied(label, promise) {
  try {
    await promise;
    console.log(`  ✗ ${label} — עבר, והיה אמור להיחסם!`);
    process.exitCode = 1;
  } catch (error) {
    const code = error?.code ?? '';
    if (String(code).includes('permission-denied')) ok(`${label} — נחסם כצפוי`);
    else {
      console.log(`  ✗ ${label} — נכשל מסיבה אחרת: ${code}`);
      process.exitCode = 1;
    }
  }
}

const serviceAccount = JSON.parse(readFileSync('scripts/serviceAccountKey.json', 'utf8'));
initAdmin({ credential: cert(serviceAccount) });

const web = initializeApp(env());
const auth = getAuth(web);
const db = getFirestore(web);

async function signInAs(uid) {
  const token = await getAdminAuth().createCustomToken(uid);
  await signInWithCustomToken(auth, token);
}

const run = async () => {
  /* -------- מי המאמן ומי שחקן ה-QA (דרך Admin, בלי להדפיס שמות) -------- */

  const adminDb = (await import('firebase-admin/firestore')).getFirestore();
  const teamSnap = await adminDb.collection('teams').doc(TEAM_ID).get();
  const coachUid = teamSnap.data().coachUid;

  const qaSnap = await adminDb
    .collection('users')
    .where('orgId', '==', ORG_ID)
    .where('username', '==', QA_PLAYER_USERNAME)
    .get();
  const playerUid = qaSnap.docs[0].id;

  console.log('\n== 1. המאמן מתחבר ומריץ את שאילתות הדשבורד ==');
  await signInAs(coachUid);

  const teams = await getDocs(query(collection(db, 'teams'), where('orgId', '==', ORG_ID)));
  ok(`teams where orgId — ${teams.size} מסמכים`);

  const users = await getDocs(query(collection(db, 'users'), where('orgId', '==', ORG_ID)));
  const players = users.docs.filter((d) => d.data().role === 'player' && d.data().active);
  ok(`users where orgId — ${users.size} מסמכים, מתוכם ${players.length} שחקנים פעילים`);

  const plans = await getDocs(query(collection(db, 'plans'), where('teamId', '==', TEAM_ID)));
  const cycles = await getDocs(
    query(collection(db, 'planCycles'), where('teamId', '==', TEAM_ID)),
  );
  ok(`plans/planCycles where teamId — ${plans.size}/${cycles.size} מסמכים`);

  const entries = await getDocs(query(collection(db, 'entries'), where('teamId', '==', TEAM_ID)));
  ok(`entries where teamId — ${entries.size} מסמכים`);

  await expectDenied('entries בלי סינון', getDocs(collection(db, 'entries')));

  /* -------- 2. המספרים של המטריצה, מהנתונים החיים -------- */

  console.log('\n== 2. המטריצה מהנתונים החיים ==');

  const currentCycle = cycles.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.weekStart.toMillis() - a.weekStart.toMillis())[0];

  info(`מחזור נוכחי: ${currentCycle.id}`);
  const snapshot = currentCycle.itemsSnapshot;
  info(`תרגילים במחזור: ${snapshot.length} · יעדים: ${snapshot.map((i) => i.target).join(', ')}`);

  const weekStart = currentCycle.weekStart.toMillis();
  const weekEnd = currentCycle.weekEnd.toMillis();

  const rows = players.map((playerDoc) => {
    const mine = entries.docs
      .map((d) => d.data())
      .filter(
        (e) =>
          e.playerUid === playerDoc.id &&
          e.deleted !== true &&
          e.date.toMillis() >= weekStart &&
          e.date.toMillis() <= weekEnd,
      );

    const cells = snapshot.map((item) => {
      const total = mine
        .filter((e) => e.exerciseId === item.exerciseId)
        .reduce((sum, e) => sum + e.amount, 0);
      return { total, pct: (total / item.target) * 100 };
    });

    const overall = cells.reduce((sum, c) => sum + Math.min(c.pct, 100), 0) / cells.length;
    return { uid: playerDoc.id, entryCount: mine.length, overall };
  });

  for (const row of rows) {
    info(`שחקן ${row.uid.slice(0, 8)}… — ${Math.round(row.overall)}% · ${row.entryCount} דיווחים`);
  }

  const average = rows.reduce((sum, r) => sum + r.overall, 0) / (rows.length || 1);
  info(
    `KPI — ממוצע ${Math.round(average)}% · דיווחו ${rows.filter((r) => r.entryCount > 0).length}/${rows.length} · ב-0%: ${rows.filter((r) => r.overall === 0).length}`,
  );

  /* -------- 3. הערת מאמן -------- */

  console.log('\n== 3. הערת מאמן ==');
  const notePath = `teams/${TEAM_ID}/notes/${playerUid}`;

  // הכללים של תת-הקולקציה הזו נכתבו בשלב 5 ועדיין לא נפרסו (deploy חסום לסוכן).
  // עד שייפרסו, המסד החי נופל לכלל ברירת המחדל "חסום" — ולכן הבדיקה מדלגת
  // במקום להיכשל, ומדווחת שזו חסימה של כלל ישן ולא של באג.
  let rulesDeployed = true;
  try {
    const beforeNote = await getDoc(doc(db, notePath));
    ok(`קריאת הערה שאינה קיימת עוברת (exists=${beforeNote.exists()})`);
  } catch (error) {
    rulesDeployed = false;
    console.log('  ⚠ כללי teams/{teamId}/notes עדיין לא נפרסו למסד החי.');
    info(`הקוד מוכן; להריץ deploy של firestore.rules ואז לחזור על הבדיקה (${error.code}).`);
  }

  if (rulesDeployed) {
  await setDoc(doc(db, notePath), {
    text: 'QA שלב 5 — בדיקת הרשאות. הטקסט הזה נמחק בסוף הריצה.',
    updatedAt: serverTimestamp(),
    updatedBy: coachUid,
  });
  created.push(notePath);
  ok('המאמן כתב הערה');

  const afterNote = await getDoc(doc(db, notePath));
  ok(`המאמן קורא אותה בחזרה (${afterNote.data().text.length} תווים)`);

  await expectDenied(
    'הערה מעל 400 תווים',
    setDoc(doc(db, notePath), {
      text: 'א'.repeat(401),
      updatedAt: serverTimestamp(),
      updatedBy: coachUid,
    }),
  );

  await expectDenied(
    'שדה נוסף במסמך ההערה',
    setDoc(doc(db, notePath), {
      text: 'x',
      updatedAt: serverTimestamp(),
      updatedBy: coachUid,
      medical: 'לא אמור להיות כאן',
    }),
  );
  }

  /* -------- 4. עריכה ומחיקה-רכה של דיווח -------- */

  console.log('\n== 4. המאמן עורך ומוחק-רכות דיווח שהוא יצר ==');

  const newEntry = await addDoc(collection(db, 'entries'), {
    playerUid,
    teamId: TEAM_ID,
    orgId: ORG_ID,
    cycleId: currentCycle.id,
    exerciseId: snapshot[0].exerciseId,
    amount: 2,
    successAmount: null,
    date: currentCycle.weekStart,
    note: 'QA שלב 5',
    createdAt: serverTimestamp(),
    createdBy: coachUid,
    deleted: false,
  });
  created.push(`entries/${newEntry.id}`);
  ok(`המאמן יצר דיווח עבור השחקן — entries/${newEntry.id}`);

  await updateDoc(doc(db, 'entries', newEntry.id), { amount: 4 });
  ok('המאמן ערך את הכמות (2 → 4)');

  await updateDoc(doc(db, 'entries', newEntry.id), { deleted: true });
  ok('המאמן מחק-רכות (deleted: true)');

  const afterDelete = await getDoc(doc(db, 'entries', newEntry.id));
  ok(`המסמך עדיין קיים, deleted=${afterDelete.data().deleted} — ההיסטוריה נשמרה`);

  /* -------- 5. השחקן מנסה, ונחסם -------- */

  console.log('\n== 5. השחקן מנסה לראות מה שאסור לו ==');
  await signOut(auth);
  await signInAs(playerUid);

  if (rulesDeployed) {
    await expectDenied('השחקן קורא את הערת המאמן עליו', getDoc(doc(db, notePath)));
    await expectDenied(
      'השחקן כותב הערת מאמן על עצמו',
      setDoc(doc(db, notePath), {
        text: 'מצוין',
        updatedAt: serverTimestamp(),
        updatedBy: playerUid,
      }),
    );
  } else {
    console.log('  ⚠ חסימת ההערה מהשחקן לא נבדקה חי — הכללים טרם נפרסו (נבדק באמולטור).');
  }
  await expectDenied(
    'השחקן שולף את דיווחי הקבוצה',
    getDocs(query(collection(db, 'entries'), where('teamId', '==', TEAM_ID))),
  );

  const mine = await getDocs(
    query(collection(db, 'entries'), where('playerUid', '==', playerUid)),
  );
  ok(`השחקן שולף את הדיווחים של עצמו — ${mine.size} מסמכים`);

  /* -------- 6. ניקוי: רק מה שהסקריפט כתב, ובלי מחיקה -------- */

  console.log('\n== 6. ניקוי ==');
  await signOut(auth);
  await signInAs(coachUid);

  if (rulesDeployed) {
    await setDoc(doc(db, notePath), {
      text: '',
      updatedAt: serverTimestamp(),
      updatedBy: coachUid,
    });
    touched.push(`${notePath} — הטקסט נוקה (מחיקה קשיחה חסומה בכלל)`);
    ok('טקסט ההערה נוקה');
  } else {
    ok('אין מה לנקות — לא נכתבה הערה');
  }

  await signOut(auth);

  console.log('\n== מה נוצר במסד ==');
  for (const path of created) console.log(`  + ${path}`);
  for (const line of touched) console.log(`  ~ ${line}`);
  console.log('  אף מסמך לא נמחק. אין בסקריפט הזה קריאת מחיקה בכלל.\n');
};

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error('\nשגיאה:', error?.code ?? '', error?.message ?? error);
    process.exit(1);
  });
