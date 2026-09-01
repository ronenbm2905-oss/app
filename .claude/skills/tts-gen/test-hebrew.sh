#!/usr/bin/env bash
# ============================================================================
#  tts-gen — שער בדיקת איכות העברית
#
#  מריצים את זה **פעם אחת** לפני שמסתמכים על הסקיל, במחשב שבו יש .env אמיתי.
#  הוא מייצר את אותו משפט עברי ב-3 קולות, כדי להשוות ולבחור.
#
#  הרצה (משורש הפרויקט):   bash .claude/skills/tts-gen/test-hebrew.sh
# ============================================================================
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

set -a; source .env; set +a
: "${OPENAI_API_KEY:?OPENAI_API_KEY ריק/חסר ב-.env}"

# --- איתור Python אמיתי (לא ה-shim של Microsoft Store) ---
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys" >/dev/null 2>&1; then
    PY="$c"; break
  fi
done
[ -n "$PY" ] || { echo "נדרש Python אמיתי לבניית ה-JSON." >&2; exit 1; }

OUTDIR="tal/Outputs/tts-test"
mkdir -p "$OUTDIR"

# משפט מבחן: שם, מספר מילולי, ופיסוק — כל מה שנוטה להישבר בעברית
TEXT="שלום, אני הקריין של הצוות. היום נדבר על שלושים ושניים אחוזי צמיחה, ועל למה זה משנה לעסק שלך."
INSTR="Speak in natural, native Modern Hebrew with an Israeli accent. Warm, clear and confident, like a professional Israeli voice-over artist. Do not use an American accent."

BODY="$(mktemp)"; trap 'rm -f "$BODY"' EXIT

for VOICE in nova shimmer alloy; do
  echo "מייצר: $VOICE ..."
  "$PY" - "$TEXT" "$INSTR" "$VOICE" > "$BODY" <<'PY'
import json, sys
sys.stdout.write(json.dumps({
    "model": "gpt-4o-mini-tts",
    "input": sys.argv[1],
    "instructions": sys.argv[2],
    "voice": sys.argv[3],
    "response_format": "mp3",
}, ensure_ascii=False))
PY
  # `|| RC=$?` חובה: בלעדיו כשל רשת (curl exit!=0) מפיל את כל הסקריפט
  # בגלל `set -e`, במקום לדווח על הקול הזה ולהמשיך לבא.
  RC=0
  HTTP="$(curl -sS -w '%{http_code}' -o "$OUTDIR/test-$VOICE.mp3" \
    -X POST "https://api.openai.com/v1/audio/speech" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data-binary "@$BODY")" || RC=$?
  if [ "$RC" != "0" ]; then
    echo "  כשל רשת (curl exit $RC) — אין גישה ל-api.openai.com מהסביבה הזו." >&2
    rm -f "$OUTDIR/test-$VOICE.mp3"; continue
  fi
  if [ "$HTTP" != "200" ]; then
    echo "  שגיאה HTTP $HTTP:"; cat "$OUTDIR/test-$VOICE.mp3" 2>/dev/null; echo
    rm -f "$OUTDIR/test-$VOICE.mp3"; continue
  fi
  echo "  נשמר: $OUTDIR/test-$VOICE.mp3 ($(wc -c < "$OUTDIR/test-$VOICE.mp3") bytes)"
done

printf '%s\n' "$TEXT" > "$OUTDIR/test-script.txt"
cat <<'MSG'

===================================================================
  האזן לשלושת הקבצים ב-tal/Outputs/tts-test/ והכרע:
    - ההגייה עברית תקינה, או מבטא אמריקאי כבד?
    - ההטעמות במקום הנכון?
    - "שלושים ושניים אחוזי צמיחה" נקרא נכון?

  אם אף קול לא סביר — הסקיל לא שמיש לעברית,
  והחלופה היא ElevenLabs (תמיכה מוצהרת בעברית, חשבון נפרד).
===================================================================
MSG
