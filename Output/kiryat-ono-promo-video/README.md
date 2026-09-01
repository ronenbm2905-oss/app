# סרטון שיווקי — מערכת שעות אימוני כדורסל (קרית אונו — דור העתיד)

שלושה חתכי וידאו שנבנים מ**צילומי מסך אמיתיים** של האפליקציה ב-`Output/basketball-scheduler/`,
לא ממוקאפים. הסרטון מיועד למכירה למועדונים ורשויות אחרים.

| קובץ ב-`final/` | פורמט | שימוש |
|---|---|---|
| `kiryat-ono-16x9-90s.mp4` | 1920×1080 | דף נחיתה, יוטיוב, מייל |
| `kiryat-ono-16x9-demo.mp4` | 1920×1080 | דמו מלא למתעניינים |

כל השלושה **שקטים** (בלי פס קול). תסריט הקריינות המתוזמן יושב ב-
`shira/Outputs/kiryat-ono-promo-script.md`.

---

## חוק ברזל — נתוני דמו בדויים

האפליקציה האמיתית מחזיקה **שמות, טלפונים ותאריכי לידה של קטינים**. כל מה שנראה בסרטון
מיוצר בקוד ב-`harness/seed-data.mjs` ואינו נוגע בשום נתון אמיתי. אם מישהו מריץ את הצנרת
מחדש — אסור להחליף את הזריעה בייצוא מהמערכת החיה.

---

## הרצה מחדש — שש פקודות

```bash
# 1. האפליקציה (פעם אחת)
cd ../basketball-scheduler && npm install && npm run build
npx http-server dist -p 4173 -s &

# 2. חזרה לכאן, ואימות שהכול נראה טוב לפני שמצלמים
cd ../kiryat-ono-promo-video
node harness/smoke.mjs            # סטילס של כל מסך -> work/smoke/

# 3. צילום
node harness/record.mjs           # מעבר רוחבי  -> raw/landscape/

# 4. כרטיסי טקסט והוכחת השיתוף
node cards/render-cards.mjs       # -> work/cards/
node build/render-proof.mjs       # -> work/proof/

# 5. הרכבה
node build/assemble.mjs           # -> final/
node build/captions.mjs           # -> final/*.he.srt
node build/narration.mjs          # -> work/narration.md
node build/narration-pdf.mjs      # -> final/תסריט-קריינות.pdf
node build/guide-track.mjs short  # -> work/audio/guide-short.mp3 (רצועת תרגול)
```

הרצה של סצנה אחת בלבד: `node harness/record.mjs --only=02-weekly`.
הרכבה של חתך אחד בלבד: `node build/assemble.mjs short`.

---

> **החתך האנכי (9:16) ירד.** בלייאאוט המובייל טבלת הלוח נחתכת בצדדים והפריים
> מתמלא בפקדים קטנים — הוא פשוט לא נראה טוב. כל התשתית שלו נשארה במקום
> (`PRESETS.vertical`, כרטיסי 9x16, `record.mjs --vertical`); כדי להחזיר אותו
> צריך רק להוסיף חזרה מקטע `vertical` ל-`build/cuts.json`.

## קריינות

הסרטון נבנה שקט, אבל אם קיים קובץ אודיו בשם החתך תחת `audio/` — הוא ממוסכן
אוטומטית לקובץ הסופי:

| קובץ | נכנס ל |
|---|---|
| `audio/demo.m4a` | הדמו המלא |
| `audio/short.m4a` | החתך של 16:9 |

התסריט המתוזמן נוצר מהקטעים שנבנו בפועל, ולא נכתב ביד:

```bash
node build/narration.mjs      # -> work/narration.md
```

הוא נותן לכל שורה חלון זמן אמיתי ותקציב מילים, ומסמן שורות צפופות. אחרי שיש
הקלטה — `node build/assemble.mjs` ותו לא. **אין צורך לצלם מחדש.**

---

## פרטי קשר בשקף הסיום

`cards/contact.json` ריק בכוונה. מלא אותו והרץ:

```bash
node cards/render-cards.mjs && node build/assemble.mjs
```

**אין צורך להקליט מחדש** — רק לרנדר ולהרכיב.

---

## איך זה עובד

**האפליקציה רצה בלי Firebase.** `src/hooks/useAuth.js` מחזיר משתמש סינתטי כשאין קונפיג,
ולכן אין מסך התחברות והכול פתוח. הנתונים ב-`localStorage`.

