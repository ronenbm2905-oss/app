# CoachTrack — חוקי הפרויקט

מסמך זה נקרא על ידי Claude Code בכל סשן. הוא הסמכות על החלטות הפרויקט.
מסמך הדרישות המלא: `docs/PRD.md`. קטלוג התרגילים: `docs/exercise-catalog.md`.

> **הפרויקט יושב תחת `Output/coachtrack/` בריפו של צוות הסוכנים.** ה-`CLAUDE.md` בשורש הריפו
> מתאר את הצוות ואת זרימות העבודה; המסמך הזה גובר עליו בכל מה שנוגע ל-CoachTrack עצמו.
> ארבע הכרעות שנפלו ב-19.8.2026 ומשנות את החבילה המקורית מרוכזות בסוף המסמך — "הכרעות 19.8.2026".

---

## מה בונים

אפליקציית ווב שבה מאמן כדורסל מגדיר תוכנית תרגילים לקבוצה, שחקנים בני 13–15 מדווחים מה ביצעו, והמערכת מציגה אחוזי השלמה.

**MVP:** קבוצה אחת, 13–18 שחקנים, עונה אחת.
**ארכיטקטורה:** מוכנה מראש ל-multi-tenant (ארגון → מאמן → קבוצה → שחקן) גם אם המימוש הוא ארגון יחיד.

---

## סטאק

| רכיב | בחירה |
|---|---|
| Frontend | React + Vite + TypeScript |
| Routing | React Router |
| State | React Query לנתוני שרת, Context לאימות. **בלי Redux** |
| Styling | Tailwind CSS |
| Backend | Firebase — Auth, Firestore, Hosting |
| Cloud Functions | **לא ב-MVP.** כל הלוגיקה בצד לקוח + Security Rules |
| Charts | Recharts |
| Dates | date-fns עם date-fns-tz |

**אין להוסיף ספריות חדשות בלי לשאול.** במיוחד: אין UI kit כבד (MUI, Chakra), אין ORM, אין state manager נוסף.

> **הערה לצוות:** הסקיל `vite-react-scaffold` של נועם הוא JavaScript מפורש. CoachTrack הוא
> **חריגה מודעת** — TypeScript, כי האפליקציה עתירת-סכמה (7 קולקציות, `itemsSnapshot`, יחידות מדידה)
> וטיפוסים ימנעו כאן באגים אמיתיים. מבנה התיקיות למטה גובר על זה שבסקיל.

---

## כללים שאסור להפר

1. **RTL הוא ברירת המחדל.** `dir="rtl"` על ה-html, `lang="he"`. כל layout נבדק ב-RTL לפני שמסמנים משימה כגמורה. אין `margin-left` / `text-align: left` קשיחים — משתמשים ב-`ms-*` / `me-*` / `text-start` / `text-end` של Tailwind.
2. **מובייל-פירסט.** מעצבים ל-375px רוחב ואז מרחיבים. רוב השחקנים ייכנסו מהטלפון.
3. **כל שאילתה מסוננת ב-`orgId`.** גם כשיש ארגון אחד. זה הבסיס לבידוד רב-ארגוני בעתיד.
4. **אין לוגיקת הרשאות רק ב-UI.** כל חסימה נאכפת ב-`firestore.rules`. הסתרת כפתור היא נוחות, לא אבטחה.
5. **אין מחיקה קשיחה.** שחקנים, דיווחים ותרגילים מסומנים `active: false` / `deleted: true`. ההיסטוריה נשמרת. הכלל **נאכף ב-`firestore.rules`** (`allow delete: if false`), לא רק ב-UI — נגזרת של כלל 4.
6. **תאריכים בשעון ישראל.** `Asia/Jerusalem`. גבולות שבוע מחושבים באזור הזמן הזה, לא ב-UTC. זו הטעות הכי סבירה בפרויקט הזה — להיזהר. ראה "פורמט תאריכים" למטה.
7. **אין נתונים אישיים מיותרים.** שם פרטי + אות ראשונה של משפחה. בלי ת.ז., כתובת, תאריך לידה, תמונות. המשתמשים הם קטינים.
8. **טקסטים בעברית מרוכזים בקובץ אחד** (`src/i18n/he.ts`). אין מחרוזות עברית מפוזרות ב-JSX. זה מה שיאפשר תרגום בעתיד.

