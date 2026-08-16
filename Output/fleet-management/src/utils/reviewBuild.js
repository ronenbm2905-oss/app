// ============================================================================
// reviewBuild.js — הופך פתרון של החזקה-לבדיקה לישויות אמיתיות.
// מופרד מ-review.js בדיוק כמו ש-importBuild מופרד מ-importExcel: כאן נוצרים
// ids וחותמות זמן, כלומר זה כבר לא טהור — והוולידציה חייבת להישאר טהורה.
//
// נכתב **רק אחרי** שהאדמין אישר במפורש. הצעה שנגזרה מהטקסט לא מגיעה לכאן
// אלא אם הוא לחץ עליה.
// ============================================================================

import { createDriver, createAssignment } from "../schema.js";
import { nowIso } from "./id.js";
import { prevDay } from "./dates.js";
import { emptyResolution, validateResolution, matchDriversByName } from "./review.js";

// ============================================================================
// שם שהוקלד ידנית ומתאים לנהג קיים → שימוש חוזר, לא כפילות.
//
// M2 (שער עדי, 2026-08-13) — ההתאמה עוברת דרך `matchDriversByName`, שהוא
// **אותו מקור אמת** שבו משתמש המסך. קודם היו כאן שתי לוגיקות: המסך התאים מול
// נהגים פעילים בלבד והשכבה הזו מול כולם, כלומר המשתמש ראה "נהג חדש" ובפועל
// נכתב שיוך לעובד שעזב. מקור אמת אחד = אין פער בין המוצג לנכתב.
//
// ובנוסף: `matchDriversByName` **אינו מתאים לנהג שעבר אנונימיזציה**. שם
// שהוקלד לא יחזיר לחיים זהות שנמחקה; במקרה כזה ייווצר נהג חדש, נפרד, בלי
// ההיסטוריה של המאונן. זו התוצאה הנכונה — האנונימיזציה בלתי-הפיכה (D6).
// ============================================================================
function findDriverByName(drivers, name) {
  return matchDriversByName(drivers, name)[0] || null;
}

export function buildReviewWrite(data, assignmentId, input, { orgId = null, actor = null, at = null } = {}) {
  const assignment = (data?.assignments || []).find((a) => a.id === assignmentId) || null;
  const errors = validateResolution(data, assignment, input);
  if (errors.length) return { ok: false, errors, drivers: [], assignments: [], vehicle: null };

  const r = { ...emptyResolution(assignment), ...(input || {}) };
  const stampAt = at || nowIso();
  const newDrivers = [];

  // מזהה נהג לפי הבחירה: קיים / חדש בשם שהוקלד / כלום.
  const resolveRef = (existingId, typedName) => {
    const id = String(existingId || "").trim();
    if (id && id !== "__new__") return id;
    const name = String(typedName || "").trim();
    if (!name) return null;
    const existing =
      findDriverByName(data?.drivers, name) || findDriverByName(newDrivers, name);
    if (existing) return existing.id;
    const created = createDriver({ orgId, fullName: name, status: "active" });
    newDrivers.push(created);
    return created.id;
  };

  const uidOf = (driverId) => {
    const d = [...(data?.drivers || []), ...newDrivers].find((x) => x.id === driverId);
    return d?.userId || null;
  };

  const assignments = [];
  let vehicle = null;

  // -- ההחזקה ההיסטורית (פיצול) --------------------------------------------
  // נוצרת ראשונה כדי שהיא תיסגר יום לפני תחילת ההחזקה הנוכחית — רצף מלא,
  // אפס חפיפה. `fromDateInferred` שלה נשאר כפי שהיה: תאריך ההתחלה שלה הוא
  // עדיין תאריך תחילת הסכם הליסינג, ולא תאריך מסירה ידוע.
  if (r.split) {
    const prevDriverId = resolveRef(r.previousDriverId, r.previousNewDriverName);
    assignments.push(
      createAssignment({
        orgId: orgId || assignment.orgId || null,
        vehicleId: assignment.vehicleId,
        driverId: prevDriverId,
        driverUid: uidOf(prevDriverId),
        fromDate: assignment.fromDate,
        toDate: prevDay(r.fromDate),
        fromDateInferred: Boolean(assignment.fromDateInferred),
        needsReview: false,
        // D-Import — הטקסט המקורי נשמר גם על ההחזקה ההיסטורית, כי היא נגזרה
        // ממנו. שדה מבודד, לא notes.
        importRaw: assignment.importRaw,
        importedAt: assignment.importedAt,
        importSource: assignment.importSource,
        reviewSplitFrom: assignment.id,
        reviewResolvedAt: stampAt,
        reviewResolvedBy: actor,
        reviewResolution: "split",
      })
    );
  }

  // -- ההחזקה שסומנה לבדיקה, אחרי הפתרון -----------------------------------
  const driverId = r.mode === "driver" ? resolveRef(r.driverId, r.newDriverName) : null;

  assignments.push({
    ...assignment,
    driverId,
    driverUid: driverId ? uidOf(driverId) : null,
    fromDate: r.fromDate,
    // הדגל יורד **רק** אם האדמין הזין תאריך אמיתי; השאיר את המשוער → נשאר true.
    fromDateInferred: Boolean(r.fromDateInferred),
    needsReview: false,
    // ⚠️ importRaw נשאר כפי שהוא — עקבות ביקורת. אסור להעתיק ל-notes.
    importRaw: assignment.importRaw,
    notes: assignment.notes || "",
    reviewResolvedAt: stampAt,
    reviewResolvedBy: actor,
    reviewResolution: r.split ? "split" : r.mode,
    updatedAt: stampAt,
  });

  // -- רכב מאגר: אין מחזיק קבוע, ואין המצאה של נהג -------------------------
  if (r.mode === "pool") {
    const v = (data?.vehicles || []).find((x) => x.id === assignment.vehicleId) || null;
    if (v && v.status !== "pool") vehicle = { ...v, status: "pool", updatedAt: stampAt };
  }

  return { ok: true, errors: [], drivers: newDrivers, assignments, vehicle };
}

export default buildReviewWrite;
