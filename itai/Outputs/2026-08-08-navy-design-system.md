# מפרט Design System — אפליקציית ניהול נכסים (סגנון navy תאגידי) (אפליקציית ניהול נכסים)
**מקור-אמת ל-tokens:** design-handoff חיצוני — פלטה pixel-sampled מאתר תאגידי ייחוס (סגנון בלבד, ללא זיקה למותג כלשהו)
**תשתית יעד:** `Output/property-management/` — אפליקציית Vite + React, RTL, עתירת-נתונים
**כיוון עיצובי:** תאגידי, שקט ואמין — navy עמוק כעוגן ניגודיות, brand-blue כמבטא נקודתי בלבד, גוף UI בהיר-קריר עם גיאומטריה חדה (radius קטן) וצל יחיד.
**סטטוס:** מפרט בלבד — היישום ע"י דורית (אין עריכת קוד מצד המעצב).

---

## 1. החלטת התאמה marketing → app

אתר הייחוס בנוי על **ניגודיות דרמטית**: משטחי navy מלאים (header/hero/footer/טופס),
כותרות 54px, מספרים ענקיים ב-Heebo 300. אפליקציה תפעולית לא יכולה להיות "כהה ודרמטית" —
מסך מלא navy מעייף בעבודה יומיומית מול טבלאות וטפסים. לכן ההמרה עובדת לפי **חלוקת תפקידים**:

| שכבה | באתר התדמית | באפליקציה |
|---|---|---|
| **Navy `#002C49`** | header, hero, footer, טופס כהה | **רק כרומה עוגנת:** TopBar/ניווט, כותרות (`h1..h4`), טקסט חזק, מילוי כפתור primary. |
| **Brand-blue `#0081E8`** | לוגו, eyebrows, מספרי סטט, CTA-on-dark | **מבטא נקודתי:** מספרי KPI בדשבורד (Heebo 300 — signature), אינדיקטור טאב פעיל, focus-ring, קישורים, CTA על רקע navy. **לא** למילוי כפתורים בהירים. |
| **גוף המסך** | לבן / F2F6F9 מתחלף | **UI בהיר-קריר וקבוע:** canvas `#F2F6F9`, כרטיסים `#FFFFFF`, wells/chips `#E4EBF1`, hairline `#D8E1E8`. שקט. |

**עיקרון:** ה-navy נותן היררכיה וזהות בלי להשתלט; ה-blue מופיע במשורה כדי שכשהוא מופיע (מספר, טאב פעיל, focus) — העין הולכת אליו. זו בדיוק אווירת "corporate & quiet" שה-README מבקש ("Keep it restrained… no shadow bloom").

---

## 2. טוקני צבע (Design Tokens)

### 2.1 טוקני הבסיס (מהמקור — as-is)
| טוקן סמנטי (Tailwind) | Hex | שימוש |
|---|---|---|
| `navy` (DEFAULT) | `#002C49` | TopBar, כותרות, טקסט חזק, מילוי כפתור primary |
| `navy-deep` | `#001E33` | פוטר / אזור כהה עמוק יותר |
| `navy-surface` | `#013D63` | מילוי inputs בגרסת-טופס-כהה בלבד |
| `navy-border` | `#0B4E7A` | קו תחתון של input כהה, קווי הפרדה על navy |
| `navy-rule` | `#073E60` | קו מפריד בפוטר |
| `accent` (DEFAULT) | `#0081E8` | brand-blue: מספרי KPI, טאב פעיל, focus, קישורים, CTA-on-navy |
| `accent-light` | `#00A0F0` | hover של קישור/nav על רקע כהה |
| `link` | `#005FA8` | קישורים inline + hover של primary על רקע בהיר |
| `ink-body` | `#3F5566` | טקסט גוף על בהיר |
| `ink-muted` | `#6B7C8B` | captions, meta, labels משניים |
| `ink-faint` | `#9AA7B2` | annotation, disabled (**לא** לטקסט גוף — ראו a11y) |
| `onnavy` (DEFAULT) | `#FFFFFF` | טקסט על navy |
| `onnavy-muted` | `#8FA3B4` | טקסט משני על navy (≥14px) |
| `onnavy-faint` | `#7C93A6` | טקסט שלישוני על navy |
| `surface` (DEFAULT) | `#FFFFFF` | כרטיסים, מודאלים, שורות טבלה |
| `surface-alt` | `#F2F6F9` | canvas האפליקציה, thead, hover-row |
| `surface-sunk` | `#E4EBF1` | wells, chips, hover של ניווט בהיר |
| `border` (DEFAULT) | `#D8E1E8` | גבול כרטיס, hairline dividers |

