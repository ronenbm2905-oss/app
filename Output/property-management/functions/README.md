# Cloud Functions — חילוץ מסמכים ב-Claude

פונקציית `extractDocument` (onCall, region `me-west1`) מקבלת מסמך (PDF/תמונה כ-base64),
שולחת ל-Claude עם **structured output**, ומחזירה שדות מובנים: `docType, amount, date,
dueDate, periodStart, periodEnd, address, name, supplier, accountNumber, propertyNumber, meterNumber`.

## עקרון אבטחה
- **המפתח `ANTHROPIC_API_KEY` הוא secret בצד השרת בלבד** — לעולם לא בקליינט/בקוד/ב-git.
- הקליינט (Vite) קורא לפונקציה דרך `httpsCallable`; הוא לא מכיר את המפתח.

## מפרט הקריאה ל-Claude (ראה `config.js` + `index.js`)
- SDK: `@anthropic-ai/sdk` (בפונקציה בלבד).
- מודל: `claude-opus-5` (קבוע ב-`config.js`, ניתן להחלפה).
- structured output: `output_config.format = { type: "json_schema", schema }` — JSON מובטח.
- קלט: PDF כ-block `document` (base64) לפני ה-`text`; תמונה כ-block `image`.
- `thinking: { type: "adaptive" }` + `output_config.effort: "low"` + `max_tokens: 4096`. **בלי** `temperature`/`budget_tokens` (נדחים ב-opus-5; `thinking:{type:"enabled"}` מחזיר 400).
- בדיקת `stop_reason === "refusal"` לפני קריאת התוכן.

## הקמה + deploy (המשתמש מריץ — לא Claude)
```bash
cd functions && npm install
# הגדרת ה-secret (פעם אחת):
firebase functions:secrets:set ANTHROPIC_API_KEY
# deploy:
firebase deploy --only functions
```

> **חסום עד שער עדי (פרטיות):** ה-deploy של הפונקציה מפעיל שליחת PII של דיירים למעבד
> חיצוני (Anthropic). אין להריץ `firebase deploy --only functions` לפני אישור שער
> הפרטיות של עדי (בסיס חוקי, יידוע דייר, DPA מול Anthropic). `firebase deploy` ממילא
> חסום ל-Claude. עד אז — האפליקציה משתמשת ב-**mock extractor** במצב מקומי.
