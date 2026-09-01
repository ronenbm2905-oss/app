# מפרט ויזואלי — סרטון שיווקי · מערכת שעות "קרית אונו — דור העתיד"

**בריף מקור:** `Briefs/kiryat-ono-promo-video.md`
**מקור המותג:** `Output/basketball-scheduler/tailwind.config.js` · `src/App.jsx` · `src/assets/club-logo.jpg`
**קופי:** טרם התקבל משירה. כל הטקסט במסמך הוא **placeholder** שנלקח מהמסר המרכזי בבריף —
מחליפים אותו בטקסט של שירה בלי לגעת ב-CSS (הכתוביות והביטים מקבלים טקסט דרך query string).
**תאריך:** 2026-09-01

**כיוון עיצובי:** *"המגרש בלילה"* — שדה כחול-מלכותי עמוק של המועדון, טיפוגרפיה כבדה
ולבנה, וקו כתום יחיד שמסמן איפה להסתכל. שקט, ענייני, בלי הייפ — הפוטג' הוא הכוכב,
השכבה שלי רק מכריזה ומסבירה.

---

## 0. מה זה, ואיפה זה יושב

זה **לא** מסמך תיאורי. כל כרטיס במסמך הוא קובץ HTML אמיתי שרונדר ונבדק, ויושב כאן:

```
itai/Outputs/video-cards/
├── 01-title-16x9.html          כרטיס פתיחה        1600×900
├── 02-title-9x16.html          כרטיס פתיחה         900×1600
├── 03-lower-third-16x9.html    כתובית תחתונה      1600×900   רקע שקוף · טקסט מ-query
├── 04-lower-third-9x16.html    כתובית תחתונה       900×1600   רקע שקוף · טקסט מ-query
├── 05-beat-16x9.html           כרטיס ביט מפריד    1600×900   טקסט מ-query
├── 06-beat-9x16.html           כרטיס ביט מפריד     900×1600   טקסט מ-query
├── 07-end-16x9.html            כרטיס סגירה        1600×900
├── 08-end-9x16.html            כרטיס סגירה         900×1600
├── 09-bug-16x9.html            באג פינה (watermark) רקע שקוף
├── 10-bug-9x16.html            באג פינה (watermark) רקע שקוף
├── assets/club-logo.jpg        הלוגו של המועדון (העתק מהאפליקציה)
├── fonts/heebo-hebrew.woff2    Heebo — subset עברי (12KB)
├── fonts/heebo-latin.woff2     Heebo — subset לטיני (30KB)
├── render.mjs                  צילום כל הכרטיסים ל-PNG דרך Playwright
└── renders/*.png               הפלט שנבדק (proof-*.png = בדיקות קריאוּת בלבד)
```

### צילום ל-PNG

```bash
cd itai/Outputs/video-cards
node render.mjs                      # כל הכרטיסים
node render.mjs 05-beat-16x9.html    # כרטיס בודד
```

`render.mjs` מצלם ב-`deviceScaleFactor: 1.2` — כלומר **1600×900 → 1920×1080** ו-**900×1600 → 1080×1920**,
ומעביר `omitBackground: true` לכל קובץ ששמו מכיל `lower-third` / `bug` (כרטיסי השכבה השקופה).
כל הכרטיסים מצולמים ב**מצב הסופי הסטטי** — האנימציה מתבצעת ב-ffmpeg, לא ב-CSS (ראו §7).
מי שרוצה לראות את התנועה בדפדפן לצורך אישור: להוסיף `?anim=1` ל-URL.

### פונט

**Heebo** (Google Fonts, רישיון SIL OFL 1.1 — מותר בהטמעה ובווידאו מסחרי).
הותקן גם ברמת המערכת (`~/.fonts/Heebo-VF.ttf`, מאומת ב-`fc-list`) — **חשוב לנועם:**
כדאי שהאפליקציה עצמה תרונדר עם Heebo בזמן ההקלטה במקום `Arial/DejaVu`, כדי שהפוטג'
והכתוביות ידברו באותו פונט. הכרטיסים עצמם לא תלויים בהתקנה: הם טוענים `@font-face`
מקבצי `fonts/*.woff2` המקומיים, בלי רשת בזמן הצילום, עם `font-display:block`
(אין FOUT — הצילום לא ייתפס באמצע החלפת פונט).

---

## 1. טוקנים לסרטון

### צבע — מהמותג האמיתי בלבד

| טוקן | Hex | מקור | שימוש בסרטון |
|---|---|---|---|
| `--brand-900` | `#122A50` | brand.900 | רקע כרטיס פתיחה/סגירה · גוף הכתובית התחתונה |
| `--brand-800` | `#17386B` | brand.800 | אמצע הגרדיאנט |
| `--brand-700` | `#1D4788` | brand.700 | ראש הגרדיאנט של הפתיחה · בסיס כרטיס ביט |
| `--brand-600` | `#2355A5` | brand.600 (**הכחול של המועדון**) | ראש הגרדיאנט של כרטיס הביט |
| `--brand-100` | `#D6E1F2` | brand.100 | טקסט משני על כחול |
| `--accent-500` | `#F58634` | accent.500 (כתום הלוגו) | קו ההדגשה, פס הביט, נקודות — **גרפיקה** |
| `--accent-300` | `#FFB07A` | גוון של accent.500 | **טקסט** כתום מעל הכחולים הבהירים בלבד |
| `--white` | `#FFFFFF` | — | טקסט ראשי, לוחית הלוגו, כפתור ה-CTA |
| `--ink` | `#0B1A33` | — | טקסט על לבן (ה-CTA) |

**חוק הכתום:** הכתום הוא סימון, לא קול. הוא מותר כטקסט רק מעל `brand-900`/`brand-800`
(5.66 / 4.60 — עובר AA). מעל `brand-700`/`brand-600` הוא יורד ל-3.61 / 2.86 ולכן שם
הוא **גרפיקה בלבד**, ואם צריך מילה כתומה משתמשים ב-`--accent-300` (4.21 / 4.03).
זה בדיוק ההיגיון שכבר קיים ב-`tailwind.config.js` — "accent … never for buttons/links".

### ניגודיות שנמדדה (WCAG 2.1)

| צמד | יחס | תקן |
|---|---|---|
| לבן על `#122A50` | 14.26 | AAA |
| לבן על `#1D4788` | 9.09 | AAA |
| לבן על `#2355A5` | 7.21 | AAA |
| `#D6E1F2` על `#122A50` | 10.80 | AAA |
| `#D6E1F2` על `#2355A5` | 5.46 | AA |
| `#F58634` על `#122A50` | 5.66 | AA |
| `#FFB07A` על `#2355A5` | 4.03 | AA (טקסט גדול) |
| `#0B1A33` על לבן (CTA) | 17.36 | AAA |
| לבן על פאנל הכתובית מעל ממשק בהיר (`.95` מעל `#FAFAF9` → `#1E3458`) | 12.45 | AAA |