### 2.2 טוקנים סמנטיים חדשים — **הוספתי** (חסרים ב-README במפורש)
ה-README מציין: *"No semantic colors were sampled. The palette needs a red and a green added for form states."* הוספתי ארבע משפחות + focus, בגוונים קרירים שמתלכדים עם הפלטה. כל אחת: `fill` (רקע-תג בהיר) + `text` (טקסט כהה, AA על ה-fill) + `solid` (מילוי מלא / גבול error).

| טוקן | fill | text | solid | שימוש | ניגודיות text/fill |
|---|---|---|---|---|---|
| `success` | `#E4F4EA` | `#15683F` | `#1E7A48` | שולם / פעיל / תקין; Pill ירוק לשעבר | ~7.3:1 ✓ |
| `danger` | `#FCE9E7` | `#B42318` | `#C0362A` | חוב / שגיאת טופס / מחיקה; Pill אדום לשעבר | ~6.1:1 ✓ |
| `warning` | `#FBEFD9` | `#8A5A06` | `#B9791A` | מתקרב לפקיעה / ממתין; Pill amber לשעבר | ~6.0:1 ✓ |
| `info` | `#E6F1FB` | `#005FA8` | `#0081E8` | הודעה / תג ניטרלי-כחול; Pill כחול לשעבר | ~5.4:1 ✓ |
| `focus-ring` | — | — | `rgba(0,129,232,.35)` | טבעת focus גלויה (מבוסס brand-blue) | — |

> **מיפוי Pill קיים → סמנטי:** `green→success` · `red→danger` · `amber→warning` · `blue→info` · `slate→neutral (surface-sunk + ink-body)`.

---

## 3. טיפוגרפיה — סקאלת אפליקציה (לא הסקאלה השיווקית)

הסקאלה השיווקית (H1 54px, סטט 56–72px) גדולה מדי לצפיפות-נתונים. הגדרתי סקאלה תפעולית שמכבדת
את שני העקרונות של המותג: **Assistant לכותרות+גוף, Heebo ל-labels/eyebrows/מספרים**, ואת ה-signature
של **מספרים ב-Heebo 300 קליל מול כותרות 700 כבדות**.

**Google Fonts import** (שורה ל-`index.css`):
```
@import url('https://fonts.googleapis.com/css2?family=Assistant:wght@200..800&family=Heebo:wght@300..800&display=swap');
```

| תפקיד | Font | Weight | Size / LH | Tracking | צבע | הערה |
|---|---|---|---|---|---|---|
| כותרת-מסך (H1) | Assistant | 700 | 24px / 1.25 | -0.01em | `navy` | כותרת דף/מסך |
| כותרת-סקשן (H2) | Assistant | 700 | 19px / 1.3 | -0.01em | `navy` | |
| כותרת-כרטיס (H3) | Assistant | 600 | 16px / 1.4 | 0 | `navy` | |
| גוף (body) | Assistant | 400 | 15px / 1.6 | 0 | `ink-body` | טקסט קריאה |
| UI ברירת-מחדל | Assistant | 400/500 | 14px / 1.5 | 0 | `ink-body` | כפתורים, ניווט, תאי טבלה |
| label / eyebrow-רך | Heebo | 600 | 13px / 1.4 | 0 | `ink-body` | תוויות טופס |
| eyebrow / כותרת-קבוצה | Heebo | 700 | 12px / 1 | **0.14em** | `accent` | כותרות-על, group labels |
| caption / meta | Heebo | 400 | 12px / 1.5 | 0 | `ink-muted` | חותמות זמן, meta |
| **מספר KPI (stat)** | **Heebo** | **300** | **34px / 1** | -0.02em | `accent` | signature — **אל תבליט (bold)** |
| מספר KPI גדול | Heebo | 300 | 44px / 1 | -0.02em | `accent` | דשבורד ראשי |
| badge / pill | Heebo | 600 | 12px / 1 | 0 | לפי tone | |

