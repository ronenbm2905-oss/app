# מערכת שעות אימוני כדורסל — אפליקציית ענן

אפליקציית ניהול מערכת שעות למועדון כדורסל: קבוצות, מאמנים, אולמות, אימונים, אילוצים,
ייבוא משחקים מהאיגוד, לוח שבועי להדפסה, ותצוגת מאמן.

בנוי ב-**React + Vite + Tailwind**, עם **Firebase** (Firestore + Auth + Hosting) לסנכרון ענן.

---

## שני מצבי הפעלה

**1. מצב מקומי (ברירת מחדל — עובד מיד):**
כל עוד לא הגדרת Firebase, האפליקציה שומרת הכול ב-`localStorage` של הדפדפן. אפשר להשתמש בה
מלא — פשוט הנתונים נשמרים במחשב הזה בלבד ולא משותפים.

**2. מצב ענן (אחרי הגדרת Firebase):**
המשתמשים המורשים רואים אותם נתונים בזמן אמת מכל מכשיר. כניסה עם Google לפי רשימת מורשים:
**מנהלים** (`admins`) עורכים, **מאמנים/צופים** (`members`) רואים במצב קריאה בלבד, וכל מי
שאינו ברשימות אינו רואה דבר.

---

## הרצה מקומית (לפיתוח / שימוש מיידי)

```bash
npm install
npm run dev
```

