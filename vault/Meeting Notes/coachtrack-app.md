# CoachTrack — אפליקציית מעקב תרגילי בית

## Overview
אפליקציית ווב שבה מאמן כדורסל מגדיר תוכנית תרגילי-בית שבועית לקבוצה, 13–18 שחקנים בני 13–15
מדווחים מהנייד מה ביצעו, והמערכת מציגה אחוזי השלמה לשחקן ולמאמן. יושבת ב-`Output/coachtrack/`.

הפרויקט **לא התחיל אצלנו** — רונן הגיע עם חבילת handoff מוכנה (`coachtrack-handoff.zip`,
19.8.2026) שכללה `CLAUDE.md` (חוקי פרויקט), `TASKS.md` (8 שלבים עם קריטריון סיום נראה-לעין),
`docs/PRD.md` v0.2, קטלוג 30 תרגילים (md+json), טיוטת `firestore.rules` ו-`scripts/seed.js`.
התפקיד שלנו התחיל בקריאה צולבת של המסמכים לפני שורת קוד ראשונה.

**המנוע:** גנרי — "תרגיל + יחידה + יעד + דיווחים מצטברים". התוכן הכדורסלי הוא דאטה, לא קוד.
**המנגנון המרכזי:** תוכנית **מתמשכת** — מפורסמת פעם אחת, וכל תחילת שבוע נפתח `planCycle`
ביצירה עצלה (בלי Cloud Function מתוזמן) עם `itemsSnapshot` שמקפיא את היעדים, כדי ששינוי יעד
היום לא ישכתב רטרואקטיבית את ההיסטוריה.
**סקופ:** MVP = ארגון אחד, קבוצה אחת, עונה אחת — על סכמה multi-tenant (ארגון→מאמן→קבוצה→שחקן),
כדי ששלב 2 (SaaS למאמנים אחרים) יהיה הרחבה ולא כתיבה מחדש.

**סטאק:** Vite + React 19 + **TypeScript** + Tailwind v3 + React Router + React Query + Firebase
(Auth/Firestore/Hosting) + Recharts + date-fns-tz. **בלי Cloud Functions** — הכל בצד לקוח + Security Rules.

זו האפליקציה השנייה של רונן באותו מועדון כדורסל, ונפרדת לגמרי מ-[[basketball-scheduler-cloud-migration]]:
שם מנהלים לו"ז אימונים ואולמות, כאן עוקבים אחרי שיעורי בית של שחקנים.

## Open Questions
- **הסכמת הורים — חוסם לפני שלב 7 (עלייה לאוויר):** המשתמשים קטינים. PRD §11 דורש נוהל הסכמה,
  ו-§14 מסמן אותו כפתוח. שער עדי חייב לרוץ לפני deploy. יש תקדים מלא ב-[[basketball-scheduler-legal-gate]],
  כולל דגל חוסם שנפל שם בדיוק על PII של קטינים ותקנון לחתימת הורה.
- **הקטלוג לא אושר בפועל:** 30 התרגילים ב-`data/exercise-catalog.json` הם הצעה. צריך לעבור
  עליהם ולהתאים למה שעמנואל באמת נותן לקבוצה (PRD §14, פתוח). **הכיול עצמו תקין** — "ילדים א"
  באגודה הוא 13–14, כלומר `defaultTargets.cadets_13_15` יושב על הטווח הנכון (רונן, 20.8).
- **סף רצף ההתמדה:** ברירת מחדל 80%. החלטה פדגוגית שטרם נסגרה.
- **אין גיבוי אוטומטי** — Spark לא כולל Scheduled backups / PITR. כל הפרויקט בנוי על "אין מחיקה
  קשיחה, ההיסטוריה נשמרת", אבל ההיסטוריה יושבת על עותק יחיד. לא חוסם MVP; להחליט לפני שהקבוצה
  המלאה נכנסת אם זה שווה Blaze או סקריפט ייצוא ידני.
- **`firestore.rules` טרם נפרסו — חוסם את שלב 1:** בקונסולה עדיין ברירת המחדל `if false`, כלומר
  האפליקציה לא תוכל לקרוא כלום. רונן מריץ `npm run fb -- login` (פעם אחת) ואז `npm run deploy:rules`
  מחלון cmd אמיתי. `firebase deploy` חסום ל-Claude.