כללים: `text-wrap: pretty` על כל כותרת ופסקה · מספרים ומחרוזות לטיניות בתוך עברית מקבלים
`direction:ltr` + Heebo + `tabular-nums` (מחלקת עזר `.num`) · גוף פרוזה ברוחב-מקס ~640px.

---

## 4. Radius · Border · Shadow · Spacing

**Radius — החלטה:** המותג הוא 2px כפתורים / 0 כרטיסים. אפס-radius בכרטיסים מרגיש חד מדי ב-UI צפוף
ודורש churn. **הפשרה:** מהדקים את כל הסקאלה לגיאומטריה קריספית של המותג, אבל משאירים ריכוך זעיר לכרטיסים.
- כפתורים / inputs / chips / status-pills → **2px** (`rounded-sm`)
- כרטיסים / פאנלים / טבלה-wrapper → **4px** (`rounded-lg` לאחר המיפוי)
- מודאל → **6px** (`rounded-2xl` לאחר המיפוי)
- אווטרים / לוגו-mark → **50%** (`rounded-full`)

**Border:** hairline יחיד `1px solid #D8E1E8` (`border-border`). זהו גם ה-`borderColor` הדיפולטי — `border` חשוף כבר נותן את הגוון הנכון.

**Shadow — יחיד:** `0 24px 80px rgba(0,44,73,.12)` (`shadow-brand`) — **רק** למיכלים מוגבהים (מודאל, dropdown). **כרטיסים ללא צל** — גבול בלבד. פלוס טבעת focus `shadow-focus` = `0 0 0 3px rgba(0,129,232,.35)`.

**Spacing:** סקאלת Tailwind הדיפולטית (4/8/12/16/20/24/32/40/48/64) כבר תואמת את סקאלת המותג — אין שינוי. gutter פנימי לכרטיס 20px (`p-5`), gap גריד 16–20px.

---

## 5. מתכוני רכיבים (Tailwind — מוכן להדבקה)

> כל המתכונים RTL-safe: משתמשים ב-utilities לוגיים (`ps-/pe-`, `ms-/me-`, `text-start/end`, `border-s/e`, `start-/end-`) בכל מקום דירקציונלי. `px/py` סימטריים — בטוחים.

### Button (`src/components/ui/Button.jsx`)
```
base:      inline-flex items-center justify-center gap-1.5 rounded-sm px-4 py-2
           text-sm font-semibold font-sans transition disabled:opacity-50
           focus-visible:shadow-focus focus-visible:outline-none
primary:   bg-navy text-white hover:bg-link
secondary: border border-navy text-navy bg-transparent hover:bg-navy hover:text-white   (outline; מתהפך ב-hover)
danger:    bg-danger-fill text-danger-text hover:brightness-95
ghost:     text-ink-body hover:bg-surface-sunk
onNavy:    bg-accent text-navy hover:bg-accent-light                                     (CTA על TopBar/אזור כהה)
```

### Pill / Badge (tones סמנטיים)
```
base:    inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold font-ui
success: bg-success-fill text-success-text
danger:  bg-danger-fill  text-danger-text
warning: bg-warning-fill text-warning-text
info:    bg-info-fill    text-info-text
neutral: bg-surface-sunk text-ink-body
```

