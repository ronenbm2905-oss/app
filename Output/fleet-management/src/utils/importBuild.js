// ============================================================================
// importBuild.js — הופך את תוכנית הייבוא (הפלט של analyzeImport) לישויות
// אמיתיות. מופרד מ-importExcel.js כי כאן נוצרים ids וחותמות זמן, כלומר זה
// כבר לא טהור — וה-analyze חייב להישאר טהור וניתן לבדיקה.
//
// נכתב **רק אחרי** שהמשתמש אישר את התצוגה המקדימה. אין ייבוא עיוור.
// ============================================================================

import {
  createVehicle,
  createVehiclePrivate,
  createDriver,
  createAssignment,
  createLeaseCompany,
} from "../schema.js";
import { nameKey } from "./importExcel.js";
import { nowIso } from "./id.js";

// ============================================================================
// M3 (שער עדי, 2026-08-13) — **הצהרת הייבוא נשמרת.**
//
// תיבת "אני מאשר/ת שהייבוא מתבצע בהתאם לחובת היידוע" חסמה את הכפתור ולא
// הותירה עקבה. D8 כולו עוסק ב**ראיה**, ובנקודה שבה עשרות עובדים אמיתיים
// נכנסים למאגר לא נשארה ראיה שהשער נחצה. כאן נבנית הרשומה; היא נכתבת
// ל-`settings.importAck`.
//
// זו **הצהרת מנהל**, לא הסכמת עובד — הניסוח נשמר ככזה בכוונה (ביחסי עבודה
// אי אפשר להישען על הסכמה חופשית). היא גם אינה ראיה לכך שהיידוע נמסר: את
// המסירה עצמה רושמים פר-עובד ב-`Driver.notice`.
//
// טהור: `at` מוזרק, ולכן בדיק.
// ============================================================================
export function buildImportAck({ ack = null, actor = null, settings = null, summary = null, at = null } = {}) {
  return {
    at: ack?.at || at || nowIso(),
    by: actor || null,
    // הגרסה שהייתה בתוקף ברגע ההצהרה — ולא "הגרסה הנוכחית" בדיעבד.
    policyVersion: ack?.policyVersion || settings?.policyVersion || null,
    file: ack?.file || null,
    sheet: ack?.sheet || null,
    vehicles: summary?.vehicles ?? null,
    drivers: summary?.drivers ?? null,
  };
}

export function buildImportWrite(plan, { orgId = null, data = {}, at = null } = {}) {
  const importedAt = at || nowIso();
  const source = plan?.meta || {};

  const leaseCompanies = [];
  const vehicles = [];
  const vehiclesPrivate = [];
  const drivers = [];
  const assignments = [];

  // -- חברות ליסינג: מיזוג הווריאנטים לרשומה אחת ---------------------------
  const leaseIdByKey = new Map();
  for (const c of plan.leaseCompanies || []) {
    const contact = c.contact || {};
    if (c.action === "create") {
      const entity = createLeaseCompany({
        orgId,
        name: c.name,
        contactName: contact.contactName || "",
        phone: contact.phone || "",
        email: contact.email || "",
        notes: contact.notes || "",
      });
      leaseCompanies.push(entity);
      leaseIdByKey.set(c.key, entity.id);
    } else {
      leaseIdByKey.set(c.key, c.existingId);
      // חברה קיימת: משלימים רק שדות **ריקים**, לא דורסים עריכה של אדמין.
      const existing = (data.leaseCompanies || []).find((x) => x.id === c.existingId);
      if (existing && contact.contactName) {
        const patch = {
          ...existing,
          contactName: existing.contactName || contact.contactName || "",
          phone: existing.phone || contact.phone || "",
          email: existing.email || contact.email || "",
          notes: existing.notes || contact.notes || "",
        };
        const changed = ["contactName", "phone", "email", "notes"].some((k) => patch[k] !== existing[k]);
        if (changed) leaseCompanies.push(patch);
      }
    }
  }

  // -- נהגים: שם זהה = אותו נהג, גם בתוך אותה הרצה -------------------------
  const driverIdByName = new Map();

  for (const row of plan.rows || []) {
    if (row.action !== "create") continue;

    // נהג
    let driverId = null;
    if (row.driverKind === "name" && row.driverName) {
      const key = nameKey(row.driverName);
      if (row.existingDriverId) {
        driverId = row.existingDriverId;
      } else if (driverIdByName.has(key)) {
        driverId = driverIdByName.get(key);
      } else {
        const d = createDriver({ orgId, fullName: row.driverName, status: "active" });
        drivers.push(d);
        driverIdByName.set(key, d.id);
        driverId = d.id;
      }
    }

    // רכב
    const vehicle = createVehicle({
      orgId,
      plate: row.plateRaw, // raw כמחרוזת — בלי עיצוב מחדש ובלי המרה למספר
      model: row.model,
      manufacturer: "",
      leaseCompanyId: row.leaseKey ? leaseIdByKey.get(row.leaseKey) || null : null,
      contractStart: row.contractStart,
      contractEnd: row.contractEnd,
      status: row.status,
    });
    vehicles.push(vehicle);

    // D1 — העלות החודשית למסמך הפרטי בלבד. ערך שנדחה → 0, ולא ניחוש.
    vehiclesPrivate.push(
      createVehiclePrivate(vehicle.id, { orgId, monthlyCost: row.monthlyCost || 0 })
    );

    // החזקה
    if (row.assignment) {
      assignments.push(
        createAssignment({
          orgId,
          vehicleId: vehicle.id,
          driverId,
          driverUid: null, // אין קישור לפורטל בייבוא (F1 — הקישור מבוקר, לא מנוחש)
          fromDate: row.assignment.fromDate,
          toDate: null,
          fromDateInferred: row.assignment.fromDateInferred,
          needsReview: row.assignment.needsReview,
          importRaw: row.assignment.importRaw,
          importedAt,
          importSource: { file: source.fileName || null, sheet: source.sheet || null, row: row.rowNumber },
        })
      );
    }
  }

  return {
    leaseCompanies,
    vehicles,
    vehiclesPrivate,
    drivers,
    assignments,
    summary: {
      leaseCompanies: leaseCompanies.length,
      vehicles: vehicles.length,
      drivers: drivers.length,
      assignments: assignments.length,
      needsReview: assignments.filter((a) => a.needsReview).length,
      importedAt,
    },
  };
}

export default buildImportWrite;
