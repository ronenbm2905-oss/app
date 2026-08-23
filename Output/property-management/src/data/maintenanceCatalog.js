// ============================================================================
// maintenanceCatalog.js — מאגר תקלות אופייניות בדירה מושכרת + טווחי עלות והערות.
// מקור: קובץ הבעלים "תקלות מאפיינות ועלות תיקון". זהו **מידע** (data) בעברית,
// לא מפתחות i18n — התוויות מוצגות ישירות (במצב אנגלית מוצגות בעברית; ניתן לתרגם בהמשך).
//
// domain תואם לערך מתוך TICKET_TYPES (plumbing/electricity/hvac/structural).
// טווח העלות בש"ח כולל מע"מ, לשעות עבודה ביום (ראה MAINTENANCE_NOTES).
// ============================================================================

export const MAINTENANCE_CATALOG = [
  // --- אינסטלציה ---
  { id: "plumb_blockage", domain: "plumbing", label: "פתיחת סתימה", costMin: 250, costMax: 450, note: "בדרך כלל עקב שימוש לא סביר של השוכר — לרוב באחריות השוכר" },
  { id: "plumb_niagara", domain: "plumbing", label: "תיקון נזילה בניאגרה — החלפת מנגנון", costMin: 250, costMax: 550, note: "" },
  { id: "plumb_faucet", domain: "plumbing", label: "החלפת ברז (עבודה בלבד)", costMin: 250, costMax: 400, note: "לא כולל עלות ברז חדש" },
  { id: "plumb_trap", domain: "plumbing", label: "החלפת סיפון", costMin: 200, costMax: 350, note: "כולל חלפים" },
  { id: "plumb_leak_exposed", domain: "plumbing", label: "תיקון נזילה מצינור גלוי", costMin: 350, costMax: 600, note: "" },
  { id: "plumb_leak_hidden", domain: "plumbing", label: "תיקון נזילה מצינור סמוי", costMin: 350, costMax: 600, note: "הפעילו את פוליסת הביטוח — בדקו את גובה ההשתתפות העצמית" },
  { id: "plumb_segment", domain: "plumbing", label: "החלפת מקטע צנרת", costMin: 350, costMax: 600, note: "" },

  // --- חשמל ---
  { id: "elec_socket", domain: "electricity", label: "החלפת שקע/מפסק תקול", costMin: 250, costMax: 350, note: "חובה חשמלאי מוסמך לכל עבודות החשמל" },
  { id: "elec_boiler_element", domain: "electricity", label: "החלפת גוף חימום בדוד (פלאנג')", costMin: 550, costMax: 850, note: "כולל ניקוי אבנית מהדוד (שטיפה)" },
  { id: "elec_rcd", domain: "electricity", label: "החלפת מפסק פחת/אוטומט", costMin: 350, costMax: 550, note: "חובה חשמלאי מוסמך" },
  { id: "elec_light", domain: "electricity", label: "התקנת גוף תאורה", costMin: 200, costMax: 350, note: "לא כולל עלות גוף התאורה" },

  // --- מיזוג אוויר ---
  { id: "hvac_gas", domain: "hvac", label: "מילוי גז (מזגן עילי/מרכזי)", costMin: 350, costMax: 800, note: "תלוי בכמות הגז ובגודל המזגן" },
  { id: "hvac_capacitor", domain: "hvac", label: "החלפת קבל", costMin: 300, costMax: 500, note: "" },
  { id: "hvac_water_leak", domain: "hvac", label: "תיקון נזילת מים מהמזגן", costMin: 250, costMax: 450, note: "" },
  { id: "hvac_board", domain: "hvac", label: "החלפת כרטיס פיקוד/עינית/דמפר", costMin: 500, costMax: 1200, note: "תלוי בדגם המזגן (מיני-מרכזי יקר יותר)" },
  { id: "hvac_fan_motor", domain: "hvac", label: "החלפת מנוע מאוורר חיצוני", costMin: 700, costMax: 1400, note: "במיני-מרכזי נוטה לרף העליון" },
  { id: "hvac_compressor", domain: "hvac", label: "החלפת מדחס", costMin: 1500, costMax: 3500, note: "עדיף לבחון החלפה למזגן חדש" },
  { id: "hvac_deep_clean", domain: "hvac", label: "ניקוי עמוק (טיפול אנטי-בקטריאלי)", costMin: 450, costMax: 800, note: "כולל פירוק פלסטיק וניקוי עובש" },

  // --- מבנה / כללי ---
  { id: "struct_cylinder", domain: "structural", label: "החלפת צילינדר (פלדלת)", costMin: 400, costMax: 650, note: "כולל סט מפתחות חדש וכרטיס לשכפול" },
  { id: "struct_shutter_strap", domain: "structural", label: "תיקון רצועת תריס/גלילה", costMin: 250, costMax: 400, note: "" },
  { id: "struct_wall_patch", domain: "structural", label: "תיקון קיר מקומי (טיח וצבע)", costMin: 300, costMax: 600, note: "לאחר תיקון נזילה/רטיבות/חורים" },
  { id: "struct_shutter_motor", domain: "structural", label: "החלפת מנוע לתריס חשמלי", costMin: 800, costMax: 1800, note: "תלוי בכוח המנוע ובסוגו" },
  { id: "struct_cabinet_hinges", domain: "structural", label: "תיקון צירים בארון מטבח", costMin: 200, costMax: 350, note: "" },
];

// הערות כלליות (מוצגות בתחתית טופס התקלה).
export const MAINTENANCE_NOTES = [
  "הטווח לשעות עבודה ביום; לילה/שבתות/חגים עשוי להכפיל את המחיר.",
  "עלות ביקור טכנאי (ללא תיקון) לרוב 200–300 ₪.",
  "תמיד כדאי לבקש קבלה ואחריות על התיקון.",
];

// כל התקלות של תחום נתון (domain = ערך TICKET_TYPES).
export function issuesForDomain(domain) {
  return MAINTENANCE_CATALOG.filter((i) => i.domain === domain);
}

// שליפת תקלה לפי id.
export function catalogById(id) {
  return MAINTENANCE_CATALOG.find((i) => i.id === id) || null;
}

// אמצע הטווח — לשימוש כברירת-מחדל להצעת מחיר.
export function midCost(item) {
  if (!item) return null;
  return Math.round((item.costMin + item.costMax) / 2);
}
