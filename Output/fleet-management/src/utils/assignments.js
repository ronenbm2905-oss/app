// ============================================================================
// assignments.js — "מי החזיק את הרכב בתאריך X".
//
// זו הלוגיקה שמצדיקה את כל האפליקציה: שיוך קנס לנהג **נגזר** מההחזקה שהייתה
// תקפה בתאריך העבירה, ולא נבחר ידנית מרשימה. הפונקציות כאן טהורות לחלוטין
// (בלי React, בלי Date.now מוסתר) כדי שאפשר יהיה לכסות אותן ב-smoke tests.
//
// אמנת טווחים: fromDate ו-toDate **כוללים** (inclusive). toDate=null = פעיל.
// ============================================================================

import { inRange, isDay, cmpDay, todayIso, prevDay } from "./dates.js";

// כל ההחזקות של רכב, ממוינות מהחדשה לישנה.
export function assignmentsForVehicle(assignments, vehicleId) {
  return (assignments || [])
    .filter((a) => a.vehicleId === vehicleId)
    .sort((a, b) => -cmpDay(a.fromDate, b.fromDate) || (a.id < b.id ? -1 : 1));
}

// כל ההחזקות של נהג, ממוינות מהחדשה לישנה.
export function assignmentsForDriver(assignments, driverId) {
  return (assignments || [])
    .filter((a) => a.driverId === driverId)
    .sort((a, b) => -cmpDay(a.fromDate, b.fromDate) || (a.id < b.id ? -1 : 1));
}

// כל ההחזקות שמכסות תאריך נתון (בדרך כלל 0 או 1; יותר מ-1 = חפיפה/החלפה).
export function assignmentsCovering(assignments, vehicleId, day) {
  if (!isDay(day)) return [];
  return (assignments || []).filter(
    (a) => a.vehicleId === vehicleId && inRange(day, a.fromDate, a.toDate)
  );
}

// ההחזקה הפעילה בתאריך. כשיש כמה — מעדיפים את זו שמתחילה מאוחר יותר
// (החלפה באותו יום: הנהג הנכנס הוא הרלוונטי), ואם גם זה שווה — האחרונה שנוצרה.
export function assignmentAtDate(assignments, vehicleId, day) {
  const hits = assignmentsCovering(assignments, vehicleId, day);
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  return [...hits].sort(
    (a, b) => cmpDay(a.fromDate, b.fromDate) || String(a.createdAt).localeCompare(String(b.createdAt))
  )[hits.length - 1];
}

// הפונקציה הטהורה המרכזית: מי החזיק את הרכב בתאריך. null = אף אחד.
export function driverAtDate(assignments, vehicleId, day) {
  const a = assignmentAtDate(assignments, vehicleId, day);
  return a ? a.driverId || null : null;
}

// ההחזקה הפעילה כרגע (toDate=null או toDate ≥ היום).
export function currentAssignment(assignments, vehicleId, today = todayIso()) {
  return assignmentAtDate(assignments, vehicleId, today);
}

export function currentDriverId(assignments, vehicleId, today = todayIso()) {
  const a = currentAssignment(assignments, vehicleId, today);
  return a ? a.driverId || null : null;
}

// הרכב שנהג מחזיק כרגע (הראשון, אם משום מה יש כמה).
export function currentVehicleIdForDriver(assignments, driverId, today = todayIso()) {
  const hit = (assignments || []).find(
    (a) => a.driverId === driverId && inRange(today, a.fromDate, a.toDate)
  );
  return hit ? hit.vehicleId : null;
}

