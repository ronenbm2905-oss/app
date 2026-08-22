/**
 * CoachTrack — הלוגיקה הטהורה של ניהול שחקנים.
 *
 * כל מה שאפשר להחליט בלי Firestore יושב כאן: ולידציה של טופס ההוספה, סינון
 * ומיון הרשימה, והפקודה שהמאמן צריך להריץ לאיפוס סיסמה. הכתיבות עצמן יושבות
 * ב-`lib/adminClient.ts` וב-`lib/playerAdmin.ts`.
 *
 * ⚠️ כלל 7 (מזעור נתונים): הטופס אוסף **ארבעה שדות בלבד** — שם תצוגה, שם משתמש,
 * סיסמה ראשונית, וקבוצה. אין ת.ז., טלפון, תאריך לידה או תמונה, גם לא כשדה
 * אופציונלי. המשתמשים הם קטינים, ומה שלא נאסף לא יכול לדלוף.
 */

import type { TranslationKey } from '../i18n/he';
import type { UserDoc } from '../types/types';
import { PASSWORD_MIN_LENGTH, isValidUsername, normalizeUsername } from './auth';

/** אורך מרבי לשם תצוגה. "יונתן ב." הוא הפורמט; 40 תווים הם כבר משהו אחר. */
export const DISPLAY_NAME_MAX_LENGTH = 40;

/** אורך הסיסמה הראשונית שהכפתור "הגרל סיסמה" מייצר. */
const GENERATED_PASSWORD_LENGTH = 10;

/**
 * רצף של 3 ספרות ומעלה בשם תצוגה — כמעט תמיד ת.ז. או טלפון שהודבקו לשדה הלא נכון.
 * זו לא ולידציה קוסמטית אלא הגנה על כלל 7.
 */
const DIGIT_RUN = /\d{3,}/;

export interface NewPlayerFormValues {
  displayName: string;
  username: string;
  password: string;
}

/** שגיאות לפי שדה. מפתחות תרגום, לא מחרוזות — כלל 8. */
export interface NewPlayerFormErrors {
  displayName?: TranslationKey;
  username?: TranslationKey;
  password?: TranslationKey;
}

/**
 * ולידציה של טופס הוספת שחקן.
 *
 * `takenUsernames` הם שמות המשתמש שכבר קיימים **בארגון של המאמן** — זה כל מה
 * שהוא רשאי לקרוא. שם שתפוס בארגון אחר לא ייתפס כאן אלא רק ב-Auth, שיחזיר
 * `auth/email-already-in-use`. שתי הבדיקות משלימות זו את זו ואף אחת מהן לבדה
 * לא מספיקה.
 */
export function validateNewPlayer(
  values: NewPlayerFormValues,
  takenUsernames: string[] = [],
): NewPlayerFormErrors {
  const errors: NewPlayerFormErrors = {};

  const displayName = values.displayName.trim();
  if (!displayName) {
    errors.displayName = 'coach.team.errors.nameRequired';
  } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = 'coach.team.errors.nameTooLong';
  } else if (DIGIT_RUN.test(displayName)) {
    errors.displayName = 'coach.team.errors.nameHasNumbers';
  }

  const username = normalizeUsername(values.username);
  if (!username) {
    errors.username = 'auth.errors.missingUsername';
  } else if (!isValidUsername(username)) {
    errors.username = 'auth.errors.invalidUsername';
  } else if (takenUsernames.map(normalizeUsername).includes(username)) {
    errors.username = 'auth.errors.usernameTaken';
  }

  if (!values.password) {
    errors.password = 'auth.errors.missingPassword';
  } else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = 'auth.errors.weakPassword';
  }

  return errors;
}

