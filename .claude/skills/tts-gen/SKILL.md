---
name: tts-gen
description: >-
  מעטפת ליצירת קריינות מטקסט דרך OpenAI Speech API (מודל gpt-4o-mini-tts).
  שולח טקסט, מקבל אודיו בינארי, ושומר כקובץ MP3 לצד תסריט .txt.
  מטפל בפיצול טקסט ארוך מעל מגבלת 4096 התווים. משמש את טל (קריינות למודעה)
  ואת ליאור (קריינות למצגת). הפעל כשצריך קובץ אודיו — קריינות, ווייס-אובר,
  הקראה לסרטון. להקראה *בתוך* אפליקציה משתמשים ב-Web Speech API, לא בזה.
---

# tts-gen — קריינות דרך OpenAI Speech API

סקיל זה עוטף את הקריאה ל-OpenAI Speech API. תפקידו: לקבל טקסט ונתיב פלט,
לשלוח את הבקשה, ולשמור את הקריינות כקובץ MP3.

## לפני הכול — שער האיכות (חובה, פעם אחת)

**עברית נמצאת ברשימת השפות הנתמכות של OpenAI, אבל הקולות מכוונים לאנגלית.**
לפני שהצוות מסתמך על הסקיל, יש להריץ פעם אחת:

```bash
bash .claude/skills/tts-gen/test-hebrew.sh
```

הוא מייצר את אותו משפט ב-3 קולות ל-`tal/Outputs/tts-test/`. **מאזינים ומכריעים.**
אם אף קול לא נשמע כמו עברית סבירה — הסקיל לא שמיש, והחלופה היא ElevenLabs
(תמיכה מוצהרת בעברית, אבל חשבון ומפתח נפרדים).

## מודל — חשוב מאוד

המודל הוא **`gpt-4o-mini-tts`** — השתמש **בדיוק** בשם הזה.

- **אל תשנה** את שם המודל ואל תציע `tts-1` / `tts-1-hd` כתחליף.
- הסיבה שהוא נבחר: הוא **היחיד שתומך בפרמטר `instructions`**, וזה הלֶבֶר
  היחיד שיש לנו על ההגייה והמסירה בעברית. עם `tts-1` אין שליטה בכלל.
- אם יש שגיאה, הבעיה כמעט תמיד ב-**`OPENAI_API_KEY`** או ב-**פרמטרים** —
  **לא** בשם המודל.

## מגבלת סביבה — קרא לפני שאתה מנסה להריץ

**`api.openai.com` חסום ב-egress proxy של סשני הענן.** הסקיל ירוץ רק במחשב
המקומי של רונן, שם יש `.env` אמיתי וגישת רשת. זה נכון גם ל-`gpt-image-gen`
(אותו host). מסשן ענן — הכן את הסקריפט ומסור לרונן להריץ, אל תנסה בעצמך.

## שימוש (סקריפט אחד, self-contained)

הקריאה מחזירה **אודיו בינארי ישירות** — לא base64 בתוך JSON כמו ב-Images.
לכן הסקריפט פשוט בהרבה: `curl -o out.mp3`, בלי `jq` ובלי `base64 -d`.

מלא שלושה משתנים בראש והרץ מתוך שורש הפרויקט:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# ===== מלא כאן =====
TEXT="<תסריט הקריינות בעברית>"
OUT="tal/Outputs/2026-01-01-slug"    # בלי סיומת .mp3
VOICE="nova"                          # מה שנבחר בשער האיכות
# ===================

set -a; source .env; set +a
: "${OPENAI_API_KEY:?OPENAI_API_KEY ריק/חסר ב-.env}"

INSTR="Speak in natural, native Modern Hebrew with an Israeli accent. Warm, clear and confident, like a professional Israeli voice-over artist. Do not use an American accent."

# --- איתור Python אמיתי (לא ה-shim של Microsoft Store) ---
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys" >/dev/null 2>&1; then
    PY="$c"; break
  fi