השורה האחרונה היא הקריטית: היא מוכיחה שהכתובית קריאה **גם** אחרי שהיא מורכבת מעל
ממשק בהיר, ולא רק כשהיא לבד על שקוף.

### טיפוגרפיה

Heebo. משקלים בשימוש: 900 (כותרות ראשיות), 800 (כותרות כתוביות), 700/600 (מטא),
500 (גוף). `letter-spacing: -.02em` בכותרות בלבד — עברית כבדה בגודל גדול נסגרת יפה.

| תפקיד | 16:9 (1600×900) | 9:16 (900×1600) |
|---|---|---|
| כותרת כרטיס פתיחה | 96px / 900 / lh 1.05 | 82px / 900 / lh 1.08 |
| תת-כותרת פתיחה | 34px / 500 / lh 1.5 | 32px / 500 / lh 1.55 |
| כותרת ביט | 116px / 900 / lh 1.02 | 92px / 900 |
| מטא ביט ("01 · מתוך 5") | 28px / 800 | 26px / 800 |
| כותרת כתובית תחתונה | 44px / 800 / lh 1.22 | 52px / 800 |
| תת-כותרת כתובית | 27px / 500 | 31px / 500 |
| קיקר (מעל הכתובית) | 22px / 800 | 24px / 800 |
| פאנץ' סגירה | 68px / 900 | 60px / 900 |
| CTA | 34px / 800 | 32px / 800 |
| פרטי קשר | 26px / 600 | 25px / 600 |
| שורת נתונים בדויים | 20px / 600 | 21px / 600 |

**מינימום מוחלט: 19px ב-1600×900** (= 22px ב-1080p). מתחת לזה טקסט מת בדחיסת וידאו
ובצפייה בנייד.

### ריווח, רדיוס, צל

- סקאלת ריווח: `8 / 12 / 16 / 24 / 32 / 44 / 56 / 88 / 112`
- **שוליים בטוחים 16:9:** 112px צדדים, 88px מעל/מתחת. שום טקסט לא חוצה אותם.
- **שוליים בטוחים 9:16:** 72px צדדים, **220px למעלה** ו-**400px למטה** — שם יושב
  ה-UI של הפלטפורמה (אווטאר/סאונד למעלה, כיתוב ורייל שיתוף למטה). הכתובית התחתונה
  האנכית יושבת ב-`bottom: 420px` בדיוק בגלל זה.
- רדיוס: 20px (פאנל כתובית) · 24–32px (לוחית לוגו) · 999px (צ'יפים ו-CTA)
- צל: `drop-shadow(0 20px 44px rgba(6,16,34,.42))` על הכתובית — הוא מה שמפריד אותה
  מממשק בהיר. על לוחיות: `0 18px 48px rgba(0,0,0,.30)`.

### הלוגו — החלטה שחשוב להבין

`club-logo.jpg` הוא JPG על רקע לבן, והאותיות בו כחולות. **אסור** להניח אותו על שדה
כחול (הכיתוב ייעלם) ואסור "לחתוך" ממנו את הלבן לשקיפות (אותו כישלון, רק בלי רקע).
לכן בכל מקום הוא יושב על **לוחית לבנה מעוגלת** עם padding פנימי — זה גם מגן על הלוגו
וגם נראה מכוון. בבאג הפינה: עיגול לבן קטן.

---

## 2. כרטיס כותרת פתיחה

### 2.1 רוחבי — `01-title-16x9.html` (1600×900)

הקומפוזיציה מיושרת לימין ומעוגנת במרכז אנכית; צד שמאל נשאר ריק בכוונה (קווי מגרש
דהויים ב-CSS בלבד, בלי תמונה). זה מותיר מקום נשימה ומבדיל את הפתיחה מכרטיס הסגירה
הממורכז.

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>כרטיס פתיחה — 1600×900</title>
<style>
/* ---------- Heebo (local, no network at capture time) ---------- */
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-hebrew.woff2') format('woff2');
  unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;}
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-latin.woff2') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212,U+2215,U+FEFF,U+FFFD;}