- **סיסמת פתיחה זהה לשני המשתמשים** (`CoachTrack26!`, עם `mustChangePassword`). צריך למסור
  לעמנואל בערוץ סביר, ולוודא שהוא באמת החליף.
- **`.env.local` קיים רק במחשב הזה** — לא עובר דרך git. במחשב אחר צריך ליצור מחדש. זו בדיוק
  המלכודת שנפלנו בה ב-[[basketball-scheduler-cloud-migration]].
- **התיבות ב-`TASKS.md` לא סומנו** — שלב 0 הושלם אך לא סומן במסמך. להחליט אם מסמנים.
- **הריפו:** הפרויקט יושב תחת `Output/coachtrack/` בריפו של הצוות, בלי git משלו. לפי הכלל
  ב-[[git-repo-topology]] ("ריפו לכל יעד deploy") הוא יצטרך ריפו עצמאי כשיגיע ל-Firebase Hosting.

## Session Log

### 2026-08-19 — קריאה צולבת של חבילת ה-handoff, הכרעות, ושלב 0 [shipped]
- **What was done:** רונן שלח `coachtrack-handoff.zip` וביקש "תקרא הכל ותראה אם זה ברור". קראתי
  את שמונת הקבצים והצלבתי ביניהם. מצאתי **שני חוסמים לוגיים, שש סתירות בין המסמכים ושלושה חורים
  ב-rules**. אחרי ארבע הכרעות של רונן — יישרתי את כל מסמכי החבילה, ונועם בנה את שלב 0.
- **החוסם הראשון (הכי חשוב) — יצירת שחקנים מול Custom Claims:** `TASKS.md` שלב 2 דורש שהמאמן
  יוסיף שחקן מהממשק, וההרשאות היו מבוססות Custom Claims. אבל Claims נקבעים **רק** דרך Admin SDK,
  ו-`createUserWithEmailAndPassword` בצד לקוח מחליף את המשתמש המחובר. כלומר פיצ'ר חובה ב-MVP
  התנגש חזיתית עם "בלי Cloud Functions".
  **ההכרעה (רונן):** `role`/`orgId` עוברים למסמך `users/{uid}`; יצירת שחקן דרך **secondary Firebase
  app instance**; איפוס סיסמה בסקריפט מקומי (`scripts/reset-password.js`, נכתב בסשן). נשארים ב-Spark,
  בלי Blaze, בלי Functions — וזו בדיוק השיטה שכבר עובדת ב-[[basketball-scheduler-cloud-migration]].
  **המחיר שצריך לזכור:** כלל אחד ב-`firestore.rules` — חסימת עדכון-עצמי של
  `role`/`orgId`/`teamIds`/`active` — הפך להיות ההגנה **היחידה** מפני הסלמת הרשאות. סומן בקוד
  ובשלושה מסמכים כ"לא לגעת בלי לעצור ולשאול".
- **החוסם השני — ללוח המובילים לא היה מאיפה לקרוא נתונים:** הוא היה בסקופ MVP, אבל ה-rules
  מרשים לשחקן לקרוא רק את הדיווחים של עצמו, `users` נקרא רק ע"י מאמן, ו-`weeklySummaries` הוא
  `write:false` (מיועד ל-Cloud Function שלא קיימת). שלוש חלופות נשקלו (לפתוח `entries` לחברי קבוצה /
  שכל שחקן יכתוב לעצמו מסמך סיכום / Function). **ההכרעה (רונן):** נדחה לשלב 2, יחד עם תג
  "הכי משתפר". `leaderboardEnabled` נשאר בסכמה כתשתית, כבוי ב-seed.
- **Decisions נוספות של רונן:** הפרויקט יושב ב-`Output/coachtrack/` (ולא בריפו נפרד כמו
  ש-START-HERE הורה), ו-**TypeScript** לפי החבילה — חריגה מודעת מהסקיל `vite-react-scaffold` של
  נועם שהוא JavaScript מפורש. הנימוק: אפליקציה עתירת-סכמה (7 קולקציות, `itemsSnapshot`, יחידות מדידה).
