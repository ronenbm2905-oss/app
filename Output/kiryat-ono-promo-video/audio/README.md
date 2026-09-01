# קריינות

שים כאן קובץ אודיו בשם החתך, והרכבה תמסכן אותו אוטומטית:

| קובץ | נכנס לסרטון |
|---|---|
| `audio/demo.m4a` | `final/kiryat-ono-16x9-demo.mp4` |
| `audio/short.m4a` | `final/kiryat-ono-16x9-90s.mp4` |
| `audio/vertical.m4a` | `final/kiryat-ono-9x16-45s.mp4` |

סיומות נתמכות: `m4a`, `mp3`, `wav`, `aac`, `ogg`.

אין קובץ → הסרטון יוצא שקט. יש קובץ → הוא ממוסכן ב-AAC 160k.

```bash
node build/assemble.mjs          # שלושת החתכים
node build/assemble.mjs short    # חתך אחד
```

**אין צורך להקליט מחדש את המסך.** התסריט המתוזמן לכל חתך נמצא ב-
`work/narration-<חתך>.md`, ונוצר מהתזמונים שנבנו בפועל (`node build/narration.mjs`).