/* ---------- Video design tokens (from tailwind.config.js) ---------- */
:root{
  --brand-900:#122A50; --brand-800:#17386B; --brand-700:#1D4788;
  --brand-600:#2355A5; --brand-500:#2F5FAC; --brand-100:#D6E1F2; --brand-50:#EEF3FA;
  --accent-500:#F58634; --accent-400:#F79A5B;
  --white:#FFFFFF;
  --pad-x:112px; --pad-y:88px;
  --fs-h1:96px; --fs-sub:34px; --fs-chip:24px;
  --radius-plate:28px; --radius-card:24px;
  --shadow-plate:0 18px 48px rgba(0,0,0,.30);
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1600px;height:900px;overflow:hidden}
body{
  font-family:'Heebo',system-ui,Arial,sans-serif;
  direction:rtl; text-align:right;
  background:var(--brand-900);
  -webkit-font-smoothing:antialiased;
}
.stage{
  position:relative; width:1600px; height:900px; overflow:hidden;
  background:
    radial-gradient(1100px 700px at 88% 12%, rgba(47,95,172,.55) 0%, rgba(18,42,80,0) 62%),
    linear-gradient(215deg,#1D4788 0%,#17386B 45%,#122A50 100%);
}
/* court-line motif — CSS only, no image */
.court{position:absolute;inset:0;pointer-events:none;opacity:.9}
.court .circle{position:absolute;left:-190px;bottom:-260px;width:720px;height:720px;
  border:3px solid rgba(255,255,255,.07);border-radius:50%}
.court .circle.sm{left:-70px;bottom:-140px;width:480px;height:480px;border-color:rgba(255,255,255,.05)}
.court .key{position:absolute;left:150px;top:0;width:2px;height:100%;background:rgba(255,255,255,.05)}
.court .base{position:absolute;left:0;bottom:96px;width:640px;height:2px;background:rgba(255,255,255,.06)}

.content{position:absolute;inset:var(--pad-y) var(--pad-x);display:flex;flex-direction:column;justify-content:center}
.logo-plate{
  width:168px;height:168px;background:var(--white);border-radius:var(--radius-plate);
  padding:16px;box-shadow:var(--shadow-plate);display:grid;place-items:center;margin-bottom:44px;
}
.logo-plate img{width:100%;height:100%;object-fit:contain;display:block}
h1{font-size:var(--fs-h1);font-weight:900;line-height:1.05;letter-spacing:-.02em;color:var(--white);max-width:1120px}
h1 .soft{color:var(--brand-100);font-weight:800}
.rule{width:104px;height:9px;background:var(--accent-500);border-radius:5px;margin:34px 0 26px}
.sub{font-size:var(--fs-sub);font-weight:500;line-height:1.5;color:var(--brand-100);max-width:920px}
.sub b{color:#fff;font-weight:700}
.chip{
  position:absolute;top:var(--pad-y);left:var(--pad-x);
  display:flex;align-items:center;gap:12px;
  font-size:var(--fs-chip);font-weight:700;color:rgba(255,255,255,.78);
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);
  padding:12px 20px;border-radius:999px;
}
.chip .dot{width:10px;height:10px;border-radius:50%;background:var(--accent-500);flex:none}

/* Optional preview animation. The captured PNG must be the FINAL state, so this only
   runs when <body class="anim"> — motion itself is done in ffmpeg. */
body.anim .logo-plate{animation:pop .5s cubic-bezier(.22,1,.36,1) both}
body.anim h1{animation:slideR .45s cubic-bezier(.22,1,.36,1) .15s both}
body.anim .rule{animation:grow .35s cubic-bezier(.22,1,.36,1) .45s both}
body.anim .sub{animation:riseIn .40s ease-out .60s both}
@keyframes pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes slideR{from{opacity:0;transform:translateX(48px)}to{opacity:1;transform:none}}
@keyframes grow{from{width:0}to{width:104px}}
@keyframes riseIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
  <div class="stage">
    <div class="court"><i class="circle"></i><i class="circle sm"></i><i class="key"></i><i class="base"></i></div>
    <div class="chip"><span class="dot"></span>קרית אונו — דור העתיד</div>
    <div class="content">
      <div class="logo-plate">
        <img src="./assets/club-logo.jpg" alt="עירוני קריית אונו – כדורסל דור העתיד">
      </div>
      <h1>מועדון נוער שלם.<br><span class="soft">במקום אחד.</span></h1>
      <div class="rule"></div>
      <p class="sub">לוח שבועי · משחקים · הסעות · מאמנים · שעות — <b>הכול בעברית</b>.</p>
    </div>
  </div>
</body>
</html>
```

### 2.2 אנכי — `02-title-9x16.html` (900×1600)

אותה שפה, אבל הבלוק כולו כלוא בין שני אזורי הבטיחות של הפלטפורמה, והכותרת מתקצרת
ל-3 שורות — בנייד קוראים פחות.

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>כרטיס פתיחה — 900×1600</title>
<style>
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-hebrew.woff2') format('woff2');
  unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;}
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-latin.woff2') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212,U+2215,U+FEFF,U+FFFD;}

:root{
  --brand-900:#122A50; --brand-800:#17386B; --brand-700:#1D4788;
  --brand-600:#2355A5; --brand-500:#2F5FAC; --brand-100:#D6E1F2;
  --accent-500:#F58634; --white:#FFFFFF;
  --pad-x:72px;
  --safe-top:220px;    /* platform UI (avatar / sound) */
  --safe-bottom:400px; /* platform UI (caption / share rail) */
  --fs-h1:82px; --fs-sub:32px; --fs-chip:22px;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:900px;height:1600px;overflow:hidden}
body{font-family:'Heebo',system-ui,Arial,sans-serif;direction:rtl;text-align:right;
  background:var(--brand-900);-webkit-font-smoothing:antialiased}
.stage{position:relative;width:900px;height:1600px;overflow:hidden;
  background:
    radial-gradient(760px 760px at 82% 18%, rgba(47,95,172,.55) 0%, rgba(18,42,80,0) 62%),
    linear-gradient(200deg,#1D4788 0%,#17386B 48%,#122A50 100%);}
.court{position:absolute;inset:0;pointer-events:none}
.court .circle{position:absolute;left:-220px;bottom:180px;width:640px;height:640px;
  border:3px solid rgba(255,255,255,.07);border-radius:50%}
.court .circle.sm{left:-120px;bottom:300px;width:400px;height:400px;border-color:rgba(255,255,255,.05)}
.court .base{position:absolute;left:0;bottom:var(--safe-bottom);width:100%;height:2px;background:rgba(255,255,255,.05)}

/* everything lives between the two platform safe areas */
.content{position:absolute;left:var(--pad-x);right:var(--pad-x);
  top:var(--safe-top);bottom:var(--safe-bottom);
  display:flex;flex-direction:column;justify-content:center}
.logo-plate{width:196px;height:196px;background:var(--white);border-radius:32px;padding:18px;
  box-shadow:0 18px 48px rgba(0,0,0,.30);display:grid;place-items:center;margin-bottom:48px}
.logo-plate img{width:100%;height:100%;object-fit:contain;display:block}
h1{font-size:var(--fs-h1);font-weight:900;line-height:1.08;letter-spacing:-.02em;color:var(--white)}
h1 .soft{color:var(--brand-100);font-weight:800}
.rule{width:92px;height:9px;background:var(--accent-500);border-radius:5px;margin:32px 0 24px}
.sub{font-size:var(--fs-sub);font-weight:500;line-height:1.55;color:var(--brand-100)}
.sub b{color:#fff;font-weight:700}
.chip{position:absolute;top:calc(var(--safe-top) - 96px);right:var(--pad-x);
  display:inline-flex;align-items:center;gap:10px;font-size:var(--fs-chip);font-weight:700;
  color:rgba(255,255,255,.78);background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.14);padding:11px 18px;border-radius:999px}
.chip .dot{width:9px;height:9px;border-radius:50%;background:var(--accent-500);flex:none}

body.anim .logo-plate{animation:pop .5s cubic-bezier(.22,1,.36,1) both}
body.anim h1{animation:slideR .45s cubic-bezier(.22,1,.36,1) .15s both}
body.anim .rule{animation:grow .35s cubic-bezier(.22,1,.36,1) .45s both}
body.anim .sub{animation:riseIn .4s ease-out .6s both}
@keyframes pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes slideR{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
@keyframes grow{from{width:0}to{width:92px}}
@keyframes riseIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
  <div class="stage">
    <div class="court"><i class="circle"></i><i class="circle sm"></i><i class="base"></i></div>
    <div class="chip"><span class="dot"></span>קרית אונו — דור העתיד</div>
    <div class="content">
      <div class="logo-plate">
        <img src="./assets/club-logo.jpg" alt="עירוני קריית אונו – כדורסל דור העתיד">
      </div>
      <h1>לוח האימונים<br>של המועדון<br><span class="soft">בלחיצה אחת.</span></h1>
      <div class="rule"></div>
      <p class="sub">בונים שבוע, משכפלים אותו,<br>ושולחים <b>כתמונה לוואטסאפ</b>.</p>
    </div>
  </div>
</body>
</html>
```

---

## 3. כתובית תחתונה (lower-third) — רקע שקוף

**זה האלמנט הכי חשוב בסרטון.** הוא נושא את כל המסר (אין פס קול), הוא מורכב מעל ממשק
**בהיר** (האפליקציה על `stone-50`), והוא ב-RTL.

איך זה עובד:

- **פאנל אטום, לא כתוביות "רגילות".** רקע `rgba(18,42,80,.95)` + `drop-shadow` חזק.
  טקסט לבן על שקוף מעל טבלה בהירה זה בלתי קריא — פאנל הוא הפתרון היחיד שעובד תמיד.
- **הקו הכתום ב-`border-inline-start`** — כלומר ב-RTL הוא נוחת אוטומטית על **הצד הימני**,
  שם העין מתחילה לקרוא. אם מישהו יעביר את הקובץ ל-LTR הוא יתהפך לבד, כמו שצריך.
- **ימין-תחתון**, כי בממשק של האפליקציה כפתורי הפעולה יושבים למעלה והתוכן שרוצים
  להראות (הטבלה) במרכז.
- **הטקסט מגיע מ-query string** — קובץ אחד מרנדר את כל הכתוביות של שירה:

```
03-lower-third-16x9.html?k=לוח שבועי&t=כותרת&s=תת-כותרת&disc=1
```

| פרמטר | משמעות |
|---|---|
| `k` | קיקר כתום קטן (שם הפרק). `k=` ריק ⇐ מוסתר |
| `t` | כותרת (חובה) |
| `s` | תת-כותרת. `s=` ריק ⇐ מוסתר |
| `disc=1` | מוסיף את פס **"כל הנתונים בסרטון בדויים"** בפינה הנגדית |
| `bg=light\|dark` | **לבדיקה בלבד** — צובע רקע מזויף כדי לאשר קריאוּת. אסור בצילום הסופי |

דוגמת קוד לצילום כל הכתוביות של שירה בלולאה (לנועם):

```js
for (const c of captions) {                    // captions = [{k,t,s,dur}, ...]
  const q = new URLSearchParams({ k: c.k ?? '', t: c.t, s: c.s ?? '', disc: c.disc ? '1' : '' });
  await page.goto(`file://${dir}/03-lower-third-16x9.html?${q}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `lt-${c.id}.png`, omitBackground: true });
}
```

### 3.1 רוחבי — `03-lower-third-16x9.html` (1600×900)

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>כתובית תחתונה — 1600×900 (רקע שקוף)</title>
<!--
  Transparent overlay. Capture with Playwright: screenshot({ omitBackground: true }).
  Text is driven by the query string so one template renders every caption:
    03-lower-third-16x9.html?k=KICKER&t=TITLE&s=SUB&disc=1
    k    = kicker (small orange label, optional)
    t    = title  (required)
    s    = subtitle (optional)
    disc = 1  -> shows the "demo data is fictional" strip on the opposite corner
    bg   = light|dark  -> PROOFING ONLY, paints a fake background. Never use for the final PNG.
-->
<style>
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-hebrew.woff2') format('woff2');
  unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;}
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-latin.woff2') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212,U+2215,U+FEFF,U+FFFD;}

:root{
  --brand-900:#122A50; --brand-700:#1D4788; --brand-100:#D6E1F2;
  --accent-500:#F58634; --white:#FFFFFF;
  --lt-right:96px; --lt-bottom:96px;
  --fs-title:44px; --fs-sub:27px; --fs-kicker:22px; --fs-disc:20px;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1600px;height:900px;overflow:hidden;background:transparent}
body{font-family:'Heebo',system-ui,Arial,sans-serif;direction:rtl;text-align:right;
  -webkit-font-smoothing:antialiased}
/* proofing backgrounds only */
body[data-bg="light"]{background:#FAFAF9}
body[data-bg="dark"]{background:#0E1726}

.lt{
  position:absolute;right:var(--lt-right);bottom:var(--lt-bottom);max-width:1040px;
  /* the drop-shadow is what keeps the panel separated from a bright app UI */
  filter:drop-shadow(0 20px 44px rgba(6,16,34,.42));
}
.panel{
  background:rgba(18,42,80,.95);
  border:1px solid rgba(255,255,255,.14);
  border-inline-start:10px solid var(--accent-500); /* RTL: the accent sits on the right */
  border-radius:20px;
  padding:26px 36px 28px;
}
.kicker{
  display:inline-flex;align-items:center;gap:10px;
  font-size:var(--fs-kicker);font-weight:800;letter-spacing:.01em;color:var(--accent-500);
  margin-bottom:10px;
}
.kicker .dot{width:8px;height:8px;border-radius:50%;background:var(--accent-500)}
.title{font-size:var(--fs-title);font-weight:800;line-height:1.22;color:var(--white);letter-spacing:-.01em}
.sub{font-size:var(--fs-sub);font-weight:500;line-height:1.45;color:var(--brand-100);margin-top:10px}
.sub b{color:#fff;font-weight:700}
.hide{display:none}

/* fictional-data strip — required by the brief; opposite corner, never over the caption */
.disc{
  position:absolute;left:var(--lt-right);bottom:var(--lt-bottom);
  display:inline-flex;align-items:center;gap:10px;
  font-size:var(--fs-disc);font-weight:600;color:rgba(255,255,255,.92);
  background:rgba(18,42,80,.85);border:1px solid rgba(255,255,255,.16);
  padding:10px 18px;border-radius:999px;
  filter:drop-shadow(0 10px 26px rgba(6,16,34,.35));
}
.disc .dot{width:7px;height:7px;border-radius:50%;background:var(--accent-500)}

body.anim .lt{animation:wipeR .35s cubic-bezier(.22,1,.36,1) both}
body.anim .panel>*{animation:riseIn .25s ease-out .12s both}
@keyframes wipeR{from{clip-path:inset(0 0 0 100%);opacity:.2}to{clip-path:inset(0 0 0 0);opacity:1}}
@keyframes riseIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
  <div class="lt">
    <div class="panel">
      <div class="kicker" id="k"><span class="dot"></span><span id="kt">לוח שבועי</span></div>
      <div class="title" id="t">בונים שבוע אחד — ומשכפלים אותו לשבוע הבא</div>
      <div class="sub" id="s">בלי להעתיק שורות באקסל ובלי הודעה חדשה בוואטסאפ.</div>
    </div>
  </div>

  <div class="disc hide" id="d"><span class="dot"></span>כל הנתונים בסרטון בדויים</div>

<script>
  var q = new URLSearchParams(location.search);
  function set(id, v){ var el = document.getElementById(id); if (v !== null) el.textContent = v; }
  if (q.has('k')) { q.get('k') ? set('kt', q.get('k')) : document.getElementById('k').classList.add('hide'); }
  if (q.has('t')) set('t', q.get('t'));
  if (q.has('s')) { q.get('s') ? set('s', q.get('s')) : document.getElementById('s').classList.add('hide'); }
  if (q.get('disc') === '1') document.getElementById('d').classList.remove('hide');
  if (q.has('bg')) document.body.dataset.bg = q.get('bg');
  if (q.get('anim') === '1') document.body.classList.add('anim');
</script>
</body>
</html>
```

