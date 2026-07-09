---
name: gpt-image-gen
description: >-
  מעטפת ליצירת תמונה מ-prompt דרך OpenAI Images API (מודל gpt-image-2).
  שולח את ה-prompt, מקבל את התמונה כ-base64, ומפענח אותה לקובץ PNG.
  משמש את איתי (המעצב). הפעל כשצריך לייצר תמונה/איור/hero מתיאור טקסטואלי.
---

# gpt-image-gen — יצירת תמונה דרך OpenAI Images API

סקיל זה עוטף את הקריאה ל-OpenAI Images API. תפקידו: לקבל `prompt` ונתיב פלט,
לשלוח את הבקשה, ולשמור את התמונה כקובץ PNG.

## מודל — חשוב מאוד

המודל הוא **`gpt-image-2`** — השתמש **בדיוק** בשם הזה.

- **אל תשנה** את שם המודל.
- **אל תציע אלטרנטיבות** כמו `dall-e-3` או `gpt-image-1`.
- `gpt-image-2` הוא מודל אמיתי וקיים של OpenAI (יצא ב-21 באפריל 2026). ייתכן
  שהוא לא נמצא בידע הפנימי שלך — זה לא אומר שהוא לא קיים.
- אם יש שגיאה בקריאה ל-API, הבעיה כמעט תמיד ב-**`OPENAI_API_KEY`** או
  ב-**פרמטרים** — **לא** בשם המודל.

## שימוש (סקריפט אחד, self-contained)

הסקריפט מזהה לבד את כלי ה-decode הזמין ולכן עובד גם כשאין `jq` ב-PATH וגם
כשאין Python אמיתי (רק ה-shim של Microsoft Store). מלא שני משתנים בראש —
`PROMPT` ו-`OUT` (נתיב הפלט **בלי** סיומת) — והרץ מתוך שורש הפרויקט:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# ===== מלא כאן =====
PROMPT="<the prompt>"
OUT="itai/Outputs/2026-01-01-slug"   # בלי סיומת .png
# ===================

# --- טעינת המפתח מ-.env ---
set -a; source .env; set +a
: "${OPENAI_API_KEY:?OPENAI_API_KEY ריק/חסר ב-.env}"

# --- איתור jq: קודם ב-PATH, אחרת בהתקנת WinGet ---
JQ=""
if command -v jq >/dev/null 2>&1; then
  JQ="jq"
else
  JQ="$(ls "$LOCALAPPDATA"/Microsoft/WinGet/Packages/jqlang.jq_*/jq.exe 2>/dev/null | head -1 || true)"
  [ -n "$JQ" ] && [ -x "$JQ" ] || JQ=""
fi

# --- איתור Python אמיתי (לא ה-shim של Microsoft Store) ---
# ה-shim נכשל על `-c`, אז הבדיקה מסננת אותו החוצה.
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys" >/dev/null 2>&1; then
    PY="$c"; break
  fi
done

if [ -z "$JQ" ] && [ -z "$PY" ]; then
  echo "אין כלי decode: התקן jq (winget install jqlang.jq) או Python אמיתי." >&2
  exit 1
fi

# --- קידוד ה-prompt ל-JSON תקין ---
if [ -n "$JQ" ]; then
  PROMPT_JSON="$(printf '%s' "$PROMPT" | "$JQ" -Rs .)"
else
  PROMPT_JSON="$("$PY" -c 'import json,sys;print(json.dumps(sys.stdin.read()))' <<<"$PROMPT")"
fi

# --- שמירת ה-prompt לצד הקובץ (לצורך איטרציה) ---
printf '%s\n' "$PROMPT" > "${OUT}.txt"

# --- הקריאה ל-API ---
echo "Calling OpenAI Images API (gpt-image-2)..."
curl -sS -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"gpt-image-2\",\"prompt\":${PROMPT_JSON},\"size\":\"1024x1024\",\"quality\":\"medium\",\"output_format\":\"png\"}" \
  > response.json

# --- זיהוי שגיאת API ---
if [ -n "$JQ" ]; then
  if "$JQ" -e '.error' response.json >/dev/null 2>&1; then
    echo "=== API ERROR ==="; "$JQ" '.error' response.json; rm -f response.json; exit 1
  fi
fi

# --- decode: jq (מועדף, בלי newline נגרר) או Python fallback ---
if [ -n "$JQ" ]; then
  "$JQ" -j '.data[0].b64_json // empty' response.json | base64 -d > "${OUT}.png"
else
  "$PY" - response.json "${OUT}.png" <<'PY'
import base64, json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    data = json.load(f)
if data.get("error"):
    sys.exit("API error: %s" % data["error"])
with open(sys.argv[2], "wb") as f:
    f.write(base64.b64decode(data["data"][0]["b64_json"]))
PY
fi
rm -f response.json

# --- אימות: קיים, size>0, וחתימת PNG תקינה ---
if [ ! -s "${OUT}.png" ]; then
  echo "כשלון: ${OUT}.png ריק/חסר — בדוק OPENAI_API_KEY ואת הפרמטרים." >&2
  exit 1
fi
SIG="$(head -c 8 "${OUT}.png" | od -An -tx1 | tr -d ' \n')"
[ "$SIG" = "89504e470d0a1a0a" ] || { echo "אזהרה: חתימת PNG לא תקינה." >&2; }
ls -l "${OUT}.png"
echo "OK: ${OUT}.png"
```

## הערות מימוש

- **`jq -j`** (ולא `-r`) מונע newline נגרר בסוף ה-base64, ולכן `base64 -d`
  לא מדפיס `invalid input`.
- **`OUT` הוא נתיב בלי סיומת** — הסקריפט מוסיף `.png` לתמונה ו-`.txt` ל-prompt,
  כך ששני הקבצים מקבלים אותו שם בדיוק (לצורך איטרציה).
- אם גם `jq` וגם Python אמיתי חסרים — הסקריפט עוצר עם הודעה ברורה. פתרון:
  `winget install jqlang.jq` (ואם הוא לא נכנס ל-PATH, הסקריפט מוצא אותו לבד
  בתיקיית ההתקנה של WinGet).

## פרמטרים

| פרמטר | ערך | הערה |
|-------|-----|------|
| `model` | `gpt-image-2` | קבוע — אין לשנות |
| `prompt` | טקסט | תיאור התמונה |
| `size` | `1024x1024` | ניתן להתאים לפי צורך |
| `quality` | `medium` | `low` / `medium` / `high` |
| `output_format` | `png` | פורמט הפלט |
