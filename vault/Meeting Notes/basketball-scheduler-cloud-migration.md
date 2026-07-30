# Basketball Scheduler — המרה לאפליקציית ענן

## Overview
המרה של `scheduler_1.html` (אפליקציית React בקובץ בודד, localStorage בלבד) לאפליקציית ענן
מלאה תחת `Output/basketball-scheduler/`. הסטאק: **Vite + React 18 + Tailwind v3 + lucide-react +
SheetJS + Firebase (Firestore/Auth/Hosting)**, JavaScript (לא TS). הכלי מנהל מערכת שעות של מועדון
כדורסל: קבוצות/מאמנים/אולמות, אימונים, אילוצים, ייבוא משחקים מהאיגוד (xlsx), לוח שבועי להדפסה/PDF,
תצוגת מאמן, **דו"ח שעות חודשי לפי מאמן** (יחידה=1.5ש', מנטרל ספורטתרפיה/יורם),
ו**רשימת שחקנים לפי קבוצה** (שם/טלפון/ת.לידה/מידות/מס' גופייה, עם ייבוא מאקסל + תבנית).
מבוסס על מפרט `basketball_spec_v2.docx` (14 סעיפים). עיקרון: **המרה, לא כתיבה מחדש** —
כל הלוגיקה הועברה מהמקור ואורגנה למבנה הקבצים של סעיף 11 במפרט.

מאפיין מפתח שנבחר: **fallback מקומי** — אם אין Firebase config, האפליקציה רצה במצב localStorage
(כולם "admin"); ברגע שמוגדר `.env` עם מפתחות → מצב ענן עם `onSnapshot`, כניסת Google, והרשאות
מנהל/מאמן לפי מערך `admins` במסמך `clubs/main`.

**מודל זמן (מ-28.7.2026):** אימונים הם **מבוססי-שבוע** — לכל session שדה `weekOf` (יום ראשון של
השבוע), עם ניווט שבועות (`WeekNav`), "שכפל שבוע קודם", ועמודת "סה"כ שבוע". לא תבנית חוזרת: כל שבוע
עומד בפני עצמו (בחירת המשתמש). אילוצים נשארים כללים חוצי-שבועות.

## Open Questions
- **שער עדי לרשימת השחקנים — B1 תוקן (30.7), נותר M1:** הדגל החוסם (מדיניות הפרטיות הצהירה שקרית שלא
  נאספים טלפון/ת.לידה/פרטי קטינים) **תוקן** — שולב סעיף "נתוני שחקנים" (2א) + הוסרה ההצהרה השקרית, עם
  סימוני ⚖️ גלויים (בחירת המשתמש). השער עבר ל🟡 **אושר עם תיקונים חובה**. **נותר M1 (על המשתמש):** לאמת
  שטופס הרישום למועדון כולל הסכמת הורים המכסה אחסון דיגיטלי; ⚖️ בסיס חוקי + הסכמת קטינים טעונים עו"ד רשומה.
- **UX התחברות מאמנים (30.7):** מאמנים מתלוננים שצריך להתחבר דרך Google ולאשר בכל כניסה. לבדוק אם
  `browserLocalPersistence` מוגדר ב-useAuth (session אמור לשרוד). Email+password נשקל ונדחה כברירת מחדל —
  ראה entry 2026-07-30. פתרון מועדף: להבטיח persistence, לא להחליף ספק.
- **QA ויזואלי לפיצ'ר השבועות ממתין למשתמש (28.7):** ניווט/שכפול/עמודת סה"כ נבדקו ב-build + unit-test
  לחשבון-התאריכים, אך התצוגות דורשות Google login (מצב ענן) — אימות אינטראקטיבי אצל המשתמש אחרי deploy.
- **אישור עו"ד למסמכי הפרטיות (תיקון 13):** המשתמש בחר לפרסם גרסה נקייה בלי באנר "טעון עו"ד"
  (בחירה מודעת, כלי פנימי/סיכון נמוך). סעיפי תיקון 13 עדיין לא עברו עו"ד רשומה — מומלץ להעביר בהמשך.
- **הפצה לאגודה נוספת (רעיון עתידי):** זיהוי בית/חוץ בייבוא משחקים מקודד ל"קרית אונו"; להפוך את שם
  האגודה מ-hardcoded להגדרה + "מדריך הקמה לאגודה חדשה" לפני חלוקת עותקים. ראה [[team-expansion-noam-fullstack]].
- קובץ `.env` קיים רק במחשב הבית — במחשב המשרד צריך ליצור אותו ידנית (לא עובר דרך git).
  לכל build/deploy עתידי מהמשרד צריך את ה-`.env` שם.
- deploy עתידי: `firebase deploy` נחסם ל-Claude ע"י ה-auto-mode classifier (פעולת פרסום) —
  המשתמש מריץ ידנית דרך `cmd /c "npx firebase-tools deploy ..."` (PowerShell חוסם סקריפטים).
- ייבוא xlsx מהאיגוד אומת דרך העברת קוד נאמנה בלבד, לא עם קובץ אמיתי (לא היה קובץ דגימה בסשן).
- זיהוי בית/חוץ בפורמט החדש מקודד לפי מילות-מפתח "קרית אונו" (מהמקור) — יצטרך התאמה למועדון אחר.

פרטי הפרויקט של המשתמש: Firebase project `basketball-schedule-f0f57`, מסמך `clubs/main`,
admin = `ronenbm2905@gmail.com`.

## Session Log

### 2026-07-11 — המרת המונוליט לאפליקציית ענן [shipped]
- **What was done:** נבנתה `Output/basketball-scheduler/` מלאה. פירוק `scheduler_1.html` (2275 שורות)
  ל-`constants.js`, `utils/` (dates, colors, conflicts, csv, games), `hooks/` (useAuth, useClubData),
  `components/` (ui/Select+Pill+icons, LoginPage, SessionForm, ManagerView, ConstraintsView,
  RostersView, GamesView, WeeklyScheduleView, CoachView), `App.jsx`, `firebase.js`, `i18n.js`.
  נוספו `firestore.rules`, `firebase.json`, `.firebaserc`, `.env.example`, `.gitignore`, `README.md`
  עם מדריך הקמה בעברית.
- **Decisions:**
  - **fallback מקומי** (במקום Firebase-only) — כדי שהמשתמש (לא-טכני, אין לו עדיין Firebase) יוכל
    להשתמש ולבדוק מיד. `useClubData` בוחר מימוש לפי `isFirebaseConfigured`; ה-effect של הענן מוגן
    כדי לא לקרוס עם `db=null`.
  - אייקונים: `lucide-react` (לפי המפרט) במקום ה-inline SVG של המקור, דרך מודול `ui/icons.jsx`
    שממפה לשמות המקוריים (IconPlus וכו') — מזעור שינויים בהעברה.
  - `EMPTY` במקום `SAMPLE` בטעינה ראשונה — כלי ניהול אמיתי לא צריך קבוצות דמו.
  - שופרו שני באגים לטנטיים מהמקור: ייבוא CSV שמר `{...data, ...next}` (המקור דרס games/mapping);
    הוספת/מחיקת משחק ידני קוראת ל-`syncGamesToSessions` (המקור סנכרן משחקים ל-sessions רק בייבוא xlsx).
  - `canEdit` (=isAdmin) מועבר לכל view; במצב קריאה מוסתרים כפתורי הוספה/עריכה/מחיקה + באנר "צפייה בלבד".
- **Verification:** `npm run build` עבר (אזהרת chunk צפויה — firebase+xlsx). `npm run dev` + דפדפן,
  מצב מקומי עם נתוני-בדיקה: אומתו end-to-end כל 6 הטאבים — ניהול (2 התנגשויות + 2 הפרות אילוץ, מיון,
  pills), לוח שבועי (grid קבוצות עם תאריכים מחושבים + דוח אולם כרונולוגי), תצוגת מאמן (אימונים+אולמות+
  הפרות), משחקים (מצב ריק), קבוצות ואילוצים (רינדור). אפס שגיאות קונסול. localStorage שרד רענון.
- **Notes / Caveats:** מסלול Firebase עצמו לא נבדק בפועל (דורש פרויקט של המשתמש) — ראה Open Questions.
- **Related:** [[agent-omer]], [[dir-output]], [[skill-obsidian-vault-workflow]]

### 2026-07-11 — הקמת Firebase + תיקון באג טעינה במצב ענן [shipped]
- **What was done:** ליוויתי את המשתמש בהקמת Firebase מלאה (project `basketball-schedule-f0f57`:
  Firestore ב-eur3 production mode, Auth Google, רישום Web app, כללי אבטחה פורסמו, מסמך
  `clubs/main` עם admin). נוצר `.env` עם המפתחות + עודכן `.firebaserc`. האפליקציה עברה למצב ענן.
- **Bug fixed:** במצב ענn ה-`onSnapshot` ב-`useClubData` נרשם ב-mount עם deps `[]` — כלומר
  **לפני** שההתחברות הושלמה (request.auth=null) → הכללים חסמו → "טעינת הנתונים נכשלה", וללא
  re-subscribe אחרי login. תוקן: ה-effect ממתין ל-`user` ותלוי ב-`user?.uid`, כך שנרשם רק כשמחובר
  ומתחבר-מחדש אחרי login. אומת בדפדפן: אין באנר שגיאה, admin מזוהה, כפתורי עריכה מופיעים, נתונים נטענים.
- **Decisions:** מפתחות Firebase Web נשמרו ב-`.env` (הם ציבוריים ממילא; ההגנה האמיתית = firestore.rules).
- **Notes / Caveats:** התיקון ב-`useClubData.js` עדיין לא עבר commit/push — צריך לפני deploy ולפני
  pull במחשב המשרד.
- **Related:** [[basketball-scheduler-cloud-migration#2026-07-11]], [[push-workflow]]

### 2026-07-11 — Deploy ל-Firebase Hosting — האפליקציה חיה [shipped]
- **What was done:** push של התיקון+פיצ'ר (commit 4e98545). התקנת firebase-tools 15.24.0,
  `npm run build`, והמשתמש התחבר (`npx firebase-tools login`) והריץ `firebase deploy`. האתר עלה.
- **URL חי:** https://basketball-schedule-f0f57.web.app (אומת בדפדפן — נטען, מסך כניסת Google, ללא שגיאות).
- **Notes / Caveats:** `firebase deploy` דרך ה-Bash של Claude נחסם ע"י ה-classifier → המשתמש הריץ
  ידנית ב-cmd. PowerShith חוסם `npx.ps1` (execution policy) → פתרנו עם `cmd /c "..."` / cmd ישיר.
  config של Firebase Web מוטמע ב-build (VITE_* מ-.env בזמן build) — build חדש נדרש לכל שינוי config.
- **Related:** [[push-workflow]], [[dir-output]]

### 2026-07-23 — תיקוני שער משפטי (עדי): הרשאות + פרטיות + נגישות [built, ממתין ל-deploy]
נועם ביצע את כל תיקוני הקוד לדגלים שעדי סימנה ב-[[basketball-scheduler-legal-review]]
(המשתמש אישר תיקון מלא). הטקסט המשפטי נוסח ע"י עדי — נועם חיווט בלבד, לא ניסח.
- **B1 (חוסם) — כלל קריאה פרוץ ב-`firestore.rules`:** הוחלף `allow read: if request.auth != null`
  במודל **allowlist**: הקריאה מוגבלת ל-`admins` (עורכים) **או** `members` (צופים). מי שאינו
  באף רשימה — אין לו גישה כלל. הרול נכתב עם helpers `isAdmin()`/`isMember()` ובדיקת קיום שדה
  (`'admins' in resource.data`) כדי לא לקרוס על מסמכים ישנים. הכתיבה נשארה admin-only. נוסף
  `members: []` ל-`EMPTY` ב-`constants.js`. ב-`useClubData` הודעת השגיאה במקרה `permission-denied`
  מפנה את המשתמש לבקש הוספה לרשימת המורשים (במקום "טעינת הנתונים נכשלה" גנרי).
- **B2 (חוסם) — יידוע פרטיות + מסמכים משפטיים:** שלושת המסמכים (`privacy-policy.md`,
  `terms-of-use.md`, `accessibility-statement.md`) הועתקו מ-`adi/Outputs/` אל
  `src/legal/content/` (כדי שהאפליקציה תישאר self-contained) ומוצגים דרך **מודאל** —
  `src/legal/Markdown.jsx` (רנדרר MD→JSX מינימלי ובטוח, ללא שינוי ניסוח), `LegalModal.jsx`,
  ו-`LegalFooter.jsx` (שורת "מדיניות פרטיות · תנאי שימוש · הצהרת נגישות" עם `·` ב-`aria-hidden`).
  הפוטר הוטמע גם ב-`LoginPage` וגם בתחתית `App.jsx`. מתחת לכפתור ההתחברות נוספה שורת יידוע
  הפרטיות המדויקת של עדי. placeholders `[[ ]]` נשארו גלויים למילוי הלקוח; גם הערות הטיוטה של
  עדי מוצגות נאמנה כ-callouts (הטיוטה טעונה אישור עו"ד לפני פרסום).
- **M2 (חובה) — ניגודיות:** כל `text-stone-400` (≈2.5:1, נכשל AA) הוחלף ב-`text-stone-600`
  בכל הקומפוננטות + טקסט `text-stone-300` קריא ("טרם נקבע") ל-`stone-500`. הפוטר החדש לא
  משתמש ב-stone-400 כלל.
- **R1 (נדרש) — aria/סמנטיקה:** נוספו `aria-label` לכפתורי אייקון שחסרו (מחיקת משחק, סגירת
  הודעות ×). טאבים ראשיים ב-`App.jsx` קיבלו `role="tablist"/"tab"/"tabpanel"` + `aria-selected`
  + `aria-controls`/`aria-labelledby`. מפרידי ה-`·` בפוטר `aria-hidden`.
- **סדר קריטי (אזהרת עדי):** M2+R1 בוצעו **לפני** חיווט הצהרת הנגישות — ההצהרה מצהירה על
  4.5:1 ו-aria-labels, ולכן חייבת להיות מדויקת. אומת ש-`index.html` הוא `lang="he" dir="rtl"`.
- **Verification:** `npm run build` עבר נקי (1553 מודולים; אזהרת chunk צפויה — firebase). `npm run dev`
  עלה, ואומת ש-`?raw` של קבצי ה-MD עובר transform ומוטמע. אין כלי דפדפן ב-toolset של נועם → QA
  ויזואלי מלא (פתיחת מודאלים, טאבים בקורא-מסך, מסך login במצב ענן) ממתין לבדיקת המשתמש.
- **Notes / Caveats:** (1) שינוי ה-rules דורש פרסום מחדש: `firebase deploy --only firestore:rules`.
  (2) **צופים קיימים ייחסמו** עד שכתובותיהם יתווספו ל-`members` ב-`clubs/main` — README עודכן עם
  ההוראה. (3) build חדש + deploy hosting נדרשים לתצוגת הפוטר/המסמכים. (4) `firebase deploy` עדיין
  נחסם ל-Claude → המשתמש מריץ ידנית, **אחרי** אישור שער של עדי.
- **Related:** [[basketball-scheduler-legal-gate]], [[team-expansion-adi-legal]], [[push-workflow]]

### 2026-07-28 — בריף סטטוס + סגירת חור הקריאה (deploy rules) [shipped]
- **What was done:** המשתמש ביקש בריף סטטוס ושאל "כל מי שמקבל את הקישור ויש לו גימייל יכול
  להיכנס ולראות את האימונים — מה אפשר לעשות?". אבחנתי (`git show HEAD:firestore.rules`) שהגרסה
  ה**חיה** (commit 4e98545) עדיין עם `allow read: if request.auth != null` → כל משתמש-גימייל קורא
  הכול. הפתרון (allowlist של נועם מ-23.7) כבר היה בקוד אך לא deployed. **סגרנו:** commit+push
  (`5901f14`) → `npm run build` נקי → המשתמש הוסיף כתובות ל-`admins[]`/`members[]` ב-`clubs/main`
  והריץ `firebase deploy --only firestore:rules`. חור הקריאה נסגר: כעת קוראים רק admins או members.
- **Decisions:** פורסמו **רק ה-rules** (לא hosting) — כדי לסגור את חור האבטחה מיד בלי להיתקע על
  תנאי עדי למסמכים המשפטיים (מילוי placeholders). ניהול הגישה נעשה דרך הרשימות ב-`clubs/main`.
- **Notes / Caveats:** deploy hosting המלא (דפי הפרטיות/נגישות בפוטר) עדיין ממתין למילוי
  placeholders + אישור עו"ד — ראה Open Questions. `firebase deploy` נחסם ל-Claude → המשתמש הריץ
  ידנית (PowerShell 5.1 לא מקבל `&&` → פוצל לשתי פקודות).
- **גוצ'ה לתמיכה עתידית (הוספת צופה):** מאמן (sean.kaminer@gmail.com) נחסם אחרי שהמשתמש
  "הוסיף אותו" — הסיבה: הכתובת הוזנה בטעות לתוך מערך מקונן (ליד `coaches`/`constraints`), לא לשדה
  `members` בשורש `clubs/main`. החוק בודק **אך ורק** `members`/`admins` ברמת השורש. אבחון: הכתובת
  ב-Auth→Users הייתה זהה בול (לא case/typo), אז חיפשנו מיקום. תיקון: הוספה ל-`members` בשורש (array
  של strings) → F5 → נכנס. **חשוב:** אם `members` לא קיים במסמך — צריך ליצור אותו ידנית ב-Console
  (המסמך `clubs/main` נוצר לפני שנוסף `members: []` ל-EMPTY, אז ייתכן שאין בו את השדה). העדכון
  מיידי — אין צורך ב-redeploy, החוקים קוראים את המסמך בזמן אמת.
- **Related:** [[basketball-scheduler-legal-gate]], [[push-workflow]]

### 2026-07-28 — שיפורי UX: רוחב לוח שבועי + סידור קבוצות [built, ממתין ל-deploy hosting]
- **What was done:** שתי בקשות UX של המשתמש. (1) **לוח שבועי נחתך** — כל האפליקציה עטופה
  ב-`max-w-4xl` (896px) בעוד הטבלה צריכה ~1,280px (10 עמודות). תיקון: הטאב `weekly` בלבד מקבל
  `max-w-7xl` (App.jsx, conditional לפי `tab`), ורוחב-מינימום עמודת יום צומצם 130→112 ב-
  `WeeklyScheduleView`. שאר הטאבים נשארו `max-w-4xl` (טפסים לא נמתחים). (2) **סידור קבוצות** —
  לא הייתה דרך; נוספו חצי מעלה/מטה לכל קבוצה ב-`RostersView` (`handleMoveTeam` מחליף איברים
  במערך `data.teams` ושומר), disabled בקצוות. נוסף `IconChevronUp` ל-icons.jsx. הסדר זורם ללוח
  השבועי (שם ה-map הוא לפי `data.teams`).
- **Decisions:** חצים מעלה/מטה במקום drag-drop — אמין במובייל, נגיש (aria-label), בלי ספריות.
- **Notes / Caveats:** צבע קבוצה נגזר ממיקום במערך (`colorFor`/`colorForTeamByCoach` index-based),
  לכן **סידור מחדש מחליף צבעים** בין קבוצות — תופעת לוואי ידועה (צבע יציב-לכל-קבוצה ידרוש שמירת
  color per team). אימות: `npm run build` נקי בלבד — אין QA ויזואלי (dev מתחבר לענן ודורש Google
  login). commits `5901f14`+`03e3f1a` נדחפו. **השינויים לא חיים** עד `firebase deploy` של hosting —
  שחסום ל-Claude וגם מצריך מילוי placeholders במסמכי עדי (שער legal-gate) כי הפוטר עולה באותו deploy.
- **Related:** [[basketball-scheduler-legal-gate]], [[push-workflow]]

### 2026-07-28 — מילוי מסמכים משפטיים + deploy hosting [shipped]
- **What was done:** המשתמש בחר להשלים ולפרסם. אספתי את פרטי המועדון ומילאתי את שלושת המסמכים
  ב-`src/legal/content/`: **קרית אונו – דור העתיד** (עמותה), הכפר 2 קרית אונו, ronenbm2905@gmail.com
  (לפרטיות+נגישות+כללי), מחוז מרכז, רכז נגישות רונן בן מאיר 054-6696288, תאריך 28.7.2026.
- **Decisions:** (1) בחירה **ב'** — גרסה נקייה: הוסרו באנרי "טיוטה", הערות ⚖️, וההערה על פטור
  נגישות; המסמכים נראים מוגמרים. (2) **עמותה → הצהרת נגישות מלאה** (פטור עוסק-פטור/<100K לא חל).
  (3) סעיף ממונה הגנת פרטיות **הוסר** (לא נדרש לעמותה קטנה). (4) אישור עו"ד לתיקון 13 — נדחה
  (המשתמש מודע, ראה Open Questions).
- **Verification:** `npm run build` נקי; grep מאשר 0 `[[ ]]`/`example.com`/⚖️ בתוכן. **QA ויזואלי
  אמיתי:** הרצתי `preview_start` + `get_page_text` על מסך ההתחברות (נגיש בלי Google login) — מודאל
  מדיניות הפרטיות נפתח ומוצג נקי עם כל הפרטים מולאו. commit `1b172a9` נדחף.
- **Notes / Caveats:** ה-build כולל גם את שיפורי ה-UX (לוח רחב + סידור קבוצות) מאותו סשן. שיפורי
  ה-UX עצמם לא אומתו ויזואלית (דורשים Google login) — לאימות המשתמש.
- **Deploy:** המשתמש הריץ `cmd /c "npx firebase-tools deploy --only hosting"` → **Deploy complete**.
  אומת על האתר החי (navigate + get_page_text ל-https://basketball-schedule-f0f57.web.app): מודאל
  הצהרת הנגישות עלה עם כל הפרטים (רונן בן מאיר, 054-6696288, קרית אונו) — נקי, בלי טיוטה/placeholders.
  **שער עדי (legal-gate) נסגר במלואו — האפליקציה חיה עם הרשאות + מסמכים משפטיים.**
- **Related:** [[basketball-scheduler-legal-gate]], [[push-workflow]]

### 2026-07-28 — לוח מבוסס-שבועות (ניווט + אימונים לפי שבוע + שכפול + סה"כ) [built, ממתין ל-deploy]
- **What was done:** שינוי מודל מהותי לבקשת המשתמש: אימונים עברו מ**תבנית שבועית שחוזרת** (day-of-week
  בלבד) ל**שיוך-שבוע** — לכל session נוסף `weekOf` (ISO של יום ראשון של אותו שבוע). המשתמש בחר
  מפורשות "כל שבוע בנפרד" (לא תבנית חוזרת). קבצים: `utils/dates.js` (weekStartOf/todayWeekStart/
  shiftWeek/weekStartOfDMY/formatWeekRange), רכיב חדש `ui/WeekNav.jsx` (קודם/הבא/היום/בורר תאריך),
  `App.jsx` (state `weekStart` משותף → Manager/Weekly/Coach), `ManagerView` (סינון לשבוע + "שכפל שבוע
  קודם" + stamp weekOf ל-CSV), `WeeklyScheduleView` (סינון לשבוע + WeekNav + **עמודת "סה"כ שבוע"**),
  `CoachView` (סינון לשבוע + WeekNav), `SessionForm` (stamp weekOf + התנגשות תוך-שבועית),
  `conflicts.js` (guard `weekOf` שווה), `games.js` (weekOf מהתאריך → משחקי עונה מופיעים בשבוע הנכון).
- **Decisions:** (1) "כל שבוע בנפרד" + כפתור **שכפל שבוע קודם** (מעתיק sessions ידניים בלבד, לא fromGame)
  כדי שלא יזין הכל מאפס. (2) אילוצים נשארים **כללים חוצי-שבועות** (לא weekOf). (3) עמודת סה"כ סופרת
  לפי activeDays המוצגים. (4) **אין מיגרציה** — למשתמש לא היו sessions (רק שלד מאמנים/קבוצות/אולמות).
- **מבוסס נתונים אמיתיים:** ניתחתי PDF לו"ז אמיתי (24–30.5) — כל הסוגים כבר נתמכים (ספורטתרפיה=סגול,
  "יורם"=אתלטיקה, משחקי חוץ, כמה sessions/יום). המשתמש אישר שאין צורך בשורת "אחר" נפרדת (הערמה בתא מספיקה).
- **Verification:** `npm run build` נקי (1554 מודולים). **unit-test ב-Node** לחשבון-התאריכים — 8/8 עברו,
  כולל weekStartOfDMY("24-05-2026")→"2026-05-24" ו-formatWeekRange→"24/05–30/05/2026". preview: מסך
  ההתחברות עולה, 0 שגיאות קונסול. QA אינטראקטיבי של התצוגות ממתין למשתמש (Google login). commit `c88682e`.
- **Notes / Caveats:** לא חי עד `firebase deploy --only hosting`. sessions בלי `weekOf` (אין כאלה) לא
  יופיעו באף שבוע — התנהגות מקובלת בהיעדר מיגרציה.
- **Related:** [[basketball-scheduler-legal-gate]], [[push-workflow]]

### 2026-07-28 — מילוי-אוטומטי של מאמן מהקבוצה ב-SessionForm [built, ממתין ל-deploy]
- **What was done:** בקשת המשתמש — לכל קבוצה מאמן קבוע, אז בחירת קבוצה בטופס האימון שולפת אוטומטית
  את המאמן. `handleTeamChange` ב-`SessionForm.jsx` מגדיר `coachId` מ-`team.coachId` (אם קיים), נשאר
  editable למחליף. build נקי, commit `cb26fa1`. נכלל באותו deploy hosting עם פיצ'ר השבועות.
- **Related:** [[push-workflow]]

### 2026-07-28 — "הוסף אימון נוסף" שומר קבוצה + מאמן בעמודות משחקת/מזכירות [built, ממתין ל-deploy]
- **What was done:** שני תיקונים קטנים אחרי שהמשתמש בדק. (1) `handleSaveAndAddNext` (`ManagerView`)
  כלל רק `coachId`+`type` בין אימונים → נוסף `teamId`, כך שגם הקבוצה נשמרת (הזרימה הטבעית: כמה
  אימונים לאותה קבוצה). תווית הכפתור ב-`SessionForm` עודכנה ל"...לקבוצה זו". (2) עמודות "קבוצה
  משחקת"/"קבוצה מזכירות" ב-`WeeklyScheduleView` הציגו שם קבוצה בלבד → helper `teamWithCoach` מציג
  "קבוצה – מאמן" בבורר, בתצוגה ובהדפסה (כמו בגיליון המקורי "נערים א - טל"). build נקי, commit `183c9c2`.
- **תיקון-המשך (`c1f80b8`):** אחרי deploy התברר שה-`<select>` הצר חתך את "קבוצה – מאמן" והמאמן לא
  נראה. שונה: הבורר מציג שם קבוצה, והמאמן יורד ל**שורה נפרדת מתחתיו** (`assignDisplay`/`coachOfTeam`,
  on-screen + print).
- **Related:** [[push-workflow]]

### 2026-07-29 — דו"ח שעות חודשי לפי מאמן [built, ממתין ל-deploy]
- **What was done:** טאב חדש **"דו"ח שעות"** (`src/components/ReportView.jsx`, נוסף ל-`App.jsx` כטאב
  שביעי). בורר חודש (חצי קודם/הבא + `input type="month"` + "החודש"), מרכז לפי מאמן: סופר sessions
  בחודש הנבחר, כל יחידה = **1.5 שעות**, ממיין לפי שעות יורד, עם שורת סה"כ. כפתור הדפסה/PDF.
- **Decisions:** (1) **ניטרול לפי סוג** — "ספורטתרפיה" ו"יורם" הם שני *סוגי אימון* ב-`SESSION_TYPES`
  (יורם=אתלטיקה), אז ההחרגה שהמשתמש ביקש ("יורם לא נחשב", "ספורטרפיה לא נחשב") מיושמת כ-
  `EXCLUDED_TYPES=["ספורטתרפיה","יורם"]` — נקי ומדויק, לא לפי שם מאמן. (2) **חישוב חודש מ-weekOf+day:**
  התאריך בפועל = `weekOf` (יום א') + היסט לפי `DAYS.indexOf(day)`, ואז השוואת "YYYY-MM". קריטי כי שבוע
  יכול לגלוש בין חודשים (שבוע 24/05 → שני=01/06 שייך ליוני). (3) יחידה קבועה 1.5ש' ללא תלות ב-start/end
  (המודל המנטלי של המשתמש). (4) משחקים (בית/חוץ) **כן נספרים** כשעת עבודה של המאמן — הנחה שצוינה למשתמש.
- **Verification:** `npm run build` נקי (1555 מודולים). **unit-test ב-Node** ללוגיקת החודש/צבירה — 5/5
  עברו: צבירת מאי (טל 2→3ש', דנה 1→1.5ש'), גלישת שבוע-חוצה-חודש מוחרגת, ניטרול סוגים, ניווט חודש
  חוצה-שנה (2026-01→2025-12, 2026-12→2027-01). QA אינטראקטיבי ממתין (Google login). commit `80e33c5` (נדחף).
- **Notes / Caveats:** לא חי עד `firebase deploy --only hosting`. נכלל באותו deploy עם פיצ'ר השבועות +
  auto-fill + עמודות משחקת/מזכירות (c88682e→c1f80b8) — כולם ממתינים ל-deploy hosting אחד.
- **Related:** [[push-workflow]]

### 2026-07-30 — רשימת שחקנים לפי קבוצה + ייבוא אקסל [built, ממתין ל-deploy]
- **What was done:** טאב חדש **"שחקנים"** (`src/components/PlayersView.jsx` + `src/utils/players.js`, נוסף
  ל-`App.jsx` בין "תצוגת מאמן" ל"דו"ח שעות"). בורר קבוצה למעלה; לכל קבוצה טבלת שחקנים עם: שם, טלפון,
  תאריך לידה, מידת חולצה/מכנס/פוטר, מספר גופייה. הוספה/עריכה/מחיקה ידנית + **ייבוא מאקסל** (מושך ישר
  לקבוצה הנבחרת, מוסיף — לא דורס) + **הורדת תבנית אקסל** ריקה. מודל נתונים: `players: []` ב-`EMPTY`
  (`constants.js`), כל שחקן `{ id, teamId, name, phone, birthDate, shirtSize, pantsSize, sweaterSize, jerseyNumber }`.
- **Decisions (לפי בחירות המשתמש):** (1) **מידות = טקסט חופשי** (מתאים למידות ילדים 8/10/M...). (2) **מס' גופייה
  ייחודי לכל קבוצה** — חוסם כפילות בהוספה/עריכה ידנית ומדלג בייבוא; ייחודיות פר-קבוצה בלבד (אותו מספר מותר
  בקבוצות שונות). (3) **תבנית אקסל** נוצרת בצד-לקוח (`XLSX.writeFile`), עמודות עבריות קבועות; ייבוא מאתר את
  שורת הכותרת לפי התא "שם" → לא תלוי בסדר עמודות. (4) טלפון: מספר בן 9 ספרות (0 מוביל שנאבד באקסל) מרופד
  חזרה ל-10. (5) ת.לידה מ-Excel Date → `DD-MM-YYYY` (`formatDateFromExcel`, אותו פורמט כמו שאר האפליקציה).
  (6) ייבוא **מוסיף** ומדלג כפילות (שם+טלפון קיים, או מס' גופייה תפוס) — לא מוחק שחקנים קיימים.
- **Verification:** `npm run build` נקי (1557 מודולים, +2). **unit-test ב-Node — 14/14 עברו**: פרסור (איתור
  כותרת, ריפוד טלפון, Excel Date, סדר עמודות מעורבב, דילוג שורות ריקות), וייבוא (append, דילוג כפילות-אדם
  ומס'-גופייה תוך-קובץ ומול-קיים, אי-פגיעה בקבוצה אחרת, מס' גופייה חוזר בין קבוצות). QA אינטראקטיבי של הטאב
  ממתין למשתמש (מצב ענן דורש Google login — `.env` קיים).
- **Notes / Caveats:** (1) **שער עדי חוסם deploy** — PII של קטינים, ראה Open Questions. (2) `firestore.rules`
  הקיימים כבר מגנים על כל מסמך `clubs/main` (allowlist), כולל `players` — אין שינוי rules נדרש. (3) לא חי עד
  `firebase deploy --only hosting`; יצטרף לאותו deploy עם התכונות הממתינות (c88682e→80e33c5).
- **Related:** [[basketball-scheduler-legal-gate]], [[team-expansion-adi-legal]], [[push-workflow]]

### 2026-07-30 — תצוגת מאמן: בורר קבוצה + דוח אימונים שבועי PDF לשחקנים [built, ממתין ל-deploy]
- **What was done:** שתי תוספות ל-`CoachView.jsx` לבקשת המשתמש. (1) **בורר קבוצה** — מאמן עם 2 קבוצות
  מקבל `<Select>` "כל הקבוצות שלי" שמסנן את "האימונים שלך" (מופיע רק כשיש ≥2 קבוצות; קבוצה יחידה = משתמעת).
  קבוצות המאמן נגזרות מ-`team.coachId===coachId` **וגם** מ-teamIds שמופיעים ב-sessions שלו. (2) **דוח אימונים
  שבועי PDF** — כרטיס ירוק עם כפתור "הורדת דוח PDF" (`window.print()`) המפיק בלוק `print-only` נקי לשחקנים:
  שם מועדון + שם קבוצה + טווח שבוע + טבלת יום/תאריך/שעה/אולם/פרטים, **רק לקבוצה הנבחרת ורק לשבוע הנבחר**.
- **Decisions:** (1) המשתמש בחר **בורר קבוצה** (ולא פיצול-לפי-קבוצה). (2) הדוח משתמש בתשתית ההדפסה הקיימת
  (`print-only`/`no-print` ב-`index.css`, A4 landscape) — כל התוכן האינטראקטיבי עוטף ב-`no-print` כך שבהדפסה
  יוצא **רק** הדוח. (3) תאריכי היום מחושבים מ-`getWeekDates(weekStart)` (weekOf+יום). (4) שם המועדון קשיח
  ("קרית אונו – דור העתיד", עקבי עם המסמכים המשפטיים). (5) הכפתור מושבת אם אין קבוצה נבחרת או אין אימונים
  לקבוצה בשבוע. **מיועד לשליחה בוואטסאפ** (הדפס→שמור PDF→שיתוף).
- **Verification:** `npm run build` נקי (1557 מודולים). QA ויזואלי של ההדפסה ממתין למשתמש (מצב ענן דורש
  Google login; הדוח דורש מאמן עם sessions בשבוע).
- **Notes / Caveats:** מיצג הדפסה גלובלי הוא A4 landscape — הדוח (טבלה צרה) יוצא ממורכז, קריא. ה-`LegalFooter`
  של האפליקציה עשוי להופיע בתחתית ההדפסה (התנהגות קיימת, לא חוסם). ממתין לאותו deploy hosting.
- **Related:** [[push-workflow]]

### 2026-07-30 — תיקון B1: שילוב סעיף נתוני שחקנים במדיניות הפרטיות [built, ממתין ל-deploy]
- **What was done:** שולב במדיניות הפרטיות החיה (`src/legal/content/privacy-policy.md`) התיקון של עדי לדגל
  החוסם B1: (1) הוסרה ההצהרה השקרית "איננו אוספים... מספרי טלפון... תאריכי לידה" (נשאר "איננו אוספים ת"ז,
  כתובות מגורים או מידע רפואי"); (2) נוספה בליטה "נתוני שחקנים" בסעיף 2; (3) נוסף **סעיף 2א "נתוני שחקנים
  (כולל קטינים)"** — מטרה/מזעור, בסיס חוקי, קטינים והסכמת הורים, מי ניגש, אחסון (eur3), שמירה/מחיקה, וזכות
  עיון; (4) תאריך עדכון → 30.7.2026.
- **Decisions (בחירות המשתמש):** (1) שולב **עם סימוני ⚖️ גלויים** (בניגוד לפעם הקודמת שבחר גרסה נקייה) —
  הבסיס החוקי + הסכמת הורים מסומנים מפורשות כטעוני עו"ד רשומה. (2) **תאריך לידה נשאר מלא** (נדרש לרישום
  לליגה/איגוד) — דחיית המלצת המזעור של עדי (M2), מודע. השער עבר מ⛔ ל🟡 **אושר עם תיקונים חובה**.
- **Verification:** grep מאשר שההצהרה השקרית ירדה + סעיף 2א קיים; `npm run build` נקי (1557 מודולים, הקובץ
  מוטמע דרך `?raw`). QA ויזואלי של המודאל אחרי deploy.
- **Notes / Caveats:** **נותר M1** — על רונן לאמת שטופס הרישום כולל הסכמת הורים לאחסון דיגיטלי; ⚖️ טעון עו"ד
  בהמשך (ראה Open Questions). כעת אין דגל חוסם → deploy hosting מותר (המשתמש מריץ ידנית).
- **Related:** [[basketball-scheduler-legal-gate]], [[team-expansion-adi-legal]], [[push-workflow]]