---

## מודל הנתונים

```
organizations/{orgId}
  name, createdAt, ownerUid
  settings: { timezone: "Asia/Jerusalem", weekStartDay: 0 }

users/{uid}
  role: "admin" | "coach" | "player"
  orgId, displayName, username, teamIds[], active, createdAt
  mustChangePassword: bool

teams/{teamId}
  orgId, coachUid, name, season, active
  settings: { leaderboardEnabled: bool, streakThreshold: 80, weekStartDay: 0 }

exercises/{exerciseId}
  scope: "global" | "org"
  orgId | null
  name, category, unit, description, videoUrl
  tracksSuccess: false          // תשתית בלבד ב-MVP
  successCapable: bool
  defaultTargets: { [cohort]: number }   // הצעת יעד מהקטלוג, למשל { cadets_13_15: 300 }
  active

plans/{planId}                   // תוכנית מתמשכת, לא חד-שבועית
  teamId, orgId
  status: "active" | "archived"
  effectiveFrom, effectiveTo|null
  createdBy, createdAt
  items: [{ exerciseId, exerciseName, unit, target, notes }]

planCycles/{cycleId}             // מחזור שבועי קונקרטי
  planId, teamId, orgId
  weekStart, weekEnd
  itemsSnapshot: [...]           // צילום יעדים בזמן הפתיחה
  createdAt

entries/{entryId}
  playerUid, teamId, orgId, cycleId|null, exerciseId
  amount: number
  successAmount: number|null     // תשתית בלבד
  date: Timestamp               // תאריך הביצוע, מקובע ל-12:00 בשעון ישראל. ראה "פורמט תאריכים"
  note, createdAt, createdBy, deleted

planTemplates/{templateId}
  orgId, coachUid, name, items[]
```

### `unit` — הערכים המותרים
`count` | `minutes` | `sessions` | `distance_km`

---

## הלוגיקה שאסור לטעות בה

### תוכנית מתמשכת
תוכנית מפורסמת פעם אחת ורצה עד שמשנים אותה. כל תחילת שבוע נפתח `planCycle` חדש עם צילום היעדים.

**מימוש:** יצירה עצלה (lazy). כשמשתמש נכנס ואין `planCycle` לשבוע הנוכחי — יוצרים אותו. בלי Cloud Function מתוזמן.

**עריכת תוכנית:** המאמן בוחר "מהשבוע הנוכחי" (מעדכן את ה-`itemsSnapshot` של המחזור הפעיל) או "מהשבוע הבא" (סוגר את התוכנית הישנה ב-`effectiveTo` ופותח חדשה).

### חישוב אחוזים
```ts
// אחוז לתרגיל בודד — לא נחסם
pctForExercise = (sumOfEntries / target) * 100

// אחוז כללי לשבוע — כל תרגיל נחסם ב-100 לפני הממוצע
overallPct = average(items.map(i => Math.min(pctForExercise(i), 100)))
```
החסימה ב-100 בממוצע הכללי היא מכוונת: 300% בזריקות לא מכסה על 0% בכושר.

### גבולות שבוע
ראשון 00:00:00 עד שבת 23:59:59 בשעון ישראל. דיווח משויך למחזור לפי **תאריך הביצוע** שהוזן, לא לפי `createdAt`.

`getWeekBounds(date, weekStartDay = 0)` — הפרמטר קיים בחתימה כי `teams.settings.weekStartDay`
קיים בסכמה, אבל **ה-MVP מקבע ראשון (0)**. אין UI לשינוי, ואין מסלול קוד שני לתחזק.