- **הכרעה שלי שסטתה מהתוכנית שאושרה — פורמט `entries.date`:** בתוכנית כתבתי מחרוזת `YYYY-MM-DD`.
  כשניגשתי לכתוב את ה-rules התברר שזה סותר סעיף אחר **באותה תוכנית**: על מחרוזת אין חשבון תאריכים
  ב-rules, ולכן אי אפשר לאכוף בשרת את חלון 7 הימים אחורה. שיניתי ל-**Timestamp מקובע ל-12:00
  בשעון ישראל**. צהריים רחוקים 12 שעות מכל גבול שבוע בכל אזור זמן ובשני צידי מעבר שעון קיץ, אז זה
  סוגר את מלכודת אזורי הזמן בדיוק כמו המחרוזת — וגם מאפשר אכיפה. דווח לרונן בזמן אמת.
- **שלושת החורים שנסגרו ב-`firestore.rules`:** (1) שחקן היה יכול לפתוח `planCycle` עם
  `itemsSnapshot` מזויף (`target:1` → 100%) — נוסף אימות מול `plans/{planId}.items`; (2) חלון 7
  הימים נאכף רק ב-UI, בניגוד לכלל 4 של הפרויקט — נוסף ל-rules; (3) הכלל "אין מחיקה קשיחה" היה
  במסמכים אבל ה-rules התירו `delete` — הוחלף ב-`allow delete: if false` בכל הקולקציות ההיסטוריות.
- **שש הסתירות שיושרו:** `weekStartDay` הוגדר כניתן-לשינוי אבל `getWeekBounds` היה בלי פרמטר
  (הוכרע: נשאר בסכמה, ה-MVP מקבע ראשון, הפרמטר בחתימה עם ברירת מחדל); `successCapable`,
  `defaultTargets` ו-`mustChangePassword` חסרו במודל הנתונים של ה-PRD; ה-seed יצר **coach** בעוד
  TASKS ביקש **admin** ראשון וכתיבה לספרייה הגלובלית היא admin-only (נוסף admin ל-seed);
  START-HERE הפנה להריץ seed אחרי שלב 0 בעוד TASKS מיקם אותו בשלב 2 (נוצר **שלב 0.5** ייעודי);
  והקטלוג בפועל 7 קטגוריות ומכויל ל-13–15 בעוד ה-PRD דיבר על 6 ועל 13–18 (גיל מול גודל סגל).
- **חוסר אפיון שהושלם:** לא נאמר אם בונה התוכנית טוען מראש יעד מ-`defaultTargets`. הוכרע: כן,
  כהצעה שהמאמן דורס.
- **מסמכים שעודכנו:** `CLAUDE.md` (נוסף סעיף "איפה נשמר התפקיד", "פורמט תאריכים", וטבלת ההכרעות),
  `docs/PRD.md` → **v0.3**, `TASKS.md` (שלב 0.5 חדש, מלכודות 5–7 חדשות), `firestore.rules` (נכתב
  מחדש), `scripts/seed.js`, `START-HERE.md`, ו-`scripts/reset-password.js` (חדש).
- **שלב 0 (נועם):** שלד Vite + React 19 + TS + Tailwind v3 תחת `Output/coachtrack/`, לפי מבנה
  התיקיות של `CLAUDE.md` (`features/{coach,player,auth}`) ולא של הסקיל. `src/types/types.ts` עם כל
  9 הישויות ואפס `any`; `src/lib/firebase.ts` **Firebase-only בלי fallback מקומי** (בניגוד להרגל
  של נועם — זו לא אפליקציה עם מצב-דמו), עם שגיאה בעברית שמונה משתני סביבה חסרים; `src/i18n/he.ts`
  עם `TranslationKey` נגזר טיפוסית כך ששגיאת כתיב במפתח נתפסת בקומפילציה.
- **החלטה של נועם ששווה לזכור:** ויתר על `"type": "module"` ב-`package.json` והסב את קונפיג Vite
  ל-`vite.config.mts`. הסיבה: התבנית של Vite מגיעה עם `type: module`, וזה היה הופך את
  `scripts/seed.js` ו-`reset-password.js` (CommonJS, `require`) ללא-ריצים — בדיוק הפקודה
  `node scripts/seed.js` ששלב 0.5 מבקש.
- **Verification:** `npm run build` עבר, `tsc --noEmit` נקי, `oxlint` בלי ממצאים. **QA אמיתי בדפדפן**
  (Edge headless): `documentElement.dir="rtl"`, `lang="he"`, Rubik נטען בפועל
  (`document.fonts.check` → true), ואפס errors/warnings בקונסולה — גם ב-dev וגם על ה-build דרך
  `npm run preview`. צילום מסך 390×844 מאשר יישור לימין. commit `4fc63d9`, **לא נדחף**.
