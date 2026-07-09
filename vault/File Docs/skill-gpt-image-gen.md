# skill-gpt-image-gen

**קובץ:** `.claude/skills/gpt-image-gen/SKILL.md`
**משויך ל:** איתי (המעצב).

מעטפת ליצירת תמונה מ-prompt דרך OpenAI Images API (מודל **`gpt-image-2`** —
קבוע, אין לשנות). מקבל prompt ונתיב פלט, שולח בקשה, ושומר PNG + קובץ `.txt` עם
ה-prompt. הסקריפט self-contained (מזהה jq/Python לבד) ומאמת חתימת PNG. דורש
`OPENAI_API_KEY` ב-`.env`. הותאם לפרויקט: נתיב הדוגמה `itai/Outputs/`.

**קבצים קשורים:** [[agent-itai]], [[config-env-example]]
