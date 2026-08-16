// ============================================================================
// retention.js — שני החובות הפתוחים מפרוסה 1.
//
// **1. מחיקת `reminderLog` בצד השרת.** `allow write: if false` חוסם גם מחיקה,
//    ולכן `deleteHousehold()` מהקליינט **לא יכול** למחוק את היומן. בלי
//    הפונקציה הזאת, "מחיקת חשבון" הייתה משאירה מאחור רשומות מסירה — וזו
//    בדיוק הצורה שבה מחיקה הופכת לתיאורטית. `deleteHouseholdPlan()` כבר
//    מסמן את זה עם `requiresServerDeletion`; כאן זה נסגר.
//
// **2. ניקוי retention מתוזמן.** `operational-short`, המלצה 12 חודשים —
//    **המספר ⚖️ פתוח**, ולכן הוא **קונפיגורבילי** (`REMINDER_LOG_RETENTION_MONTHS`)
//    ולא קבוע בקוד. כשעדי תקבע, זה משתנה סביבה ולא deploy של לוגיקה.
// ============================================================================

import { ALL_COLLECTIONS, SERVER_ONLY_COLLECTIONS, RETENTION_CLASSES } from "../../src/constants.js";
import { addMonths, todayInZone } from "../../src/utils/dates.js";

const TZ = "Asia/Jerusalem";

// ברירת המחדל היא ההמלצה; הערך המחייב מגיע מהסביבה.
export function retentionMonths(env = process.env) {
  const n = Number(env.REMINDER_LOG_RETENTION_MONTHS);
  return Number.isFinite(n) && n > 0 ? n : RETENTION_CLASSES["operational-short"].recommendedMonths;
}

// ============================================================================
// purgeReminderLogs — מוחק רשומות יומן שעברו את תקופת השמירה.
// עובר על כל משקי הבית; `firedAt` הוא חותמת ISO מלאה, ולכן ההשוואה על
// היום בלבד (10 התווים הראשונים) בטוחה לקסיקוגרפית.
// ============================================================================
export async function purgeReminderLogs({ db, now = new Date(), months = null, logger = console } = {}) {
  const keepMonths = months ?? retentionMonths();
  const cutoff = addMonths(todayInZone(TZ, now), -keepMonths);
  const stats = { households: 0, deleted: 0, cutoff, keepMonths };

  const households = await db.collection("households").get();
  for (const hh of households.docs) {
    stats.households++;
    const old = await hh.ref.collection("reminderLog").where("firedAt", "<", `${cutoff}T00:00:00.000Z`).get();
    if (old.empty) continue;
    // מחיקה במנות — batch מוגבל ל-500 פעולות.
    let batch = db.batch();
    let n = 0;
    for (const d of old.docs) {
      batch.delete(d.ref);
      n++;
      stats.deleted++;
      if (n % 450 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
  }
  logger.log?.("reminderLog purge", stats);
  return stats;
}

// ============================================================================
// deleteHouseholdServerSide — הצלע שהקליינט לא יכול לבצע.
//
// ⚠️ מוחק **רק** את האוספים שהשרת בלבד כותב. את שאר הנתונים ואת קובצי
// ה-Storage מוחק הקליינט (`deleteHousehold()` ב-useActions), כי שם הוא כן
// מורשה — ואין סיבה להעביר לשרת סמכות שלא נחוצה לו.
//
// `purgeAll` מוחק גם את אוספי הישויות — לשימוש כשהמחיקה יזומה מהשרת (למשל
// חשבון שנמחק דרך תמיכה), ולא מהאפליקציה.
// ============================================================================
export async function deleteHouseholdServerSide({ db, householdId, uid, purgeAll = false, logger = console } = {}) {
  if (!householdId) throw Object.assign(new Error("missing householdId"), { code: "invalid-argument" });

  const hhRef = db.collection("households").doc(householdId);
  const hhSnap = await hhRef.get();
  if (!hhSnap.exists) return { deleted: 0, collections: [] };

  // רק בעלים מוחק. Admin SDK עוקף rules, ולכן הבדיקה חייבת להיות כאן.
  const members = hhSnap.data().household?.members || {};
  if (uid && members[uid] !== "owner") {
    throw Object.assign(new Error("not an owner"), { code: "permission-denied" });
  }

  const targets = purgeAll ? ALL_COLLECTIONS : SERVER_ONLY_COLLECTIONS;
  const stats = { deleted: 0, collections: targets };
  for (const c of targets) {
    const snap = await hhRef.collection(c).get();
    if (snap.empty) continue;
    let batch = db.batch();
    let n = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      n++;
      stats.deleted++;
      if (n % 450 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
  }
  logger.log?.("household server-side delete", { householdId, ...stats });
  return stats;
}