**הזריעה נעשית מבחוץ.** `page.addInitScript()` כותב את חמשת מפתחות ה-localStorage לפני
שהאפליקציה עולה — בלי לגעת בקוד האפליקציה ובלי הבזק של מסך ריק.

**הסמן מוזרק.** Playwright לא מרנדר סמן עכבר בהקלטה. `harness/harness.mjs` מזריק שכבת
סמן שעוקבת אחרי אירועי העכבר, עם הד על כל קליק. בלי זה הפוטג' נראה כאילו דברים קורים לבד.

**כל טיימקוד נגזר מיומן ביטים.** כל סצנה מסמנת ביטים (`cue.mark`) ל-`work/cues/`, וקובץ
העריכה `build/cuts.json` בוחר קטעים **לפי שם ביט** ולא לפי סטופר. הקלטה חוזרת לא שוברת
את החיתוך.

**הטקסט מרונדר ב-Chromium, לא ב-ffmpeg.** `drawtext` נבנה ברוב ההפצות בלי HarfBuzz ובלי
מעבר bidi, ולכן עברית יוצאת בסדר הפוך — ושורה שמערבבת עברית עם ספרות נשברת לגמרי.
הכרטיסים הם HTML של איתי, מצולמים ל-PNG, ו-ffmpeg רק מרכיב שכבות.

---

## שלוש מלכודות שנפלנו בהן, שלא כדאי ליפול בהן שוב

**1. `recordVideo.size` חייב להיות זהה ל-viewport.**
Playwright לא מותח את התצוגה לגודל ההקלטה — הוא ממקם אותה בפינה וממלא את השאר באפור.
`viewport: 1280×720` עם `recordSize: 1920×1080` הוציא פריים שבו שליש מהתמונה אפור.
ההגדלה לרזולוציית המסירה נעשית ב-ffmpeg (`deliver` ב-`PRESETS`).

**2. `addInitScript` רץ לפני שה-DOM קיים.**
`document.documentElement.appendChild(...)` בראש הסקריפט זורק, ומפיל בשקט את **כל**
הסקריפט — כולל הסרת באנר "מצב מקומי" הצהוב, שחזר לתוך הפריים בלי שאיש שם לב.
כל נגיעה ב-DOM מוגנת מאחורי `if (document.body)`.

**3. `.hide` שהפסיד בסדר ההכרזה.**
בתבניות הכתוביות `.hide{display:none}` הוכרז **לפני** `.disc{display:flex}`, ובאותה
ספציפיות הכלל המאוחר מנצח — כך שתג "כל הנתונים בסרטון בדויים" הופיע על **כל** כתובית,
כפול, גם כשלא ביקשו אותו. הכלל עכשיו `!important`. שווה לזכור: קוד שנראה כמו מתג
(`classList.add('hide')`) יכול להיות מנוטרל בשקט ע"י סדר ההכרזה ב-CSS.

---

## מבנה

```
harness/
  seed-data.mjs   מערך נתוני הדמו הבדוי
  harness.mjs     הקשר דפדפן, זריעה, סמן, עוזרי תנועה, יומן ביטים
  scenes.mjs      חמש הסצנות
  record.mjs      מריץ סצנות -> raw/ + work/cues/
  smoke.mjs       סטילס אימות לפני צילום
cards/
  *.html          כרטיסי איתי (כותרת, ביט, כתובית, סיום) — מקבלים טקסט ב-query string
  whatsapp.html   מסגרת השיחה שמציגה את התמונה שהאפליקציה ייצרה
  cards.json      הקופי של שירה
  contact.json    פרטי הקשר לשקף הסיום  ← מלא כאן
  render-cards.mjs
build/
  cuts.json       העריכה כנתונים — קטעים לפי תוויות ביט
  assemble.mjs    ffmpeg: קטעים -> כתוביות -> שרשור -> H.264
  render-proof.mjs
  captions.mjs    מפיק .srt מהתזמונים שנבנו — חלופה טקסטואלית לסרטון שקט (WCAG 1.2.1)
  timing-map.mjs  מפת תזמונים אמיתית לתסריט הקריינות
raw/   קליפי webm גולמיים   (gitignore)
work/  קטעי ביניים, כרטיסים, יומנים  (gitignore)
final/ התוצרים
```
