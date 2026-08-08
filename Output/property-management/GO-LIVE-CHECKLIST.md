# צ'קליסט עלייה לאוויר — אפליקציית ניהול נכסים

> סטטוס שער עדי: **🟠 אושר עם תיקונים חובה** (2026-08-06). מותר: דמו מקומי בלי נתונים אמיתיים.
> חסום: deploy ועלייה עם נתוני דיירים אמיתיים — עד שכל סעיפי 🔴 ו-⚖️ למטה יסומנו.

---

## ✅ מוכן (בנייה + קוד) — אין מה לעשות

- [x] פרוסה 1 — מודל נתונים מלא + מסכי בעלים (לובי, דף נכס, דשבורדים, תקלות)
- [x] פרוסה 2 — 3 תפקידים (בעלים/דייר/תחזוקה) עם בידוד מאומת ב-firestore/storage rules
- [x] פרוסה 3 — סריקת מסמכים ב-AI (Cloud Function) + מנוע תזכורות
- [x] חסימת סריקת AI לצילום ת.ז. (B-AI-2)
- [x] מחיקת דייר עם כל נתוניו — זכות מחיקה (B-RET)
- [x] דף מדיניות פרטיות + הודעת דייר (טיוטה, מקושר בכניסה ובפורטל)
- [x] יידוע דייר על עיבוד ה-AI
- [x] `npm run build` נקי · smoke 131/131

---

## 🔴 הפעולות שלך (עסקי — לפני deploy)

### 1. חשבון + DPA מול Anthropic
- [ ] לוודא שחשבון ה-API שלך ב-Anthropic הוא **חשבון מסחרי** (Console → Billing/Plan). ה-DPA מוטמע אוטומטית בתנאים המסחריים.
- [ ] (אופציונלי) להוריד עותק DPA להראות לעו"ד — דרך עמוד ה-Help של Anthropic.

### 2. ZDR (Zero Data Retention) — פנייה ל-Sales
- [ ] לשלוח לצוות המכירות של Anthropic בקשת ZDR למסלול סריקת המסמכים (טיוטה מוכנה — ראה `ZDR-request-draft` למטה). https://www.anthropic.com/contact-sales
- [ ] אחרי אישור — לאמת ב-Console: **Settings → Privacy Controls → Data retention period**.

### 3. DPA מול Google/Firebase
- [ ] לאשר את ה-Data Processing Addendum של Google Cloud דרך ה-Console.
- [x] region `me-west1` (ישראל) — כבר מוגדר.

---

## ⚖️ הפעולות של עו"ד רשומה (פרטיות/רגולציית טכנולוגיה)

- [ ] נוסח סופי של **מדיניות הפרטיות** (יש טיוטת שלד ב-`adi/Outputs/2026-08-06-...`).
- [ ] נוסח סופי של **הודעת הדייר**.
- [ ] קביעת **הבסיס החוקי** לעיבוד — כולל סריקת ה-AI ספציפית.
- [ ] אישור שחתימת ה-DPA מקיימת את **החריג בתקנות תשס"א-2001** (העברה חוצת-גבולות).
- [ ] בירור **חובת/פטור נגישות** (ת"י 5568) לפי מחזור/היקף.

---

## 🔧 נדחה לפרוסה הבאה (לא חוסם עכשיו)

- [ ] מנגנון הזמנת דייר/איש-תחזוקה לענן (email → uid) — הפורטלים בענן תלויים בזה.
- [ ] הרחבת מחיקת דייר גם לקבצי **Storage** (כשהעלאת קבצים נפתחת — אחרת יתומי PII).
- [ ] בדיקת ה-rules מול **Firebase emulator** לפני deploy.
- [ ] נוהל אירוע אבטחה + מימוש זכויות נושא מידע (O-BREACH / O-RIGHTS).

---

## 🚀 deploy (רק אחרי שכל 🔴 ו-⚖️ סומנו)

> `firebase deploy` חסום ל-Claude — **אתה מריץ ידנית.** הוראות מלאות ב-`functions/README.md`.

- [ ] `npm run build`
- [ ] הגדרת secret `ANTHROPIC_API_KEY` ב-Firebase Functions
- [ ] `firebase deploy` (hosting + firestore/storage rules + functions)

---

## נספח — טיוטת בקשת ZDR ל-Anthropic Sales

```
Subject: Zero Data Retention (ZDR) request — [שם החברה]

Hi, we're building a property-management application on the Claude API.
Our use case sends tenant documents for field-extraction, which involves
third-party personal data. To meet our privacy obligations, we'd like to
enable Zero Data Retention on our organization's API workload.
Could you advise on eligibility and next steps?
Organization ID: [להשלים]. Thanks.
```