### פורמט תאריכים
- **`entries.date` הוא Timestamp מקובע ל-12:00 בשעון ישראל** — לא חצות, ולא מחרוזת.
  צהריים אף פעם לא קרוב לגבול שבוע בשום אזור זמן, ולכן דיווח של שבת בערב לא יזלוג לשבוע הבא.
  זו בדיוק מלכודת #1 ב-`TASKS.md`. חצות היה נופל בה; Timestamp מאפשר גם ל-`firestore.rules`
  לאכוף את חלון 7 הימים, מה שמחרוזת `YYYY-MM-DD` לא מאפשרת.
- **`createdAt` הוא `serverTimestamp()`** — לא זמן הלקוח. עליו נשען חלון העריכה.
- **שני חלונות "7 ימים" שונים.** דיווח רטרואקטיבי נמדד על `date` (תאריך הביצוע); חלון עריכה
  נמדד על `createdAt` (מתי נרשם). לא לאחד אותם.
- כל בנייה או פירוק של תאריך עוברת דרך `lib/dates.ts`. אין `new Date()` מפוזר בקוד.

### ולידציות דיווח
- `amount > 0`, מספר בלבד
- תאריך: עד 7 ימים אחורה, לא בעתיד. **נאכף גם ב-`firestore.rules`**, לא רק ב-UI (כלל 4)
- אם `amount > 3 × target` ברישום בודד — דיאלוג אישור "האם התכוונת ל-X?"

### בניית תוכנית
כשהמאמן מוסיף תרגיל מהספרייה, שדה היעד **נטען מראש מ-`defaultTargets`** של התרגיל
(מפתח `cadets_13_15` ב-MVP). זו הצעה בלבד — המאמן דורס אותה בחופשיות.

---

## הרשאות

| פעולה | מי |
|---|---|
| קריאת תוכנית ומחזור | חברי הקבוצה + המאמן |
| יצירה/עריכת תוכנית | מאמן הקבוצה |
| יצירת דיווח | השחקן לעצמו; מאמן עבור כל שחקן בקבוצתו |
| עריכה/מחיקת דיווח | היוצר עד 7 ימים; מאמן תמיד |
| קריאת דיווחים של שחקן אחר | מאמן בלבד |
| ניהול משתמשים | מאמן יוצר ומנהל **שחקנים** בארגון שלו; admin בכל מקום |
| ספריית תרגילים גלובלית | קריאה לכולם, כתיבה ל-admin |

### איפה נשמר התפקיד

**`role` ו-`orgId` נשמרים במסמך `users/{uid}` — לא ב-Custom Claims.**

Custom Claims נקבעים אך ורק דרך Admin SDK, וה-MVP הוא בלי Cloud Functions. כלומר מאמן לא היה
יכול להוסיף שחקן מהממשק — פיצ'ר חובה (TASKS שלב 2). לכן ההרשאות נקראות ממסמך המשתמש דרך
`get()` ב-`firestore.rules`.

> 🔒 **הכלל הכי חשוב במערכת:** ב-`users/{uid}` חסום עדכון-עצמי של
> `role` / `orgId` / `teamIds` / `active`. זו ההגנה היחידה שמונעת משחקן לקדם את עצמו ל-admin.
> כל שינוי בכלל הזה הוא שינוי אבטחה — לעצור ולשאול.

**יצירת שחקן בצד לקוח:** דרך **secondary Firebase app instance** (`initializeApp(config, 'admin')`),
כדי ש-`createUserWithEmailAndPassword` לא ינתק את המאמן מהסשן שלו. אחריה נכתב מסמך `users/{uid}`
עם `role: 'player'` ו-`mustChangePassword: true`.