// ============================================================================
// resolveDriverForFine — הגזירה המלאה, עם כל מקרי הקצה שהאפיון דורש.
//
// מחזיר { driverId, assignmentId, status, candidates, reasonKey, fromDateInferred }:
//   'resolved'     — החזקה יחידה כיסתה את התאריך → שיוך ודאי
//   'ambiguous'    — יותר מהחזקה אחת (החלפה באותו יום / חפיפה) → נבחרה ברירת
//                    מחדל, אבל ה-UI חייב לבקש אישור מודע
//   'needsReview'  — ההחזקה המכסה סומנה "דורש בדיקה ידנית" (D5): מקורה בטקסט
//                    חופשי מיובא. **לא משייכים אוטומטית** — שיוך שגוי כאן
//                    מוביל להסבת דוח על שם עובד שלא נהג.
//   'pool'         — רכב מאגר בלי החזקה בתאריך → אין נהג לשייך
//   'none'         — אין החזקה בתאריך (פער בהיסטוריה / קנס לפני תחילת המעקב)
//   'invalid'      — חסר רכב או תאריך תקין
//
// `fromDateInferred: true` — השיוך תקף, אבל תאריך תחילת ההחזקה שממנה נגזר
// הגיע מהייבוא (תאריך תחילת הסכם הליסינג) והוא **משוער**. השיוך ממשיך לעבוד
// (אחרת הפיצ'ר משותק), אבל הממשק חייב להציג אזהרה — "לא לנחש בשקט".
// ============================================================================
export function resolveDriverForFine(data, vehicleId, violationDate) {
  const empty = {
    driverId: null,
    assignmentId: null,
    status: "invalid",
    candidates: [],
    reasonKey: "fine.derive.invalid",
    fromDateInferred: false,
  };
  if (!vehicleId || !isDay(violationDate)) return empty;

  const vehicle = (data.vehicles || []).find((v) => v.id === vehicleId) || null;
  const hits = assignmentsCovering(data.assignments, vehicleId, violationDate);

  // D5 — החזקה שדורשת בדיקה ידנית לא מייצרת שיוך אוטומטי, גם אם היא יחידה.
  if (hits.length && hits.every((a) => a.needsReview)) {
    return {
      driverId: null,
      assignmentId: null,
      status: "needsReview",
      candidates: hits,
      reasonKey: "fine.derive.needsReview",
      fromDateInferred: hits.some((a) => a.fromDateInferred),
    };
  }

  // החזקה בלי נהג (רכב מאגר שנפתר במסך הבדיקה: "ללא מחזיק קבוע") אינה מקור
  // לשיוך — היא מתעדת תקופה, לא אדם. בלי הסינון הזה הקנס היה מוצג כ"שויך"
  // לאף אחד, במקום ליפול למסלול המפורש של רכב מאגר.
  const usable = hits.filter((a) => !a.needsReview && a.driverId);

  if (usable.length === 1) {
    return {
      driverId: usable[0].driverId || null,
      assignmentId: usable[0].id,
      status: "resolved",
      candidates: [usable[0]],
      reasonKey: "fine.derive.resolved",
      fromDateInferred: Boolean(usable[0].fromDateInferred),
    };
  }

  if (usable.length > 1) {
    const picked = assignmentAtDate(usable, vehicleId, violationDate);
    return {
      driverId: picked ? picked.driverId || null : null,
      assignmentId: picked ? picked.id : null,
      status: "ambiguous",
      candidates: usable,
      reasonKey: "fine.derive.ambiguous",
      fromDateInferred: Boolean(picked?.fromDateInferred),
    };
  }

  if (vehicle && vehicle.status === "pool") {
    return { ...empty, status: "pool", reasonKey: "fine.derive.pool" };
  }

  return { ...empty, status: "none", reasonKey: "fine.derive.none" };
}

// ============================================================================
// בדיקות תקינות בהוספת החזקה — חפיפה על אותו רכב, וטווח הפוך.
// מחזיר מערך מפתחות-שגיאה (ריק = תקין).
// ============================================================================
export function validateAssignment(assignments, candidate) {
  const errors = [];
  if (!candidate.vehicleId) errors.push("assign.err.noVehicle");
  if (!candidate.driverId) errors.push("assign.err.noDriver");
  if (!isDay(candidate.fromDate)) errors.push("assign.err.noFrom");
  if (candidate.toDate && isDay(candidate.fromDate) && candidate.toDate < candidate.fromDate) {
    errors.push("assign.err.reversed");
  }
  if (candidate.vehicleId && isDay(candidate.fromDate)) {
    const others = (assignments || []).filter(
      (a) => a.vehicleId === candidate.vehicleId && a.id !== candidate.id
    );
    if (others.some((a) => rangesOverlap(a, candidate))) errors.push("assign.err.overlap");
  }
  return errors;
}

export function rangesOverlap(a, b) {
  const aFrom = a.fromDate;
  const bFrom = b.fromDate;
  if (!isDay(aFrom) || !isDay(bFrom)) return false;
  const aTo = isDay(a.toDate) ? a.toDate : "9999-12-31";
  const bTo = isDay(b.toDate) ? b.toDate : "9999-12-31";
  return aFrom <= bTo && bFrom <= aTo;
}

// כשמוסיפים החזקה חדשה בזמן שקיימת פעילה — סוגרים את הקודמת יום לפני.
// מחזיר מערך assignments מעודכן (טהור, בלי מוטציה).
export function closeOpenAssignments(assignments, vehicleId, newFromDate) {
  return (assignments || []).map((a) => {
    if (a.vehicleId !== vehicleId) return a;
    if (a.toDate) return a;
    if (!isDay(a.fromDate) || !isDay(newFromDate)) return a;
    if (a.fromDate >= newFromDate) return a;
    return { ...a, toDate: prevDay(newFromDate) };
  });
}
