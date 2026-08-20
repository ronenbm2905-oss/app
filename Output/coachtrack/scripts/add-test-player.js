#!/usr/bin/env node
/**
 * CoachTrack — יצירת שחקן בדיקה
 *
 * למה סקריפט ולא הממשק: מסך "הוספת שחקן" נבנה בשלב 2. עד אז אין דרך ליצור שחקן,
 * ובלי שחקן אי אפשר לבדוק את מסלול השחקן שנבנה בשלב 1 (ניתוב ל"השבוע שלי",
 * מסך החלפת סיסמה, וחסימת הסלמת ההרשאות ב-firestore.rules).
 *
 * השחקן נוצר בדיוק כמו ששלב 2 ייצור אותו: משתמש ב-Auth עם אימייל סינתטי
 * `<username>@coachtrack.local`, ומסמך `users/{uid}` עם role: 'player',
 * ה-teamIds של הקבוצה, ו-mustChangePassword: true.
 *
 * הסקריפט אידמפוטנטי — הרצה חוזרת מאפסת את הסיסמה ואת דגל ההחלפה,
 * וכך אפשר לבדוק שוב ושוב את זרימת הכניסה הראשונה.
 *
 * הרצה:
 *   node scripts/add-test-player.js                       # ברירות מחדל
 *   node scripts/add-test-player.js <username> <סיסמה>
 *
 * דורש scripts/serviceAccountKey.json (חסום ב-.gitignore).
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();
const auth = getAuth();

// חייב להיות זהה ל-AUTH_EMAIL_DOMAIN ב-src/lib/auth.ts.
const EMAIL_DOMAIN = 'coachtrack.local';

const ORG_ID = 'org_kiryat_ono';
const TEAM_ID = 'team_yeladim_a';

const [usernameArg, passwordArg] = process.argv.slice(2);

const PLAYER = {
  username: usernameArg || 'tester',
  password: passwordArg || 'CoachTrack26!',
  // כלל 7 ב-CLAUDE.md: שם פרטי ואות ראשונה של משפחה בלבד. אלה משתמשים קטינים.
  displayName: 'בודק ב.',
};

async function ensureAuthUser({ email, password, displayName }) {
  try {
    const user = await auth.createUser({ email, password, displayName });
    return { user, created: true };
  } catch (e) {
    if (e.code !== 'auth/email-already-exists') throw e;
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName });
    return { user: existing, created: false };
  }
}

(async () => {
  try {
    const email = `${PLAYER.username}@${EMAIL_DOMAIN}`;

    // אימות מקדים: בלי הקבוצה, isTeamMember ב-rules ייכשל והשחקן לא יוכל לדווח.
    const team = await db.collection('teams').doc(TEAM_ID).get();
    if (!team.exists) {
      throw new Error(`הקבוצה ${TEAM_ID} לא קיימת. הרץ קודם: node scripts/seed.js --with-org`);
    }

    const { user, created } = await ensureAuthUser({ ...PLAYER, email });

    await db.collection('users').doc(user.uid).set(
      {
        role: 'player',
        orgId: ORG_ID,
        displayName: PLAYER.displayName,
        username: PLAYER.username,
        teamIds: [TEAM_ID],
        active: true,
        mustChangePassword: true,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log('');
    console.log(created ? '✓ שחקן בדיקה נוצר' : '✓ שחקן בדיקה עודכן (כבר היה קיים)');
    console.log(`  שם משתמש: ${PLAYER.username}`);
    console.log(`  סיסמה:     ${PLAYER.password}`);
    console.log(`  uid:       ${user.uid}`);
    console.log(`  קבוצה:     ${TEAM_ID}`);
    console.log('  בכניסה הראשונה הוא יתבקש להחליף סיסמה.');
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('שגיאה:', err.message || err);
    process.exit(1);
  }
})();