**איפוס סיסמה:** אין נתיב בצד לקוח (השחקנים מקבלים אימיילים סינתטיים, אז `sendPasswordResetEmail`
לא רלוונטי). מריצים `node scripts/reset-password.js` מקומית. בשלב 2 זה יהפוך ל-Cloud Function.

---

## מוסכמות קוד

- **שמות קבצים:** קומפוננטות `PascalCase.tsx`, hooks `useCamelCase.ts`, utils `camelCase.ts`
- **מבנה תיקיות:**
  ```
  src/
    components/     קומפוננטות משותפות
    features/       coach/ , player/ , auth/
    lib/            firebase.ts, dates.ts, calculations.ts
    hooks/
    types/          types.ts — כל הטיפוסים של המודל
    i18n/           he.ts
  ```
- **טיפוסים:** כל collection מקבל interface ב-`types/`. אין `any`.
- **חישובים:** כל פונקציית חישוב אחוזים ב-`lib/calculations.ts`, פונקציה טהורה, עם טסטים.
- **תאריכים:** כל פעולת תאריך עוברת דרך `lib/dates.ts`. אין `new Date()` מפוזר בקוד.

---

## בדיקות

- **חובה:** unit tests ל-`lib/calculations.ts` ו-`lib/dates.ts`. אלה שני המקומות שבהם באג לא ייראה על המסך אבל יהרוס את הנתונים.
- לא נדרשים טסטים לקומפוננטות ב-MVP.
- `firestore.rules` נבדקים עם Firebase Emulator לפני deploy.

---

## סדר עבודה

עובדים לפי `TASKS.md`, שלב אחר שלב. **לא מתחילים שלב לפני שהקודם עומד בקריטריון הסיום שלו.**

בסוף כל שלב: commit עם הודעה בעברית או אנגלית שמתארת מה נעשה.

---

## מה לא לבנות

התראות · יצוא PDF/Excel · העלאת וידאו · ממשק הורים · תשלומים · הרשמה עצמית · יעדים אישיים · תגים והישגים · ניהול עונות · תרגילי יחס הצלחה (רק שדות בסכמה) · מנגנון שבוע מושהה · **לוח מובילים ותג "הכי משתפר"** (רק `leaderboardEnabled` בסכמה) · **Cloud Functions**

אם משימה נראית כאילו היא דורשת אחד מאלה — לעצור ולשאול.

---

## הכרעות 19.8.2026

ארבע הכרעות שנפלו אחרי קריאת החבילה, ומשנות אותה. הן משוקפות כבר בגוף המסמך הזה,
ב-`docs/PRD.md`, ב-`TASKS.md` וב-`firestore.rules`.

| # | נושא | ההכרעה | למה |
|---|---|---|---|
| 1 | הרשאות ויצירת שחקנים | `role`/`orgId` ב-`users/{uid}` במקום Custom Claims; יצירת שחקן דרך secondary app; איפוס סיסמה בסקריפט מקומי | Custom Claims דורשים Admin SDK, וזה סותר את "בלי Cloud Functions" מול הדרישה שמאמן יוסיף שחקן מהממשק |
| 2 | לוח מובילים | **נדחה לשלב 2**, יחד עם תג "הכי משתפר" | שחקן רשאי לקרוא רק את הדיווחים של עצמו, ו-`weeklySummaries` הוא `write:false` — לא היה מאיפה לחשב אותו בלי לשבור את כלל הפרטיות |
| 3 | מיקום | `Output/coachtrack/` בריפו של צוות הסוכנים | נועם בונה, עדי עוברת שער לפני deploy, הכל מתועד ב-vault |
| 4 | שפה | TypeScript לפי החבילה | חריגה מודעת מסקיל `vite-react-scaffold` (JavaScript) |

בנוסף נסגרו ב-`firestore.rules` שלושה חורים שהיו בטיוטה: אימות `itemsSnapshot` מול התוכנית
ביצירת מחזור, אכיפת חלון 7 הימים ביצירת דיווח, וחסימת מחיקה קשיחה.