פותח את האפליקציה בכתובת שמופיעה בטרמינל (בד"כ http://localhost:5173). זהו — היא עובדת
במצב מקומי, בלי צורך ב-Firebase.

---

## מעבר לענן — מדריך צעד-אחר-צעד

> את השלבים האלה צריך לבצע פעם אחת. הם דורשים את חשבון ה-Google שלך.

### שלב 1 — יצירת פרויקט Firebase
1. היכנס ל-https://console.firebase.google.com ולחץ **"Add project"**.
2. תן שם (למשל `basketball-scheduler`), אשר, וסיים.

### שלב 2 — הפעלת השירותים
בתוך הפרויקט, בתפריט הצד:
1. **Build → Firestore Database** → "Create database" → **Production mode** → בחר אזור (למשל `eur3`).
2. **Build → Authentication** → "Get started" → בלשונית **Sign-in method** הפעל **Google**.
3. **Build → Hosting** → "Get started" (אפשר לדלג על הפקודות שהוא מציג — נריץ אותן בהמשך).

### שלב 3 — העתקת ה-config לאפליקציה
1. גלגל **Project settings** (גלגל השיניים למעלה) → למטה תחת **"Your apps"** לחץ על אייקון ה-Web `</>`.
2. תן כינוי לאפליקציה, רשום — יופיע אובייקט `firebaseConfig` עם המפתחות.
3. במחשב, העתק את הקובץ `.env.example` לקובץ חדש בשם `.env`, והדבק את הערכים:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> ברגע שקובץ `.env` קיים עם מפתחות תקינים — האפליקציה עוברת אוטומטית למצב ענן.

### שלב 4 — הגדרת המנהל הראשון
ב-**Firestore Database** → לשונית **Data** → צור מסמך:
- Collection: `clubs`
- Document ID: `main`
- הוסף שדה `admins` מסוג **array**, ובתוכו את כתובת ה-Gmail שלך (למשל `you@gmail.com`).

זה מה שהופך אותך למנהל (הרשאת קריאה **וגם** כתיבה). (שאר השדות ייווצרו אוטומטית
כשתשמור מהאפליקציה.)

> **חשוב — צופים חייבים להיות ברשימת המורשים:** בעקבות מודל ההרשאות המעודכן, משתמש
> מחובר שאינו ברשימה **לא** יראה את הלוח. כדי לתת למאמן גישת צפייה, הוסף שדה
> `members` מסוג **array** והכנס אליו את כתובות ה-Gmail של הצופים.

### שלב 5 — פריסה (Deploy)
```bash
npm install -g firebase-tools     # פעם אחת, אם עדיין לא מותקן
firebase login                    # התחברות עם חשבון Google שלך
# ערוך את .firebaserc והחלף REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID במזהה הפרויקט
firebase deploy --only firestore:rules    # מעלה את כללי האבטחה
npm run build                     # בונה את האפליקציה לתיקיית dist/
firebase deploy --only hosting    # מעלה את האתר
```

בסוף התהליך תקבל כתובת ציבורית (למשל `https://basketball-scheduler.web.app`) — שתף אותה
עם המאמנים. הם ייכנסו עם Google ויראו את הלוח במצב צפייה — **בתנאי שכתובת ה-Gmail שלהם
נמצאת במערך `members`** (ראו למטה).

### הוספת מנהלים נוספים
ב-Firestore → `clubs/<המועדון>` → הוסף כתובות Gmail נוספות למערך `admins`.

### הוספת צופים (מאמנים)
ב-Firestore → `clubs/<המועדון>` → הוסף את כתובות ה-Gmail של המאמנים למערך `members`.
בלי זה הם ייכנסו עם Google אך יקבלו הודעה שאין להם הרשאת גישה.

> **חשוב — אותיות קטנות בלבד.** חוקי האבטחה משווים את הדוא"ל של המשתמש באותיות קטנות, אך אינם
> יכולים להקטין את מה שרשום ברשימה. כתובת כמו `Ronen@Gmail.com` לעולם לא תתאים — והתסמין מבלבל:
> האפליקציה תציג כפתורי עריכה, אבל כל שמירה תיכשל.

### כמה אגודות באותה מערכת (multi-club)

המועדון נקבע מהכתובת בזמן ריצה, כך שפריסה אחת משרתת כמה אגודות:

| כתובת | מועדון |
|---|---|
| `/` | ברירת המחדל (`VITE_CLUB_ID`, כברירת מחדל `main`) — כל הקישורים הקיימים ממשיכים לעבוד |
| `/c/hapoel-holon` | `clubs/hapoel-holon` |

כל מה שהיה קשיח למועדון אחד (שם, לוגו, צבעים, נקודת איסוף, זיהוי בית/חוץ, פרטים משפטיים) נמצא
בטאב **הגדרות** בתוך האפליקציה, גלוי למנהל בלבד. להקמת אגודה חדשה — ראה `docs/new-club-setup.md`.

---

## מבנה הפרויקט

```
src/
  firebase.js              אתחול Firebase (מ-env). אם אין config → מצב מקומי
  App.jsx                  ניתוב ראשי + Auth + באנרים
  constants.js             DAYS, SESSION_TYPES, COLORS, DAY_BG_COLORS
  i18n.js                  helper t() לתרגום עתידי
  hooks/
    useAuth.js             מצב התחברות (Google) + fallback מקומי
    useClubData.js         onSnapshot + save + isAdmin / localStorage
  utils/
    dates.js               זמנים, תאריכים, uid, חפיפות
    colors.js              צבעי קבוצות/סוגים
    conflicts.js           זיהוי התנגשויות והפרות אילוצים
    csv.js                 ייבוא CSV לאימונים
    games.js               ייבוא/סנכרון משחקים מהאיגוד (xlsx)
  components/
    ui/ (Select, Pill, icons)
    LoginPage, SessionForm, ManagerView, ConstraintsView,
    RostersView, GamesView, WeeklyScheduleView, CoachView
```

## אבטחה — כללי Firestore (`firestore.rules`)
מודל ההרשאות מבוסס **רשימת מורשים (allowlist)** — משתמש מחובר שאינו ברשימות אינו
רואה דבר:
- **`admins`** (מערך כתובות Gmail) — עורכים: יכולים **לקרוא וגם לכתוב**.
- **`members`** (מערך כתובות Gmail) — צופים: יכולים **לקרוא בלבד**.
- כתובת שאינה באף אחת מהרשימות — **אין לה גישה** (הקריאה נחסמת). כך נתוני המועדון
  אינם חשופים לכל בעל חשבון Google, אלא רק למי שהוזמן במפורש.

## הערות
- כל טקסטי הממשק בעברית ועטופים בתשתית `t()` לתרגום עתידי.
- `.env` **לא** נכנס ל-git (מוגדר ב-`.gitignore`) — אל תשתף את המפתחות בפומבי.