done
[ -n "$PY" ] || { echo "נדרש Python אמיתי לבניית ה-JSON." >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
printf '%s\n' "$TEXT" > "${OUT}.txt"     # התסריט נשמר לצד האודיו

# --- פיצול על גבול משפט אם מעל 4096 תווים (מגבלת ה-API) ---
CHUNKDIR="$(mktemp -d)"; trap 'rm -rf "$CHUNKDIR"' EXIT
"$PY" - "$TEXT" "$CHUNKDIR" <<'PY'
import re, sys, os
text, outdir = sys.argv[1], sys.argv[2]
LIMIT = 4000                      # שוליים מתחת ל-4096
parts, cur = [], ""
for sent in re.split(r'(?<=[.!?])\s+|\n\n+', text.strip()):
    if not sent: continue
    # משפט בודד שחורג מהמגבלה (תסריט בלי פיסוק) — חיתוך על גבול מילה
    while len(sent) > LIMIT:
        cut = sent.rfind(" ", 0, LIMIT)
        if cut <= 0: cut = LIMIT            # מילה אחת ענקית: חיתוך קשיח
        if cur: parts.append(cur.strip()); cur = ""
        parts.append(sent[:cut].strip())
        sent = sent[cut:].lstrip()
    if len(cur) + len(sent) + 1 > LIMIT:
        if cur: parts.append(cur.strip()); cur = ""
    cur += sent + " "
if cur.strip(): parts.append(cur.strip())
for i, p in enumerate(parts, 1):
    with open(os.path.join(outdir, f"{i:02d}.txt"), "w", encoding="utf-8") as f:
        f.write(p)
print(len(parts))
PY
N="$(ls "$CHUNKDIR"/*.txt | wc -l)"
echo "התסריט פוצל ל-$N קטע(ים)."

# --- קריאה ל-API לכל קטע ---
BODY="$(mktemp)"
i=0
for CHUNK in "$CHUNKDIR"/*.txt; do
  i=$((i+1)); PART="$(printf '%s' "$(cat "$CHUNK")")"
  "$PY" - "$PART" "$INSTR" "$VOICE" > "$BODY" <<'PY'
import json, sys
sys.stdout.write(json.dumps({
    "model": "gpt-4o-mini-tts",
    "input": sys.argv[1],
    "instructions": sys.argv[2],
    "voice": sys.argv[3],
    "response_format": "mp3",
}, ensure_ascii=False))
PY
  SEG="$CHUNKDIR/$(printf '%02d' $i).mp3"
  RC=0
  HTTP="$(curl -sS -w '%{http_code}' -o "$SEG" \
    -X POST "https://api.openai.com/v1/audio/speech" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data-binary "@$BODY")" || RC=$?
  [ "$RC" = "0" ] || { echo "כשל רשת (curl $RC) — api.openai.com חסום?" >&2; exit 1; }
  [ "$HTTP" = "200" ] || { echo "שגיאת API $HTTP:" >&2; cat "$SEG" >&2; exit 1; }
  echo "  קטע $i/$N — OK"
done
rm -f "$BODY"

# --- איחוד: פריימים של MP3 עצמאיים, cat עובד לדיבור ---
cat "$CHUNKDIR"/*.mp3 > "${OUT}.mp3"

# --- אימות: קיים, לא ריק, וחתימת MP3 תקינה ---
[ -s "${OUT}.mp3" ] || { echo "כשלון: ${OUT}.mp3 ריק/חסר." >&2; exit 1; }
SIG="$(head -c 3 "${OUT}.mp3" | od -An -tx1 | tr -d ' \n')"
case "$SIG" in
  494433) ;;               # "ID3"
  fffb*|fff3*|fff2*) ;;    # MPEG frame sync
  *) echo "אזהרה: חתימת MP3 לא מזוהה ($SIG)." >&2 ;;
esac
ls -l "${OUT}.mp3"
echo "OK: ${OUT}.mp3"
```

## הערות מימוש

- **`|| RC=$?` על ה-curl הוא קריטי.** בלעדיו, תחת `set -e`, כשל רשת מפיל את
  הסקריפט בלי הודעה מובנת. זה נתפס בבדיקה אמיתית, לא בתיאוריה.
- **`OUT` הוא נתיב בלי סיומת** — הסקריפט מוסיף `.mp3` לאודיו ו-`.txt` לתסריט,
  כך ששניהם מקבלים אותו שם (לאיטרציה ולתיעוד מה בדיוק נאמר).
- **הפיצול נופל על גבול משפט** (`.`/`!`/`?`/שורה ריקה) ולא באמצע מילה.
- **`cat` לאיחוד MP3** עובד כי פריימים של MPEG עצמאיים. לדיבור זה תקין;
  לתוצר שידור מקצועי עדיף לאחות בעורך אמיתי. **אין להסתמך על `ffmpeg`** —
  הוא לא ב-PATH כאן ולא במחשב של רונן.

## פרמטרים

| פרמטר | ערך | הערה |
|-------|-----|------|
| `model` | `gpt-4o-mini-tts` | קבוע — אין לשנות |
| `input` | טקסט | **מקסימום 4096 תווים** לבקשה; הסקריפט מפצל |
| `voice` | `nova` | 13 אפשרויות: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse, marin, cedar |
| `instructions` | טקסט | הנחיית מסירה — **הלֶבֶר על ההגייה בעברית** |
| `response_format` | `mp3` | גם opus, aac, flac, wav, pcm |
| `speed` | 1.0 | טווח 0.25–4.0 |

---

## נספח: כתיבת תסריט קריינות בעברית

הפרמטרים לא יצילו תסריט שכתוב לעין ולא לאוזן. חמישה כללים:

1. **ראשי תיבות — לכתוב כמו שאומרים.** `צה"ל` → "צהל" · `ד"ר` → "דוקטור" ·
   `וכו'` → "וכולי". המודל לא יודע לפענח גרשיים עבריים.
2. **מספרים — במילים.** `32%` → "שלושים ושניים אחוז" · `1,500 ₪` →
   "אלף וחמש מאות שקלים" · `03-1234567` → ספרה-ספרה במילים.
3. **ניקוד למילים דו-משמעיות ולשמות.** בלי ניקוד "ספר" יכול לצאת סֵפֶר או
   סַפָּר. לנקד רק את המילה הבעייתית, לא את כל התסריט.
4. **פיסוק הוא בקרת קצב.** פסיק = נשימה קצרה · נקודה = עצירה · שורה ריקה =
   מעבר נושא. תסריט בלי פיסוק יוצא כמפולת.
5. **קצר משפטים.** ~150 מילים לדקה. משפט מעל 25 מילים מאבד את המאזין —
   ובעברית, בלי הטעמה נכונה, גם את המשמעות.

**שירה כותבת את התסריט** (היא הבעלים של הקופי). טל/ליאור רק מריצים אותו.

**שער עדי לפני פרסום:** קול AI במודעה מחייב שקילת **גילוי נאות**, ואסור
לחקות קול של אדם מזוהה. ראה `.claude/agents/adi.md`.