### Field / Input / Select / Textarea (`src/components/ui/Field.jsx`)
בחירה: **גבול מלא** (לא border-bottom) — טופס אפליקציה צריך affordance ברור על רקע בהיר.
ה-underline-on-navy נשמר רק לגרסת-טופס-כהה (ראו למטה).
```
label:    text-[13px] font-semibold font-ui text-ink-body   ( *חובה: <span class="text-danger-text"> )
input:    w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-navy
          outline-none focus:border-accent focus-visible:shadow-focus
          placeholder:text-ink-faint disabled:bg-surface-alt disabled:text-ink-muted
error:    border-danger-solid   + helper: text-danger-text text-xs mt-1
select:   (כמו input) + bg-white
checkbox: h-4 w-4 rounded-sm border-border text-navy focus-visible:shadow-focus
textarea: (כמו input) min-h-[88px]
hint:     text-xs text-ink-muted
```
**גרסת-טופס-כהה (on-navy — אופציונלי, לפורטל/hero-strip):** `bg-navy-surface border-0 border-b border-navy-border text-white`, label `text-onnavy-muted`.

### Card (`Card`)
```
card:      bg-white border border-border rounded-lg p-5            (ללא צל)
stat-card: bg-white border border-border border-t-[3px] border-t-accent rounded-lg p-5
stat-num:  font-ui font-light text-[34px] leading-none tracking-tight text-accent num
stat-title:font-sans font-semibold text-base text-navy
```

### Table (`.table-scroll` wrapper)
```
wrapper: table-scroll rounded-lg border border-border
table:   w-full text-sm
thead th:bg-surface-alt text-ink-muted font-ui font-semibold text-xs tracking-wide
         px-3 py-2 border-b border-border text-start
tbody td:px-3 py-2 border-b border-border text-navy text-start
row:     hover:bg-surface-alt
total:   font-semibold text-navy bg-surface-alt   (שורת סיכום)
```

### TopBar / Nav (`src/components/TopBar.jsx`) — navy
```
header:  sticky top-0 z-40 bg-navy text-white
inner:   mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2
logo:    flex items-center gap-1.5 text-white font-bold          ( icon-mark ב-accent )
nav-btn base:  inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-sm font-medium transition
  active:      bg-white/10 text-white
  idle:        text-onnavy-muted hover:text-white hover:bg-white/10
lang/logout:   text-onnavy-muted hover:text-white
```

### Tabs
```
container: flex gap-1 border-b border-border
tab base:  px-3 py-2 text-sm font-medium -mb-px border-b-2 transition
  active:  border-b-accent text-navy
  idle:    border-b-transparent text-ink-muted hover:text-navy
```

### Modal (`src/components/ui/Modal.jsx`)
```
overlay: fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-deep/50 p-4
dialog:  my-8 w-full max-w-xl rounded-2xl bg-white shadow-brand    ( wide → max-w-3xl )
header:  flex items-center justify-between border-b border-border px-5 py-3
title:   text-lg font-semibold text-navy
close:   rounded-sm p-1 text-ink-muted hover:bg-surface-sunk
body:    max-h-[70vh] overflow-y-auto px-5 py-4
footer:  flex justify-end gap-2 border-t border-border px-5 py-3
```

---

## 6. אסטרטגיית הפצה — churn מינימלי

**מהלך A (חובה, אפס-churn): מיפוי מחדש של סקאלת `brand` הקיימת.** כל 40 המופעים של `*-brand-*`
משנים מראה מיידית בלי לגעת בקובץ, כי הסקאלה ממופה מחדש ל-navy/blue:

| step | ערך חדש | תפקיד | מאמת מול שימוש קיים |
|---|---|---|---|
| `brand-50` | `#EAF3FC` | tint פעיל / info-bg | `bg-brand-50` (5×) ✓ |
| `brand-100` | `#CFE7FB` | focus ring | `ring-brand-100` (3×) ✓ |
| `brand-500` | `#0081E8` | focus border / accent | `border-brand-500` (4×), `ring-brand-500` ✓ |
| `brand-600` | `#002C49` | **navy** — מילוי primary, אייקונים, טקסט חזק | `bg-brand-600`, `text-brand-600` (10×) ✓ |
| `brand-700` | `#005FA8` | link / hover | `hover:bg-brand-700`, `text-brand-700` (7×) ✓ |

