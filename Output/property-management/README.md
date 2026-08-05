# ניהול נכסים — Property Management (פרוסה 1)

אפליקציית ווב לניהול נכסים לבעלי דירות (נכס בודד עד ~100 יחידות). **פרוסה 1** מכסה
את **צד הבעלים בהזנה ידנית**: onboarding, לובי נכסים, דף נכס עם 5 טאבים, דשבורד
כלכלי, דשבורד תקלות, ופתיחת/עריכת תקלה. עברית + אנגלית (RTL/LTR) מהיום הראשון.

הסטאק: **Vite + React 18 + Tailwind v3 + Firebase (Firestore/Auth/Hosting)**, JavaScript.

---

## הרצה מקומית (בלי הקמת ענן)

```bash
npm install
npm run dev
```

ללא קובץ `.env`, האפליקציה רצה אוטומטית ב**מצב מקומי** (`localStorage`): משתמש בודד =
בעלים, כל הנתונים נשמרים בדפדפן זה בלבד. אפשר להתחיל להשתמש מיד, לפני הקמת Firebase.

```bash
npm run build      # בונה ל-dist/
npm run preview    # תצוגה מקדימה של ה-build
```

---

## מעבר למצב ענן (Firebase)

1. צור פרויקט ב-[Firebase Console](https://console.firebase.google.com).
2. **Firestore Database** → צור, ב-**production mode**.
   - **בחירת אזור (region) — החלטה מודעת (B4, שער עדי):** המערכת אוגרת PII של דיירים
     ומסמכים. בחר region לפי מיקום המשתמשים/הרגולציה: `me-west1` (ישראל, קרוב) /
     `eur3` (GDPR) / `us-central1`. העברת PII חוצת-גבולות דורשת בחירה מודעת ותיעוד —
     ה-region **לא** מקודד באפליקציה; בחר אותו כאן, בהקמה.
3. **Authentication** → הפעל **Google**.
4. **Project settings → Your apps → Web app** → העתק את ה-config למשתני `VITE_*`
   בקובץ `.env` (העתק מ-`.env.example`):

   ```
   VITE_FB_API_KEY=...
   VITE_FB_AUTH_DOMAIN=...
   VITE_FB_PROJECT_ID=...
   VITE_FB_STORAGE_BUCKET=...
   VITE_FB_SENDER_ID=...
   VITE_FB_APP_ID=...
   ```

5. עדכן `.firebaserc` עם ה-`projectId` שלך (במקום ה-placeholder).
6. `npm run build` (ה-`VITE_*` נקראים בזמן build — כל שינוי config דורש build מחדש).

> `.env` **לעולם לא נכנס ל-git** (מופיע ב-`.gitignore`). מפתחות ה-Web ציבוריים ממילא —
> ההגנה האמיתית היא ב-`firestore.rules` / `storage.rules`.

---

## אבטחה ופרטיות (שער עדי — privacy-by-design)

- **`firestore.rules` — deny-by-default.** אין שום כלל קריאה פרוץ. כל בעלים מחזיק מסמך
  יחיד `owners/{uid}` ונגיש **רק** אם `request.auth.uid == uid`. הכשל הקטלני שנמנע:
  בעלים א' הקורא דיירי/מסמכי בעלים ב'.
- **`ownerId` בכל ישות (B1).** מעבר לבידוד ברמת המסמך, כל ישות (Property/Unit/Tenant/
  Lease/Transaction/Debt/Ticket/Document/Reminder) נושאת `ownerId` — קו-הגנה שני
  ולבסיס למודל תת-אוספים/שאילתות בפרוסות הבאות.
- **`storage.rules` — deny-by-default.** מוכן לקבצים סרוקים תחת `owners/{uid}/...` בלבד.
  בפרוסה 1 אין העלאת קבצים בפועל.
- **מזעור נתונים (B3).** ת.ז. דייר הוא שדה **אופציונלי** בלבד; אין העלאת צילום ת.ז.
  העלאת מסמכים סרוקים (חוזה/ערבים) מוכנה בסכימה (`fileRef`) אך **אינה נבנית** — הצפנה
  והחלטת אחסון ממתינות לשער עדי לפני deploy.

פרסום `rules` (המשתמש מריץ ידנית — ראה למטה):

```bash
firebase deploy --only firestore:rules,storage
```

---

## Deploy — אתה מכין, המשתמש מריץ

`firebase deploy` **חסום ל-Claude** (auto-mode classifier). לכן:

```bash
npm run build
# ואז ידנית בחלון cmd אמיתי (Win+R → cmd), בתיקיית הפרויקט:
cmd /c "npx firebase-tools deploy --only hosting,firestore:rules,storage"
```

אם ה-deploy הגלובלי נכשל, התקן מקומית והרץ מה-node_modules:

```bash
npm install firebase-tools --save-dev
node ".\node_modules\firebase-tools\lib\bin\firebase.js" deploy --only hosting
```

---

## מבנה התיקיות

```
src/
├── constants.js        # enums, מגבלות פר-תוכנית, EMPTY
├── schema.js           # factories לכל 9 הישויות (עם ownerId)
├── firebase.js         # isFirebaseConfigured + init
├── i18n.js             # מילון עברית + אנגלית, translate()
├── utils/              # format, finance, display, id, options,
│                       #   access (בידוד תפקידים), firestoreSync (תת-אוספים)
├── hooks/              # useI18n, useAuth, useData (מקומי ↔ תת-אוספים), useRole
└── components/
    ├── ui/             # Field, Select, Modal, Button, Pill, icons
    ├── tabs/           # General, TenantLease, Finance, Maintenance, Documents
    ├── Onboarding · Lobby · PropertyPage · FinancialDashboard
    ├── MaintenanceDashboard · TicketForm · PropertyForm · TopBar · LoginPage
    ├── TenantPortal (מסך 6) · MaintenanceApp (מסך 7) · DevRoleSwitcher (דמו)
    └── App.jsx
```

## מה נכלל בפרוסה 1

מודל נתונים **מלא** (כל 9 הישויות) · מסך 0 Onboarding · מסך 1 לובי · מסך 4 דף נכס
(5 טאבים) · מסך 2 דשבורד כלכלי · מסך 3 דשבורד תקלות · מסך 5 טופס תקלה · i18n he/en +
RTL/LTR · מדינה+מטבע פר-נכס · תשואה כשדה מחושב · fallback מקומי ↔ Firestore.

## מה נוסף בפרוסה 2 — שלושה תפקידים + בידוד בענן

**מסך 6 (פורטל דייר)** ו**מסך 7 (אפליקציית תחזוקה, מובייל-פירסט)**, מודל שלושה
תפקידים (`owner` / `tenant` / `maintenance`), ו**רסטרקטורינג של מודל הנתונים בענן
לתת-אוספים** — הבסיס לבידוד ברמת-מסמך.

### מבנה תת-האוספים (Firestore)

```
owners/{uid}                      ← מסמך שורש: settings בלבד (owner-only)
owners/{uid}/properties/{id}
owners/{uid}/units/{id}
owners/{uid}/tenants/{id}
owners/{uid}/leases/{id}
owners/{uid}/transactions/{id}
owners/{uid}/debts/{id}
owners/{uid}/tickets/{id}
owners/{uid}/documents/{id}
owners/{uid}/reminders/{id}
```

המודל בזיכרון נשאר אובייקט אחד נוח (מערכים) — `src/utils/firestoreSync.js` מתרגם
קריאה↔כתיבה מול תת-האוספים: `subscribeOwner` מאזין לכל תת-אוסף ומרכיב את
האובייקט; `writeOwnerDiff` כותב רק ישויות שהשתנו/נמחקו כמסמכים בודדים. **מצב מקומי
לא השתנה** (blob יחיד ב-localStorage) כדי לא לשבור את הדמו.

### איך ה-rules אוכפים כל תפקיד (deny-by-default)

- **owner** — `request.auth.uid == ownerId` → קריאה/כתיבה מלאה על כל תת-האוספים שלו.
- **tenant** — קריאה **בלבד**, ורק על מסמכים שבהם הוא ה-tenant המקושר:
  - `tenants/{id}` — רק המסמך שבו `userId == uid`.
  - `leases/{id}` — רק אם `tenantId` שלו (join דרך `get()` על מסמך הדייר).
  - `documents/{id}` — רק אם `tenantId`/`leaseId` מקושרים אליו.
  - `tickets/{id}` — קריאה רק אם `reportedByTenantId` שלו; **create** מותר רק
    לדירתו (`reportedByTenantId` שלו + `status=='open'` + `ownerId` תואם).
  - `properties/{id}` owner-only (מכיל נתונים כלכליים) — הדייר מקבל תצוגה מצומצמת
    בצד-לקוח (כתובת/סוג/סטטוס בלבד) שנגזרת מה-lease שהוא מורשה לקרוא.
  - `transactions/debts/units/reminders` — **חסומים לו לחלוטין**.
- **maintenance** — קריאה+עדכון **רק** על `tickets` שבהם `assigneeUserId == uid`,
  וה-**update** מוגבל בבדיקת diff ל-`['status','fieldPhotos']` בלבד — לא שדות
  כלכליים (`quote`/`cost`/`insurance`). אין גישה לנכסים/דיירים/כספים אחרים.
- `storage.rules` באותו מודל: owner מלא; maintenance כותב תמונות תחת
  `owners/{ownerId}/tickets/{ticketId}/**` אם הוא ה-assignee (`firestore.get`);
  tenant קורא `owners/{ownerId}/documents/{docId}/**` אם מקושר למסמך.

### בדיקה במצב מקומי (בלי ענן) — מתג התפקידים

במצב מקומי (בלי `.env`) מופיע **מתג תפקיד לדמו** בראש המסך (רצועה כתומה "מצב דמו"):
owner ↔ tenant ↔ maintenance. בוחרים דייר/איש-צוות מהרשימה ורואים את המסך המתאים.
כדי לבדוק tenant צריך תחילה להוסיף דייר (במצב owner); כדי לבדוק maintenance צריך
לשייך תקלה לאיש-צוות במייל (בטופס התקלה, שדה "שיוך לצוות תחזוקה"). הבידוד בצד-לקוח
מיושם ב-`src/utils/access.js` (מקביל לוגי ל-rules).

### מה נשאר שלד בענן (מתועד)

מסלול ה-**ענן** לתפקידי tenant/maintenance דורש **מנגנון הזמנה** שממפה משתמש→בעלים
(`user → ownerId`), כי הדייר/איש-הצוות מתחבר עם uid משלו ונתוניו יושבים תחת ה-uid
של הבעלים. הסכימה תומכת (`Tenant.userId/portalStatus`, `Ticket.assigneeUserId/
assigneeEmail/assigneeStatus`) — החיווט המלא של ההזמנה בפרוסה הבאה. ה-**rules** הם
מפרט הבידוד המחייב וכבר כתובים ומאומתים בקריאה + smoke test.

## מה נוסף בפרוסה 3 — סריקת מסמכים AI + מנוע תזכורות

### חלק 1 — סריקת מסמכים ב-AI (Claude, דרך Cloud Function)

**ארכיטקטורה:** לאפליקציית ה-Vite **אין** מפתח Anthropic. הקריאה עוברת דרך
**Firebase Cloud Function** (`functions/`) שמחזיקה את המפתח כ-secret בצד השרת.

- `functions/index.js` — `extractDocument` (onCall, region `me-west1`): מקבל
  `{ base64, mediaType, fileName }`, בונה block מסמך (PDF→`document`, תמונה→`image`)
  + text, וקורא ל-Claude עם **structured output**. מחזיר `{ docType, amount, date,
  address, name }`.
- `functions/config.js` — מודל `claude-opus-5` (קבוע, ניתן להחלפה), `max_tokens: 2048`,
  `thinking.effort: "low"` (adaptive), **בלי** `temperature`/`budget_tokens`. בדיקת
  `stop_reason === "refusal"` לפני קריאת התוכן.
- **`src/utils/aiExtract.js`** (קליינט) — `extractDocument`: במצב ענן קורא ל-Cloud
  Function דרך `httpsCallable`; במצב מקומי מחזיר **mock extractor** (בלי מפתח/רשת)
  בצורת הסכימה המדויקת — לבדיקת זרימת ה-UI (העלאה→חילוץ→מילוי).
- **UI:** בטאב המסמכים, בטופס "הוספת מסמך" — בחירת קובץ + כפתור **"סרוק עם AI"**
  (opt-in פר-מסמך), הצגת השדות שחולצו, וכפתור "מלא את הטופס".

**פרטיות (שער עדי — חשוב):** הסריקה שולחת PII של דיירים למעבד חיצוני (Anthropic).
לכן: **opt-in פר-מסמך** (לא אוטומטי), הערה גלויה שהחילוץ נעשה ע"י מעבד חיצוני,
ובאנר שהתכונה ממתינה לאישור שער הפרטיות. **`firebase deploy --only functions` חסום
עד סקירת עדי** (בסיס חוקי, יידוע דייר, DPA מול Anthropic). ראה `functions/README.md`.

בדיקה מקומית: בלי `.env` → הכפתור מחזיר **חילוץ דמה** (תג "חילוץ דמה (מקומי)"),
מזהה סוג מסמך משם הקובץ (ארנונה/חשמל/מים/חוזה) וממלא את הטופס.

### חלק 2 — מנוע תזכורות (client-side)

**`src/utils/reminders.js`** — `computeReminders(state)` מחשב תזכורות מהנתונים:
חידוש חוזה (נגזר אוטומטית מ-`Lease.endDate` של חוזים פעילים) + תזכורות שמורות
(ביטוח/דיווח מס/בדיקה שנתית מרשומות `Reminder`). כל אחת עם `leadDays` (ברירת מחדל
30); "בתוך החלון" אם נותרו ≤ leadDays ימים. **מסך "תזכורות"** (`ReminderPanel`,
נוסף לניווט) מציג הכל ממוין לפי דחיפות, עם הדגשת מה שבחלון/באיחור, והוספת/סימון
תזכורות. **בלי push/מייל** (זה v2) — חישוב ותצוגה בתוך האפליקציה בלבד.

## לא בפרוסה 3 (פרוסות הבאות)

מנגנון הזמנה מלא (user→owner) · Open Banking + קטגוריזציה אוטומטית · AI Assistant
יזום · מנוע התראות push/מייל · deploy חי של סריקת ה-AI (אחרי שער עדי).