### 3.2 אנכי — `04-lower-third-9x16.html` (900×1600)

זהה, למעט: `--lt-bottom: 420px` (מעל ה-UI של הפלטפורמה), הפאנל נמתח לרוחב מלא בין
השוליים (`right`+`left`), הטיפוגרפיה גדלה (52/31), ופס "נתונים בדויים" עובר לימין
מתחת לפאנל — בפינה השמאלית הוא היה מתנגש ברייל השיתוף.

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>כתובית תחתונה — 900×1600 (רקע שקוף)</title>
<!--
  Transparent overlay. Capture with Playwright: screenshot({ omitBackground: true }).
  Text is driven by the query string so one template renders every caption:
    04-lower-third-9x16.html?k=KICKER&t=TITLE&s=SUB&disc=1
    k    = kicker (small orange label, optional)
    t    = title  (required)
    s    = subtitle (optional)
    disc = 1  -> shows the "demo data is fictional" strip on the opposite corner
    bg   = light|dark  -> PROOFING ONLY, paints a fake background. Never use for the final PNG.
-->
<style>
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-hebrew.woff2') format('woff2');
  unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;}
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-latin.woff2') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212,U+2215,U+FEFF,U+FFFD;}

:root{
  --brand-900:#122A50; --brand-700:#1D4788; --brand-100:#D6E1F2;
  --accent-500:#F58634; --white:#FFFFFF;
  --lt-right:56px; --lt-bottom:420px;  /* 420px clears the platform caption + share rail */
  --fs-title:52px; --fs-sub:31px; --fs-kicker:24px; --fs-disc:21px;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:900px;height:1600px;overflow:hidden;background:transparent}