תוצאה: כפתור primary (`bg-brand-600 hover:bg-brand-700`) הופך אוטומטית ל-navy→#005FA8 — **בדיוק** מתכון ה-primary של המותג. focus של inputs (`border-brand-500 ring-brand-100`) הופך ל-brand-blue. בלי לגעת ב-Button.jsx/Field.jsx.

**מהלך B (מומלץ): הוספת המשפחות הסמנטיות** (`navy/accent/link/ink/onnavy/surface/border/success/danger/warning/info`) ל-theme — קוד חדש משתמש בשמות ברורים; קוד ישן ממשיך לעבוד דרך מהלך A.

**מהלך C (אופציונלי, find/replace גלובלי — עקביות, לא חובה):**
| Find | Replace | מופעים | הערה |
|---|---|---|---|
| `text-slate-800` | `text-navy` | 26 | כותרות/טקסט חזק |
| `text-slate-700` | `text-ink-body` | 39 | |
| `text-slate-600` | `text-ink-body` | 28 | |
| `text-slate-500` | `text-ink-muted` | 51 | ⚠️ ודא ≥13px על לבן (a11y) |
| `text-slate-400` | `text-ink-faint` | 18 | ⚠️ decorative/disabled בלבד |
| `bg-slate-100` | `bg-surface-sunk` | 16 | chips/hover |
| `bg-slate-50` | `bg-surface-alt` | 6 | |
| `border-slate-200` | `border-border` | — | dividers |
| `bg-slate-200` | `bg-border` | 2 | |

**להשאיר כמו שהוא:** סקאלת spacing, `rounded-full` לאווטרים, `px/py` סימטריים, מבנה הזרימה (RTL כבר עובד).
**מה כן להחליף ידנית (רכיבי-מפתח):** Button/Pill/Field/Modal/TopBar/Tabs לפי המתכונים בסעיף 5 — 6 קבצים בלבד נותנים ~90% מהאפקט הוויזואלי.

---

## 7. בלוק Tailwind theme + index.css (מדביק כמעט as-is)

### `tailwind.config.js`
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // --- מהלך A: סקאלת brand הקיימת ממופה מחדש (אפס-churn) ---
        brand: { 50:"#EAF3FC", 100:"#CFE7FB", 500:"#0081E8", 600:"#002C49", 700:"#005FA8" },
        // --- מהלך B: משפחות סמנטיות ---
        navy:    { DEFAULT:"#002C49", deep:"#001E33", surface:"#013D63", border:"#0B4E7A", rule:"#073E60" },
        accent:  { DEFAULT:"#0081E8", light:"#00A0F0" },
        link:    "#005FA8",
        ink:     { body:"#3F5566", muted:"#6B7C8B", faint:"#9AA7B2" },
        onnavy:  { DEFAULT:"#FFFFFF", muted:"#8FA3B4", faint:"#7C93A6" },
        surface: { DEFAULT:"#FFFFFF", alt:"#F2F6F9", sunk:"#E4EBF1" },
        border:  { DEFAULT:"#D8E1E8" },
        success: { fill:"#E4F4EA", text:"#15683F", solid:"#1E7A48" },
        danger:  { fill:"#FCE9E7", text:"#B42318", solid:"#C0362A" },
        warning: { fill:"#FBEFD9", text:"#8A5A06", solid:"#B9791A" },
        info:    { fill:"#E6F1FB", text:"#005FA8", solid:"#0081E8" },
      },
      borderColor: { DEFAULT: "#D8E1E8" },   // `border` חשוף = hairline המותג
      fontFamily: {
        sans: ["Assistant","system-ui","-apple-system","Segoe UI","sans-serif"],
        ui:   ["Heebo","Assistant","system-ui","sans-serif"],
      },
      borderRadius: {
        none:"0", sm:"2px", DEFAULT:"2px", md:"3px",
        lg:"4px", xl:"5px", "2xl":"6px", "3xl":"8px", full:"9999px",
      },
      boxShadow: {
        brand: "0 24px 80px rgba(0,44,73,.12)",
        focus: "0 0 0 3px rgba(0,129,232,.35)",
      },
      fontSize: {
        stat:    ["34px", { lineHeight:"1", letterSpacing:"-0.02em" }],
        "stat-lg":["44px",{ lineHeight:"1", letterSpacing:"-0.02em" }],
        eyebrow: ["12px", { lineHeight:"1", letterSpacing:"0.14em" }],
      },
    },
  },
  plugins: [],
};
```

### `src/index.css`
```css
@import url('https://fonts.googleapis.com/css2?family=Assistant:wght@200..800&family=Heebo:wght@300..800&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light;
  --focus-ring: 0 0 0 3px rgba(0,129,232,.35);
  --shadow-elevated: 0 24px 80px rgba(0,44,73,.12);
}

