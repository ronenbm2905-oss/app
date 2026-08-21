#!/usr/bin/env node
/**
 * CoachTrack — סקריפט seed
 *
 * טוען את קטלוג התרגילים הגלובלי ל-Firestore, ואופציונלית יוצר
 * ארגון, קבוצה, מאמן ו-admin ראשונים.
 *
 * הרשאות: role ו-orgId נכתבים למסמך users/{uid} — לא ל-Custom Claims (הכרעה 19.8.2026,
 * ראה CLAUDE.md → "איפה נשמר התפקיד"). ה-rules קוראים אותם משם.
 *
 * הרצה:
 *   1. הורד Service Account key מקונסולת Firebase:
 *      Project Settings → Service Accounts → Generate new private key
 *   2. שמור בשם serviceAccountKey.json בתיקיית scripts/ (ודא ש-.gitignore חוסם אותו!)
 *   3. npm install firebase-admin
 *   4. node scripts/seed.js                    # רק תרגילים
 *      node scripts/seed.js --with-org         # תרגילים + ארגון + קבוצה + מאמן + admin
 */

// firebase-admin v13+ הסיר את ה-namespace הישן (admin.credential / admin.firestore()).
// ה-API המודולרי מגיע דרך subpaths — זה הייבוא הנכון מכאן והלאה.
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const auth = getAuth();

const WITH_ORG = process.argv.includes('--with-org');

// ---------- הגדרות הארגון הראשון — ערוך לפני הרצה ----------
// מזהים תיאוריים ולא 'org_main'/'team_main': האגודה מפעילה כמה מאמנים וכמה קבוצות,
// והפיילוט הוא קבוצה אחת מתוכן. מזהה גנרי היה מסבך את ההוספה של הקבוצה השנייה.
const ORG = {
  id: 'org_kiryat_ono',
  name: 'קרית אונו – דור העתיד',
  timezone: 'Asia/Jerusalem',
  weekStartDay: 0, // 0 = ראשון
};

// ⚠️ אין סיסמאות קשיחות בקובץ הזה. הריפו פאבליק.
// ב-19–21.8.2026 היו כאן סיסמאות כתובות, והן נדחפו לגיטהאב. הן הוחלפו ב-21.8.
// הסיסמה מוגרלת בכל הרצה ומודפסת פעם אחת בסוף. אם צריך ערך מסוים — להעביר
// במשתנה סביבה (`COACH_PASSWORD=... node scripts/seed.js`), לא לכתוב כאן.
function initialPassword(envVar) {
  if (process.env[envVar]) return process.env[envVar];
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (const byte of crypto.randomBytes(12)) out += alphabet[byte % alphabet.length];
  return `${out}!`;
}

// המאמן בפיילוט — לא רונן. רונן הוא ה-admin למטה.
const COACH = {
  email: 'emanuel@coachtrack.local', // Firebase Auth דורש פורמט אימייל
  username: 'emanuel',
  password: initialPassword('COACH_PASSWORD'),
  displayName: 'עמנואל ורדי',
};

// ה-admin נדרש: כתיבה לספריית התרגילים הגלובלית היא admin-only ב-firestore.rules.
// בלעדיו אי אפשר יהיה להוסיף או לערוך תרגיל גלובלי מהממשק.
const ADMIN = {
  email: 'ronen@coachtrack.local',
  username: 'ronen',
  password: initialPassword('ADMIN_PASSWORD'),
  displayName: 'רונן בן מאיר',
};

const TEAM = {
  id: 'team_yeladim_a',
  name: 'ילדים א',
  season: '2026/27',
};

// ---------------------------------------------------------------

async function seedExercises() {
  const catalogPath = path.join(__dirname, '..', 'data', 'exercise-catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  console.log(`טוען ${catalog.exercises.length} תרגילים...`);

  let batch = db.batch();
  let count = 0;

  for (const ex of catalog.exercises) {
    const ref = db.collection('exercises').doc(ex.id);
    batch.set(ref, {
      scope: 'global',
      orgId: null,
      name: ex.name,
      category: ex.category,
      unit: ex.unit,
      description: ex.description,
      videoUrl: null,
      tracksSuccess: false,
      successCapable: ex.successCapable,
      defaultTargets: ex.defaultTargets,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  await batch.commit();
  console.log(`✓ ${count} תרגילים נטענו`);
}

// יוצר משתמש ב-Auth, או מחזיר את הקיים אם כבר נוצר בהרצה קודמת (הסקריפט idempotent).
async function ensureAuthUser({ email, password, displayName }, label) {
  try {
    const user = await auth.createUser({ email, password, displayName });
    console.log(`✓ משתמש ${label} נוצר: ${user.uid}`);
    return user;
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const user = await auth.getUserByEmail(email);
      console.log(`· משתמש ${label} כבר קיים: ${user.uid}`);
      return user;
    }
    throw e;
  }
}

async function seedOrg() {
  console.log('יוצר ארגון, קבוצה, מאמן ו-admin...');

  await db.collection('organizations').doc(ORG.id).set({
    name: ORG.name,
    ownerUid: null, // יעודכן אחרי יצירת המאמן
    settings: { timezone: ORG.timezone, weekStartDay: ORG.weekStartDay },
    createdAt: FieldValue.serverTimestamp(),
  });

  const coachUser = await ensureAuthUser(COACH, 'מאמן');
  const adminUser = await ensureAuthUser(ADMIN, 'admin');

  // ההרשאות נקבעות כאן — במסמך users, לא ב-Custom Claims.
  await db.collection('users').doc(coachUser.uid).set({
    role: 'coach',
    orgId: ORG.id,
    displayName: COACH.displayName,
    username: COACH.username,
    teamIds: [TEAM.id],
    active: true,
    mustChangePassword: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection('users').doc(adminUser.uid).set({
    role: 'admin',
    orgId: ORG.id,
    displayName: ADMIN.displayName,
    username: ADMIN.username,
    teamIds: [],
    active: true,
    mustChangePassword: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection('organizations').doc(ORG.id).update({ ownerUid: coachUser.uid });

  // קבוצה
  await db.collection('teams').doc(TEAM.id).set({
    orgId: ORG.id,
    coachUid: coachUser.uid,
    name: TEAM.name,
    season: TEAM.season,
    active: true,
    settings: {
      // לוח המובילים נדחה לשלב 2 — הדגל נשאר בסכמה כתשתית, כבוי.
      leaderboardEnabled: false,
      streakThreshold: 80,
      weekStartDay: ORG.weekStartDay,
    },
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`✓ ארגון "${ORG.name}" וקבוצה "${TEAM.name}" נוצרו`);
  console.log('');
  console.log('פרטי התחברות:');
  console.log(`  מאמן — אימייל: ${COACH.email} | סיסמה: ${COACH.password}`);
  console.log(`  admin — אימייל: ${ADMIN.email} | סיסמה: ${ADMIN.password}`);
  console.log('  ⚠️  החלף סיסמאות בכניסה הראשונה');
}

(async () => {
  try {
    await seedExercises();
    if (WITH_ORG) await seedOrg();
    console.log('\nהסתיים בהצלחה.');
    process.exit(0);
  } catch (err) {
    console.error('שגיאה:', err);
    process.exit(1);
  }
})();
