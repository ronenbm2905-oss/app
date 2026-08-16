# הקמת תשתית — ניהול מערך רכבים

מדריך צעד-אחר-צעד להוצאת האפליקציה ממצב "דפדפן אחד" למערכת אמיתית בענן.

**👤 = פעולה שלך** (חשבון Google/GitHub — חסום ל-Claude).
**🤖 = אני מבצעת** אחרי שתמסור לי את הפרטים.

> ⛔ **לפני שמעלים נתונים אמיתיים לענן צריך אישור שער של עדי.** נכון לכתיבת המדריך
> הסבב רץ. הקמת התשתית עצמה (שלבים א'-ג') מותרת בכל מקרה — היא לא מעלה נתונים.
> **אל תריץ את שלב ה' (deploy של Hosting עם נתונים אמיתיים) לפני שהשער נסגר.**

---

## מצב נוכחי

| | |
|---|---|
| נתונים | **localStorage של דפדפן אחד** — 36 רכבים, 29 נהגים |
| `.env` | ❌ לא קיים → האפליקציה במצב מקומי |
| `.firebaserc` | תבנית (`REPLACE_WITH_FIREBASE_PROJECT_ID`) |
| `firestore.rules` / `storage.rules` | כתובים ונקראו — **מעולם לא הורצו** |
| `firebase-tools` | ✅ 15.25.0 (דרך `npx`) |
| Java | ❌ לא מותקן → **ה-emulator לא יכול לרוץ** (ראה שלב ו') |
| git | הקוד tracked בתוך הריפו הראשי `app`, אין ריפו ייעודי (ראה שלב ז') |

> **הסיכון שדוחף את כל זה:** ניקוי נתוני הדפדפן = אובדן 36 הרכבים. אין גיבוי.

---

## שלב א' — יצירת פרויקט Firebase 👤

1. היכנס ל-[console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. שם מוצע: `fleet-management` (ה-ID יהיה משהו כמו `fleet-management-a1b2c`)
3. Google Analytics — **אפשר לכבות**, אין בו צורך כאן (ופחות איסוף נתונים = פחות חשיפה).

**מסור לי את ה-PROJECT ID.**

---

## שלב ב' — הפעלת השירותים 👤

בקונסול של הפרויקט החדש:

1. **Firestore Database** → Create database → **Production mode** →
   **Location: `me-west1` (Tel Aviv)**
   ⚠️ **המיקום נקבע פעם אחת ואי אפשר לשנות.** ישראל חשוב כאן — זה מקטין מהותית את
   סוגיית ההעברה חוצה-הגבולות בסקירה של עדי.
2. **Authentication** → Get started → **Sign-in method** → הפעל **Google**
3. **Storage** → Get started → אותו מיקום `me-west1`
   (זה היעד של סריקות הקנסות וצילומי מד-האוץ.)

---

## שלב ג' — קונפיג ה-Web 👤 → 🤖

בקונסול: **⚙️ Project settings** → גלול ל-**Your apps** → אייקון `</>` (Web) →
רשום אפליקציה בשם `fleet-web` → **בלי** Firebase Hosting בשלב הזה.

תקבל בלוק `firebaseConfig`. **העתק אותו אליי כמו שהוא** ואני אמלא:
- `.env` (שישה מפתחות `VITE_FB_*`)
- `.firebaserc` (ה-PROJECT ID)

> המפתחות האלה ציבוריים מעצם טבעם. **ההגנה האמיתית היא ה-rules** — לכן שלב ד' קודם לכל העלאה.

---

## שלב ד' — העלאת ה-rules בלבד (לפני כל נתון) 👤

**זה השלב הכי חשוב במדריך.** ברירת המחדל של Firestore ב-Production mode היא נעילה,
אבל אנחנו רוצים את הכללים שלנו למעלה **לפני** שמשהו נכתב:

```bash
cd "C:\Users\RONEN\Desktop\cloud ai\app\Output\fleet-management" && cmd /c "npx firebase-tools login"
```

ואז:

```bash
cd "C:\Users\RONEN\Desktop\cloud ai\app\Output\fleet-management" && cmd /c "npx firebase-tools deploy --only firestore:rules,storage:rules"
```

> **למה בנפרד ולא הכל ביחד:** אם ה-Hosting עולה לפני ה-rules, יש חלון שבו האפליקציה חיה
> מול מסד עם כללי ברירת מחדל. שנייה אחת של חלון כזה מספיקה.

---

## שלב ה' — Build ו-Deploy של האפליקציה 👤

**⛔ רק אחרי שעדי סגרה את השער.**

```bash
cd "C:\Users\RONEN\Desktop\cloud ai\app\Output\fleet-management" && npm run build
```

```bash
cd "C:\Users\RONEN\Desktop\cloud ai\app\Output\fleet-management" && cmd /c "npx firebase-tools deploy --only hosting"
```

> ⚠️ **`.env` נקרא בזמן build, לא בזמן ריצה.** כל שינוי בקונפיג מחייב `npm run build` מחדש
> לפני deploy — אחרת תעלה גרסה עם הקונפיג הישן.
> `firebase.json` כבר מוגדר עם `Cache-Control: no-cache` על `index.html`, כדי שלא תראה
> גרסה ישנה בטלפון אחרי deploy.

**העברת הנתונים הקיימים:** הם יושבים ב-localStorage של הדפדפן שבו עבדנו. אחרי שהענן יעלה
ותתחבר, נצטרך להעביר אותם — אל תנקה את הדפדפן הזה לפני שנעשה את זה. אם תעדיף, אפשר פשוט
**להריץ את הייבוא מהאקסל מחדש** מול הענן; ה-8 החזקות שסומנו יחזרו לבדיקה, אבל זה נקי יותר.

---

## שלב ו' — הרצת ה-rules מול emulator (G2 בשער של עדי — **חוסם**)

`firestore.rules` ו-`storage.rules` **מעולם לא הורצו** — הם רק נקראו בעיניים. זה בדיוק
סוג הפער שתפסנו כבר פעם: חסרו `match` לאוספים הפרטיים, וכל כתיבה אליהם הייתה נכשלת בענן.

**מה מוכן (13.8.2026):**

- בלוק `emulators` ב-`firebase.json` (Firestore 8080 · Storage 9199 · UI 4000).
- `scripts/rules-test.mjs` — ארבע הבדיקות שעדי דרשה, כתובות וממתינות:
  (א) משתמש לא-מחובר נדחה מכל נתיב · (ב) אדמין של ארגון א' נדחה מ-`orgs/B/**` ·
  (ג) כתיבה ל-`vehiclesPrivate` **מצליחה** לאדמין (הבאג של 12.8 היה נופל כאן) ·
  (ד) העלאה ל-Storage מחוץ לארבעת התחומים **נדחית** (G3).
- `@firebase/rules-unit-testing@3` מותקן כתלות פיתוח (גרסה 3 — היא זו שתואמת ל-firebase 10).
- `npm run rules:test` בודק קודם שהאמולטור מאזין, ואם לא — מדפיס בדיוק מה להריץ.

**החסם שנשאר:** ה-emulator הוא תהליך JVM, ו-**Java אינה מותקנת על המכונה**
(`java -version` → command not found). לכן **הבדיקות טרם הורצו — נכתבו בלבד.**

אחרי התקנת [JDK 17+](https://adoptium.net) 👤, בטרמינל אחד:

```bash
cd "C:\Users\RONEN\Desktop\cloud ai\app\Output\fleet-management" && cmd /c "npx firebase-tools emulators:start --only firestore,storage --project fleet-rules-test"
```

ובשני:

```bash
cd "C:\Users\RONEN\Desktop\cloud ai\app\Output\fleet-management" && npm run rules:test
```

או בפקודה אחת: `npm run rules:test:exec` (דורש `firebase-tools` מותקן).

**בלי זה** — הבידוד מאומת בקריאה סטטית בלבד. מה שכן אומת אוטומטית כבר עכשיו:
`npm run smoke` סורק את `storage.rules` עצמו ומוודא שארבעת התחומים מכוסים בכלל
אחד בדיוק, שאין catch-all תחת `orgs/`, ושכל נתיב מחוץ לתחומים אינו מכוסה כלל.

---

## שלב ז' — Git: ריפו ייעודי? 👤 החלטה

הקוד כרגע tracked בתוך הריפו הראשי `app`, יחד עם ה-vault וכל פרויקטי הצוות.

באפליקציית ניהול הנכסים בחרנו **ריפו ייעודי נפרד**, מאותו טעם שרלוונטי גם כאן:
מוצר פרודקשן שמחזיק **נתוני עובדים** ראוי להפרדה. אם תרצה, זה:

```bash
cd "C:\Users\RONEN\Desktop\cloud ai\app\Output\fleet-management" && git init -b main
```

ואז `gh repo create fleet-management --private --source=. --push` 👤.
**שים לב:** צריך גם להסיר את התיקייה מהמעקב של הריפו הראשי (`git rm --cached`) כדי
למנוע embedded-repo בזמן PUSH.

---

## תמצית מה שחסום לי ומחכה לך

| # | פעולה | סטטוס |
|---|---|---|
| 1 | יצירת פרויקט Firebase + מסירת ה-PROJECT ID | ממתין |
| 2 | הפעלת Firestore (`me-west1`) / Auth Google / Storage | ממתין |
| 3 | מסירת בלוק `firebaseConfig` | ממתין |
| 4 | `npx firebase-tools login` + deploy של ה-rules | ממתין |
| 5 | התקנת JDK 17+ (לאימות rules אמיתי) | אופציונלי, מומלץ |
| 6 | החלטה על ריפו ייעודי | אופציונלי |
| 7 | **מסמך יידוע לעובדים + נוהל הסבת דוח** | **חוסם את שלב ה'** |
