# מאיפה מתחילים

מדריך צעד־אחר־צעד מרגע זה ועד שיש לך פרויקט שרץ ו‑Claude Code שיודע מה לעשות.
זמן משוער עד סוף שלב 4: כשעה.

---

## שלב 1 — פרויקט Firebase (10 דקות, ידני)

זה החלק היחיד שאף אחד לא יכול לעשות במקומך.

1. היכנס ל‑[console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. שם: `coachtrack` (או מה שתבחר). אפשר לכבות Google Analytics.
3. **Build → Authentication → Get started → Email/Password → Enable**
4. **Build → Firestore Database → Create database →** בחר **Production mode** (לא Test — הכללים שהכנתי מחליפים את זה)
   - Location: `eur3` או `europe-west1` (קרוב לישראל, ורלוונטי לפרטיות)
5. **Build → Hosting → Get started** (אפשר לדלג על ההוראות, נחזור לזה בשלב 7)
6. **Project Settings (גלגל שיניים) → General → Your apps → Web (`</>`)**
   - שם: `coachtrack-web`
   - סמן "Also set up Firebase Hosting"
   - **העתק את אובייקט `firebaseConfig` שמופיע** — תצטרך אותו מיד

---

## שלב 2 — תיקיית הפרויקט ✅ בוצע

הפרויקט כבר יושב תחת **`Output/coachtrack/`** בריפו של צוות הסוכנים (הכרעה 19.8.2026),
עם כל קבצי החבילה במקומם: `CLAUDE.md`, `TASKS.md`, `firestore.rules`, `docs/PRD.md`,
`docs/exercise-catalog.md`, `data/exercise-catalog.json`, `scripts/seed.js` ו-`scripts/reset-password.js`.
אין `git init` נפרד — הריפו של הצוות מנהל את הגרסאות.

**מה שנשאר לך:** צור `.env.local` בשורש `Output/coachtrack/` עם הערכים מ‑`firebaseConfig`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

וצור `.gitignore`:

```
node_modules
dist
.env.local
scripts/serviceAccountKey.json
.firebase
```

> ⚠️ **שתי השורות האחרונות קריטיות.** מפתח Service Account שנדחף לגיט = גישה מלאה למסד הנתונים לכל מי שרואה את הריפו.

---

## שלב 3 — קריאה צולבת ✅ בוצע (19.8.2026)

הצוות קרא את `CLAUDE.md`, `TASKS.md`, `docs/PRD.md` ו-`firestore.rules` לפני שורת קוד ראשונה,
ומצא **שני חוסמים לוגיים, שש סתירות בין המסמכים ושלושה חורים ב-rules**. כולם הוכרעו ותוקנו
במסמכים עצמם — ההכרעות מרוכזות ב-`CLAUDE.md` → "הכרעות 19.8.2026" וב-`docs/PRD.md` §14.

**הכי חשוב לדעת מהן:**
1. **התפקיד עבר מ-Custom Claims למסמך `users/{uid}`** — אחרת מאמן לא היה יכול להוסיף שחקן
   מהממשק בלי Cloud Function.
2. **לוח המובילים ירד לשלב 2** — לשחקן לא היה מקור נתונים חוקי לחשב ממנו דירוג.
3. **`entries.date` נשמר מקובע ל-12:00 בשעון ישראל** — סוגר את מלכודת אזורי הזמן.

מכאן עובדים לפי `TASKS.md`, שלב אחרי שלב.

---

## שלב 4 — הרצת ה‑seed

אחרי ששלב 0 עובד:

1. קונסולת Firebase → **Project Settings → Service Accounts → Generate new private key**
2. שמור את הקובץ בתור `scripts/serviceAccountKey.json`
3. הרץ:

```bash
npm install firebase-admin
node scripts/seed.js --with-org
```

לפני ההרצה — **ערוך את הקבועים בראש `seed.js`**: שם הארגון, שם הקבוצה, ופרטי המאמן וה-admin.

הסקריפט ידפיס לך אימייל וסיסמה לשני משתמשים: **מאמן** ו-**admin**. ה-admin נדרש כי כתיבה
לספריית התרגילים הגלובלית היא admin-only ב-`firestore.rules`.

לאיפוס סיסמה של שחקן בהמשך: `node scripts/reset-password.js <username>`.

4. פרוס את כללי האבטחה:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore     # בחר את הפרויקט, אשר את firestore.rules הקיים
firebase deploy --only firestore:rules
```

---

## שלב 5 — משם והלאה

עובדים לפי `TASKS.md`, שלב אחרי שלב. הפרומפט לכל שלב:

```
בצע את שלב N מ-TASKS.md. אל תעבור לשלב הבא.
כשתסיים, תגיד לי בדיוק מה לבדוק ידנית כדי לאמת את קריטריון הסיום.
```

---

## חמישה כללים לעבודה עם Claude Code בפרויקט הזה

1. **שלב אחד בכל פעם.** "תבנה הכל" מייצר קוד שאתה לא מבין ולא יכול לתחזק. השלבים ב‑TASKS.md מפוצלים בכוונה.

2. **בדוק את קריטריון הסיום בעצמך.** לא "הוא אמר שסיים" — אתה פותח את הדפדפן ומוודא. כל שלב ב‑TASKS.md מסתיים בקריטריון שאפשר לבדוק בעיניים.

3. **commit בסוף כל שלב.** אם משהו נשבר בשלב 4, אתה רוצה יכולת לחזור לשלב 3 עובד.

4. **אל תדלג על הטסטים בשלב 1.** `dates.ts` ו‑`calculations.ts` הם שני הקבצים שבהם באג לא ייראה על המסך אבל ישחית לך את הנתונים. אלה 20 דקות שיחסכו לך ימים.

5. **`/clear` בין שלבים.** כשמתחילים שלב חדש, קונטקסט נקי עובד טוב יותר. Claude Code יקרא מחדש את `CLAUDE.md` ויידע איפה הוא.

---

## אם משהו נתקע

- **"Permission denied" ב‑Firestore** — כמעט תמיד **חסר מסמך `users/{uid}`** למשתמש המחובר, או שיש בו `active: false`. ההרשאות נקראות מהמסמך הזה; בלעדיו כל כלל נחסם. בדוק בקונסולה ש-uid המשתמש קיים ב-`users` ושיש בו `role` ו-`orgId`.
- **תאריכים נופלים בשבוע הלא נכון** — מישהו חישב ב‑UTC, או שמר `date` על חצות במקום על 12:00. כל חישוב תאריך חייב לעבור דרך `lib/dates.ts`.
- **"המאמן נזרק מהחשבון אחרי שהוסיף שחקן"** — יצירת המשתמש רצה על ה-app הראשי במקום על ה-secondary instance ב-`src/lib/adminClient.ts`.
- **Layout נשבר ב‑RTL** — חפש `ml-`, `mr-`, `left-`, `right-`, `text-left` בקוד. הם צריכים להיות `ms-`, `me-`, `start-`, `end-`, `text-start`.
- **Claude Code "שכח" את החוקים** — הוא כנראה לא קרא את `CLAUDE.md` בסשן הזה. פשוט תגיד לו "קרא את CLAUDE.md".

---

*חבילה זו מלווה את PRD גרסה 0.3. אם משנים החלטה מוצרית — לעדכן קודם את ה‑PRD ואת `CLAUDE.md`, ורק אז לבקש מ‑Claude Code לשנות קוד.*