- **Notes / Caveats:** (1) `.env.local` עוד לא קיים — שלב 1 חסום עד שרונן יקים את פרויקט ה-Firebase.
  (2) שלב 0.5 (seed + פרסום rules) על רונן — `firebase deploy` חסום ל-Claude; ראה
  [[basketball-scheduler-cloud-migration]] לשיטה שעבדה (firebase-tools מקומי + חלון cmd אמיתי).
  (3) ה-rules החדשים **טרם נבדקו ב-Emulator** — זה פריט חובה בשלב 1, במיוחד שלושת החורים שנסגרו.
- **Related:** [[basketball-scheduler-cloud-migration]], [[basketball-scheduler-legal-gate]],
  [[team-expansion-noam-fullstack]], [[git-repo-topology]], [[push-workflow]]

### 2026-08-20 — הקמת פרויקט Firebase מקצה לקצה [shipped]
- **What was done:** ליוויתי את רונן צעד-אחר-צעד בקונסולת Firebase (פריסה חדשה — אין תפריט
  "Build", המוצרים תחת Product categories). נוצר פרויקט **`coachtrack-e6355`** על **Spark**:
  Auth עם Email/Password בלבד, Firestore `(default)` ב-**eur3** / Standard edition / Native /
  Production mode, ו-Hosting מוכן ל-release ראשון. בצד הקוד נוצרו `.env.local`, `.firebaserc`,
  `firebase.json` ו-`firestore.indexes.json`, והותקנו `firebase-tools 15.28.1` ו-`firebase-admin 14.3.0`
  כ-devDependencies מקומיים.
- **Decisions:**
  - **פרויקט נפרד מ-`basketball-schedule-f0f57`.** התרעתי לפני שהתחלנו: פריסת ה-rules של
    CoachTrack לפרויקט הקיים הייתה דורסת את הכללים של לוח האימונים וחוסמת את המאמנים.
  - **Spark ולא Blaze** — אפשרי רק בזכות הכרעה 1 (role במסמך `users` במקום Custom Claims).
    ההכרעה ההיא שילמה את עצמה כבר עכשיו: אין צורך בכרטיס אשראי.
  - **בלי Google Analytics** — משתמשים קטינים; פחות מעקב = פחות עבודה בשער של עדי.
  - **בלי Google Sign-In** ובלי Email-link. רונן הפעיל בטעות גם Email link (passwordless) —
    כובה: לשחקנים אימיילים סינתטיים (`dani@coachtrack.local`) שאין מאחוריהם תיבה, אז קישור-קסם
    נשלח לשומקום. הבאנר של Firebase שממליץ על Google Sign-In הוא המלצה גנרית שלא מתאימה לקהל
    של בני 13–15 — וגם ב-basketball המאמנים התלוננו בדיוק על זה.
  - **`firebase.json` נכתב עם כותרות Cache מראש** — `no-cache` ל-`index.html`, `immutable` ל-`/assets/**`.
    זה הלקח מ-[[basketball-deploy-cache-headers]], מיושם מהיום הראשון במקום אחרי שהטלפון מציג גרסה ישנה.
  - **`firebase-tools` מקומי ולא גלובלי** — האשף בקונסולה מורה על `npm install -g`, אבל ההתקנה
    הגלובלית של רונן שבורה (`MODULE_NOT_FOUND`). נוספו סקריפטים ב-`package.json` שעוטפים את הנתיב
    המקומי: `fb`, `deploy:rules`, `deploy:hosting`, `seed`, `seed:org`.
  - **לא הרצנו `firebase init`** — האשף מציע אותה, אבל היא הייתה מציעה לדרוס את `firebase.json`,
    `.firebaserc` ו-`firestore.rules` שכבר כתובים.
- **Verification:** במקום להסתמך על קריאת ה-`apiKey` מצילום מסך (סכנת בלבול `0`/`O`, `1`/`l`),
  שלחתי קריאת POST ל-`identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` עם המפתח
  ומייל דמה. התשובה `INVALID_LOGIN_CREDENTIALS` (ולא `API key not valid` ולא `OPERATION_NOT_ALLOWED`)
  הוכיחה בבת אחת ששני דברים תקינים: המפתח נקרא נכון, וספק Email/Password באמת מופעל.
  **הטכניקה הזו שווה זכירה** לכל פעם שקוראים config מצילום מסך.
