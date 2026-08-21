/**
 * CoachTrack — האינסטנס המשני של Firebase, ויצירת חשבון שחקן.
 *
 * ## הבעיה שהקובץ הזה פותר
 *
 * `createUserWithEmailAndPassword` לא "יוצר משתמש" — הוא **מחליף את המשתמש
 * המחובר**. אם המאמן יקרא לו על האינסטנס הראשי, הוא יימצא פתאום מחובר כשחקן
 * שהרגע יצר: הדשבורד ייעלם, ה-rules יפסיקו להתיר לו לכתוב, והמסך הבא שהוא יראה
 * יהיה "השבוע שלי" של ילד אחר. זו מלכודת 7 ב-TASKS.md.
 *
 * הפתרון היחיד בלי Cloud Functions הוא **אינסטנס שני של Firebase** (`initializeApp(config, 'admin')`),
 * שיש לו מצב אימות נפרד לחלוטין מהראשי. יוצרים בו את המשתמש, מתנתקים ממנו מיד,
 * והסשן של המאמן באינסטנס הראשי לא זז.
 *
 * ## שתי הקפדות שבלעדיהן זה עדיין נשבר
 *
 * 1. **`inMemoryPersistence`** — בלעדיו האינסטנס המשני שומר את השחקן שנוצר
 *    ל-IndexedDB. אחרי רענון של הדף יש סשן רפאים על הדיסק. כאן הוא נעלם עם הטאב.
 * 2. **מסמך `users/{uid}` נכתב דרך האינסטנס הראשי** (`db`), כלומר **בזהות המאמן** —
 *    כי `firestore.rules` מתירים יצירת משתמש למאמן (`isCoach() && role == 'player'`),
 *    ולא לשחקן שזה עתה נולד. כתיבה מהאינסטנס המשני הייתה נחסמת.
 *
 * המאמן יכול ליצור **שחקנים בלבד**. אין כאן פרמטר `role` בכוונה — גם אם מישהו
 * ינסה, הכלל ב-`firestore.rules` יחסום. שכבת ה-UI לא מנסה בכלל.
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  signOut,
  type Auth,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, getFirebaseConfig } from './firebase';
import { usernameToEmail } from './auth';
import type { User, WriteModel } from '../types/types';

/** שם האינסטנס המשני. כל שם שאינו `[DEFAULT]` יוצר מצב אימות נפרד. */
const ADMIN_APP_NAME = 'admin';

/**
 * האינסטנס המשני, נוצר פעם אחת ונשמר.
 *
 * ה-guard על `getApps()` נדרש בגלל HMR של Vite: קריאה שנייה ל-`initializeApp`
 * עם אותו שם זורקת `app/duplicate-app`.
 */
function getAdminApp(): FirebaseApp {
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  return existing ?? initializeApp(getFirebaseConfig(), ADMIN_APP_NAME);
}

/**
 * ה-Auth של האינסטנס המשני, עם persistence בזיכרון בלבד.
 *
 * `initializeAuth` זורק אם כבר אותחל לאותה אפליקציה, ולכן יש נפילה אחורה
 * ל-`getAuth` — שמחזיר את מה שכבר קיים.
 */
export function getAdminAuth(): Auth {
  const app = getAdminApp();
  try {
    return initializeAuth(app, { persistence: inMemoryPersistence });
  } catch {
    return getAuth(app);
  }
}

/** קלט יצירת שחקן. **אין כאן שדות נוספים בכוונה** — כלל 7, מזעור נתונים על קטינים. */
export interface CreatePlayerInput {
  /** שם פרטי + אות ראשונה של משפחה. */
  displayName: string;
  /** שם משתמש להתחברות (לטיני). ממנו נגזר האימייל הסינתטי. */
  username: string;
  /** סיסמה ראשונית שהמאמן מוסר לשחקן. הוא יידרש להחליף אותה בכניסה הראשונה. */
  password: string;
  orgId: string;
  teamIds: string[];
}

export interface CreatePlayerResult {
  uid: string;
  username: string;
}

/**
 * חשבון ה-Auth נוצר אבל מסמך הפרופיל לא נכתב.
 *
 * זה המצב היחיד שדורש התערבות ידנית, ולכן הוא טיפוס שגיאה נפרד ולא הודעה גנרית:
 * בלי מסמך `users/{uid}` המשתמש יתחבר ויראה את מסך "החשבון עדיין לא מוכן"
 * (מלכודת 5). ה-UI מציג בגללו הנחיה מפורשת עם שם המשתמש.
 */
export class PlayerProfileWriteError extends Error {
  readonly uid: string;
  readonly username: string;

  constructor(username: string, uid: string, cause: unknown) {
    super(`הפרופיל של ${username} לא נכתב (uid=${uid})`);
    this.name = 'PlayerProfileWriteError';
    this.uid = uid;
    this.username = username;
    this.cause = cause;
  }
}

/**
 * יוצרת חשבון שחקן: משתמש ב-Auth דרך האינסטנס המשני, ומסמך `users/{uid}`
 * דרך האינסטנס הראשי (בזהות המאמן).
 *
 * הסדר קבוע: יצירה → **התנתקות מהמשני** → כתיבת המסמך. ההתנתקות ב-`finally`
 * ולא אחרי הכתיבה, כדי שגם כתיבה שנכשלה לא תשאיר את האינסטנס המשני מחובר.
 */
export async function createPlayerAccount(
  input: CreatePlayerInput,
): Promise<CreatePlayerResult> {
  const adminAuth = getAdminAuth();
  const email = usernameToEmail(input.username);

  const credential = await createUserWithEmailAndPassword(adminAuth, email, input.password);
  const uid = credential.user.uid;

  try {
    await signOut(adminAuth);
  } catch {
    // ההתנתקות מהאינסטנס המשני היא ניקיון, לא תנאי הצלחה. הסשן שלו בזיכרון
    // בלבד ונעלם עם הטאב, ואין טעם להכשיל בגללה יצירה שהצליחה.
  }

  const profile: WriteModel<User> = {
    role: 'player',
    orgId: input.orgId,
    displayName: input.displayName,
    username: input.username,
    teamIds: input.teamIds,
    active: true,
    mustChangePassword: true,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid), profile);
  } catch (error) {
    throw new PlayerProfileWriteError(input.username, uid, error);
  }

  return { uid, username: input.username };
}
