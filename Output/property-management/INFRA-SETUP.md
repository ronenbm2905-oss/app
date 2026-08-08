# הקמת תשתיות — GitHub + Firebase

מדריך צעד-אחר-צעד. חלק מהצעדים דורשים **התחברות לחשבונות שלך** (Google / GitHub) —
אותם רק אתה מריץ; Claude חסום מלהתחבר לחשבונות בשמך. כל צעד מסומן: 👤 = אתה · 🤖 = כבר בוצע.

> **סטטוס שער עדי: 🟠** — מותר להקים תשתית ולבדוק מקומית. **אסור** לעלות עם נתוני דיירים
> אמיתיים עד שסעיפי ה-🔴/⚖️ ב-`GO-LIVE-CHECKLIST.md` יסומנו. הקמת התשתית עצמה מותרת.

---

## חלק א' — GitHub (ריפו ייעודי)

- 🤖 **בוצע:** אותחל ריפו git מקומי בתיקייה הזו, ענף `main`, commit ראשון. `.env` וסודות חסומים ב-`.gitignore`.

### א.1 — התחברות ל-GitHub 👤
פותח דפדפן להזדהות (device-code). הרץ:
```bash
gh auth login
```
בחר: **GitHub.com** → **HTTPS** → **Login with a web browser** → העתק את הקוד לדפדפן.

### א.2 — יצירת הריפו ודחיפה 👤
מתוך התיקייה `Output/property-management`:
```bash
gh repo create property-management --private --source=. --remote=origin --push
```
זה יוצר ריפו **פרטי** בשם `property-management` תחת החשבון שלך, ומחבר+דוחף את ה-`main` המקומי.

### א.3 — ניקוי ה-monorepo (חד-פעמי, חשוב) 👤
כרגע הקוד קיים גם בריפו הייעודי החדש וגם ב-monorepo הישן (`ronenbm2905-oss/app`). כדי שה-monorepo
יפסיק לעקוב אחריו (אחרת ה"PUSH" הבא ייצור בלגן של "embedded repository") — הרץ מ**שורש** `cloud ai/app`:
```bash
git rm -r --cached Output/property-management
echo "Output/property-management/" >> .gitignore
git commit Output/property-management .gitignore -m "Move property-management to its own repo"
```
> הקבצים נשארים על הדיסק — רק ההצמדה ל-monorepo מוסרת. מעכשיו הריפו הייעודי הוא מקור-האמת של האפליקציה.

---

## חלק ב' — Firebase (פרויקט ענן)

### ב.1 — התחברות ל-Firebase 👤
```bash
firebase login
```
פותח דפדפן להתחברות עם חשבון Google שלך.

### ב.2 — יצירת פרויקט 👤
או דרך ה-Console (מומלץ, ויזואלי): https://console.firebase.google.com → **Add project**.
או דרך CLI:
```bash
firebase projects:create YOUR-PROJECT-ID --display-name "Property Management"
```
> בחר מזהה באותיות קטנות בלבד, למשל `ronen-property-mgmt`. **שמור אותו** — צריך אותו בהמשך.

### ב.3 — הפעלת השירותים (ב-Console) 👤
בפרויקט שיצרת, הפעל:
1. **Firestore Database** → Create database → מיקום **`me-west1` (Tel Aviv)** → מצב Production.
2. **Authentication** → Get started → ספק **Google** → Enable.
3. **Storage** → Get started → מיקום `me-west1`.
4. **(לסריקת AI בהמשך)** Functions דורש תוכנית **Blaze** (חיוב-לפי-שימוש). לא חובה עד שמפעילים את הפונקציה.

### ב.4 — קבלת ה-Web config 👤
ב-Console → **Project settings** (גלגל שיניים) → **Your apps** → **Web app** (`</>`) → רשום אפליקציה →
העתק את ערכי ה-`firebaseConfig`.

### ב.5 — מילוי `.env` 🤖👤
צור קובץ `.env` בתיקייה הזו (לא נכנס ל-git) עם הערכים מ-ב.4:
```
VITE_FB_API_KEY=...
VITE_FB_AUTH_DOMAIN=YOUR-PROJECT-ID.firebaseapp.com
VITE_FB_PROJECT_ID=YOUR-PROJECT-ID
VITE_FB_STORAGE_BUCKET=YOUR-PROJECT-ID.appspot.com
VITE_FB_SENDER_ID=...
VITE_FB_APP_ID=...
```
> תבנית מלאה ב-`.env.example`. **תגיד לי את ה-PROJECT-ID ואמלא לך את `.firebaserc` ואת שאר ההגדרות.**

### ב.6 — חיבור התיקייה לפרויקט 🤖
אחרי שאדע את ה-PROJECT-ID, אעדכן את `.firebaserc` (כרגע placeholder).

---

## חלק ג' — בדיקה מקומית מול הפרויקט האמיתי 👤
```bash
npm install
npm run build
firebase emulators:start   # בדיקת rules לפני deploy אמיתי
```

---

## חלק ד' — Deploy 🔒 (חסום עד שער עדי + רק אתה מריץ)
`firebase deploy` חסום ל-Claude. אחרי שכל 🔴/⚖️ ב-`GO-LIVE-CHECKLIST.md` סומנו:
```bash
firebase functions:secrets:set ANTHROPIC_API_KEY   # המפתח נשמר בצד השרת בלבד
firebase deploy
```

---

### מה תלוי במה
```
gh auth login ─► gh repo create --push          (GitHub מוכן)
firebase login ─► create project ─► enable svcs ─► web config ─► .env + .firebaserc  (Firebase מוכן)
                                                                  └─► npm build ─► [שער עדי] ─► deploy
```
