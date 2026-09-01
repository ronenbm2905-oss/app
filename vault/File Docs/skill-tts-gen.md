# skill-tts-gen

**קובץ:** `.claude/skills/tts-gen/SKILL.md` (+ `test-hebrew.sh`)
**משויך ל:** טל (קריינות למודעה), ליאור (מצגת מוקלטת). שירה כותבת את התסריט.

מעטפת ל-OpenAI Speech API (`POST /v1/audio/speech`, מודל **`gpt-4o-mini-tts`** —
קבוע). מקבל טקסט עברי ונתיב פלט, מחזיר `OUT.mp3` + `OUT.txt` עם התסריט.
מפצל אוטומטית טקסט מעל **4096 תווים** על גבול משפט (עם fallback לגבול מילה),
ומאחד ב-`cat`. מאמת חתימת MP3. דורש `OPENAI_API_KEY` ב-`.env`.

**המודל נבחר כי הוא היחיד שתומך ב-`instructions`** — הלֶבֶר על ההגייה בעברית.

**שתי מגבלות שחייבים להכיר:**
- **`api.openai.com` חסום בסשני ענן** — הסקיל רץ רק במחשב המקומי. חל גם על
  [[skill-gpt-image-gen]] (אותו host).
- **איכות העברית טרם אושרה.** יש להריץ פעם אחת `test-hebrew.sh` ולהאזין.

**לא להתבלבל:** זה מייצר **קובץ**. להקראה חיה *בתוך* אפליקציה יש
`useSpeech.js` (Web Speech API) — ראה [[haderech-lamilim-app]].

**קבצים קשורים:** [[agent-tal]], [[skill-gpt-image-gen]], [[tts-narration-skill]]