body{font-family:'Heebo',system-ui,Arial,sans-serif;direction:rtl;text-align:right;
  -webkit-font-smoothing:antialiased}
/* proofing backgrounds only */
body[data-bg="light"]{background:#FAFAF9}
body[data-bg="dark"]{background:#0E1726}

.lt{
  position:absolute;right:var(--lt-right);left:var(--lt-right);bottom:var(--lt-bottom);
  /* the drop-shadow is what keeps the panel separated from a bright app UI */
  filter:drop-shadow(0 20px 44px rgba(6,16,34,.42));
}
.panel{
  background:rgba(18,42,80,.95);
  border:1px solid rgba(255,255,255,.14);
  border-inline-start:10px solid var(--accent-500); /* RTL: the accent sits on the right */
  border-radius:20px;
  padding:24px 30px 26px;
}
.kicker{
  display:inline-flex;align-items:center;gap:10px;
  font-size:var(--fs-kicker);font-weight:800;letter-spacing:.01em;color:var(--accent-500);
  margin-bottom:10px;
}
.kicker .dot{width:8px;height:8px;border-radius:50%;background:var(--accent-500)}
.title{font-size:var(--fs-title);font-weight:800;line-height:1.22;color:var(--white);letter-spacing:-.01em}
.sub{font-size:var(--fs-sub);font-weight:500;line-height:1.45;color:var(--brand-100);margin-top:10px}
.sub b{color:#fff;font-weight:700}
.hide{display:none}

/* fictional-data strip — required by the brief; opposite corner, never over the caption */
.disc{
  position:absolute;right:var(--lt-right);bottom:calc(var(--lt-bottom) - 74px);
  display:inline-flex;align-items:center;gap:10px;
  font-size:var(--fs-disc);font-weight:600;color:rgba(255,255,255,.92);
  background:rgba(18,42,80,.85);border:1px solid rgba(255,255,255,.16);
  padding:10px 18px;border-radius:999px;
  filter:drop-shadow(0 10px 26px rgba(6,16,34,.35));
}
.disc .dot{width:7px;height:7px;border-radius:50%;background:var(--accent-500)}

body.anim .lt{animation:wipeR .35s cubic-bezier(.22,1,.36,1) both}
body.anim .panel>*{animation:riseIn .25s ease-out .12s both}
@keyframes wipeR{from{clip-path:inset(0 0 0 100%);opacity:.2}to{clip-path:inset(0 0 0 0);opacity:1}}
@keyframes riseIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
  <div class="lt">
    <div class="panel">
      <div class="kicker" id="k"><span class="dot"></span><span id="kt">לוח שבועי</span></div>
      <div class="title" id="t">בונים שבוע אחד — ומשכפלים אותו לשבוע הבא</div>
      <div class="sub" id="s">בלי להעתיק שורות באקסל ובלי הודעה חדשה בוואטסאפ.</div>
    </div>
  </div>

  <div class="disc hide" id="d"><span class="dot"></span>כל הנתונים בסרטון בדויים</div>

<script>
  var q = new URLSearchParams(location.search);
  function set(id, v){ var el = document.getElementById(id); if (v !== null) el.textContent = v; }
  if (q.has('k')) { q.get('k') ? set('kt', q.get('k')) : document.getElementById('k').classList.add('hide'); }
  if (q.has('t')) set('t', q.get('t'));
  if (q.has('s')) { q.get('s') ? set('s', q.get('s')) : document.getElementById('s').classList.add('hide'); }
  if (q.get('disc') === '1') document.getElementById('d').classList.remove('hide');
  if (q.has('bg')) document.body.dataset.bg = q.get('bg');
  if (q.get('anim') === '1') document.body.classList.add('anim');
</script>
</body>
</html>
```

---

## 4. כרטיס סגירה

ממורכז — הפוך מהפתיחה, וזה מה שנותן תחושת סוף. שלוש שכבות בלבד: הפאנץ', ה-CTA,
פרטי הקשר. **פרטי הקשר הם placeholder** (`example.org`) ומוחלפים לפני ייצוא.
שורת התחתית קבועה ואינה לקישוט: היא מצהירה גם על מועדון הפיילוט וגם על נתוני הדמו —
עדי ביקשה את שתי ההצהרות, ועדיף שהן יהיו חלק מהעיצוב ולא טלאי.

### 4.1 רוחבי — `07-end-16x9.html` (1600×900)

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>כרטיס סגירה — 1600×900</title>
<!--
  End card. Centred composition (the title card is right-aligned) so the film has a full stop.
  Contact details are PLACEHOLDERS — replace before export.
-->
<style>
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-hebrew.woff2') format('woff2');
  unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;}
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-latin.woff2') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212,U+2215,U+FEFF,U+FFFD;}

:root{
  --brand-900:#122A50; --brand-800:#17386B; --brand-700:#1D4788; --brand-600:#2355A5;
  --brand-100:#D6E1F2; --accent-500:#F58634; --white:#FFFFFF; --ink:#0B1A33;
  --pad-y:76px;
  --fs-punch:68px; --fs-cta:34px; --fs-contact:26px; --fs-legal:19px;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1600px;height:900px;overflow:hidden}
body{font-family:'Heebo',system-ui,Arial,sans-serif;direction:rtl;text-align:center;
  background:var(--brand-900);-webkit-font-smoothing:antialiased}
.stage{position:relative;width:1600px;height:900px;overflow:hidden;
  background:
    radial-gradient(900px 620px at 50% 22%, rgba(47,95,172,.5) 0%, rgba(18,42,80,0) 62%),
    linear-gradient(180deg,#1D4788 0%,#17386B 46%,#122A50 100%);}
.court{position:absolute;left:50%;bottom:-420px;transform:translateX(-50%);
  width:920px;height:920px;border:3px solid rgba(255,255,255,.06);border-radius:50%}
.content{position:absolute;inset:var(--pad-y) 120px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:0}
.logo-plate{width:132px;height:132px;background:var(--white);border-radius:24px;padding:14px;
  box-shadow:0 18px 48px rgba(0,0,0,.30);display:grid;place-items:center;margin-bottom:34px}
.logo-plate img{width:100%;height:100%;object-fit:contain;display:block}
.punch{font-size:var(--fs-punch);font-weight:900;line-height:1.14;letter-spacing:-.02em;
  color:var(--white);max-width:1180px}
.punch b{color:var(--accent-500);font-weight:900}
.rule{width:88px;height:8px;background:var(--accent-500);border-radius:4px;margin:32px 0 30px}
.cta{display:inline-flex;align-items:center;gap:14px;background:var(--white);color:var(--ink);
  font-size:var(--fs-cta);font-weight:800;padding:20px 40px;border-radius:999px;
  box-shadow:0 16px 40px rgba(0,0,0,.28)}
.cta .ball{width:14px;height:14px;border-radius:50%;background:var(--accent-500);flex:none}
.contact{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:34px;
  font-size:var(--fs-contact);font-weight:600;color:var(--brand-100)}
.contact .sep{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.3)}
.contact span[dir="ltr"]{direction:ltr;unicode-bidi:isolate}
.legal{position:absolute;left:0;right:0;bottom:44px;font-size:var(--fs-legal);font-weight:500;
  color:rgba(255,255,255,.55)}

body.anim .logo-plate{animation:pop .5s cubic-bezier(.22,1,.36,1) both}
body.anim .punch{animation:riseIn .45s cubic-bezier(.22,1,.36,1) .12s both}
body.anim .rule{animation:grow .3s ease-out .4s both}
body.anim .cta{animation:pop .4s cubic-bezier(.22,1,.36,1) .5s both}
body.anim .contact{animation:riseIn .35s ease-out .68s both}
@keyframes pop{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes riseIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes grow{from{width:0}to{width:88px}}
</style>
</head>
<body>
  <div class="stage">
    <div class="court"></div>
    <div class="content">
      <div class="logo-plate">
        <img src="./assets/club-logo.jpg" alt="עירוני קריית אונו – כדורסל דור העתיד">
      </div>
      <div class="punch">מה שלוקח היום ערב שלם באקסל —<br><b>יוצא כאן בלחיצה.</b></div>
      <div class="rule"></div>
      <div class="cta"><span class="ball"></span>רוצים את זה במועדון שלכם?</div>
      <div class="contact">
        <span dir="ltr">example.org</span><span class="sep"></span>
        <span dir="ltr">hello@example.org</span><span class="sep"></span>
        <span dir="ltr">03-0000000</span>
      </div>
    </div>
    <div class="legal">המערכת פועלת במועדון "קרית אונו — דור העתיד" · כל הנתונים המוצגים בסרטון בדויים</div>
  </div>
</body>
</html>
```

### 4.2 אנכי — `08-end-9x16.html` (900×1600)

דלתא מהקובץ הרוחבי: `--pad-y:220px` · פאנץ' 60px · CTA 32px · `.contact{flex-wrap:wrap}` ·
עיגול המגרש 760px ב-`bottom:-300px` · שורת התחתית ל-`bottom:330px` (מעל ה-UI של הפלטפורמה) ·
הפאנץ' מתקצר ל-"ערב שלם באקסל — או לחיצה אחת כאן." הקובץ המלא קיים בתיקייה.

---

## 5. כרטיס "ביט" מפריד

מפריד קצר בין פרקים. הרקע כאן **בהיר יותר** (`brand-600 → brand-800`) מכרטיסי
הפתיחה/סגירה — ההבדל הזה הוא מה שגורם לקאט להיקרא כמעבר פרק ולא כסוף הסרט.
המספר הענק ברקע הוא עיגון ויזואלי, ופס הסגמנטים בתחתית מראה לצופה כמה נשאר —
בדמו של 3 דקות זה מחזיק אנשים בפנים. ב-RTL הסגמנטים מתמלאים מימין לשמאל, כמו שצריך.

```
05-beat-16x9.html?n=1&of=5&t=לוח שבועי&s=בונים, משכפלים, משתפים.
```

| פרמטר | משמעות |
|---|---|
| `n` | מספר הביט (1-based) — מזין את הספרה, את הרקע ואת הסגמנטים |
| `of` | כמה ביטים בסך הכול (ברירת מחדל 5) |
| `t` | כותרת קצרה — 2-3 מילים, לא יותר |
| `s` | שורת משנה אחת (אופציונלי; `s=` ריק ⇐ מוסתר) |

הביטים מהבריף: `t=לוח שבועי` · `t=משחקים והסעות` · `t=תצוגת מאמן` · `t=ניהול`.

### 5.1 רוחבי — `05-beat-16x9.html` (1600×900)

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>כרטיס ביט מפריד — 1600×900</title>
<!--
  Full-frame beat card between chapters.
  05-beat-16x9.html?n=1&of=5&t=TITLE&s=SUB
    n  = beat index (1-based) — drives both the numeral and the progress segments
    of = number of beats (default 5)
    t  = title (short: 2-3 words)
    s  = subtitle (optional, one line)
-->
<style>
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-hebrew.woff2') format('woff2');
  unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;}
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-latin.woff2') format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212,U+2215,U+FEFF,U+FFFD;}

:root{
  --brand-900:#122A50; --brand-800:#17386B; --brand-700:#1D4788; --brand-600:#2355A5;
  --brand-100:#D6E1F2; --accent-500:#F58634;
  /* a tint of the club orange, for orange TEXT over the lighter blues (AA-safe) */
  --accent-300:#FFB07A;
  --white:#FFFFFF;
  --pad-x:112px; --pad-y:88px;
  --fs-num:28px; --fs-title:116px; --fs-sub:32px; --fs-ghost:560px;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1600px;height:900px;overflow:hidden}
body{font-family:'Heebo',system-ui,Arial,sans-serif;direction:rtl;text-align:right;
  background:var(--brand-700);-webkit-font-smoothing:antialiased}
.stage{position:relative;width:1600px;height:900px;overflow:hidden;
  background:
    radial-gradient(900px 620px at 78% 30%, rgba(47,95,172,.55) 0%, rgba(29,71,136,0) 60%),
    linear-gradient(210deg,#2355A5 0%,#1D4788 52%,#17386B 100%);}
.ghost{
  position:absolute;left:56px;top:50%;transform:translateY(-50%);
  font-size:var(--fs-ghost);font-weight:900;line-height:.8;letter-spacing:-.04em;
  color:rgba(255,255,255,.055);user-select:none;direction:ltr;
}
.content{position:absolute;inset:var(--pad-y) var(--pad-x);display:flex;flex-direction:column;justify-content:center}
.meta{display:flex;align-items:center;gap:14px;font-size:var(--fs-num);font-weight:800;
  color:rgba(255,255,255,.72);letter-spacing:.02em;margin-bottom:22px}
.meta .num{color:var(--accent-300);direction:ltr;unicode-bidi:isolate}
.meta .sep{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.35)}
.title{font-size:var(--fs-title);font-weight:900;line-height:1.02;letter-spacing:-.025em;color:var(--white)}
.sub{font-size:var(--fs-sub);font-weight:500;color:var(--brand-100);margin-top:24px;max-width:900px}
.segs{position:absolute;right:var(--pad-x);left:var(--pad-x);bottom:var(--pad-y);
  display:flex;flex-direction:row;gap:12px}
.segs i{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.16)}
.segs i.on{background:var(--accent-500)}
.hide{display:none}

body.anim .content>*{animation:riseIn .3s cubic-bezier(.22,1,.36,1) both}
body.anim .title{animation-delay:.06s}
body.anim .sub{animation-delay:.12s}
body.anim .segs i.on{animation:grow .3s ease-out .1s both}
@keyframes riseIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
</style>
</head>
<body>
  <div class="stage">
    <div class="ghost" id="ghost">01</div>
    <div class="content">
      <div class="meta">
        <span class="num" id="num">01</span><span class="sep"></span><span id="ofTxt">מתוך 5</span>
      </div>
      <div class="title" id="t">לוח שבועי</div>
      <div class="sub" id="s">בונים, משכפלים, משתפים.</div>
    </div>
    <div class="segs" id="segs"></div>
  </div>
<script>
  var q = new URLSearchParams(location.search);
  var n  = parseInt(q.get('n') || '1', 10);
  var of = parseInt(q.get('of') || '5', 10);
  var pad = function (x) { return String(x).padStart(2, '0'); };
  document.getElementById('num').textContent = pad(n);
  document.getElementById('ghost').textContent = pad(n);
  document.getElementById('ofTxt').textContent = 'מתוך ' + of;
  if (q.has('t')) document.getElementById('t').textContent = q.get('t');
  if (q.has('s')) {
    if (q.get('s')) document.getElementById('s').textContent = q.get('s');
    else document.getElementById('s').classList.add('hide');
  }
  var segs = document.getElementById('segs');
  for (var i = 1; i <= of; i++) {
    var el = document.createElement('i');
    if (i <= n) el.className = 'on';
    segs.appendChild(el);
  }
  if (q.get('anim') === '1') document.body.classList.add('anim');
</script>
</body>
</html>
```

### 5.2 אנכי — `06-beat-9x16.html` (900×1600)

דלתא: `--pad-y:220px` · כותרת 92px · מספר הרפאים 420px ונדחף ל-`top:38%` ·
הסגמנטים ל-`bottom:400px`. הקובץ המלא בתיקייה.

---

## 6. באג פינה (watermark) — `09-bug-16x9.html`

יושב לאורך כל הסרטון ב**פינה השמאלית העליונה** — כלומר בדיוק בפינה שהכתובית ב-RTL
לא נוגעת בה. הוא מה שמחזיק את המותג על המסך גם כשאין כרטיס. רקע שקוף, `omitBackground:true`.
`?corner=tr` מעביר אותו לימין-למעלה אם שוט מסוים דורש.

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>באג פינה (watermark) — 1600×900 · רקע שקוף</title>
<!--
  Corner bug: sits on screen for the whole film at ~85% opacity, top-LEFT so it never
  collides with the RTL caption block on the right. Capture with omitBackground:true.
  09-bug-16x9.html?corner=tl|tr   (default tl)
-->
<style>
@font-face{font-family:'Heebo';font-style:normal;font-weight:100 900;font-display:block;
  src:url('./fonts/heebo-hebrew.woff2') format('woff2');
  unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F;}
:root{--brand-900:#122A50;--accent-500:#F58634;--white:#FFFFFF;--pad:56px}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1600px;height:900px;overflow:hidden;background:transparent}
body{font-family:'Heebo',system-ui,Arial,sans-serif;direction:rtl;-webkit-font-smoothing:antialiased}
.bug{position:absolute;top:var(--pad);left:var(--pad);display:flex;align-items:center;gap:14px;
  background:rgba(18,42,80,.88);border:1px solid rgba(255,255,255,.16);
  padding:10px 20px 10px 10px;border-radius:999px;opacity:.92;
  filter:drop-shadow(0 12px 28px rgba(6,16,34,.35))}
.bug[data-corner="tr"]{left:auto;right:var(--pad);flex-direction:row-reverse;padding:10px 10px 10px 20px}
.bug img{width:52px;height:52px;object-fit:contain;background:#fff;border-radius:50%;padding:5px;display:block}
.bug .txt{font-size:23px;font-weight:700;color:#fff;line-height:1.15}
.bug .txt em{display:block;font-style:normal;font-size:17px;font-weight:600;color:rgba(255,255,255,.7)}
</style>
</head>
<body>
  <div class="bug" id="bug">
    <img src="./assets/club-logo.jpg" alt="עירוני קריית אונו – כדורסל דור העתיד">
    <div class="txt">קרית אונו — דור העתיד<em>מערכת שעות אימונים</em></div>
  </div>
<script>
  var c = new URLSearchParams(location.search).get('corner');
  if (c) document.getElementById('bug').dataset.corner = c;
</script>
</body>
</html>
```

---

## 7. תנועה

### כלל הברזל

ה-PNG-ים מצולמים **סטטיים במצב הסופי**. כל התנועה נעשית ב-ffmpeg. אנימציית ה-CSS
בקבצים (`body.anim`) קיימת רק כדי לאשר את התחושה בדפדפן — היא לא נכנסת לצילום.
הסיבה פשוטה: צילום מסך תופס פריים אחד; אם האנימציה תרוץ ב-CSS נקבל PNG של אמצע
המעבר. `?anim=1` = תצוגה מקדימה בלבד.

### תזמונים

| אלמנט | כניסה | החזקה | יציאה | סה"כ |
|---|---|---|---|---|
| כרטיס פתיחה | fade 0.40s + scale 1.03→1.00 | 2.20s | fade 0.35s | 2.95s |
| כרטיס ביט | fade 0.30s | 1.10s | fade 0.25s | 1.65s |
| כתובית תחתונה | wipe מימין 0.35s | לפי נוסחה ↓ | fade + 12px ימינה 0.25s | משתנה |
| באג פינה | fade 0.40s (נכנס ב-0:03) | לאורך הסרטון | fade 0.40s לפני כרטיס הסגירה | — |
| כרטיס סגירה | fade 0.50s | 4.00s (freeze בפריים האחרון) | — | 4.50s |

**נוסחת ההחזקה של כתובית:** `hold = max(1.8, chars/12 + 0.9)` שניות — קצב קריאה של
כ-12 תווים בשנייה בעברית, פלוס 0.9 שנייה לתפיסת המבט. כתובית של 60 תווים = 5.9 שניות.
בחתך האנכי (9:16) מוסיפים 15% — בנייד קוראים לאט יותר.

**קצב:** קאט או שינוי כל 4–6 שניות; לא להשאיר פריים סטטי בלי אף אירוע יותר מ-6 שניות.
כניסות מרגישות RTL: הכול נכנס **מימין**, יוצא שמאלה או דועך. ה-easing האחיד:
`cubic-bezier(.22,1,.36,1)` — יציאה מהירה, נחיתה רכה, בלי bounce.

### ffmpeg — הרכבת כתובית מעל פוטג'

```bash
# כתובית מ-t=12.0 עד t=17.9 (0.35 כניסה + 5.3 החזקה + 0.25 יציאה)
ffmpeg -i footage.mp4 -loop 1 -i lt-01.png -filter_complex "\
[1:v]format=rgba,\
 fade=in:st=0:d=0.35:alpha=1,\
 fade=out:st=5.65:d=0.25:alpha=1,\
 trim=duration=5.9,setpts=PTS-STARTPTS[lt];\
[0:v][lt]overlay=\
 x='if(lt(t-12,0.35), 40*(1-(t-12)/0.35), 0)':y=0:\
 enable='between(t,12,17.9)':eof_action=pass[v]" \
 -map "[v]" -map 0:a? -c:a copy out.mp4
```

ה-`x` הוא ה-wipe מימין: הפאנל מתחיל 40px ימינה ונוחת על 0 תוך 0.35 שנייה — התנועה
היחידה שהכתובית עושה.

### ffmpeg — כרטיס מלא (פתיחה / ביט / סגירה)

```bash
# PNG -> קליפ
ffmpeg -loop 1 -i 01-title-16x9.png -t 2.95 \
  -vf "fps=30,scale=1920:1080,format=yuv420p" title.mp4

# מעבר רך לפוטג' (offset = אורך הכרטיס פחות משך המעבר)
ffmpeg -i title.mp4 -i beat1.mp4 -filter_complex \
  "[0][1]xfade=transition=fade:duration=0.35:offset=2.60" joined.mp4
```

**באג הפינה** מורכב פעם אחת על כל הפוטג' עם `enable='between(t,3,END-5)'` ואותה
לוגיקת fade.

---

## 8. הנחיות צילום (לנועם — הרנס)

### הגדרות הקלטה

- להקליט ב-**1600×900 CSS px** ב-`deviceScaleFactor: 2` (פלט 3200×1800, מוקטן ל-1080p) —
  טקסט של טבלאות שורד ככה את הדחיסה. לאנכי: 900×1600 באותו DSF.
- **Heebo מותקן במערכת** — לוודא שהאפליקציה מרנדרת איתו בזמן ההקלטה
  (`src/index.css` מגדיר היום `-apple-system, "Segoe UI", Arial`), אחרת הפוטג' יהיה
  Arial והכרטיסים Heebo, וזה ייראה כמו שני סרטים.
- קצב עכבר: לעצור 0.6 שנייה לפני כל קליק ו-0.8 שנייה אחריו. תנועה רציפה בלי עצירות
  קוראת כמו רעש.
- כל שוט מתחיל ב**establishing** של המסך המלא (עם הכותרת הכחולה והלוגו בפריים) ורק
  אז נכנסים פנימה. ההדר הוא ההוכחה שזו מערכת אמיתית של מועדון אמיתי.

### איפה לא לשים ממשק

הכתובית תופסת את **ימין-תחתון** (עד ~1040px רוחב, ~200px גובה מעל השוליים). לפני
צילום כל שוט: לוודא שהאזור הזה ריק מתוכן שחייבים לראות. בפועל באפליקציה זה כמעט
תמיד בטוח — הפעולות למעלה והתוכן במרכז — חוץ מטבלאות ארוכות שנגללות עד למטה;
שם לגלול כך שהשורה המעניינת תהיה בשליש העליון.

### רגעי הזום — לפי ביט

| ביט | הפריים הרחב | לזום פנימה על |
|---|---|---|
| 0 · הכאב | — | (סטילס/מסך חיצוני; לא ממשק המערכת) |
| 1 · לוח שבועי | הלוח השבועי המלא, כולל ההדר | (א) כפתור **שכפול השבוע הקודם** ברגע הלחיצה · (ב) ניווט בין שבועות — התאריך שמתחלף · (ג) **התמונה שיוצאת לשיתוף** — הפריים הכי חשוב בסרטון, 2.5 שניות עליו לבד |
| 2 · משחקים והסעות | מסך "משחקים" אחרי הייבוא | (א) באנר אישור הייבוא מהאיגוד · (ב) **תג בית/חוץ** — זום צמוד, זה ה-wow הקטן · (ג) שורת ההסעה עם נקודת האיסוף ושעת היציאה |
| 3 · תצוגת מאמן | מסך "תצוגת מאמן" | (א) תוכנית האימון · (ב) **סקיצת המגרש עם הסימונים** — זום איטי פנימה תוך כדי ציור · (ג) הערה אחרי משחק |
| 4 · ניהול | מסך "שחקנים" ← "זמינות מאמנים" ← "דו"ח שעות" | **סך השעות החודשי** בדו"ח — המספר הסופי, זום צמוד |
| 5 · סגירה | חזרה למסך הבית (האריחים) | — |

**איך מבצעים את הזום:** `zoompan`/`scale+crop` על הפוטג', 1.00→1.35 לאורך 0.8 שנייה עם easing,
החזקה 1.5–2 שניות, חזרה 0.6 שנייה. **לא לזום בזמן שכתובית נכנסת** — שתי תנועות
בו-זמנית קוראות כמו תקלה. סדר נכון: זום → נחיתה → כתובית נכנסת.

### שני דגלים לפני ההקלטה

1. **קטינים.** מסך "שחקנים" ו"דו"ח שעות" מחזיקים שמות, טלפונים ותאריכי לידה. אף
   פריים לא יוצא בלי שכל הרשומות בדויות — כולל שמות מאמנים ושמות קבוצות. הפס
   "כל הנתונים בסרטון בדויים" (`disc=1`) חייב להיות על המסך בכל שוט שמראה רשומות אישיות.
2. **מצב הדפסה.** מסך הדו"ח מוגדר `no-print` על ה-chrome — בהקלטה רגילה זה לא משנה,
   אבל אם מצלמים תצוגת הדפסה ההדר ייעלם ואיתו המיתוג. לשוט הזה עדיף להישאר בתצוגה הרגילה.

---

## 9. מה עוד צריך לקרות

- **שירה** — הטקסטים בכרטיסים הם placeholder מהמסר בבריף. ברגע שיש קופי: מזינים
  אותו דרך ה-query string (כתוביות וביטים) ומחליפים ידנית ב-`01/02/07/08` בלבד.
  אורך מקסימלי מומלץ: כותרת פתיחה עד 34 תווים לשורה, כתובית עד 60 תווים, כותרת ביט
  עד 18 תווים.
- **עדי (שער חוסם)** — שלושה דברים לסקירה: (א) הצגת המותג "קרית אונו — דור העתיד"
  בסרטון מכירה — האם נדרש אישור בכתב מהעמותה; (ב) שורת ההצהרה בכרטיס הסגירה — האם
  הניסוח מספיק; (ג) רישוי: Heebo תחת SIL OFL 1.1 (מותר), הלוגו בבעלות העמותה, אין
  שום נכס סטוק בסרטון — כל האלמנטים הגרפיים הם CSS.
- **נועם** — `render.mjs` מוכן ובדוק; להתחבר אליו מצנרת ההרכבה ולהוסיף לולאת כתוביות.
