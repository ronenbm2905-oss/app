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
כל המשתמשים רואים אותם נתונים בזמן אמת מכל מכשיר. כניסה עם Google. **מנהלים** עורכים,
**מאמנים** רואים במצב קריאה בלבד.

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

זה מה שהופך אותך למנהל. (שאר השדות ייווצרו אוטומטית כשתשמור מהאפליקציה.)

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
עם המאמנים. הם ייכנסו עם Google ויראו את הלוח במצב צפייה.

### הוספת מנהלים נוספים
ב-Firestore → `clubs/main` → הוסף כתובות Gmail נוספות למערך `admins`.

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
- כל משתמש מחובר יכול **לקרוא**.
- רק כתובות שנמצאות במערך `admins` יכולות **לכתוב**.

## הערות
- כל טקסטי הממשק בעברית ועטופים בתשתית `t()` לתרגום עתידי.
- `.env` **לא** נכנס ל-git (מוגדר ב-`.gitignore`) — אל תשתף את המפתחות בפומבי.
