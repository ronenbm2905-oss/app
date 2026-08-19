#!/usr/bin/env node
/**
 * CoachTrack — איפוס סיסמה לשחקן
 *
 * למה זה סקריפט ולא כפתור בממשק:
 * השחקנים מקבלים אימיילים סינתטיים (player_dani@coachtrack.local), אז
 * sendPasswordResetEmail לא רלוונטי — אין תיבת דואר לשלוח אליה. שינוי סיסמה
 * של משתמש אחר אפשרי רק דרך Admin SDK, וה-MVP הוא בלי Cloud Functions.
 * בשלב 2 זה יהפוך ל-Cloud Function שהמאמן מפעיל מהמסך.
 *
 * הרצה:
 *   node scripts/reset-password.js <username|email> [סיסמה-חדשה]
 *
 * דוגמאות:
 *   node scripts/reset-password.js dani                # מגריל סיסמה זמנית
 *   node scripts/reset-password.js dani Basket2026!    # קובע סיסמה מפורשת
 *
 * דורש scripts/serviceAccountKey.json (חסום ב-.gitignore).
 */

const crypto = require('crypto');
const admin = require('firebase-admin');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const auth = admin.auth();

const EMAIL_DOMAIN = 'coachtrack.local';

const [target, explicitPassword] = process.argv.slice(2);

if (!target) {
  console.error('שימוש: node scripts/reset-password.js <username|email> [סיסמה-חדשה]');
  process.exit(1);
}

// סיסמה זמנית קריאה להכתבה בטלפון — בלי תווים שקל לבלבל ביניהם.
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `${out}!`;
}

async function findUser(value) {
  const email = value.includes('@') ? value : `${value}@${EMAIL_DOMAIN}`;
  try {
    return await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }

  // נפילה אחורה: חיפוש לפי שדה username במסמכי users, למקרה שהאימייל בנוי אחרת
  const snap = await db.collection('users').where('username', '==', value).limit(2).get();
  if (snap.empty) return null;
  if (snap.size > 1) {
    throw new Error(`יותר ממשתמש אחד עם username "${value}" — הרץ עם האימייל המלא`);
  }
  return auth.getUser(snap.docs[0].id);
}

(async () => {
  try {
    const user = await findUser(target);
    if (!user) {
      console.error(`לא נמצא משתמש עבור "${target}"`);
      process.exit(1);
    }

    const password = explicitPassword || generatePassword();
    await auth.updateUser(user.uid, { password });

    // מכריח החלפה בכניסה הבאה. merge כדי לא לדרוס את שאר הפרופיל.
    await db.collection('users').doc(user.uid).set({ mustChangePassword: true }, { merge: true });

    const profile = await db.collection('users').doc(user.uid).get();
    const displayName = profile.exists ? profile.data().displayName : user.displayName;

    console.log('');
    console.log(`✓ הסיסמה אופסה עבור ${displayName || user.email}`);
    console.log(`  אימייל: ${user.email}`);
    console.log(`  סיסמה חדשה: ${password}`);
    console.log('  השחקן יתבקש להחליף אותה בכניסה הבאה.');
    console.log('');
    process.exit(0);
  } catch (err) {
    console.error('שגיאה:', err.message || err);
    process.exit(1);
  }
})();
