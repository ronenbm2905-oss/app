// ============================================================================
// waMessages.js — בניית טקסט הודעות וואטסאפ יוצאות (בלי התחברות/פורטל).
// מקבל מחרוזות מתורגמות בלבד (i18n-agnostic) כדי שיהיה טהור וניתן לבדיקה.
// ============================================================================

// הודעה לאיש תחזוקה: ברכה + כתובת הנכס + סוג התקלה + תיאור + סגירה.
// שורות ריקות (תיאור חסר) מושמטות.
export function ticketWaText({ hi, handlerName, subject, address, typeLabel, description, close }) {
  const greeting = handlerName ? `${hi} ${handlerName},` : `${hi},`;
  return [
    greeting,
    `${subject} ${address} — ${typeLabel}.`,
    (description || "").trim(),
    close,
  ]
    .filter(Boolean)
    .join("\n");
}

// הודעה גנרית: ברכה (עם שם אם קיים) + גוף + סגירה. משמש לתזכורת תשלום/תזכורת חוזה.
export function simpleWaText({ hi, name, body, close }) {
  const greeting = name ? `${hi} ${name},` : `${hi},`;
  return [greeting, (body || "").trim(), close].filter(Boolean).join("\n");
}