body {
  margin: 0;
  font-family: "Assistant", system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 16px;
  background: #F2F6F9;   /* surface-alt = canvas האפליקציה */
  color: #3F5566;        /* ink-body */
}

h1, h2, h3, h4 { color: #002C49; text-wrap: pretty; }   /* navy + pretty wrapping */
p { text-wrap: pretty; }

/* focus גלוי אחיד (brand-blue) — a11y */
:where(a, button, input, select, textarea):focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: 2px;
}

/* מספרים/מחרוזות לטיניות בתוך עברית: Heebo + LTR + ספרות מיושרות */
.num {
  font-family: "Heebo", sans-serif;
  direction: ltr;
  font-variant-numeric: tabular-nums;
  font-weight: 300;   /* signature: מספר קליל */
}

/* טבלאות שגולשות במובייל */
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
```

---

## 8. RTL — הערות
- הדוקומנט כבר `dir="rtl"` (index.html) — הזרימה עובדת.
- מתכונים דירקציונליים משתמשים ב-**logical properties** (`ps-/pe-`, `ms-/me-`, `text-start/end`, `border-s/e`, `start-/end-`) — כך שגרסת EN עתידית היא היפוך `dir` בלי override.
- אייקוני חיצים (קישורי "קראו עוד ←") מתהפכים ב-`rtl:scale-x-[-1]` — לא לקודד את הגליף.
- **לא מתהפכים:** לוגו, מספרים/KPI, גרפים, מחרוזות לטיניות (`FM`, `EN`) — נשארות LTR (`.num`).

## 9. נגישות (שער עדי — ת"י 5568 / WCAG 2.0 AA)
- **ניגודיות טקסט קטן (≥4.5:1):** `ink-muted #6B7C8B` — **רק** על `#FFFFFF` ובגודל ≥13px; על `surface-alt/sunk` יש לעלות ל-`ink-body #3F5566`. `ink-faint #9AA7B2` — **decorative/disabled בלבד**, אף פעם לא טקסט גוף. `onnavy-muted #8FA3B4` — תקין על navy בגודל **≥14px** (גבולי ב-13px — ה-README סימן; להעדיף ≥14px).
- גודל בסיס 16px; גוף מינימום 15px; 12px רק ל-pills/eyebrows (bold, ניגודיות גבוהה).
- **focus states גלויים** — טבעת `shadow-focus` אחידה על כל האינטראקטיביים (מוגדר ב-index.css).
- `alt` לכל תמונה; hit-targets ≥44px במובייל.

## 10. פריטי המשך (open items)
- **לוגו SVG אמיתי לא סופק** — TopBar משתמש כרגע ב-icon-mark. פלייסהולדר: עיגול `accent` 34px + הטקסט של שם המוצר. להחליף כשיסופק לוגו SVG (גרסה בהירה+כהה). **קניין רוחני → שער עדי.**
- **אישור פונט** — Assistant/Heebo הם התאמה ויזואלית, לא מאומתת מול ה-CSS של האתר. הסקאלה תקפה בכל מקרה; להחליף משפחה אם הלקוח מאשר פונט מורשה אחר.
- **מיתוג:** שם המוצר והקופי באפליקציה **לא שונו** — זה design-system בלבד.
</content>
</invoke>