- **Notes / Caveats:** (1) `Scheduled backups: Disabled` — מגבלת Spark, נוסף ל-Open Questions.
  (2) ה-rules בקונסולה עדיין ברירת המחדל `if false` — `firestore.rules` שלנו טרם נפרסו.
  (3) `.env.local` קיים רק במחשב הזה.
- **Related:** [[basketball-scheduler-cloud-migration]], [[basketball-deploy-cache-headers]],
  [[basketball-saas-env-loading]], [[push-workflow]]

### 2026-08-20 — שלב 0.5: seed של הקטלוג, הארגון וקבוצת הפיילוט [shipped]
- **What was done:** הורצה `npm run seed:org` מול `coachtrack-e6355`. נטענו **30 תרגילים**
  (`scope: global`) בשבע קטגוריות, ונוצרו הארגון, הקבוצה ושני המשתמשים הראשונים.
- **קבוצת הפיילוט — לא של רונן:** רונן בחר להריץ את הפיילוט על **מאמן אחר באגודה** — עמנואל ורדי,
  קבוצת **ילדים א**, עונת 2026/27. רונן עצמו הוא ה-**admin**, עמנואל הוא ה-**coach**. זה שינוי מהנחת
  ה-PRD ("קבוצה אחת של רונן") ומחזק את הצורך שהמסמכים מול ההורים יהיו מסודרים — מי שמדבר עם ההורים
  הוא עמנואל, לא רונן.
- **מזהים תיאוריים:** `org_kiryat_ono` / `team_yeladim_a` במקום `org_main` / `team_main` שבחבילה.
  ברגע שברור שהאגודה מפעילה כמה מאמנים, מזהה בשם `team_main` הופך למכשול בקבוצה השנייה.
- **באג אמיתי שנתפס — `firebase-admin` v14 הסיר את ה-namespace הישן:** החבילה נכתבה מול API ישן
  (`admin.credential.cert()`, `admin.firestore()`, `admin.firestore.FieldValue`), וב-v14 שורש
  החבילה מייצא רק פונקציות ברמת ה-app. ההרצה נפלה על
  `TypeError: Cannot read properties of undefined (reading 'cert')`. **לא ניחשתי** — הרצתי
  `Object.keys()` על הייצוא כדי לראות מה קיים בפועל, ואז העברתי את שני הסקריפטים ל-API המודולרי:
  `require('firebase-admin/app')` → `initializeApp`/`cert`, `firebase-admin/firestore` →
  `getFirestore`/`FieldValue`, `firebase-admin/auth` → `getAuth`. **לזכור:** כל דוגמת קוד של
  firebase-admin מלפני 2024 תיפול ככה.
- **Verification:** לא הסתמכתי על פלט הסקריפט — קראתי את הנתונים חזרה מ-Firestore דרך Admin SDK
  ואימתתי: 30 תרגילים בפילוח הנכון לקטגוריות, `defaultTargets` נשמר, `organizations` עם
  `Asia/Jerusalem`, `teams` עם `leaderboardEnabled: false`, שני מסמכי `users` עם ה-`role` הנכון
  ו-`mustChangePassword: true`, ו-`org.ownerUid === team.coachUid`.
- **אבטחת המפתח:** `serviceAccountKey.json` הועבר מ-Downloads ל-`scripts/`, ואומת עם
  `git check-ignore -v` שהוא באמת חסום — לא הסתמכות על זה שכתבנו את השורה ב-`.gitignore`.
  התוכן לא נקרא ולא הודפס; רק `project_id` ו-`client_email` לאימות התאמה לפרויקט.
- **Notes / Caveats:** (1) `firestore.rules` **טרם נפרסו** — בקונסולה עדיין `if false`. עד הפריסה
  האפליקציה לא תוכל לקרוא כלום. `npm run deploy:rules` על רונן. (2) סיסמת הפתיחה `CoachTrack26!`
  זהה לשני המשתמשים ו-`mustChangePassword` יכפה החלפה; צריך למסור אותה לעמנואל בערוץ סביר.
- **Related:** [[coachtrack-app#2026-08-20]], [[basketball-scheduler-legal-gate]], [[push-workflow]]