/** האם הטופס תקין. */
export function isPlayerFormValid(errors: NewPlayerFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

/**
 * אישור הסכמת ההורה — הבדיקה שחוסמת את יצירת החשבון.
 *
 * ⚖️ דרישת עדי (סקירת השער 21.8.2026, חלק ה'1): תזכורת שאיש אינו מתעד אינה
 * ראיה להסכמה. לכן נוסף **אישור אקטיבי של המאמן ברגע היצירה**, וכפתור היצירה
 * חסום בלעדיו — זה מה שהופך תזכורת לתיעוד.
 *
 * ⚠️ האישור **אינו נשמר למסד ואינו חלק מ-`NewPlayerFormValues`**. הוא אישור של
 * המאמן במעמד היצירה, לא שדה נתונים על השחקן; הראיה עצמה היא טופס ההסכמה
 * החתום ששמור אצל המועדון. מי ששוקל לכתוב אותו ל-`users/{uid}` — זו החלטה
 * משפטית ולא טכנית: לעצור ולשאול.
 *
 * מחזירה מפתח שגיאה, או `null` כשמותר ליצור.
 */
export function validateParentConsent(confirmed: boolean): TranslationKey | null {
  return confirmed ? null : 'coach.team.add.consentRequired';
}

/**
 * סיסמה ראשונית קריאה להכתבה בטלפון.
 *
 * אותו אלפבית כמו ב-`scripts/reset-password.js` בכוונה: בלי O/0 ובלי l/1/I,
 * כי הסיסמה נמסרת בקול לילד בן 13 ולא בהעתק-הדבק.
 */
export function generateInitialPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(GENERATED_PASSWORD_LENGTH);
  globalThis.crypto.getRandomValues(bytes);

  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return `${out}!`;
}

/** רק שחקנים. הרשימה מהמסד כוללת גם את המאמן ואת ה-admin של אותו ארגון. */
export function onlyPlayers(users: UserDoc[]): UserDoc[] {
  return users.filter((user) => user.role === 'player');
}

/**
 * סינון לפי קבוצה **בצד הלקוח**.
 *
 * למה לא `where('teamIds','array-contains',teamId)` בשאילתה עצמה: צירוף של
 * `array-contains` עם השוויון על `orgId` דורש אינדקס מורכב, ו-deploy של אינדקסים
 * חסום לסוכן. עם ארגון אחד ו-≤20 שחקנים הסינון כאן זול לחלוטין.
 */
export function playersOfTeam(players: UserDoc[], teamId: string | null): UserDoc[] {
  if (!teamId) return players;
  return players.filter((player) => player.teamIds.includes(teamId));
}

/** חיפוש חופשי בשם התצוגה ובשם המשתמש. */
export function searchPlayers(players: UserDoc[], term: string): UserDoc[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return players;

  return players.filter(
    (player) =>
      player.displayName.toLowerCase().includes(needle) ||
      player.username.toLowerCase().includes(needle),
  );
}

/**
 * מיון לתצוגה: פעילים לפני מושבתים, ובתוך כל קבוצה לפי שם בעברית.
 *
 * `localeCompare('he')` ולא השוואת מחרוזות: סדר יוניקוד היה שם את "אורי" אחרי
 * "בן" רק בגלל ניקוד או אות סופית.
 */
export function sortPlayers(players: UserDoc[]): UserDoc[] {
  return [...players].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.displayName.localeCompare(b.displayName, 'he');
  });
}

/** הרכבה של השלושה — מה שהמסך באמת מציג. */
export function visiblePlayers(
  users: UserDoc[],
  teamId: string | null,
  searchTerm: string,
): UserDoc[] {
  return sortPlayers(searchPlayers(playersOfTeam(onlyPlayers(users), teamId), searchTerm));
}

/**
 * הפקודה לאיפוס סיסמה.
 *
 * ⚠️ אין איפוס סיסמה מתוך האפליקציה, ואין טעם לחפש אחד: לשחקנים יש אימיילים
 * סינתטיים (`<username>@coachtrack.local`) שאין מאחוריהם תיבת דואר, ולכן
 * `sendPasswordResetEmail` חסר משמעות; ושינוי סיסמה של משתמש **אחר** אפשרי רק
 * דרך Admin SDK, שאין לו נתיב בצד לקוח. המסך מציג את הפקודה הזו כפי שהיא.
 */
export function resetPasswordCommand(username: string): string {
  return `node scripts/reset-password.js ${normalizeUsername(username)}`;
}
