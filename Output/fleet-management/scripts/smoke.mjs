// ============================================================================
// smoke.mjs — בדיקות עשן ללוגיקה הטהורה (בלי React, בלי DOM, בלי Firebase).
// מריצים: npm run smoke
//
// הכיסוי מכוון לשני דברים: (1) הלוגיקה שמצדיקה את האפליקציה — גזירת שיוך
// הקנס מההחזקה שהייתה תקפה, על כל מקרי הקצה; (2) חוסמי-התכנון של עדי
// (D1-D8), כדי שרגרסיה בפרטיות תיפול כאן ולא בשער.
// ============================================================================

import assert from "node:assert";

import {
  createVehicle,
  createVehiclePrivate,
  createDriver,
  createAssignment,
  createFine,
  createFinePrivate,
  createFineScan,
  createOdometerReading,
  createServiceRecord,
  createVehicleDocument,
  createLeaseCompany,
  createIncident,
  createIncidentPrivate,
  emptyAttribution,
} from "../src/schema.js";

import {
  EMPTY,
  ENTITY_COLLECTIONS,
  ADMIN_ONLY_COLLECTIONS,
  DOCUMENT_TYPE,
  FINE_STATUS,
  DRIVER_STATUS,
  FORBIDDEN_FIELDS,
  RETENTION_CLASSES,
  STORAGE_DOMAINS,
  NOTICE_METHODS,
  NOTICE_METHOD_WEAK,
  NOTICE_METHOD_DEFAULT,
  POLICY_VERSION,
} from "../src/constants.js";

import {
  buildNoticeDelivery,
  buildNoticeRecord,
  isWeakNoticeEvidence,
  noticeCandidates,
  noticeDeliveredAt,
  normalizeNoticeMethod,
  partitionNoticeTargets,
  validateNoticeDelivery,
} from "../src/utils/notice.js";

import {
  driverAtDate,
  assignmentAtDate,
  assignmentsCovering,
  resolveDriverForFine,
  validateAssignment,
  closeOpenAssignments,
  currentDriverId,
  currentVehicleIdForDriver,
  rangesOverlap,
} from "../src/utils/assignments.js";

import {
  isReviewItem,
  reviewAssignments,
  reviewProgress,
  pendingReviewCount,
  emptyResolution,
  validateResolution,
  splitPreview,
  applyNameSuggestion,
  applyDateSuggestion,
  applySplitSuggestion,
  applyPoolSuggestion,
  changeFromDate,
  matchDriversByName,
  nameMatchInfo,
} from "../src/utils/review.js";
import { buildReviewWrite } from "../src/utils/reviewBuild.js";
import { parseImportRaw, parseLooseDate, findDates, confidenceOf } from "../src/utils/reviewParse.js";

import {
  isFineOpen,
  isAwaitingTransfer,
  validateFine,
  canTransition,
  buildAttribution,
  applyDerivedDriver,
  totalAmount,
  noticeGateError,
  fineStatusChange,
  driversWithoutNotice,
  hasNotice,
} from "../src/utils/fines.js";

import { kmStatus, serviceDue, currentKm, readingsForVehicle } from "../src/utils/odometer.js";
import { computeAlerts, ALERT_GROUPS } from "../src/utils/alerts.js";
import { todayIso, daysBetween, inRange, prevDay, isDay } from "../src/utils/dates.js";
import { removeVehicleCascade, removeFineCascade, removeLeaseCompanyDetach } from "../src/utils/cascade.js";
import {
  archiveDriver,
  anonymizeDriver,
  collectDriverStoragePaths,
  collectVehicleStoragePaths,
  parseAnonymizedName,
  anonymizationToken,
  redactNameFromText,
  redactDriverNameEverywhere,
} from "../src/utils/retention.js";
import {
  DRIVER_READABLE_COLLECTIONS,
  DRIVER_DENIED_COLLECTIONS,
  adminOnlyCollectionsAreDenied,
  driverForUid,
  driverCanReadFine,
  driverCanReadFineScan,
  driverCanReadVehicleDocument,
  driverVehicleProjection,
  leaksForbiddenField,
} from "../src/utils/access.js";
import { storagePath, validateFile, isAcceptedType } from "../src/utils/files.js";
import {
  analyzeImport,
  classifyDriverCell,
  parseMonthlyCost,
  parseDateCell,
  excelSerialToIso,
  plateKey,
  leaseKey,
  isExcludedSheet,
  driverMergeGroups,
  mergedRowNumbers,
} from "../src/utils/importExcel.js";
import { buildImportWrite, buildImportAck } from "../src/utils/importBuild.js";
import { monthlyCostOf, adminNotesOf, scanForFine, driverName } from "../src/utils/options.js";
import dict, { translate, LANGS } from "../src/i18n.js";

let pass = 0;
let failed = 0;
const failures = [];

function ok(name, cond) {
  try {
    assert.ok(cond, name);
    pass++;
  } catch {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name);
  }
}
function eq(name, a, b) {
  try {
    assert.deepStrictEqual(a, b, name);
    pass++;
  } catch (e) {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, "\n    got:", JSON.stringify(a), "\n    want:", JSON.stringify(b));
  }
}
function section(title) {
  console.log(`\n— ${title}`);
}

const ORG = "org1";

// ============================================================================
section("1. סכימה — 9 הישויות, orgId, ו-retentionClass");
// ============================================================================
const entities = {
  vehicle: createVehicle({ orgId: ORG }),
  driver: createDriver({ orgId: ORG }),
  assignment: createAssignment({ orgId: ORG }),
  fine: createFine({ orgId: ORG }),
  odometer: createOdometerReading({ orgId: ORG }),
  service: createServiceRecord({ orgId: ORG }),
  document: createVehicleDocument({ orgId: ORG }),
  leaseCompany: createLeaseCompany({ orgId: ORG }),
  incident: createIncident({ orgId: ORG }),
};
for (const [name, e] of Object.entries(entities)) {
  ok(`${name}: יש orgId`, e.orgId === ORG);
  ok(`${name}: יש id ייחודי`, typeof e.id === "string" && e.id.length > 0);
}
ok("EMPTY מכיל מערך לכל תת-אוסף", ENTITY_COLLECTIONS.every((c) => Array.isArray(EMPTY[c])));
ok("scan נושא retentionClass", createFineScan({ orgId: ORG }).retentionClass === "fineScan");
// רק ישויות נושאות-PII נדרשות ל-retentionClass. Vehicle/ServiceRecord/
// LeaseCompany הם נתוני נכס ותפעול — אין להם שעון שמירה של מידע אישי.
const PII_ENTITIES = ["driver", "assignment", "fine", "odometer", "document", "incident"];
for (const name of PII_ENTITIES) {
  ok(`${name}: יש retentionClass מוכר`, Boolean(RETENTION_CLASSES[entities[name].retentionClass]));
}
ok("Vehicle הוא נתון נכס — בלי retentionClass", entities.vehicle.retentionClass === undefined);
ok("תקופות ה-retention טרם נקבעו (⚖️ עו\"ד)", Object.values(RETENTION_CLASSES).every((r) => r.months === null));

// ============================================================================
section("2. D7 — שדות אסורים: שכר, ניכוי, ת.ז., דנרמול שם, GPS");
// ============================================================================
const allEntities = {
  ...entities,
  vehiclePrivate: createVehiclePrivate("v1", { orgId: ORG }),
  finePrivate: createFinePrivate("f1", { orgId: ORG }),
  incidentPrivate: createIncidentPrivate("i1", { orgId: ORG }),
  fineScan: createFineScan({ orgId: ORG }),
};
for (const [name, e] of Object.entries(allEntities)) {
  const hits = FORBIDDEN_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(e, f));
  eq(`${name}: אין שדות אסורים (שכר/ת.ז./שם מדונרמל)`, hits, []);
}
ok("Driver: אין ת.ז. — ההסבה מתבצעת מחוץ למערכת", !("nationalId" in entities.driver));
ok("Fine: אין ניכוי משכר", !("deductedFromSalary" in entities.fine));

// ============================================================================
section("3. D1 — הפרדת שדות אדמין-בלבד ממסמכים שהנהג קורא");
// ============================================================================
ok("Vehicle: אין monthlyCost על המסמך הציבורי", !("monthlyCost" in entities.vehicle));
ok("VehiclePrivate: monthlyCost קיים כאן", "monthlyCost" in allEntities.vehiclePrivate);
ok("Fine: אין adminNotes על המסמך שהנהג קורא", !("adminNotes" in entities.fine));
ok("FinePrivate: adminNotes קיים כאן", "adminNotes" in allEntities.finePrivate);
ok("Incident: אין adminAssessment על מסמך הדיווח", !("adminAssessment" in entities.incident));
ok("IncidentPrivate: adminAssessment קיים כאן", "adminAssessment" in allEntities.incidentPrivate);
eq("Vehicle לא מדליף שדה אסור לנהג", leaksForbiddenField(entities.vehicle), []);
eq("Fine לא מדליף שדה אסור לנהג", leaksForbiddenField(entities.fine), []);
eq("projection של רכב לנהג — בלי monthlyCost", leaksForbiddenField(driverVehicleProjection(entities.vehicle)), []);
ok("האוספים האדמין-בלבד חסומים לנהג", adminOnlyCollectionsAreDenied());
for (const c of ADMIN_ONLY_COLLECTIONS) {
  ok(`${c}: לא ברשימת הקריאה של נהג`, DRIVER_DENIED_COLLECTIONS.includes(c));
}

// ============================================================================
section("4. D2 — סריקת קנס אינה מסמך רכב");
// ============================================================================
ok("DOCUMENT_TYPE כבר לא כולל fineScan", !DOCUMENT_TYPE.includes("fineScan"));
ok("fineScans הוא אוסף עצמאי", ENTITY_COLLECTIONS.includes("fineScans"));
eq(
  "נתיב Storage של סריקת קנס ממופתח בקנס",
  storagePath({ domain: STORAGE_DOMAINS.fine, orgId: ORG, fineId: "F9", docId: "F9", fileName: "a.pdf" }),
  "orgs/org1/fines/F9/F9_a.pdf"
);
eq(
  "נתיב צילום מד ממופתח בנהג",
  storagePath({ domain: STORAGE_DOMAINS.odometer, orgId: ORG, driverId: "D1", docId: "R1", fileName: "m.jpg" }),
  "orgs/org1/drivers/D1/odometer/R1_m.jpg"
);
eq(
  "נתיב מסמך רכב ממופתח ברכב",
  storagePath({ domain: STORAGE_DOMAINS.vehicleDoc, orgId: ORG, vehicleId: "V1", docId: "C1", fileName: "i.pdf" }),
  "orgs/org1/vehicles/V1/docs/C1_i.pdf"
);
eq("בלי מזהה — אין נתיב (לא נופלים לנתיב שטוח)", storagePath({ domain: STORAGE_DOMAINS.fine, orgId: ORG }), null);
ok("סוג קובץ לא נתמך נדחה", !isAcceptedType("application/zip"));
ok("קובץ גדול מדי במצב מקומי נדחה", !validateFile({ type: "image/jpeg", size: 3e6 }, { local: true }).ok);
ok("אותו קובץ מתקבל בענן", validateFile({ type: "image/jpeg", size: 3e6 }, { local: false }).ok);

// ============================================================================
section("5. driverAtDate — הלוגיקה שמצדיקה את האפליקציה");
// ============================================================================
// תרחיש: רכב V1. נהג A מ-1.1 עד 9.5. נהג B מ-10.5 ואילך (החלפה באותו יום).
const V1 = createVehicle({ orgId: ORG, plate: "11-111-11", status: "active" });
const V_POOL = createVehicle({ orgId: ORG, plate: "22-222-22", status: "pool" });
const DA = createDriver({ orgId: ORG, fullName: "אורית", userId: "uidA", portalStatus: "active" });
const DB = createDriver({ orgId: ORG, fullName: "בני", userId: "uidB", portalStatus: "active" });
const A1 = createAssignment({
  orgId: ORG, vehicleId: V1.id, driverId: DA.id, driverUid: "uidA",
  fromDate: "2026-01-01", toDate: "2026-05-10",
});
const A2 = createAssignment({
  orgId: ORG, vehicleId: V1.id, driverId: DB.id, driverUid: "uidB",
  fromDate: "2026-05-10", toDate: null,
});
const base = {
  ...EMPTY,
  vehicles: [V1, V_POOL],
  drivers: [DA, DB],
  assignments: [A1, A2],
};

eq("אמצע תקופת A", driverAtDate(base.assignments, V1.id, "2026-03-15"), DA.id);
eq("יום ראשון של A (גבול כולל)", driverAtDate(base.assignments, V1.id, "2026-01-01"), DA.id);
eq("אחרי תחילת B", driverAtDate(base.assignments, V1.id, "2026-06-01"), DB.id);
eq("החזקה פעילה (toDate=null) ממשיכה", driverAtDate(base.assignments, V1.id, "2027-01-01"), DB.id);
eq("לפני כל החזקה — אין נהג", driverAtDate(base.assignments, V1.id, "2025-12-31"), null);
eq("רכב אחר — אין נהג", driverAtDate(base.assignments, V_POOL.id, "2026-03-15"), null);
// החלפה באותו יום: שתי החזקות מכסות את 10.5 — נבחר הנהג הנכנס.
eq("החלפה באותו יום: שתי החזקות מכסות", assignmentsCovering(base.assignments, V1.id, "2026-05-10").length, 2);
eq("החלפה באותו יום: נבחר הנהג הנכנס", driverAtDate(base.assignments, V1.id, "2026-05-10"), DB.id);
eq("currentDriverId משתמש בהיום", currentDriverId(base.assignments, V1.id, "2026-06-01"), DB.id);
eq("הרכב של הנהג היום", currentVehicleIdForDriver(base.assignments, DB.id, "2026-06-01"), V1.id);
eq("תאריך לא תקין מחזיר null", driverAtDate(base.assignments, V1.id, "not-a-date"), null);

// ============================================================================
section("6. resolveDriverForFine — מקרי הקצה, כולל needsReview (D5)");
// ============================================================================
const rResolved = resolveDriverForFine(base, V1.id, "2026-03-15");
eq("שיוך ודאי: status", rResolved.status, "resolved");
eq("שיוך ודאי: הנהג", rResolved.driverId, DA.id);
eq("שיוך ודאי: נשמר מזהה ההחזקה לראיה", rResolved.assignmentId, A1.id);

const rAmb = resolveDriverForFine(base, V1.id, "2026-05-10");
eq("החלפה באותו יום: ambiguous", rAmb.status, "ambiguous");
eq("החלפה באותו יום: שני מועמדים מוצגים", rAmb.candidates.length, 2);
eq("החלפה באותו יום: ברירת מחדל = הנכנס", rAmb.driverId, DB.id);

const rNone = resolveDriverForFine(base, V1.id, "2025-06-01");
eq("אין החזקה: status", rNone.status, "none");
eq("אין החזקה: אין נהג", rNone.driverId, null);

const rPool = resolveDriverForFine(base, V_POOL.id, "2026-03-15");
eq("רכב מאגר בלי החזקה: status", rPool.status, "pool");
eq("רכב מאגר: אין שיוך אוטומטי", rPool.driverId, null);

eq("בלי רכב/תאריך: invalid", resolveDriverForFine(base, null, "2026-03-15").status, "invalid");
eq("תאריך לא תקין: invalid", resolveDriverForFine(base, V1.id, "13/5/2026").status, "invalid");

// D5 — החזקה שיובאה מטקסט חופשי לא מייצרת שיוך אוטומטי.
const AR = createAssignment({
  orgId: ORG, vehicleId: V_POOL.id, driverId: DA.id,
  fromDate: "2026-01-01", toDate: null,
  // שם בדוי בכוונה — שמות עובדים אמיתיים לא נכנסים לריפו (D3 / סעיף 5.5).
  needsReview: true, importRaw: "החל מ 28.4.2026 עבר לעובד חדש",
});
const withReview = { ...base, assignments: [...base.assignments, AR] };
const rReview = resolveDriverForFine(withReview, V_POOL.id, "2026-03-15");
eq("needsReview: status", rReview.status, "needsReview");
eq("needsReview: אין שיוך אוטומטי", rReview.driverId, null);
ok("needsReview: המועמד עדיין מוצג לאדמין", rReview.candidates.length === 1);

// ============================================================================
section("7. אימות החזקות — חפיפה, טווח הפוך, סגירה אוטומטית");
// ============================================================================
const overlapping = createAssignment({
  orgId: ORG, vehicleId: V1.id, driverId: DA.id, fromDate: "2026-02-01", toDate: "2026-04-01",
});
ok("חפיפה נתפסת", validateAssignment(base.assignments, overlapping).includes("assign.err.overlap"));
const reversed = createAssignment({
  orgId: ORG, vehicleId: V1.id, driverId: DA.id, fromDate: "2026-04-01", toDate: "2026-02-01",
});
ok("טווח הפוך נתפס", validateAssignment([], reversed).includes("assign.err.reversed"));
ok("בלי נהג נתפס", validateAssignment([], createAssignment({ vehicleId: V1.id, fromDate: "2026-01-01" })).includes("assign.err.noDriver"));
const closed = closeOpenAssignments([A2], V1.id, "2026-08-01");
eq("סגירה אוטומטית של החזקה פעילה", closed[0].toDate, prevDay("2026-08-01"));
eq("prevDay חוצה גבול חודש", prevDay("2026-08-01"), "2026-07-31");

// ============================================================================
section("8. D5 — שרשרת הראיות של השיוך (attribution)");
// ============================================================================
const autoFine = applyDerivedDriver(base, {
  ...createFine({ orgId: ORG, vehicleId: V1.id, violationDate: "2026-03-15", amount: 250 }),
});
eq("שיוך אוטומטי: הנהג נגזר", autoFine.driverId, DA.id);
eq("שיוך אוטומטי: source=auto", autoFine.attribution.source, "auto");
eq("שיוך אוטומטי: נשמר מזהה ההחזקה", autoFine.attribution.assignmentId, A1.id);
eq("שיוך אוטומטי: נשמר סטטוס הגזירה", autoFine.attribution.resolvedStatus, "resolved");
ok("שיוך אוטומטי: יש חותמת זמן", Boolean(autoFine.attribution.resolvedAt));
eq("D3 — ה-uid מדונרמל מהנהג", autoFine.driverUid, "uidA");
ok("D3 — השם לא מדונרמל על הקנס", !("driverFullName" in autoFine));

const manualFine = applyDerivedDriver(
  base,
  {
    ...autoFine,
    driverId: DB.id,
    attribution: { ...autoFine.attribution, source: "manual", reason: "הנהג אישר שהעביר את הרכב לעמית" },
  },
  { actor: "admin-uid" }
);
eq("עקיפה ידנית: הנהג שנבחר", manualFine.driverId, DB.id);
eq("עקיפה ידנית: source=manual", manualFine.attribution.source, "manual");
eq("עקיפה ידנית: נרשם מי עקף", manualFine.attribution.overriddenBy, "admin-uid");
ok("עקיפה ידנית: נרשמה חותמת עקיפה", Boolean(manualFine.attribution.overriddenAt));
eq("עקיפה ידנית: נשמר מה שהמערכת גזרה", manualFine.attribution.previousDriverId, DA.id);
eq("עקיפה ידנית: הנימוק נשמר", manualFine.attribution.reason, "הנהג אישר שהעביר את הרכב לעמית");
eq("עקיפה ידנית: ה-uid התעדכן לנהג החדש", manualFine.driverUid, "uidB");

ok(
  "עקיפה בלי נימוק נדחית",
  validateFine({ ...manualFine, attribution: { ...manualFine.attribution, reason: "" } }).includes(
    "fine.err.noOverrideReason"
  )
);
ok("קנס בלי סכום נדחה", validateFine({ ...autoFine, amount: 0 }).includes("fine.err.noAmount"));
ok("קנס בלי תאריך עבירה נדחה", validateFine({ ...autoFine, violationDate: null }).includes("fine.err.noDate"));
eq("קנס תקין עובר אימות", validateFine(autoFine), []);
const attrFresh = buildAttribution({ derivation: rResolved, manual: false, previous: null });
eq("buildAttribution אוטומטי לא ממציא overriddenBy", attrFresh.overriddenBy, null);
ok("emptyAttribution הוא ברירת מחדל תקינה", emptyAttribution().source === "auto");

// ============================================================================
section("9. D5 — state machine של הקנס, כולל disputed");
// ============================================================================
ok("received → notified_driver מותר", canTransition("received", "notified_driver"));
ok("received → transferred **חסום** (אין דילוג על יידוע)", !canTransition("received", "transferred"));
ok("notified_driver → disputed מותר", canTransition("notified_driver", "disputed"));
ok("disputed → transferred מותר (אחרי בירור)", canTransition("disputed", "transferred"));
ok("disputed → cancelled מותר", canTransition("disputed", "cancelled"));
ok("transferred → paid מותר", canTransition("transferred", "paid"));
ok("paid הוא מצב סופי", !canTransition("paid", "transferred"));
ok("cancelled הוא מצב סופי", !canTransition("cancelled", "paid"));
ok("disputed קיים ב-enum", FINE_STATUS.includes("disputed"));
ok("notified_driver קיים ב-enum", FINE_STATUS.includes("notified_driver"));
ok(
  "אימות חוסם הסבה לפני יידוע",
  validateFine({ ...autoFine, status: "transferred", notifiedDriverAt: null }).includes(
    "fine.err.transferBeforeNotice"
  )
);
eq(
  "הסבה אחרי יידוע עוברת",
  validateFine({ ...autoFine, status: "transferred", notifiedDriverAt: "2026-04-01T10:00:00Z" }),
  []
);
ok("קנס שהתקבל נחשב פתוח", isFineOpen({ status: "received" }));
ok("קנס במחלוקת נחשב טרם-הוסב", isAwaitingTransfer({ status: "disputed" }));
ok("קנס ששולם אינו פתוח", !isFineOpen({ status: "paid" }));
ok("קנס שבוטל אינו פתוח", !isFineOpen({ status: "cancelled" }));
eq("סכימת קנסות", totalAmount([{ amount: 100 }, { amount: 250 }]), 350);

// ============================================================================
section("10. חריגת ק\"מ מול המכסה השנתית");
// ============================================================================
const VK = createVehicle({
  orgId: ORG, plate: "33-333-33",
  contractStart: "2026-01-01", contractEnd: "2027-01-01",
  annualKmAllowance: 36500, startKm: 0,
});
// 100 ק"מ ליום מותר. אחרי 100 יום מותר 10,000.
const readOn = (date, km) => createOdometerReading({ orgId: ORG, vehicleId: VK.id, date, km });
const kmOk = kmStatus(VK, [readOn("2026-04-11", 9000)], "2026-04-11");
eq("בתוך המכסה", kmOk.status, "ok");
eq("מותר-עד-היום מחושב יחסית", Math.round(kmOk.allowedToDate), 10000);
eq("בפועל-עד-היום", kmOk.actualToDate, 9000);

const kmOver = kmStatus(VK, [readOn("2026-04-11", 13000)], "2026-04-11");
eq("חריגה מזוהה", kmOver.status, "over");
eq("גודל החריגה", Math.round(kmOver.deltaKm), 3000);

const kmWarn = kmStatus(VK, [readOn("2026-04-11", 9800)], "2026-04-11");
eq("אזהרה ב-98% מהמכסה", kmWarn.status, "warning");

eq("בלי קריאות — unknown", kmStatus(VK, [], "2026-04-11").status, "unknown");
eq(
  "בלי מכסה — unknown",
  kmStatus({ ...VK, annualKmAllowance: 0 }, [readOn("2026-04-11", 9000)], "2026-04-11").status,
  "unknown"
);
eq(
  "בלי תאריך תחילת חוזה — unknown",
  kmStatus({ ...VK, contractStart: null }, [readOn("2026-04-11", 9000)], "2026-04-11").status,
  "unknown"
);

// extrapolation: שתי קריאות → קצב יומי → תחזית לסוף החוזה
const kmProj = kmStatus(VK, [readOn("2026-01-31", 3000), readOn("2026-03-02", 6000)], "2026-03-02");
eq("קצב יומי מחושב משתי קריאות", Math.round(kmProj.kmPerDay), 100);
ok("יש תחזית לסוף החוזה", kmProj.projectedAtContractEnd > 0);
eq("תחזית לסוף חוזה בקצב 100/יום", Math.round(kmProj.projectedAtContractEnd), 36500);
ok("אין חריגה צפויה בקצב המכסה", Math.abs(kmProj.projectedOverage) < 200);

// startKm — רכב שנכנס לחוזה לא-חדש
const VUsed = { ...VK, startKm: 50000 };
eq("startKm מקוזז מהחישוב", kmStatus(VUsed, [readOn("2026-04-11", 59000)], "2026-04-11").actualToDate, 9000);

eq("currentKm = הקריאה האחרונה", currentKm([readOn("2026-01-01", 100), readOn("2026-02-01", 900)], VK.id), 900);
eq("קריאות ממוינות לפי תאריך", readingsForVehicle([readOn("2026-02-01", 900), readOn("2026-01-01", 100)], VK.id)[0].km, 100);

// טיפול הבא
const srv = createServiceRecord({
  orgId: ORG, vehicleId: VK.id, date: "2026-01-05", km: 1000, nextServiceKm: 16000, nextServiceDate: "2026-07-05",
});
eq("טיפול לפי ק\"מ מגיע", serviceDue(VK, [srv], [readOn("2026-04-11", 15500)], "2026-02-01").reason, "km");
eq("טיפול לא מגיע עדיין", serviceDue(VK, [srv], [readOn("2026-02-01", 5000)], "2026-02-01").due, false);

// ============================================================================
section("11. בידוד — סריקת קנס לא נקראת דרך הרכב (הדליפה שעדי תפסה)");
// ============================================================================
// V1 הוחזק ע"י A ואז ע"י B. לקנס של A מצורפת סריקה. B הוא המחזיק הנוכחי.
const fineOfA = createFine({
  orgId: ORG, vehicleId: V1.id, driverId: DA.id, driverUid: "uidA",
  violationDate: "2026-03-15", amount: 500, status: "received",
});
const scanOfA = createFineScan({
  orgId: ORG, fineId: fineOfA.id, driverId: DA.id, driverUid: "uidA",
  fileRef: "orgs/org1/fines/F/scan.pdf", storageMode: "storage",
});
const insuranceDoc = createVehicleDocument({
  orgId: ORG, vehicleId: V1.id, type: "insurance", validUntil: "2026-12-31",
});
const iso = { ...base, fines: [fineOfA], fineScans: [scanOfA], documents: [insuranceDoc] };
const TODAY_ISO = "2026-06-01"; // B הוא המחזיק

eq("הנהג מזוהה לפי uid בלבד", driverForUid(iso, "uidB")?.id, DB.id);
eq("uid לא מוכר → אין נהג", driverForUid(iso, "uidX"), null);
ok("A קורא את הקנס שלו", driverCanReadFine(iso, fineOfA, "uidA"));
ok("B **לא** קורא את הקנס של A", !driverCanReadFine(iso, fineOfA, "uidB"));
ok("A קורא את סריקת הקנס שלו", driverCanReadFineScan(iso, scanOfA, "uidA"));
ok("B **לא** קורא את סריקת הקנס של A — למרות שהוא מחזיק את הרכב", !driverCanReadFineScan(iso, scanOfA, "uidB"));
ok("B כן קורא את ביטוח הרכב שהוא מחזיק", driverCanReadVehicleDocument(iso, insuranceDoc, "uidB", TODAY_ISO));
ok("A כבר לא קורא את מסמכי הרכב (החזקתו הסתיימה)", !driverCanReadVehicleDocument(iso, insuranceDoc, "uidA", TODAY_ISO));
ok("סריקה אינה מופיעה באוסף מסמכי הרכב", !iso.documents.some((d) => d.type === "fineScan"));
eq("scanForFine מאתר לפי הקנס", scanForFine(iso, fineOfA.id)?.id, scanOfA.id);
// נהג שגישתו בוטלה (F1) — לא קורא כלום
const revoked = { ...iso, drivers: [{ ...DA, portalStatus: "revoked" }, DB] };
ok("נהג עם portalStatus=revoked לא קורא את הקנס שלו", !driverCanReadFine(revoked, fineOfA, "uidA"));

// ============================================================================
section("12. D1 — העלות החודשית והערות האדמין לא נמצאות במסמך הנהג");
// ============================================================================
const vp = createVehiclePrivate(V1.id, { orgId: ORG, monthlyCost: 2400 });
const fp = createFinePrivate(fineOfA.id, { orgId: ORG, adminNotes: "נהג חוזר" });
const priv = { ...iso, vehiclesPrivate: [vp], finesPrivate: [fp] };
eq("monthlyCostOf קורא מהמסמך הפרטי", monthlyCostOf(priv, V1.id), 2400);
eq("רכב בלי מסמך פרטי → 0", monthlyCostOf(priv, V_POOL.id), 0);
eq("adminNotesOf קורא מהמסמך הפרטי", adminNotesOf(priv, fineOfA.id), "נהג חוזר");
ok("מסמך הרכב עצמו עדיין נקי", !("monthlyCost" in priv.vehicles[0]));
eq("projection לנהג לא כולל שדות מסחריים", driverVehicleProjection(priv.vehicles[0]).monthlyCost, undefined);

// ============================================================================
section("13. D6 — ארכוב ואנונימיזציה (לא מחיקה), כולל Storage");
// ============================================================================
const readingWithPhoto = createOdometerReading({
  orgId: ORG, vehicleId: V1.id, driverId: DA.id, driverUid: "uidA", date: "2026-03-01", km: 5000,
  photoRef: "orgs/org1/drivers/D/odometer/p.jpg", photoStorageMode: "storage",
});
const incidentWithPhoto = createIncident({
  orgId: ORG, vehicleId: V1.id, driverId: DA.id, driverUid: "uidA",
  photos: [{ fileRef: "orgs/org1/drivers/D/incidents/i.jpg", storageMode: "storage" }],
});
const retData = {
  ...priv,
  odometerReadings: [readingWithPhoto],
  incidents: [incidentWithPhoto],
  assignments: [A1, { ...A2, driverId: DA.id, driverUid: "uidA", toDate: null }],
};

const archived = archiveDriver(retData, DA.id, "2026-06-01");
eq("ארכוב: הסטטוס", archived.drivers.find((d) => d.id === DA.id).status, "archived");
eq("ארכוב: הפורטל מבוטל", archived.drivers.find((d) => d.id === DA.id).portalStatus, "revoked");
eq("ארכוב: ה-uid מנותק", archived.drivers.find((d) => d.id === DA.id).userId, null);
eq("ארכוב: החזקה פתוחה נסגרה", archived.assignments.find((a) => a.driverId === DA.id && !a.toDate), undefined);
ok("ארכוב: השם עדיין קיים (עוד לא retention)", archived.drivers.find((d) => d.id === DA.id).fullName === "אורית");

eq("איסוף נתיבי Storage של נהג", collectDriverStoragePaths(retData, DA.id).length, 2);
const { data: anon, storagePaths } = anonymizeDriver(retData, DA.id);
const anonDriver = anon.drivers.find((d) => d.id === DA.id);
ok("אנונימיזציה: השם הוחלף בטוקן", parseAnonymizedName(anonDriver.fullName) !== null);
eq("אנונימיזציה: טלפון נוקה", anonDriver.phone, "");
eq("אנונימיזציה: מייל נוקה", anonDriver.email, "");
eq("אנונימיזציה: מס' עובד נוקה", anonDriver.employeeNumber, "");
ok("אנונימיזציה: יש חותמת", Boolean(anonDriver.anonymizedAt));
eq("אנונימיזציה: הקנס לא נמחק", anon.fines.length, 1);
eq("אנונימיזציה: ההחזקות לא נמחקו", anon.assignments.length, 2);
eq("אנונימיזציה: driverId נשאר (פסאודונימי)", anon.fines[0].driverId, DA.id);
eq("אנונימיזציה: driverUid נותק מהקנס", anon.fines[0].driverUid, null);
eq("אנונימיזציה: driverUid נותק מהסריקה", anon.fineScans[0].driverUid, null);
eq("אנונימיזציה: צילום המד הוסר", anon.odometerReadings[0].photoRef, null);
eq("אנונימיזציה: צילומי התקלה הוסרו", anon.incidents[0].photos.length, 0);
eq("אנונימיזציה: הוחזרו נתיבי Storage למחיקה", storagePaths.length, 2);
ok("D6 — המחיקה כוללת Storage ולא רק מטא-דאטה", storagePaths.every((p) => p.startsWith("orgs/")));
eq("טוקן דטרמיניסטי", anonymizationToken(DA.id), anonymizationToken(DA.id));
ok("שם מאונן מוצג דרך i18n", driverName(anon.drivers, DA.id, "—", (k) => translate("he", k)).includes("#"));
ok("archived אינו סטטוס נהג חוקי בלבד-לקריאה", DRIVER_STATUS.includes("archived"));

// ============================================================================
section("14. Cascade — אין רשומות יתומות, כולל המסמכים הפרטיים");
// ============================================================================
const casc = removeVehicleCascade(priv, V1.id);
eq("מחיקת רכב: הרכב ירד", casc.vehicles.length, 1);
eq("מחיקת רכב: המסמך הפרטי ירד", casc.vehiclesPrivate.length, 0);
eq("מחיקת רכב: ההחזקות ירדו", casc.assignments.length, 0);
eq("מחיקת רכב: הקנסות ירדו", casc.fines.length, 0);
eq("מחיקת רכב: הקנס-הפרטי ירד", casc.finesPrivate.length, 0);
eq("מחיקת רכב: הסריקות ירדו", casc.fineScans.length, 0);
eq("מחיקת רכב: המסמכים ירדו", casc.documents.length, 0);
eq("איסוף נתיבי Storage של רכב", collectVehicleStoragePaths(priv, V1.id).length, 1);
const cascFine = removeFineCascade(priv, fineOfA.id);
eq("מחיקת קנס: הסריקה ירדה איתו", cascFine.fineScans.length, 0);
eq("מחיקת קנס: המסמך הפרטי ירד איתו", cascFine.finesPrivate.length, 0);
const lc = createLeaseCompany({ orgId: ORG, name: "פריים ליס" });
const withLc = { ...priv, leaseCompanies: [lc], vehicles: [{ ...V1, leaseCompanyId: lc.id }] };
eq("מחיקת חברת ליסינג מנתקת ולא מוחקת רכב", removeLeaseCompanyDetach(withLc, lc.id).vehicles.length, 1);
eq("מחיקת חברת ליסינג מנקה את הקישור", removeLeaseCompanyDetach(withLc, lc.id).vehicles[0].leaseCompanyId, null);

// ============================================================================
section("15. דשבורד — תשע קבוצות ההתראות");
// ============================================================================
// שים לב: ה-factories מייצרים id בעצמם — לוקחים אותו מהאובייקט, לא ממציאים.
const vA = createVehicle({ orgId: ORG, plate: "1", status: "active", contractEnd: "2026-07-01" });
const vB = createVehicle({ orgId: ORG, plate: "2", status: "active" });
const dashData = {
  ...EMPTY,
  vehicles: [vA, vB],
  drivers: [DA],
  assignments: [
    createAssignment({ orgId: ORG, vehicleId: vA.id, driverId: DA.id, fromDate: "2026-01-01" }),
  ],
  fines: [
    createFine({ orgId: ORG, vehicleId: vA.id, driverId: DA.id, violationDate: "2026-05-01", amount: 300, status: "received", dueDate: "2026-06-05" }),
  ],
  documents: [
    createVehicleDocument({ orgId: ORG, vehicleId: vA.id, type: "insurance", validUntil: "2026-06-10" }),
  ],
};
const al = computeAlerts(dashData, "2026-06-01", EMPTY.settings);
ok("קיימות תשע קבוצות התראה", ALERT_GROUPS.length === 9);
// M4 — הקבוצה החדשה: העובד בדאטה הזה לא קיבל יידוע, ויש עליו קנס → danger.
eq("נהג ללא יידוע מופיע בהתראות", al.groups.driversWithoutNotice.length, 1);
eq("ועם קנס משויך הוא חוסם בפועל", al.groups.driversWithoutNotice[0].severity, "danger");
eq("עם ספירת הקנסות שלו", al.groups.driversWithoutNotice[0].fineCount, 1);
eq("אין החזקות שממתינות לאימות בדאטה הזה", al.groups.assignmentsNeedingReview.length, 0);
eq("חוזה שנגמר בתוך 90 יום", al.groups.contractEnding.length, 1);
eq("קנס שטרם הוסב", al.groups.finesAwaitingTransfer.length, 1);
eq("קנס שמועד התשלום מתקרב", al.groups.finesDueSoon.length, 1);
eq("רכב ללא נהג", al.groups.vehiclesWithoutDriver.length, 1);
eq("ביטוח שפג בקרוב", al.groups.documentsExpiring.length, 1);
ok("סה\"כ התראות נספר", al.total >= 5);
const clean = computeAlerts({ ...EMPTY, vehicles: [] }, "2026-06-01", EMPTY.settings);
eq("ארגון ריק — אין התראות", clean.total, 0);

// ============================================================================
section("16. תאריכים");
// ============================================================================
ok("todayIso בפורמט יום", isDay(todayIso()));
eq("הפרש ימים", daysBetween("2026-01-01", "2026-01-31"), 30);
eq("הפרש חוצה שנה", daysBetween("2025-12-31", "2026-01-01"), 1);
ok("inRange כולל את קצה ההתחלה", inRange("2026-01-01", "2026-01-01", "2026-02-01"));
ok("inRange כולל את קצה הסיום", inRange("2026-02-01", "2026-01-01", "2026-02-01"));
ok("inRange פתוח כש-toDate ריק", inRange("2030-01-01", "2026-01-01", null));
ok("inRange שולל מחוץ לטווח", !inRange("2025-12-31", "2026-01-01", null));

// ============================================================================
section("17. i18n — parity מלא he/en, בלי מפתחות חסרים");
// ============================================================================
const heKeys = Object.keys(dict.he).sort();
const enKeys = Object.keys(dict.en).sort();
const missingEn = heKeys.filter((k) => !dict.en[k]);
const missingHe = enKeys.filter((k) => !dict.he[k]);
eq("כל מפתח עברי קיים גם באנגלית", missingEn, []);
eq("כל מפתח אנגלי קיים גם בעברית", missingHe, []);
eq("שתי שפות מוגדרות", LANGS, ["he", "en"]);
ok("אין ערכים ריקים", heKeys.every((k) => String(dict.he[k]).length > 0));
eq("החלפת משתנים עובדת", translate("he", "onb.step", { n: 2, total: 3 }), "שלב 2 מתוך 3");
eq("מפתח חסר מוחזר כפי שהוא (fail-visible)", translate("he", "no.such.key"), "no.such.key");
// כל ערך enum חייב מפתח תרגום בשתי השפות
for (const s of FINE_STATUS) {
  ok(`תרגום לסטטוס קנס ${s} (he)`, Boolean(dict.he[`fine.status.${s}`]));
  ok(`תרגום לסטטוס קנס ${s} (en)`, Boolean(dict.en[`fine.status.${s}`]));
}
for (const s of DRIVER_STATUS) {
  ok(`תרגום לסטטוס נהג ${s} (he)`, Boolean(dict.he[`driver.status.${s}`]));
}
for (const s of DOCUMENT_TYPE) {
  ok(`תרגום לסוג מסמך ${s} (he)`, Boolean(dict.he[`doc.type.${s}`]));
}
for (const g of ALERT_GROUPS) {
  ok(`תרגום לקבוצת התראה ${g} (he)`, Boolean(dict.he[`dash.${g}`]));
  ok(`תרגום לתיאור קבוצה ${g} (he)`, Boolean(dict.he[`dash.${g}.desc`]));
  ok(`תרגום לקבוצת התראה ${g} (en)`, Boolean(dict.en[`dash.${g}`]));
}

// ============================================================================
section("18. בדיקה סטטית — שמות אוספים שבשימוש בקוד קיימים באמת");
// ============================================================================
// upsert("...")/remove("...") עם שם שגוי נכשל רק בזמן ריצה. סורקים את המקור.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.jsx?$/.test(f) ? [p] : [];
  });
}
const sources = walk(SRC);
ok("נסרקו קבצי מקור", sources.length > 30);

// מסירים הערות לפני הסריקה — אחרת "אין navigator.geolocation" בהערה נספר כהפרה.
const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const used = new Set();
let geolocationHits = [];
for (const file of sources) {
  const code = stripComments(readFileSync(file, "utf8"));
  for (const m of code.matchAll(/\b(?:upsert|remove)\(\s*"([a-zA-Z]+)"/g)) used.add(m[1]);
  if (/navigator\s*\.\s*geolocation/.test(code)) geolocationHits.push(file);
}
for (const c of used) {
  ok(`אוסף "${c}" שבשימוש קיים ב-ENTITY_COLLECTIONS`, ENTITY_COLLECTIONS.includes(c));
}
eq("D4 — אין navigator.geolocation בקוד", geolocationHits, []);

// D7 — אף שדה אסור לא הוחזר בדלת אחורית. constants.js מוחרג: הוא **מצהיר**
// על רשימת האיסור (FORBIDDEN_FIELDS), ולכן מכיל את השמות מעצם תפקידו.
const forbiddenInUi = [];
for (const file of sources) {
  if (file.endsWith("constants.js")) continue;
  const code = stripComments(readFileSync(file, "utf8"));
  for (const f of ["deductedFromSalary", "salaryDeduction", "nationalId", "driverLicenseScan"]) {
    if (code.includes(f)) forbiddenInUi.push(`${f} @ ${file.split(/[\\/]/).pop()}`);
  }
}
eq("D7 — אין שדות שכר/ת.ז. בקוד המקור", forbiddenInUi, []);

// ============================================================================
section("19. מסך 6 — ייבוא מהאקסל: המרות, דחיות, וזיהוי טקסט חופשי");
// ============================================================================
// הפיקסטורה מדמה את **המבנה** של הקובץ האמיתי (`רכבים 20.7.2026.xlsx`,
// גיליון `20.7.26`) תא-בתא: כותרת בשורה 1, זבל בשורות 2-3, 36 רכבים בשורות
// 4-39, ושורת אנשי קשר של הספק בשורה 40 — אבל עם **שמות בדויים**.
// הנתונים האמיתיים הם 36 עובדים אמיתיים; הם לא נכנסים לריפו (עדי, D3/5.5).
// אימות מול הקובץ האמיתי: `node scripts/import-check.mjs "<path>"`.

const N = (v) => v; // קריאוּת: תא מספרי
const D = (iso) => new Date(`${iso}T00:00:00.000Z`); // תא תאריך כפי שהספרייה מחזירה

// 27 שורות "נקיות" — שמות של עד 3 מילים, בלי ספרות ובלי מילות-הקשר.
const CLEAN_NAMES = [
  "כהן - לוי", // שם משפחה מקוף: חייב להיספר כשתי מילים, לא שלוש
  "אורית בן דוד",
  "יניר שפירא",
  "רונית מזרחי",
  "דנה ברק", "עופר שגיא", "רחלי נאור", "טל אבידן", "שירן קדם", "אמיר גלעד",
  "נועה שחר", "יובל ארז", "מיכל אשד", "רון פלד", "ליאת אדרי", "גיא נבון",
  "הילה ברנע", "אסף רימון", "מאיה כרמי", "עידו שני", "תמר אלון", "ניר עומר",
  "שני להב", "בר אשכנזי", "עמית רוזן", "יעל שוהם", "דור מלכה",
];

// 9 שורות טקסט חופשי — אותם **דפוסים** בדיוק כמו בקובץ האמיתי.
// (שורה 25 בקובץ האמיתי = רכב מאגר.)
const FREE_TEXT = {
  7: "החל מ 28.4.2026 עבר לעובד חדש",
  10: "פלונית אלמונית החל מ 11.1.2026 (קודמת לשעבר)",
  14: "עובד אחזקה באתר החל 6.5.26",
  15: "החל מתאריך 17.6.2026 אצל עובד אחר",
  19: "אצל מזכירה החל מ 8.2.2026",
  21: "עבור קבלן משנה אחזקות",
  22: "אלמוני 2.2.26",
  25: "רכב מסתובב - חברה אצל רכזת", // → pool
  26: "פלוני אלמוני - אחים קבלן", // 4 מילים: שם או חברה? לא מנחשים
};

const HEADER_ROW = ["מסד", "מס' רישוי", "דגם", "שם נהג", "חברת ליסינג", "תאריך תחילת הסכם", "תאריך סיום הסכם", "עלות חודשית"];

function buildFixture() {
  const rows = [];
  rows[0] = HEADER_ROW;
  // שורה 2: תא יתום בעמודת העלות. שורה 3: תא יתום בעמודה J.
  rows[1] = [null, null, null, null, null, null, null, N(2347)];
  rows[2] = [null, null, null, null, null, null, null, null, null, "30.12.25"];

  let cleanIdx = 0;
  for (let i = 1; i <= 36; i++) {
    const rowNumber = i + 3; // 4..39
    const free = FREE_TEXT[rowNumber];
    const driver = free ?? CLEAN_NAMES[cleanIdx++];
    // שלושה כתיבים של אותה חברה — חייבים להתמזג לרשומה אחת.
    const lease = rowNumber === 20 ? "פרים ליס" : rowNumber === 30 ? "פריים ליס " : "פריים ליס";
    // חצי מהשורות עם serial מספרי, חצי עם Date — שני מסלולי ההמרה נבדקים.
    const useSerial = rowNumber % 2 === 0;
    const start = useSerial ? N(45621) : D("2024-11-25");
    const end = useSerial ? N(46716) : D("2027-11-25");

    let cost = null;
    if (rowNumber === 8) cost = "052-1234567"; // טלפון בעמודת עלות
    else if (rowNumber === 19) cost = D("2028-05-26"); // serial תאריך (46899)
    else if (rowNumber === 11) cost = N(2770);
    else if (rowNumber === 13) cost = N(2750);
    else if (rowNumber === 16) cost = N(1800);
    else if (rowNumber === 24) cost = N(120000); // מחוץ לטווח סביר

    rows[rowNumber - 1] = [
      N(i),
      N(25324400 + i), // לוחית כמספר, כמו בקובץ האמיתי
      `דגם ${i}`,
      driver,
      lease,
      start,
      end,
      cost,
    ];
  }

  // שורה 40 — אנשי הקשר של הספק. לא רכב, אבל מזין את LeaseCompany.
  rows[39] = [
    null, "פריים ליס", "עמית", "052-3866645", null, "amitro@primelease.co.il", "איש קשר נוסף 052-7306374", null,
  ];
  return rows;
}

const FIX = buildFixture();
eq("הפיקסטורה: 40 שורות כמו בקובץ האמיתי", FIX.length, 40);

// -- המרת serial של אקסל --
eq("serial → תאריך (epoch 1899-12-30)", excelSerialToIso(45621), "2024-11-25");
eq("serial → תאריך, סוף חוזה", excelSerialToIso(46716), "2027-11-25");
eq("serial 46899 הוא תאריך, לא סכום", excelSerialToIso(46899), "2028-05-26");
eq("serial לא חוקי → null", excelSerialToIso(0), null);
eq("לא-מספר → null", excelSerialToIso("abc"), null);
eq("תא Date מומר ליום", parseDateCell(new Date("2026-05-27T00:00:00Z")).iso, "2026-05-27");
eq("תא serial מומר ליום", parseDateCell(45621).iso, "2024-11-25");
eq('מחרוזת "6.5.26" מומרת', parseDateCell("6.5.26").iso, "2026-05-06");
eq('מחרוזת "17.6.2026" מומרת', parseDateCell("17.6.2026").iso, "2026-06-17");
eq("תא ריק אינו שגיאה", parseDateCell(null).empty, true);
eq("טקסט שאינו תאריך מסומן", parseDateCell("בקרוב").reasonKey, "importx.reason.badDate");

// -- עמודת העלות המזוהמת --
eq("עלות תקינה מתקבלת", parseMonthlyCost(2770).value, 2770);
ok("טלפון בעמודת עלות נדחה", !parseMonthlyCost("052-7954426").ok);
eq("סיבת הדחייה: טלפון", parseMonthlyCost("052-7954426").reasonKey, "importx.reason.costIsPhone");
ok("serial תאריך בעמודת עלות נדחה", !parseMonthlyCost(46899).ok);
eq("סיבת הדחייה: תאריך", parseMonthlyCost(46899).reasonKey, "importx.reason.costIsDate");
eq("תא Date בעמודת עלות נדחה כתאריך", parseMonthlyCost(D("2028-05-26")).reasonKey, "importx.reason.costIsDate");
eq("סכום נמוך מדי נדחה", parseMonthlyCost(12).reasonKey, "importx.reason.costOutOfRange");
eq("סכום גבוה מדי נדחה", parseMonthlyCost(120000).reasonKey, "importx.reason.costOutOfRange");
ok("תא ריק אינו נחשב דחייה", parseMonthlyCost(null).ok && parseMonthlyCost(null).empty);
eq('מחרוזת מספרית "2750" מתקבלת', parseMonthlyCost("2750").value, 2750);
eq("הערך המקורי נשמר לתצוגה", parseMonthlyCost("052-7954426").raw, "052-7954426");

// -- ההיוריסטיקה של עמודת "שם נהג" --
eq("שם רגיל", classifyDriverCell("אורית בן דוד").kind, "name");
eq("שם עם מקף נספר כשתי מילים", classifyDriverCell("כהן - לוי").kind, "name");
eq("תא ריק", classifyDriverCell("").kind, "empty");
for (const [row, text] of Object.entries(FREE_TEXT)) {
  const c = classifyDriverCell(text);
  ok(`שורה ${row}: זוהה כטקסט חופשי`, c.kind === "freeText");
  ok(`שורה ${row}: יש סיבה מוצגת`, c.reasons.length > 0);
  ok(`שורה ${row}: לא נגזר ממנה שם נהג`, c.name === null);
}
for (const n of CLEAN_NAMES) {
  ok(`שם נקי לא סומן בטעות: ${n}`, classifyDriverCell(n).kind === "name");
}
ok("רכב מסתובב מזוהה כרכב מאגר", classifyDriverCell(FREE_TEXT[25]).isPool);
ok("שם רגיל אינו רכב מאגר", !classifyDriverCell("דנה ברק").isPool);
eq("ארבע מילים = לא שם", classifyDriverCell("פלוני אלמוני - אחים קבלן").reasons.includes("importx.reason.tooManyWords"), true);

// -- נרמול מפתחות --
eq("שני כתיבים של חברת הליסינג = אותו מפתח", leaseKey("פריים ליס"), leaseKey("פרים ליס"));
eq("רווח עודף לא מפצל", leaseKey("פריים ליס "), leaseKey("פריים ליס"));
ok("חברה אחרת נשארת נפרדת", leaseKey("אלבר") !== leaseKey("פריים ליס"));
eq("לוחית עם מקפים = אותה לוחית", plateKey("25-324-403"), plateKey("25324403"));

// -- הניתוח המלא של הגיליון --
const IMPORT_META = { fileName: "fixture.xlsx", sheet: "20.7.26" };
const plan = analyzeImport(FIX, EMPTY, IMPORT_META);
ok("הניתוח הצליח", plan.ok);
eq("שורת הכותרת אותרה", plan.header.rowNumber, 1);
eq("עמודת הלוחית מופתה לפי התווית", plan.header.columns.plate, 1);
eq("עמודת העלות מופתה לפי התווית", plan.header.columns.monthlyCost, 7);
eq("כל העמודות נמצאו", plan.missingCols, []);

eq("36 רכבים בדיוק", plan.counts.vehiclesToCreate, 36);
eq("36 שורות נתונים (2-3 ו-40 אינן נתונים)", plan.counts.dataRows, 36);
eq("27 נהגים ייווצרו (36 פחות 9 לבדיקה)", plan.counts.driversToCreate, 27);
eq("36 החזקות ייווצרו", plan.counts.assignmentsToCreate, 36);
eq("9 שורות סומנו לבדיקה ידנית", plan.counts.needsReview, 9);
eq("רכב מאגר אחד", plan.counts.poolVehicles, 1);
eq("חברת ליסינג אחת אחרי נרמול", plan.counts.leaseCompaniesToCreate, 1);
// שלושה כתיבים בקובץ; "פריים ליס " מנורמל כבר בקריאת התא, ולכן נותרים שני
// וריאנטים **שונים באמת** להצגה — וכולם מצביעים על אותה חברה.
eq("שני כתיבים שונים באמת מוצגים למשתמש", plan.leaseCompanies[0].variants.length, 2);
eq("וכל 36 השורות מצביעות על אותה חברה", plan.leaseCompanies[0].rows.length, 36);
eq("כל 36 ההחזקות מסומנות כתאריך משוער", plan.counts.inferredFromDates, 36);

// שורות 2-3 זבל, שורה 40 אנשי קשר — שלוש שורות שאינן רכב.
eq("3 שורות דולגו", plan.counts.skippedRows, 3);
eq("שורה 2 דולגה כזבל", plan.skipped.find((s) => s.rowNumber === 2)?.reasonKey, "importx.reason.junkRow");
eq("שורה 3 דולגה כזבל", plan.skipped.find((s) => s.rowNumber === 3)?.reasonKey, "importx.reason.junkRow");
eq("שורה 40 סווגה כשורת אנשי קשר", plan.skipped.find((s) => s.rowNumber === 40)?.reasonKey, "importx.reason.contactRow");
ok("שורה 40 **לא** יובאה כרכב", !plan.rows.some((r) => r.rowNumber === 40));
eq("שורות הרכב מתחילות ב-4", plan.rows[0].rowNumber, 4);
eq("שורות הרכב נגמרות ב-39", plan.rows[plan.rows.length - 1].rowNumber, 39);

// פרטי הספק חולצו משורה 40 → LeaseCompany
const lc0 = plan.leaseCompanies[0];
eq("איש הקשר של הספק חולץ", lc0.contact.contactName, "עמית");
eq("טלפון הספק חולץ", lc0.contact.phone, "052-3866645");
eq("מייל הספק חולץ", lc0.contact.email, "amitro@primelease.co.il");
ok("איש הקשר הנוסף נשמר בהערות", lc0.contact.notes.includes("052-7306374"));

// ערכים שנדחו — בדיוק שניים, עם הערך המקורי והסיבה
eq("3 ערכי עלות נדחו (טלפון, תאריך, מחוץ לטווח)", plan.counts.rejectedValues, 3);
const rej8 = plan.rejected.find((r) => r.rowNumber === 8);
eq("שורה 8: הטלפון נדחה", rej8.reasonKey, "importx.reason.costIsPhone");
eq("שורה 8: הערך המקורי מוצג למשתמש", rej8.raw, "052-1234567");
eq("שורה 8: העלות לא יובאה", plan.rows.find((r) => r.rowNumber === 8).monthlyCost, null);
const rej19 = plan.rejected.find((r) => r.rowNumber === 19);
eq("שורה 19: ה-serial נדחה כתאריך", rej19.reasonKey, "importx.reason.costIsDate");
eq("שורה 19: העלות לא יובאה", plan.rows.find((r) => r.rowNumber === 19).monthlyCost, null);
eq("עלות תקינה כן יובאה", plan.rows.find((r) => r.rowNumber === 11).monthlyCost, 2770);

// 9 שורות ה-needsReview — הטקסט החופשי מבודד ולא הופך לשם נהג (D-Import)
const reviewRows = plan.rows.filter((r) => r.assignment?.needsReview);
eq("9 החזקות סומנו לבדיקה", reviewRows.length, 9);
eq(
  "אלה בדיוק השורות הצפויות",
  reviewRows.map((r) => r.rowNumber),
  [7, 10, 14, 15, 19, 21, 22, 25, 26]
);
for (const r of reviewRows) {
  ok(`שורה ${r.rowNumber}: הטקסט נשמר ב-importRaw`, r.assignment.importRaw.length > 0);
  eq(`שורה ${r.rowNumber}: לא נוצר נהג בשם הזה`, r.driverName, null);
  eq(`שורה ${r.rowNumber}: driverAction=none`, r.driverAction, "none");
  ok(`שורה ${r.rowNumber}: מוצגת סיבה למשתמש`, r.driverReasons.length > 0);
}
eq("שורה 25 מסומנת כרכב מאגר", plan.rows.find((r) => r.rowNumber === 25).status, "pool");
ok("D-Import — הטקסט החופשי לא מגיע ל-notes התפעולי",
  reviewRows.every((r) => !("notes" in r.assignment)));

// לוחית נשמרת raw כמחרוזת, בלי עיצוב מחדש ובלי הפיכה למספר
const row4 = plan.rows.find((r) => r.rowNumber === 4);
eq("לוחית נשמרת כמחרוזת", typeof row4.plateRaw, "string");
eq("לוחית לא עוצבה מחדש", row4.plateRaw, "25324401");
eq("תאריך מ-Date הומר", plan.rows.find((r) => r.rowNumber === 5).contractStart, "2024-11-25");
eq("תאריך מ-serial הומר", plan.rows.find((r) => r.rowNumber === 4).contractStart, "2024-11-25");
eq("היצרן נשאר ריק — לא מנחשים מהדגם", row4.manufacturer, "");

// -- הבנייה בפועל --------------------------------------------------------
const built = buildImportWrite(plan, { orgId: ORG, data: EMPTY });
eq("נבנו 36 רכבים", built.vehicles.length, 36);
eq("נבנו 36 מסמכי-עלות פרטיים (D1)", built.vehiclesPrivate.length, 36);
eq("נבנו 27 נהגים", built.drivers.length, 27);
eq("נבנו 36 החזקות", built.assignments.length, 36);
eq("נבנתה חברת ליסינג אחת", built.leaseCompanies.length, 1);
ok("D1 — אין monthlyCost על מסמך הרכב", built.vehicles.every((v) => !("monthlyCost" in v)));
eq("העלות יושבת במסמך הפרטי", built.vehiclesPrivate.filter((p) => p.monthlyCost > 0).length, 3);
ok("כל הרכבים קושרו לחברת הליסינג",
  built.vehicles.every((v) => v.leaseCompanyId === built.leaseCompanies[0].id));
eq("פרטי הספק נשמרו על חברת הליסינג", built.leaseCompanies[0].phone, "052-3866645");
ok("כל ההחזקות מסומנות fromDateInferred", built.assignments.every((a) => a.fromDateInferred));
eq("9 החזקות עם needsReview", built.assignments.filter((a) => a.needsReview).length, 9);
ok("החזקות needsReview הן בלי נהג", built.assignments.filter((a) => a.needsReview).every((a) => !a.driverId));
ok("החזקות רגילות כן עם נהג", built.assignments.filter((a) => !a.needsReview).every((a) => Boolean(a.driverId)));
ok("D3 — אין דנרמול של שם על ההחזקה", built.assignments.every((a) => !("driverFullName" in a)));
ok("D7 — אין שדות אסורים על הישויות המיובאות",
  [...built.vehicles, ...built.drivers, ...built.assignments].every(
    (e) => FORBIDDEN_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(e, f)).length === 0
  ));
ok("מקור הייבוא מתועד על ההחזקה", built.assignments.every((a) => a.importSource?.row >= 4));

// -- המצב אחרי הייבוא: השיוך האוטומטי + האזהרה --------------------------
const afterImport = {
  ...EMPTY,
  leaseCompanies: built.leaseCompanies,
  vehicles: built.vehicles,
  vehiclesPrivate: built.vehiclesPrivate,
  drivers: built.drivers,
  assignments: built.assignments,
};
const cleanVehicle = built.vehicles.find(
  (v) => built.assignments.find((a) => a.vehicleId === v.id && !a.needsReview)
);
const dv = resolveDriverForFine(afterImport, cleanVehicle.id, "2026-06-01");
eq("שיוך קנס אחרי ייבוא עובד", dv.status, "resolved");
ok("נגזר נהג", Boolean(dv.driverId));
eq("**והוא מסומן כמשוער** — האזהרה בממשק", dv.fromDateInferred, true);
const reviewVehicle = built.vehicles.find(
  (v) => built.assignments.find((a) => a.vehicleId === v.id && a.needsReview)
);
const dr = resolveDriverForFine(afterImport, reviewVehicle.id, "2026-06-01");
eq("החזקה שסומנה לבדיקה חוסמת שיוך אוטומטי", dr.status, "needsReview");
eq("ולא נגזר נהג", dr.driverId, null);
// שרשרת הראיות (D5) נושאת את הדגל
const importedFine = applyDerivedDriver(afterImport, {
  ...createFine({ orgId: ORG, vehicleId: cleanVehicle.id, violationDate: "2026-06-01", amount: 250 }),
});
eq("D5 — הדגל נשמר בשרשרת הראיות של השיוך", importedFine.attribution.fromDateInferred, true);
// החזקה שנוצרה ביד — לא משוערת
eq("החזקה ידנית אינה מסומנת כמשוערת", createAssignment({ orgId: ORG }).fromDateInferred, false);

// -- הרצה חוזרת: בלי כפילויות (התאמה לפי לוחית) --------------------------
const plan2 = analyzeImport(FIX, afterImport, IMPORT_META);
eq("הרצה חוזרת: 0 רכבים חדשים", plan2.counts.vehiclesToCreate, 0);
eq("הרצה חוזרת: 36 זוהו כקיימים", plan2.counts.vehiclesExisting, 36);
eq("הרצה חוזרת: 0 נהגים חדשים", plan2.counts.driversToCreate, 0);
eq("הרצה חוזרת: 0 החזקות חדשות", plan2.counts.assignmentsToCreate, 0);
eq("הרצה חוזרת: חברת הליסינג לא משוכפלת", plan2.counts.leaseCompaniesToCreate, 0);
const built2 = buildImportWrite(plan2, { orgId: ORG, data: afterImport });
eq("הרצה חוזרת: הבנייה ריקה", built2.vehicles.length + built2.drivers.length + built2.assignments.length, 0);

// התאמה לפי לוחית עובדת גם כשהלוחית עוצבה אחרת במערכת
const reformatted = {
  ...afterImport,
  vehicles: afterImport.vehicles.map((v) => ({ ...v, plate: v.plate.replace(/^(\d{2})(\d{3})(\d{3})$/, "$1-$2-$3") })),
};
eq("התאמה לפי לוחית עמידה לעיצוב שונה", analyzeImport(FIX, reformatted, IMPORT_META).counts.vehiclesToCreate, 0);

// כפילות **בתוך** הקובץ נתפסת
const dupFix = FIX.map((r) => (r ? [...r] : r));
dupFix[38] = [...dupFix[38]];
dupFix[38][1] = dupFix[37][1]; // שורה 39 מקבלת את הלוחית של שורה 38
const dupPlan = analyzeImport(dupFix, EMPTY, IMPORT_META);
eq("כפילות בתוך הקובץ מזוהה", dupPlan.counts.vehiclesDuplicateInFile, 1);
eq("ונוצרים 35 רכבים בלבד", dupPlan.counts.vehiclesToCreate, 35);

// שני רכבים לאותו נהג — נהג אחד, שתי החזקות
const sameDriverFix = FIX.map((r) => (r ? [...r] : r));
sameDriverFix[4][3] = sameDriverFix[3][3];
const sdPlan = analyzeImport(sameDriverFix, EMPTY, IMPORT_META);
eq("שם זהה בשתי שורות = נהג אחד", sdPlan.counts.driversToCreate, 26);
const sdBuilt = buildImportWrite(sdPlan, { orgId: ORG, data: EMPTY });
eq("ונבנה נהג אחד בלבד", sdBuilt.drivers.length, 26);
eq("אבל שתי החזקות", sdBuilt.assignments.filter((a) => a.driverId === sdBuilt.drivers[0].id).length, 2);

// -- גיליון `החזרות רכבים` מוחרג לחלוטין (D-Import) ----------------------
ok("הגיליון המוחרג מזוהה", isExcludedSheet("החזרות רכבים"));
ok("רווחים מיותרים לא עוקפים את ההחרגה", isExcludedSheet("  החזרות רכבים "));
ok("גיליון רגיל אינו מוחרג", !isExcludedSheet("20.7.26"));

// -- כשל מבוקר: גיליון בלי כותרת מוכרת -----------------------------------
const noHeader = analyzeImport([["a", "b"], [1, 2]], EMPTY, IMPORT_META);
ok("גיליון בלי כותרת נכשל במפורש", !noHeader.ok);
eq("עם מפתח שגיאה מוצג", noHeader.errorKey, "importx.err.noHeader");
eq("ולא מייבא כלום", noHeader.rows.length, 0);
eq("גריד ריק לא מפיל", analyzeImport([], EMPTY, IMPORT_META).ok, false);

// -- i18n: כל מפתח שהייבוא מייצר קיים בשתי השפות -------------------------
const importKeys = new Set([
  ...plan.rejected.map((r) => r.reasonKey),
  ...plan.skipped.map((s) => s.reasonKey),
  ...plan.rows.flatMap((r) => [...r.driverReasons, ...r.warnings]),
  "importx.reason.costNotNumber", "importx.reason.badDate",
  "importx.reason.noFromDate", "importx.reason.noDriver",
  "importx.reason.costRejected", "importx.reason.punctuation",
  "importx.action.create", "importx.action.skipExisting", "importx.action.skipDuplicateInFile",
  "importx.err.noHeader", "importx.err.read", "importx.err.excludedSheet",
  "importx.inferredBadge", "fine.inferredFromDate", "importx.nav", "importx.title",
]);
for (const k of importKeys) {
  ok(`מפתח תרגום קיים (he): ${k}`, Boolean(dict.he[k]));
  ok(`מפתח תרגום קיים (en): ${k}`, Boolean(dict.en[k]));
}

// ============================================================================
section("20. מסך 7 — תיקון ההחזקות שסומנו לבדיקה");
// ============================================================================
// ממשיכים מהמצב שנוצר בסעיף 19: 36 רכבים, 27 נהגים, 36 החזקות, 9 מסומנות.
// זה בדיוק המצב של הקובץ האמיתי אחרי הייבוא.

// -- פרסור התאריכים: שלושת הפורמטים שמופיעים בקובץ ------------------------
eq('פורמט D.M.YYYY', parseLooseDate("28.4.2026"), "2026-04-28");
eq('פורמט D.M.YY', parseLooseDate("6.5.26"), "2026-05-06");
eq('פורמט DD.M.YY', parseLooseDate("2.2.26"), "2026-02-02");
eq('פורמט עם לוכסן', parseLooseDate("17/6/2026"), "2026-06-17");
eq("שנה דו-ספרתית נמוכה → 20xx", parseLooseDate("1.1.05"), "2005-01-01");
eq("שנה דו-ספרתית גבוהה → 19xx", parseLooseDate("1.1.99"), "1999-01-01");
eq("31 באפריל אינו תאריך", parseLooseDate("31.4.2026"), null);
eq("30 בפברואר אינו תאריך", parseLooseDate("30.2.2026"), null);
eq("חודש 13 נדחה", parseLooseDate("1.13.2026"), null);
eq("טקסט שאינו תאריך", parseLooseDate("בקרוב"), null);
eq("תאריך בתוך משפט מאותר", findDates("החל מ 28.4.2026 והלאה")[0].iso, "2026-04-28");
eq("שני תאריכים באותו טקסט", findDates("מ 1.1.26 עד 2.2.26").length, 2);

// -- ההצעות: כל 9 הטקסטים של הקובץ האמיתי (בשמות בדויים) ------------------
const rawTexts = Object.values(FREE_TEXT);
const parsedAll = rawTexts.map(parseImportRaw);
eq("9 טקסטים חופשיים", parsedAll.length, 9);
ok("לכל טקסט יש הצעה כלשהי", parsedAll.every((p) => p.hasAnySuggestion));
eq("6 טקסטים מכילים תאריך חילופים", parsedAll.filter((p) => p.suggestedFromDate).length, 6);
eq("טקסט אחד מתאר רכב מאגר", parsedAll.filter((p) => p.isPool).length, 1);
eq("טקסט אחד מתעד שני מחזיקים", parsedAll.filter((p) => p.splitSuggested).length, 1);
ok("שם הוצע לכל טקסט שיש בו מילים", parsedAll.every((p) => p.nameSuggestion));
ok("ההצעה מסמנת מאיפה נגזרה",
  parsedAll.every((p) => p.nameSuggestion.viaKey.startsWith("reviewx.via.")));
const pSplit = parseImportRaw(FREE_TEXT[10]);
eq("המחזיק הנוכחי נגזר", pSplit.nameSuggestion.text, "פלונית אלמונית");
eq("המחזיק הקודם נגזר מהמילה לשעבר", pSplit.formerSuggestion.text, "קודמת");
eq("תאריך החילופים נגזר", pSplit.suggestedFromDate, "2026-01-11");
eq("מילת-הקשר מזוהה", parseImportRaw(FREE_TEXT[15]).nameSuggestion.viaKey, "reviewx.via.cue");
eq("שם ארוך מדי מסומן כביטחון נמוך",
  parseImportRaw("אלמוני פלוני איש אחזקה באתר הצפוני החל 6.5.26").nameSuggestion.confidence, "low");
eq("טקסט ריק לא מייצר הצעה", parseImportRaw("").hasAnySuggestion, false);

// -- המצב ההתחלתי: 9 פריטים לבדיקה ----------------------------------------
let state = { ...afterImport };
eq("9 החזקות ממתינות לאימות", pendingReviewCount(state), 9);
eq("המונה: 0 מתוך 9", reviewProgress(state), { total: 9, pending: 9, resolved: 0, done: false });
ok("רק החזקות עם importRaw נכנסות למסך",
  reviewAssignments(state).every((a) => a.importRaw && a.needsReview));
eq("החזקה רגילה אינה פריט-בדיקה",
  isReviewItem(state.assignments.find((a) => !a.needsReview)), false);

// התראת הדשבורד קיימת כל עוד יש מה לאמת
const alReview = computeAlerts(state, "2026-06-01", EMPTY.settings);
eq("התראת הדשבורד סופרת את כל התשע", alReview.groups.assignmentsNeedingReview.length, 9);

// -- ההצעה **אינה** מוחלת אוטומטית ----------------------------------------
// בוחרים במפורש פריטים "רגילים" (לא הפיצול ולא המאגר) — אלה נבדקים בנפרד.
const isPlain = (a) => {
  const p = parseImportRaw(a.importRaw);
  return !p.splitSuggested && !p.isPool;
};
const plainItems = reviewAssignments(state).filter((a) => a.needsReview && isPlain(a));
const item = plainItems[0];
const itemParsed = parseImportRaw(item.importRaw);
const draft0 = emptyResolution(item);
eq("הטיוטה נפתחת בלי נהג", draft0.driverId, "");
eq("הטיוטה נפתחת בלי שם חדש", draft0.newDriverName, "");
eq("הטיוטה נפתחת בלי פיצול", draft0.split, false);
eq("הטיוטה יורשת את התאריך המשוער בלבד", draft0.fromDate, item.fromDate);
ok("ההצעה קיימת אך לא נכנסה לטיוטה",
  Boolean(itemParsed.nameSuggestion) && draft0.newDriverName === "");
ok("שמירה בלי בחירה מפורשת נכשלת", validateResolution(state, item, draft0).includes("reviewx.err.noDriver"));
eq("ובנייה מסורבת", buildReviewWrite(state, item.id, draft0, { orgId: ORG }).ok, false);

// -- "לחיצה" על ההצעה: מה בדיוק נכנס לטופס --------------------------------
// אלה הטרנספורמציות שמאחורי כפתורי "מילוי" ב-UI. הן טהורות בכוונה, כדי
// שההתנהגות של הלחיצה תהיה מכוסה כאן ולא רק בעין.
const clickedName = applyNameSuggestion(draft0, itemParsed.nameSuggestion.text, state.drivers);
eq("לחיצה על 'מילוי השם' בוחרת 'נהג חדש'", clickedName.driverId, "__new__");
eq("ומכניסה את השם המוצע לשדה", clickedName.newDriverName, itemParsed.nameSuggestion.text);
eq("בלי לגעת בתאריך", clickedName.fromDate, draft0.fromDate);
const clickedDate = applyDateSuggestion(clickedName, itemParsed.suggestedFromDate);
eq("לחיצה על 'מילוי התאריך' מכניסה את התאריך", clickedDate.fromDate, itemParsed.suggestedFromDate);
eq("ומורידה את סימון ה'משוער' — זה תאריך שאדם רשם", clickedDate.fromDateInferred, false);
eq("אחרי שתי הלחיצות הטופס תקין", validateResolution(state, item, clickedDate), []);
ok("ההצעה שהוחלה אכן נשמרת", buildReviewWrite(state, item.id, clickedDate, { orgId: ORG }).ok);
// שם מוצע שכבר קיים במאגר → נבחר הנהג הקיים, ולא "חדש"
const known = state.drivers[0].fullName;
eq("שם מוכר → בחירת הנהג הקיים",
  applyNameSuggestion(draft0, known, state.drivers).driverId, state.drivers[0].id);
eq("ובלי שם חדש", applyNameSuggestion(draft0, known, state.drivers).newDriverName, "");
// שינוי ידני של התאריך מוריד את הדגל; חזרה לערך המקורי לא מדליקה אותו מחדש
eq("שינוי ידני של התאריך מוריד את 'משוער'",
  changeFromDate(draft0, item, "2026-05-05").fromDateInferred, false);
eq("התאריך המקורי משאיר את הדגל כפי שהוא",
  changeFromDate(draft0, item, item.fromDate).fromDateInferred, draft0.fromDateInferred);
eq("לחיצה על 'סימון כמאגר' מחליפה מצב", applyPoolSuggestion(clickedDate).mode, "pool");
eq("ומכבה פיצול", applyPoolSuggestion({ ...clickedDate, split: true }).split, false);

// -- פתרון פשוט: נהג חדש inline + תאריך אמיתי -----------------------------
const applyWrite = (data, built) => {
  const next = { ...data, drivers: [...data.drivers], assignments: [...data.assignments], vehicles: [...data.vehicles] };
  const put = (arr, e) => {
    const i = arr.findIndex((x) => x.id === e.id);
    if (i >= 0) arr[i] = e;
    else arr.push(e);
  };
  for (const d of built.drivers) put(next.drivers, d);
  for (const a of built.assignments) put(next.assignments, a);
  if (built.vehicle) put(next.vehicles, built.vehicle);
  return next;
};

const w1 = buildReviewWrite(
  state,
  item.id,
  { mode: "driver", driverId: "__new__", newDriverName: "אלמוני חדש", fromDate: "2026-04-28", fromDateInferred: false },
  { orgId: ORG, actor: "admin-uid" }
);
ok("הפתרון נבנה", w1.ok);
eq("נוצר נהג אחד חדש", w1.drivers.length, 1);
eq("ההחזקה עודכנה בלבד (בלי פיצול)", w1.assignments.length, 1);
const a1 = w1.assignments[0];
eq("needsReview ירד", a1.needsReview, false);
eq("driverId הוגדר", a1.driverId, w1.drivers[0].id);
eq("driverUid הוגדר (null כל עוד אין פורטל)", a1.driverUid, null);
eq("תאריך אמיתי → fromDateInferred=false", a1.fromDateInferred, false);
eq("importRaw נשמר גם אחרי הפתרון", a1.importRaw, item.importRaw);
eq("importRaw **לא** הועתק ל-notes", a1.notes, "");
ok("notes אינו מכיל את הטקסט החופשי", !String(a1.notes).includes(item.importRaw));
eq("מקור הייבוא נשמר", a1.importSource.row, item.importSource.row);
eq("מי פתר נרשם", a1.reviewResolvedBy, "admin-uid");
eq("סוג הפתרון נרשם", a1.reviewResolution, "driver");
ok("יש חותמת פתרון", Boolean(a1.reviewResolvedAt));
eq("D7 — אין שדות אסורים על ההחזקה שנפתרה",
  FORBIDDEN_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(a1, f)), []);

state = applyWrite(state, w1);
eq("המונה עלה ל-1 מתוך 9", reviewProgress(state).resolved, 1);
eq("נותרו 8 חסומות", pendingReviewCount(state), 8);

// -- needsReview=false פותח שיוך קנס אוטומטי שהיה חסום --------------------
const beforeFix = resolveDriverForFine(afterImport, item.vehicleId, "2026-06-01");
eq("לפני התיקון: השיוך חסום", beforeFix.status, "needsReview");
eq("לפני התיקון: אין נהג", beforeFix.driverId, null);
const afterFix = resolveDriverForFine(state, item.vehicleId, "2026-06-01");
eq("אחרי התיקון: שיוך אוטומטי עובד", afterFix.status, "resolved");
eq("אחרי התיקון: הנהג הנכון", afterFix.driverId, w1.drivers[0].id);
eq("ואינו מסומן עוד כמשוער", afterFix.fromDateInferred, false);
const fineAfterFix = applyDerivedDriver(state, {
  ...createFine({ orgId: ORG, vehicleId: item.vehicleId, violationDate: "2026-06-01", amount: 250 }),
});
eq("שרשרת הראיות מצביעה על ההחזקה שאומתה", fineAfterFix.attribution.assignmentId, item.id);
eq("ובלי דגל 'משוער'", fineAfterFix.attribution.fromDateInferred, false);

// -- השארת התאריך המשוער: הדגל **נשאר** ----------------------------------
const item2 = plainItems[1];
const w2 = buildReviewWrite(
  state,
  item2.id,
  { mode: "driver", driverId: state.drivers[0].id, fromDate: item2.fromDate, fromDateInferred: true },
  { orgId: ORG, actor: "admin-uid" }
);
ok("פתרון עם נהג קיים נבנה", w2.ok);
eq("לא נוצר נהג מיותר", w2.drivers.length, 0);
eq("תאריך משוער שנשאר → הדגל נשאר true", w2.assignments[0].fromDateInferred, true);
eq("אבל החסימה הוסרה", w2.assignments[0].needsReview, false);
state = applyWrite(state, w2);
eq("השיוך עובד — עם אזהרת 'משוער'",
  resolveDriverForFine(state, item2.vehicleId, "2026-06-01").fromDateInferred, true);

// -- שם שכבר קיים לא מייצר נהג כפול ---------------------------------------
const item3 = plainItems[2];
const existingName = state.drivers[0].fullName;
const w3 = buildReviewWrite(
  state,
  item3.id,
  { mode: "driver", driverId: "__new__", newDriverName: existingName, fromDate: "2026-03-01", fromDateInferred: false },
  { orgId: ORG }
);
eq("שם קיים → אין נהג חדש", w3.drivers.length, 0);
eq("וההחזקה שויכה לרשומה הקיימת", w3.assignments[0].driverId, state.drivers[0].id);

// ============================================================================
// -- הפיצול: שתי החזקות רציפות בלי חפיפה (הערך האמיתי של המסך) ------------
// ============================================================================
const splitItem = reviewAssignments(state).find(
  (a) => a.needsReview && parseImportRaw(a.importRaw).splitSuggested
);
ok("אותר הפריט שמתעד שני מחזיקים", Boolean(splitItem));
const splitParsed = parseImportRaw(splitItem.importRaw);
const clickedSplit = applySplitSuggestion(
  emptyResolution(splitItem),
  splitParsed.formerSuggestion.text,
  state.drivers
);
eq("לחיצה על 'מילוי הפיצול' מדליקה את הפיצול", clickedSplit.split, true);
eq("וממלאת את שם המחזיק הקודם", clickedSplit.previousNewDriverName, splitParsed.formerSuggestion.text);
eq("אבל לא בוחרת את המחזיק הנוכחי במקומך", clickedSplit.driverId, "");

const splitInput = {
  mode: "driver",
  driverId: "__new__",
  newDriverName: splitParsed.nameSuggestion.text,
  fromDate: splitParsed.suggestedFromDate, // 2026-01-11
  fromDateInferred: false,
  split: true,
  previousDriverId: "__new__",
  previousNewDriverName: splitParsed.formerSuggestion.text,
};
eq("הצגה מקדימה של הפיצול", splitPreview(splitItem, splitInput.fromDate), {
  previous: { fromDate: splitItem.fromDate, toDate: "2026-01-10" },
  current: { fromDate: "2026-01-11", toDate: null },
});
eq("קלט תקין — אין שגיאות", validateResolution(state, splitItem, splitInput), []);
const w4 = buildReviewWrite(state, splitItem.id, splitInput, { orgId: ORG, actor: "admin-uid" });
ok("הפיצול נבנה", w4.ok);
eq("נוצרו שני נהגים", w4.drivers.length, 2);
eq("נוצרו שתי החזקות", w4.assignments.length, 2);
const prevA = w4.assignments.find((a) => a.reviewSplitFrom === splitItem.id);
const curA = w4.assignments.find((a) => a.id === splitItem.id);
ok("ההחזקה ההיסטורית מסומנת כתוצר פיצול", Boolean(prevA));
eq("היא מתחילה בתאריך המקורי", prevA.fromDate, splitItem.fromDate);
eq("ונסגרת יום לפני החילופים", prevA.toDate, "2026-01-10");
eq("ההחזקה הנוכחית מתחילה ביום החילופים", curA.fromDate, "2026-01-11");
eq("והיא עדיין פתוחה", curA.toDate, null);
ok("שני מחזיקים שונים", prevA.driverId !== curA.driverId);
ok("אין חפיפה בין השתיים", !rangesOverlap(prevA, curA));
eq("רצף מלא — אין יום מת", prevDay(curA.fromDate), prevA.toDate);
eq("גם ההיסטורית לא דורשת בדיקה", prevA.needsReview, false);
eq("importRaw נשמר גם על ההיסטורית", prevA.importRaw, splitItem.importRaw);
eq("importRaw לא זלג ל-notes של ההיסטורית", prevA.notes, "");
eq("ההיסטורית שומרת על סימון התאריך המשוער", prevA.fromDateInferred, true);
eq("D7 — אין שדות אסורים על ההחזקה ההיסטורית",
  FORBIDDEN_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(prevA, f)), []);

state = applyWrite(state, w4);
// זה כל העניין: קנס מלפני החילופים הולך למחזיק הקודם, ואחריו — לנוכחי.
eq("קנס מ-2025 משויך למחזיק הקודם",
  resolveDriverForFine(state, splitItem.vehicleId, "2025-12-01").driverId, prevA.driverId);
eq("קנס מיום לפני החילופים — עדיין הקודם",
  resolveDriverForFine(state, splitItem.vehicleId, "2026-01-10").driverId, prevA.driverId);
eq("קנס מיום החילופים — כבר הנוכחי",
  resolveDriverForFine(state, splitItem.vehicleId, "2026-01-11").driverId, curA.driverId);
eq("ושניהם שיוך ודאי, לא ambiguous",
  resolveDriverForFine(state, splitItem.vehicleId, "2026-01-11").status, "resolved");
eq("driverAtDate מחזיר את המחזיק ההיסטורי",
  driverAtDate(state.assignments, splitItem.vehicleId, "2025-06-01"), prevA.driverId);
eq("ההחזקה ההיסטורית אינה פריט-בדיקה נוסף", isReviewItem(prevA), false);
eq("המונה נשאר על 9 פריטים", reviewProgress(state).total, 9);
eq("ונפתרו 3 (הפיצול נחשב פריט אחד)", reviewProgress(state).resolved, 3);

// -- ולידציה של הפיצול -----------------------------------------------------
const badSplit = { ...splitInput, fromDate: splitItem.fromDate };
ok("פיצול בלי טווח למחזיק הקודם נחסם",
  validateResolution(state, splitItem, badSplit).includes("reviewx.err.splitRange"));
ok("פיצול בלי מחזיק קודם נחסם",
  validateResolution(state, splitItem, { ...splitInput, previousDriverId: "", previousNewDriverName: "" })
    .includes("reviewx.err.noPreviousDriver"));
ok("אותו נהג משני הצדדים נחסם",
  validateResolution(state, splitItem, {
    ...splitInput, driverId: state.drivers[0].id, previousDriverId: state.drivers[0].id,
  }).includes("reviewx.err.splitSameDriver"));
ok("תאריך לא תקין נחסם",
  validateResolution(state, splitItem, { ...splitInput, fromDate: "" }).includes("reviewx.err.noFromDate"));
// פיצול חוזר של פריט שכבר פוצל ייצור חפיפה עם ההחזקה ההיסטורית — ונחסם.
ok("פיצול חוזר נחסם כחפיפה",
  validateResolution(state, splitItem, splitInput).includes("reviewx.err.overlap"));

// -- רכב מאגר: בלי להמציא נהג ---------------------------------------------
const poolItem = reviewAssignments(state).find(
  (a) => a.needsReview && parseImportRaw(a.importRaw).isPool
);
ok("אותר הפריט של רכב המאגר", Boolean(poolItem));
const w5 = buildReviewWrite(
  state,
  poolItem.id,
  { mode: "pool", fromDate: poolItem.fromDate, fromDateInferred: true },
  { orgId: ORG, actor: "admin-uid" }
);
ok("פתרון 'רכב מאגר' נבנה בלי נהג", w5.ok && w5.drivers.length === 0);
eq("ההחזקה נשארת בלי נהג", w5.assignments[0].driverId, null);
eq("אבל כבר לא חוסמת", w5.assignments[0].needsReview, false);
eq("סוג הפתרון: מאגר", w5.assignments[0].reviewResolution, "pool");
eq("importRaw נשמר גם כאן", w5.assignments[0].importRaw, poolItem.importRaw);
state = applyWrite(state, w5);
eq("הרכב סומן כרכב מאגר",
  state.vehicles.find((v) => v.id === poolItem.vehicleId).status, "pool");
const poolResolve = resolveDriverForFine(state, poolItem.vehicleId, "2026-06-01");
eq("קנס על רכב מאגר: מסלול 'pool', לא שיוך ריק", poolResolve.status, "pool");
eq("ואין נהג מומצא", poolResolve.driverId, null);

// -- סיום: כשכולן נפתרות, ההתראה נעלמת ------------------------------------
for (const a of reviewAssignments(state).filter((x) => x.needsReview)) {
  const p = parseImportRaw(a.importRaw);
  const w = buildReviewWrite(
    state,
    a.id,
    {
      mode: "driver",
      driverId: "__new__",
      newDriverName: p.nameSuggestion ? p.nameSuggestion.text : "נהג בדיקה",
      fromDate: p.suggestedFromDate || a.fromDate,
      fromDateInferred: !p.suggestedFromDate,
    },
    { orgId: ORG, actor: "admin-uid" }
  );
  ok(`פתרון שורה ${a.importSource?.row}`, w.ok);
  state = applyWrite(state, w);
}
eq("לא נותרו החזקות שממתינות לאימות", pendingReviewCount(state), 0);
eq("המונה: 9 מתוך 9", reviewProgress(state), { total: 9, pending: 0, resolved: 9, done: true });
eq("התראת הדשבורד נעלמה",
  computeAlerts(state, "2026-06-01", EMPTY.settings).groups.assignmentsNeedingReview.length, 0);
ok("כל 36 ההחזקות המקוריות עדיין קיימות",
  state.assignments.filter((a) => !a.reviewSplitFrom).length === 36);
ok("אף החזקה לא איבדה את importRaw שלה",
  reviewAssignments(state).every((a) => a.importRaw.length > 0));
ok("ואף אחת לא העתיקה אותו ל-notes",
  state.assignments.every((a) => !a.importRaw || !String(a.notes).includes(a.importRaw)));
// כל רכב שנפתר עם נהג — שיוך הקנס שלו כבר לא חסום
const stillBlocked = state.vehicles.filter(
  (v) => resolveDriverForFine(state, v.id, "2026-06-01").status === "needsReview"
);
eq("אין יותר רכב שהשיוך האוטומטי שלו חסום", stillBlocked.length, 0);

// -- i18n: כל מפתח של המסך קיים בשתי השפות --------------------------------
const reviewKeys = new Set([
  "reviewx.nav", "reviewx.title", "reviewx.subtitle", "reviewx.progress", "reviewx.progressAria",
  "reviewx.blockedCount", "reviewx.showResolved", "reviewx.hideResolved",
  "reviewx.emptyTitle", "reviewx.emptyHint", "reviewx.allDoneTitle", "reviewx.allDoneBody",
  "reviewx.goVehicles", "reviewx.sourceRow", "reviewx.rawTitle", "reviewx.rawNote", "reviewx.whyTitle",
  "reviewx.suggestionTitle", "reviewx.suggestionNote", "reviewx.suggestName", "reviewx.suggestDate",
  "reviewx.suggestDateHint", "reviewx.suggestFormer", "reviewx.suggestPool", "reviewx.suggestPoolHint",
  "reviewx.applyName", "reviewx.applyDate", "reviewx.applySplit", "reviewx.applyPool",
  "reviewx.via.cue", "reviewx.via.position", "reviewx.via.former",
  "reviewx.confidence.high", "reviewx.confidence.low", "reviewx.confidenceLowNote", "reviewx.noSuggestion",
  "reviewx.modeLabel", "reviewx.mode.driver", "reviewx.mode.pool", "reviewx.poolNote",
  "reviewx.poolResolvedNote", "reviewx.holder", "reviewx.driverNew", "reviewx.newDriverName",
  "reviewx.newDriverPh", "reviewx.newDriverNote", "reviewx.fromDate", "reviewx.fromDateHint",
  "reviewx.keepInferred", "reviewx.split", "reviewx.splitNote", "reviewx.splitPrevious",
  "reviewx.splitPreviewTitle", "reviewx.resolve", "reviewx.resolveHint", "reviewx.saving",
  "reviewx.resolvedBadge", "reviewx.unblocked", "reviewx.pillBlocked",
  "dash.assignmentsNeedingReview", "dash.assignmentsNeedingReview.desc",
  ...[
    "noAssignment", "noMode", "noFromDate", "noDriver", "noNewName", "noPreviousDriver",
    "noPreviousName", "splitNeedsDriver", "splitRange", "splitNoOrigin", "splitSameDriver", "overlap",
  ].map((k) => `reviewx.err.${k}`),
]);
for (const k of reviewKeys) {
  ok(`מפתח מסך 7 קיים (he): ${k}`, Boolean(dict.he[k]));
  ok(`מפתח מסך 7 קיים (en): ${k}`, Boolean(dict.en[k]));
}
// המלכודת מהסבב הקודם: אותו מפתח לכפתור ולמצב-ריק = כפילות ויזואלית.
ok("מפתח הכותרת של מצב-ריק שונה מכל מפתח כפתור",
  dict.he["reviewx.emptyTitle"] !== dict.he["reviewx.resolve"] &&
    dict.he["reviewx.allDoneTitle"] !== dict.he["reviewx.emptyTitle"]);

// ============================================================================
section("21. שער עדי 13.8 — M1: אנונימיזציה מוחקת את השם גם מטקסט חופשי");
// ============================================================================
// הממצא: `anonymizeDriver` ניקה `driverUid` בלבד, ושם העובד שרד ב-
// `Assignment.importRaw` — כלומר האנונימיזציה לא עשתה את מה שהצהירה.
// הבדיקה כאן היא זו שעדי דרשה במפורש: **אחרי אנונימיזציה, שם העובד אינו
// מופיע באף שדה בשום ישות.** היא סורקת כל מחרוזת בכל אוסף — כך ששדה טקסט
// חדש שיישכח ב-REDACTABLE_TEXT_FIELDS ייפול כאן ולא בשער.

const M1_NAME = "אורית לוי";
const M1_FIRST = "אורית";
const M1_LAST = "לוי";

// כל המחרוזות בכל הישויות, עם הנתיב שלהן — לסריקה עמוקה.
function allStrings(value, path, out) {
  if (typeof value === "string") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => allStrings(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) allStrings(v, `${path}.${k}`, out);
  }
  return out;
}
function findNeedle(data, needle) {
  return allStrings(data, "data", []).filter(([, v]) => v.includes(needle));
}

const m1Driver = createDriver({ orgId: ORG, fullName: M1_NAME, status: "archived", notes: `הערות על ${M1_NAME}` });
const m1Other = createDriver({ orgId: ORG, fullName: "רונית מזרחי", status: "active" });
const m1Vehicle = createVehicle({ orgId: ORG, plate: "12-345-67" });
const m1Fine = createFine({
  orgId: ORG, vehicleId: m1Vehicle.id, driverId: m1Driver.id, driverUid: "uid-m1",
  violationDate: "2026-03-01", amount: 500,
  driverStatement: { text: `${M1_NAME} טוענת שלא נהגה ברכב`, at: "2026-03-05T08:00:00.000Z" },
});
const m1Assignment = createAssignment({
  orgId: ORG, vehicleId: m1Vehicle.id, driverId: m1Driver.id, driverUid: "uid-m1",
  fromDate: "2026-01-01", needsReview: true,
  importRaw: `החל מ 28.4.2026 עבר לעובד ${M1_NAME}`,
  importedAt: "2026-07-20T00:00:00.000Z",
  importSource: { file: "רכבים 20.7.2026.xlsx", sheet: "20.7.26", row: 7 },
});
// החזקה של **עובד אחר** שבטקסט החופשי שלה מוזכר העובד המאונן ("לשעבר").
const m1OtherAssignment = createAssignment({
  orgId: ORG, vehicleId: m1Vehicle.id, driverId: m1Other.id,
  fromDate: "2026-05-01", importRaw: `רונית מזרחי החל מ 1.5.2026 (${M1_NAME} לשעבר)`,
  importSource: { file: "רכבים 20.7.2026.xlsx", sheet: "20.7.26", row: 8 },
});
const m1Data = {
  ...EMPTY,
  vehicles: [m1Vehicle],
  drivers: [m1Driver, m1Other],
  assignments: [m1Assignment, m1OtherAssignment],
  fines: [m1Fine],
  finesPrivate: [createFinePrivate(m1Fine.id, { orgId: ORG, adminNotes: `שיחה עם ${M1_NAME} ב-3.3` })],
  fineScans: [createFineScan({ orgId: ORG, fineId: m1Fine.id, driverId: m1Driver.id, fileName: `קנס ${M1_NAME}.pdf` })],
  documents: [createVehicleDocument({ orgId: ORG, vehicleId: m1Vehicle.id, type: "other", title: `טופס של ${M1_NAME}` })],
  incidents: [createIncident({ orgId: ORG, vehicleId: m1Vehicle.id, driverId: m1Driver.id, description: `${M1_NAME} דיווחה על שריטה` })],
  incidentsPrivate: [createIncidentPrivate("inc_x", { orgId: ORG, adminAssessment: `להערכתי ${M1_NAME} לא אשמה` })],
  odometerReadings: [createOdometerReading({ orgId: ORG, vehicleId: m1Vehicle.id, driverId: m1Driver.id, date: "2026-02-01", km: 100, notes: `נמסר ע"י ${M1_NAME}` })],
  serviceRecords: [createServiceRecord({ orgId: ORG, vehicleId: m1Vehicle.id, notes: `${M1_NAME} הביאה לטיפול` })],
  leaseCompanies: [createLeaseCompany({ orgId: ORG, name: "פריים ליס", notes: `דוברת מול ${M1_NAME}` })],
};

ok("לפני האנונימיזציה השם אכן פזור בכל הישויות", findNeedle(m1Data, M1_NAME).length >= 10);

const m1Token = anonymizationToken(m1Driver.id);
const m1Res = anonymizeDriver(m1Data, m1Driver.id);
const m1After = m1Res.data;

// ⬅ הבדיקה שעדי דרשה, מילה במילה.
eq("M1 — השם המלא אינו מופיע באף שדה בשום ישות", findNeedle(m1After, M1_NAME), []);
eq("M1 — גם השם הפרטי לבדו נעלם", findNeedle(m1After, M1_FIRST), []);
eq("M1 — וגם שם המשפחה לבדו", findNeedle(m1After, M1_LAST), []);
ok("M1 — דווח כמה שדות עברו רדקציה", m1Res.redactedFields.length >= 10);

const m1A = m1After.assignments.find((a) => a.id === m1Assignment.id);
ok("importRaw לא נמחק — הוא עקבת ביקורת", m1A.importRaw.length > 0);
ok("והוא מכיל את הטוקן במקום השם", m1A.importRaw.includes(m1Token));
ok("שאר המשפט נשאר קריא (התאריך שרד)", m1A.importRaw.includes("28.4.2026"));
ok("סומן מתי בוצעה הרדקציה", Boolean(m1A.importRawRedactedAt));
eq("מקור הייבוא נשמר במלואו — קובץ", m1A.importSource.file, "רכבים 20.7.2026.xlsx");
eq("מקור הייבוא נשמר במלואו — שורה", m1A.importSource.row, 7);
// הטקסט של **עובד אחר** מנוקה מהשם של המאונן, אבל שמו שלו נשאר
const m1B = m1After.assignments.find((a) => a.id === m1OtherAssignment.id);
ok("שם המאונן נמחק גם מהחזקה של עובד אחר", !m1B.importRaw.includes(M1_NAME));
ok("ושם העובד האחר לא נפגע", m1B.importRaw.includes("רונית מזרחי"));
ok("ההחזקה של האחר סומנה כמי שעברה רדקציה", Boolean(m1B.importRawRedactedAt));
eq("החזקה שלא נגעו בה אינה מקבלת חותמת רדקציה",
  anonymizeDriver({ ...EMPTY, drivers: [m1Other], assignments: [
    createAssignment({ orgId: ORG, driverId: m1Other.id, importRaw: "טקסט בלי שמות" }),
  ] }, m1Other.id).data.assignments[0].importRawRedactedAt, null);

// שדות שאינם טקסט חופשי לא נפגעים
eq("לוחית הרישוי לא נגעה", m1After.vehicles[0].plate, "12-345-67");
eq("סכום הקנס לא נגע", m1After.fines[0].amount, 500);
eq("driverId נשאר פסאודונימי", m1After.fines[0].driverId, m1Driver.id);

// -- הגנה על מילה משותפת: שני עובדים עם אותו שם פרטי ----------------------
const shareA = createDriver({ orgId: ORG, fullName: "דנה ברק", status: "archived" });
const shareB = createDriver({ orgId: ORG, fullName: "דנה כהן", status: "active" });
const shareData = {
  ...EMPTY,
  drivers: [shareA, shareB],
  assignments: [
    createAssignment({ orgId: ORG, driverId: shareA.id, importRaw: "דנה ברק החל מ 1.1.2026" }),
    createAssignment({ orgId: ORG, driverId: shareB.id, importRaw: "דנה כהן החל מ 1.6.2026" }),
  ],
};
const shared = anonymizeDriver(shareData, shareA.id).data;
eq("שם מלא של המאונן נעלם", findNeedle(shared, "דנה ברק"), []);
ok("אבל השם של העובדת האחרת נשאר שלם",
  shared.assignments[1].importRaw.includes("דנה כהן"));
ok("ושם פרטי משותף לא נמחק מהטקסט של האחרת",
  shared.assignments[1].importRaw.startsWith("דנה"));

// -- redactNameFromText כפונקציה טהורה ------------------------------------
eq("רדקציה: שם אחרי מילת-הקשר",
  redactNameFromText("אצל אורית לוי החל מ 8.2.2026", "אורית לוי", "#T1").text,
  "אצל [#T1] החל מ 8.2.2026");
eq("רדקציה: שני חלקי השם מתאחדים לטוקן אחד",
  redactNameFromText("אורית לוי", "אורית לוי", "#T1").text, "[#T1]");
eq("רדקציה: טקסט בלי השם אינו משתנה",
  redactNameFromText("רכב מסתובב - חברה", "אורית לוי", "#T1").changed, false);
eq("רדקציה: שם ריק אינו מוחק כלום",
  redactNameFromText("טקסט כלשהו", "", "#T1").changed, false);
eq("רדקציה: מילה בת אות אחת אינה יעד",
  redactNameFromText("ב 5.5.26 עבר", "ב", "#T1").changed, false);

// ============================================================================
section("22. שער עדי 13.8 — M2: האנונימיזציה בלתי-הפיכה דרך ה-UI");
// ============================================================================
// שני חלקים: (א) התאמה מול **כל** הנהגים ולא רק הפעילים — אחרת כל עוזב
// מקבל כפילות; (ב) נהג שעבר אנונימיזציה **לא** מותאם לשם מוקלד, כדי שלא
// יהיה מסלול "החייאה" של זהות שנמחקה.

const leaver = createDriver({ orgId: ORG, fullName: "יניר שפירא", status: "archived" });
const activeDrv = createDriver({ orgId: ORG, fullName: "טל אבידן", status: "active" });
const m2Vehicle = createVehicle({ orgId: ORG, plate: "9-99-999" });
const m2Item = createAssignment({
  orgId: ORG, vehicleId: m2Vehicle.id, fromDate: "2026-01-01", needsReview: true,
  importRaw: "אצל יניר שפירא החל מ 8.2.2026", importSource: { file: "f", sheet: "s", row: 3 },
});
let m2Data = { ...EMPTY, vehicles: [m2Vehicle], drivers: [leaver, activeDrv], assignments: [m2Item] };

eq("M2 — התאמת שם מוצאת גם עובד שעזב", matchDriversByName(m2Data.drivers, "יניר שפירא")[0]?.id, leaver.id);
eq("M2 — ההצעה מצביעה על הרשומה הקיימת ולא על 'נהג חדש'",
  applyNameSuggestion(emptyResolution(m2Item), "יניר שפירא", m2Data.drivers).driverId, leaver.id);
eq("ולכן אין שם חדש להקליד",
  applyNameSuggestion(emptyResolution(m2Item), "יניר שפירא", m2Data.drivers).newDriverName, "");
const m2Merge = nameMatchInfo(m2Data.drivers, "יניר שפירא");
ok("M6 — המיזוג מסומן", m2Merge.merges);
ok("וגם שהרשומה אינה פעילה", m2Merge.inactive);
ok("ואינו מסומן כדו-משמעי כשיש התאמה אחת", !m2Merge.ambiguous);
const m2Twin = nameMatchInfo([leaver, { ...activeDrv, fullName: "יניר שפירא" }], "יניר שפירא");
ok("שני עובדים באותו שם → דו-משמעי", m2Twin.ambiguous && m2Twin.count === 2);
eq("שם שאינו קיים אינו ממזג", nameMatchInfo(m2Data.drivers, "מישהו אחר").merges, false);
// הכתיבה בפועל: אין כפילות של העוזב
const m2Write = buildReviewWrite(
  m2Data, m2Item.id,
  { mode: "driver", driverId: "__new__", newDriverName: "יניר שפירא", fromDate: "2026-02-08", fromDateInferred: false },
  { orgId: ORG, actor: "admin" }
);
eq("M2 — לא נוצר נהג כפול לעוזב", m2Write.drivers.length, 0);
eq("וההחזקה שויכה לרשומה הקיימת", m2Write.assignments[0].driverId, leaver.id);

// -- אחרי אנונימיזציה: אין דרך להחיות ------------------------------------
const anonRes = anonymizeDriver(m2Data, leaver.id);
m2Data = anonRes.data;
const anonLeaver = m2Data.drivers.find((d) => d.id === leaver.id);
ok("העוזב מאונן", Boolean(anonLeaver.anonymizedAt) && parseAnonymizedName(anonLeaver.fullName) !== null);
eq("M1 — שמו כבר לא בטקסט של ההחזקה", findNeedle(m2Data, "יניר שפירא"), []);
eq("M2 — התאמה לשם המקורי לא מחזירה את הרשומה המאוננת",
  matchDriversByName(m2Data.drivers, "יניר שפירא"), []);
const revive = buildReviewWrite(
  m2Data, m2Item.id,
  { mode: "driver", driverId: "__new__", newDriverName: "יניר שפירא", fromDate: "2026-02-08", fromDateInferred: false },
  { orgId: ORG, actor: "admin" }
);
eq("M2 — הקלדת השם יוצרת רשומה **חדשה**, לא מחייה את המאונן", revive.drivers.length, 1);
ok("והרשומה החדשה אינה המאונן", revive.drivers[0].id !== leaver.id);
eq("המאונן נשאר מאונן", m2Data.drivers.find((d) => d.id === leaver.id).fullName, anonLeaver.fullName);
eq("והשיוך החדש אינו מצביע עליו", revive.assignments[0].driverId, revive.drivers[0].id);

// ============================================================================
section("23. שער עדי 13.8 — M3: הצהרת הייבוא נשמרת כראיה");
// ============================================================================
const ackRec = buildImportAck({
  ack: { at: "2026-08-13T09:00:00.000Z", policyVersion: "0.1-draft", file: "רכבים.xlsx", sheet: "20.7.26" },
  actor: "admin-uid",
  settings: EMPTY.settings,
  summary: { vehicles: 36, drivers: 27 },
});
eq("M3 — נרשם מתי", ackRec.at, "2026-08-13T09:00:00.000Z");
eq("M3 — נרשם מי", ackRec.by, "admin-uid");
eq("M3 — נרשמה גרסת המדיניות", ackRec.policyVersion, "0.1-draft");
eq("נרשם הקובץ והגיליון", [ackRec.file, ackRec.sheet], ["רכבים.xlsx", "20.7.26"]);
eq("ונרשם היקף הייבוא", [ackRec.vehicles, ackRec.drivers], [36, 27]);
eq("בלי גרסה בהצהרה — נופלים לגרסת ההגדרות",
  buildImportAck({ actor: "x", settings: EMPTY.settings, at: "2026-08-13T09:00:00.000Z" }).policyVersion,
  EMPTY.settings.policyVersion);
ok("מצב מקומי בלי משתמש — נרשם null ולא ערך מומצא",
  buildImportAck({ at: "2026-08-13T09:00:00.000Z" }).by === null);

// ============================================================================
section("24. שער עדי 13.8 — M4: השער הקשיח יושב בקנס");
// ============================================================================
const noNotice = createDriver({ orgId: ORG, fullName: "עובד בלי יידוע", status: "active" });
const withNotice = createDriver({
  orgId: ORG, fullName: "עובד עם יידוע", status: "active",
  notice: { policyVersion: "1.0", acknowledgedAt: "2026-08-01T10:00:00.000Z", method: "admin_recorded" },
});
const gateVehicle = createVehicle({ orgId: ORG, plate: "4-44-444" });
const gateFine = createFine({
  orgId: ORG, vehicleId: gateVehicle.id, driverId: noNotice.id,
  violationDate: "2026-06-01", amount: 400, status: "received",
});
const gateData = {
  ...EMPTY, vehicles: [gateVehicle], drivers: [noNotice, withNotice], fines: [gateFine],
};

eq("M4 — 'נמסרה הודעה לנהג' חסום בלי יידוע",
  noticeGateError(gateData, { ...gateFine, status: "notified_driver" }), "fine.err.driverNoNotice");
eq("M4 — 'הוסב לנהג' חסום בלי יידוע",
  noticeGateError(gateData, { ...gateFine, status: "transferred", notifiedDriverAt: "2026-06-02T00:00:00.000Z" }),
  "fine.err.driverNoNotice");
eq("רישום הקנס עצמו אינו חסום", noticeGateError(gateData, gateFine), null);
eq("ביטול הקנס אינו חסום", noticeGateError(gateData, { ...gateFine, status: "cancelled" }), null);
eq("קנס בלי נהג משויך אינו חסום (אין את מי ליידע)",
  noticeGateError(gateData, { ...gateFine, driverId: null, status: "notified_driver" }), null);
eq("לעובד עם יידוע — פתוח",
  noticeGateError(gateData, { ...gateFine, driverId: withNotice.id, status: "notified_driver" }), null);
// דרך פעולת שינוי הסטטוס
eq("M4 — פעולת הסטטוס נחסמת ומחזירה סיבה",
  fineStatusChange(gateData, gateFine, "notified_driver"),
  { ok: false, errorKey: "fine.err.driverNoNotice" });
eq("מעבר לא חוקי מוחזר כשגיאה נפרדת",
  fineStatusChange(gateData, gateFine, "paid").errorKey, "fine.err.badTransition");
eq("אותו מעבר לעובד עם יידוע — מותר",
  fineStatusChange(gateData, { ...gateFine, driverId: withNotice.id }, "notified_driver"),
  { ok: true, errorKey: null });
// דרך הוולידציה של הטופס
ok("M4 — validateFine עם data חוסם",
  validateFine({ ...gateFine, status: "notified_driver" }, gateData).includes("fine.err.driverNoNotice"));
ok("ובלי data נשמרת ההתנהגות הישנה (תאימות)",
  !validateFine({ ...gateFine, status: "notified_driver" }).includes("fine.err.driverNoNotice"));
ok("ושתי החסימות יכולות לדור בכפיפה אחת",
  validateFine({ ...gateFine, status: "transferred" }, gateData).includes("fine.err.transferBeforeNotice"));
// רישום היידוע פותח את השער — וגם מוריד את ההתראה
eq("לפני היידוע — שני עובדים בהתראה", driversWithoutNotice(gateData).length, 1);
const gateOpened = {
  ...gateData,
  drivers: gateData.drivers.map((d) =>
    d.id === noNotice.id
      ? { ...d, notice: { policyVersion: "1.0", acknowledgedAt: "2026-08-13T00:00:00.000Z", method: "admin_recorded" } }
      : d
  ),
};
eq("אחרי רישום היידוע — השער נפתח", fineStatusChange(gateOpened, gateFine, "notified_driver").ok, true);
eq("וההתראה נעלמת", computeAlerts(gateOpened, "2026-08-13", EMPTY.settings).groups.driversWithoutNotice.length, 0);
eq("עובד מאורכב אינו נספר בהתראה",
  driversWithoutNotice({ ...gateData, drivers: [{ ...noNotice, status: "archived" }] }).length, 0);

// ============================================================================
section("25. שער עדי 13.8 — G3 + M5: כללי ה-Storage מגבילים לארבעת התחומים");
// ============================================================================
// בודקים את **קובץ הכללים עצמו** מול מה ש-storagePath מייצר. זו לא הרצת
// אמולטור (ראו G2 בסעיף 26), אבל היא תופסת בדיוק את מה שעדי סימנה: כלל
// catch-all שמחזיר את ההרשאה לכל נתיב, וסכימת נתיבים מתועדת שאינה נכונה.
const storageRules = readFileSync(join(SRC, "..", "storage.rules"), "utf8");
// שים לב: נתיב הכלל עצמו מכיל סוגריים מסולסלים ({orgId}), ולכן עוצרים
// ברווח שלפני ה-`{` של הבלוק ולא בסוגר הראשון שנתקלים בו.
const ruleBodyPaths = [...storageRules.matchAll(/^\s*match\s+(\/orgs\/\S+)\s+\{/gm)].map((m) => m[1]);
eq("יש בדיוק ארבעה כללי נתיב תחת orgs", ruleBodyPaths.length, 4);
eq("G3 — אין catch-all תחת orgs",
  ruleBodyPaths.filter((p) => /\{[a-zA-Z]+=\*\*\}/.test(p)), []);

const ruleToRe = (p) =>
  new RegExp(`^${p.slice(1).split("/").map((seg) => (/^\{.*=\*\*\}$/.test(seg) ? ".+" : /^\{.*\}$/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/")}$`);
const ruleRes = ruleBodyPaths.map(ruleToRe);
const matchCount = (path) => ruleRes.filter((re) => re.test(path)).length;

const allowedPaths = [
  storagePath({ domain: STORAGE_DOMAINS.fine, orgId: "orgA", fineId: "fin_1", docId: "scn_1", fileName: "scan.png" }),
  storagePath({ domain: STORAGE_DOMAINS.odometer, orgId: "orgA", driverId: "drv_1", docId: "odo_1", fileName: "p.jpg" }),
  storagePath({ domain: STORAGE_DOMAINS.incident, orgId: "orgA", driverId: "drv_1", docId: "inc_1", fileName: "p.jpg" }),
  storagePath({ domain: STORAGE_DOMAINS.vehicleDoc, orgId: "orgA", vehicleId: "veh_1", docId: "doc_1", fileName: "ins.pdf" }),
];
for (const p of allowedPaths) {
  eq(`נתיב מותר מכוסה בכלל אחד בדיוק: ${p.split("/").slice(2, 4).join("/")}`, matchCount(p), 1);
}
const deniedPaths = [
  "orgs/orgA/loose.png",
  "orgs/orgA/misc/x.png",
  "orgs/orgA/drivers/drv_1/x.png",
  "orgs/orgA/drivers/drv_1/other/x.png",
  "orgs/orgA/vehicles/veh_1/x.png",
  "orgs/orgA/vehicles/veh_1/private/x.png",
  "orgs/orgA/fines/fin_1/sub/deep.png",
];
for (const p of deniedPaths) {
  eq(`G3 — נתיב מחוץ לתחומים אינו מכוסה: ${p}`, matchCount(p), 0);
}
// M5 — ההערה בראש הקובץ מתעדת את הסכימה האמיתית
const header = storageRules.slice(0, storageRules.indexOf("service firebase.storage"));
ok("M5 — ההערה מתעדת את נתיב סריקות הקנס", header.includes("orgs/{orgId}/fines/{fineId}/"));
ok("M5 — ואת נתיב צילומי המד", header.includes("orgs/{orgId}/drivers/{driverId}/odometer/"));
ok("M5 — ואת נתיב צילומי התקלה", header.includes("orgs/{orgId}/drivers/{driverId}/incidents/"));
ok("M5 — ואת נתיב מסמכי הרכב", header.includes("orgs/{orgId}/vehicles/{vehicleId}/docs/"));
ok("M5 — הסכימה השגויה הישנה הוסרה", !header.includes("orgs/{orgId}/{vehicleId}/{docId}/{fileName}"));

// ============================================================================
section("26. שער עדי 13.8 — G2: בדיקות הכללים מחווטות (טרם הורצו)");
// ============================================================================
// ⚠️ אלה בדיקות **קיום וחיווט** בלבד. ארבע בדיקות ה-rules עצמן דורשות
// אמולטור Firebase, שהוא תהליך JVM — ו-Java אינה מותקנת על מכונת הפיתוח.
// הקוד כתוב ומוכן; "נכתבו" אינו "עברו", והדיווח לעדי אומר זאת במפורש.
const ROOT_DIR = join(SRC, "..");
const firebaseJson = JSON.parse(readFileSync(join(ROOT_DIR, "firebase.json"), "utf8"));
ok("G2 — יש בלוק emulators ב-firebase.json", Boolean(firebaseJson.emulators));
ok("G2 — אמולטור Firestore מוגדר עם פורט", Number.isInteger(firebaseJson.emulators?.firestore?.port));
ok("G2 — אמולטור Storage מוגדר עם פורט", Number.isInteger(firebaseJson.emulators?.storage?.port));
const pkg = JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf8"));
ok("G2 — יש סקריפט npm להרצת בדיקות הכללים", Boolean(pkg.scripts?.["rules:test"]));
ok("G2 — ספריית הבדיקות מוגדרת כתלות פיתוח",
  Boolean(pkg.devDependencies?.["@firebase/rules-unit-testing"]));
const rulesTest = readFileSync(join(ROOT_DIR, "scripts", "rules-test.mjs"), "utf8");
ok("G2 — (א) משתמש לא-מחובר", rulesTest.includes("(א) משתמש לא-מחובר"));
ok("G2 — (ב) בידוד בין ארגונים", rulesTest.includes("(ב) אדמין של ארגון א'"));
ok("G2 — (ג) כתיבה ל-vehiclesPrivate מצליחה", rulesTest.includes("vehiclesPrivate"));
ok("G2 — (ד) Storage מחוץ לתחומים נדחה", rulesTest.includes("(ד) Storage"));
ok("G2 — הבדיקות נטענות מקבצי הכללים האמיתיים",
  rulesTest.includes("firestore.rules") && rulesTest.includes("storage.rules"));
ok("G2 — הסקריפט מזהיר כשהאמולטור אינו רץ", rulesTest.includes("האמולטור אינו רץ"));

// ============================================================================
section("27. שער עדי 13.8 — M6: ביטחון לפי פרובננס + חיווי מיזוג");
// ============================================================================
// (א) דירוג הביטחון
eq("M6 — שם שנבחר לפי מיקום הוא 'ניחוש' ולכן low", confidenceOf(2, "position"), "low");
eq("גם שם בן מילה אחת לפי מיקום", confidenceOf(1, "position"), "low");
eq("שם אחרי מילת-הקשר ובאורך סביר — high", confidenceOf(2, "cue"), "high");
eq("שם ארוך מדי גם אחרי מילת-הקשר — low", confidenceOf(5, "cue"), "low");
const byCue = parseImportRaw("אצל מזכירה החל מ 8.2.2026");
eq("טקסט עם מילת-הקשר: הפרובננס cue", byCue.nameSuggestion.via, "cue");
eq("וביטחון סביר", byCue.nameSuggestion.confidence, "high");
const byPos = parseImportRaw("אלמוני פלוני 2.2.26");
eq("טקסט בלי מילת-הקשר: הפרובננס position", byPos.nameSuggestion.via, "position");
eq("M6 — ולכן ביטחון נמוך, גם כששתי מילים בלבד", byPos.nameSuggestion.confidence, "low");
eq("מפתח התרגום עקבי עם הפרובננס", byPos.nameSuggestion.viaKey, "reviewx.via.position");
eq("המחזיק הקודם נגזר מ'לשעבר'", parseImportRaw("פלונית אלמונית החל מ 11.1.2026 (קודמת לשעבר)").formerSuggestion.via, "former");

// (ב) חיווי מיזוג-לפי-שם במסך הייבוא
const mergeGrid = [];
mergeGrid[0] = ["מסד", "מס' רישוי", "דגם", "שם נהג", "חברת ליסינג", "תאריך תחילת הסכם", "תאריך סיום הסכם", "עלות חודשית"];
mergeGrid[3] = [1, 11111111, "דגם א", "דנה ברק", "פריים ליס", D("2024-11-01"), D("2027-11-01"), 2500];
mergeGrid[4] = [2, 22222222, "דגם ב", "דנה ברק", "פריים ליס", D("2024-11-01"), D("2027-11-01"), 2500];
mergeGrid[5] = [3, 33333333, "דגם ג", "עופר שגיא", "פריים ליס", D("2024-11-01"), D("2027-11-01"), 2500];
const existingDrv = createDriver({ orgId: ORG, fullName: "עופר שגיא", status: "active" });
const mergePlan = analyzeImport(mergeGrid, { ...EMPTY, drivers: [existingDrv] }, { fileName: "m.xlsx", sheet: "s" });
const groups = driverMergeGroups(mergePlan);
eq("M6 — זוהו שני מיזוגים", groups.length, 2);
const withinFile = groups.find((g) => g.kind === "withinFile");
eq("שם שחוזר בקובץ מסומן כמיזוג פנימי", withinFile.rows.length, 2);
eq("ומצביע על שתי השורות", withinFile.rows, [4, 5]);
const existingGroup = groups.find((g) => g.kind === "existing");
eq("שם שכבר קיים במערכת מסומן ככזה", existingGroup.existingDriverId, existingDrv.id);
eq("שורות שמעורבות במיזוג מסומנות בטבלה", [...mergedRowNumbers(mergePlan)].sort((a, b) => a - b), [4, 5, 6]);
eq("קובץ בלי מיזוגים — רשימה ריקה",
  driverMergeGroups(analyzeImport(
    [mergeGrid[0], , , mergeGrid[5]],
    EMPTY,
    { fileName: "m.xlsx", sheet: "s" }
  )).length, 0);

// (ג) i18n — כל מפתח חדש שהשער הזה הוסיף, בשתי השפות
const gateKeys = [
  "reviewx.confidencePositionNote", "reviewx.mergeNotice", "reviewx.mergeInactive", "reviewx.mergeAmbiguous",
  "importx.merge.title", "importx.merge.intro", "importx.merge.existing", "importx.merge.withinFile",
  "importx.merge.rows", "importx.merge.badge", "importx.merge.none",
  "importx.privacy.ackRecorded", "importx.err.noAck",
  "settings.importAck.title", "settings.importAck.value", "settings.importAck.none",
  "settings.importAck.localUser", "settings.importAck.hint",
  "fine.err.driverNoNotice", "fine.err.badTransition", "fine.err.notFound", "fine.noticeGateNote",
  "dash.driversWithoutNotice", "dash.driversWithoutNotice.desc", "dash.noticeBlocking",
  "dash.noticeFines", "dash.noticeNoFines", "driver.noticeMissingShort",
];
for (const k of gateKeys) {
  ok(`מפתח השער קיים (he): ${k}`, Boolean(dict.he[k]));
  ok(`מפתח השער קיים (en): ${k}`, Boolean(dict.en[k]));
}

// (ד) חיווט ב-UI — שדרוגי השער אינם נשארים בשכבת ה-utils בלבד
const importScreenSrc = readFileSync(join(SRC, "components", "ImportScreen.jsx"), "utf8");
ok("מסך הייבוא מציג את חיווי המיזוג", importScreenSrc.includes("driverMergeGroups"));
ok("ומונע ייבוא בלי הצהרה", importScreenSrc.includes("importx.err.noAck"));
const actionsSrc = readFileSync(join(SRC, "hooks", "useActions.js"), "utf8");
ok("M3 — ההצהרה נכתבת ל-settings.importAck", actionsSrc.includes("importAck"));
ok("M4 — שינוי סטטוס עובר דרך שער היידוע", actionsSrc.includes("fineStatusChange"));
ok("M4 — גם שמירת קנס עוברת דרכו", actionsSrc.includes("noticeGateError"));
const reviewItemSrc = readFileSync(join(SRC, "components", "review", "ReviewItem.jsx"), "utf8");
ok("M2 — מסך האימות מתאים מול כל הנהגים", reviewItemSrc.includes("allDrivers"));
ok("M6 — ומציג חיווי מיזוג", reviewItemSrc.includes("nameMatchInfo"));

// ============================================================================
section("28. שער עדי 16.8 — G1: אירוע מסירה, תאריך מסירה, enum שיטות, קישור גרסה");
// ============================================================================

// -- (א) פעולה קבוצתית: אותו אובייקט לכולם + רשומת אירוע אחת ---------------
const nDrivers = [
  createDriver({ orgId: ORG, fullName: "נהג א", status: "active" }),
  createDriver({ orgId: ORG, fullName: "נהג ב", status: "active" }),
  createDriver({ orgId: ORG, fullName: "נהג ג", status: "archived" }),
  createDriver({ orgId: ORG, fullName: "נהג ד", status: "active", notice: {
    policyVersion: "0.1-draft", deliveredAt: "2026-07-01", method: "signed_form",
  } }),
];
const nData = { ...EMPTY, settings: { ...EMPTY.settings, policyVersion: "0.1-draft" }, drivers: nDrivers };

eq("(א) מועמדים למסירה = פעילים בלי רישום",
  noticeCandidates(nData).map((d) => d.fullName), ["נהג א", "נהג ב"]);

const part = partitionNoticeTargets(nData, [nDrivers[0].id, nDrivers[1].id, nDrivers[2].id, "drv_nope", nDrivers[0].id]);
eq("(א) נהג בארכיון מדולג (4.5)", part.targets.map((d) => d.fullName), ["נהג א", "נהג ב"]);
eq("(א) והדילוג מדווח ולא נבלע", part.skipped.map((s) => s.reason).sort(),
  ["notice.skip.archived", "notice.skip.unknown"]);

const evt = buildNoticeDelivery({
  driverIds: [nDrivers[0].id, nDrivers[1].id],
  policyVersion: "0.1-draft",
  method: "email_bulk",
  deliveredAt: "2026-08-10",
  evidenceRef: "מייל 10.8",
  actor: "admin-uid",
  deliveryId: "ndl_x",
  at: "2026-08-14T09:00:00.000Z",
});
// בדיוק בתבנית settings.importAck: מי הצהיר, מתי, לפי איזו גרסה.
for (const k of ["at", "by", "policyVersion"]) {
  ok(`(א) רשומת האירוע נושאת את שדה ה-importAck: ${k}`, evt[k] !== undefined);
}
eq("(א) מי הצהיר", evt.by, "admin-uid");
eq("(א) מתי נרשם", evt.at, "2026-08-14T09:00:00.000Z");
eq("(א) מתי נמסר בפועל — ולא רגע הרישום", evt.deliveredAt, "2026-08-10");
eq("(א) באיזו שיטה", evt.method, "email_bulk");
eq("(א) לאיזו גרסה", evt.policyVersion, "0.1-draft");
eq("(א) ולכמה עובדים", evt.drivers, 2);
eq("(א) וגם למי בדיוק — בחירה, לא 'הכל'", evt.driverIds.length, 2);

const rec = buildNoticeRecord({
  policyVersion: "0.1-draft", deliveredAt: "2026-08-10", method: "email_bulk",
  evidenceRef: "מייל 10.8", deliveryId: "ndl_x", recordedBy: "admin-uid",
  recordedAt: "2026-08-14T09:00:00.000Z",
});
eq("(א) רשומת הנהג מקושרת לאירוע", rec.deliveryId, "ndl_x");
ok("(א) האובייקט זהה לכל הנהגים — אין 29 חותמות שונות",
  JSON.stringify(rec) === JSON.stringify(buildNoticeRecord({
    policyVersion: "0.1-draft", deliveredAt: "2026-08-10", method: "email_bulk",
    evidenceRef: "מייל 10.8", deliveryId: "ndl_x", recordedBy: "admin-uid",
    recordedAt: "2026-08-14T09:00:00.000Z",
  })));

// -- (ב) deliveredAt מפורש, ותאריך עתידי חסום ------------------------------
eq("(ב) תאריך המסירה נשמר כיום, לא כחותמת לחיצה", rec.deliveredAt, "2026-08-10");
ok("(ב) רגע הלחיצה נשמר בנפרד ולא מתחזה לתאריך המסירה",
  rec.recordedAt === "2026-08-14T09:00:00.000Z" && rec.recordedAt !== rec.deliveredAt);
const vBase = { driverIds: ["drv_1"], policyVersion: "0.1-draft", method: "signed_form" };
eq("(ב) תאריך תקין עובר",
  validateNoticeDelivery({ ...vBase, deliveredAt: "2026-08-10" }, { today: "2026-08-16" }), []);
eq("(ב) תאריך היום עובר",
  validateNoticeDelivery({ ...vBase, deliveredAt: "2026-08-16" }, { today: "2026-08-16" }), []);
eq("(ב) תאריך עתידי נדחה",
  validateNoticeDelivery({ ...vBase, deliveredAt: "2026-08-17" }, { today: "2026-08-16" }),
  ["notice.err.futureDate"]);
eq("(ב) תאריך לא תקין נדחה",
  validateNoticeDelivery({ ...vBase, deliveredAt: "אתמול" }, { today: "2026-08-16" }),
  ["notice.err.badDate"]);
eq("(ב) בלי נהגים אין רישום",
  validateNoticeDelivery({ ...vBase, driverIds: [], deliveredAt: "2026-08-10" }, { today: "2026-08-16" }),
  ["notice.err.noDrivers"]);
eq("(ב) בלי גרסת מדיניות אין רישום",
  validateNoticeDelivery({ ...vBase, policyVersion: null, deliveredAt: "2026-08-10" }, { today: "2026-08-16" }),
  ["notice.err.noPolicyVersion"]);
// השער נשען על תאריך המסירה, ורשומות ישנות (acknowledgedAt) נשארות תקפות.
const legacyDrv = { ...createDriver({ orgId: ORG, fullName: "מורשת" }),
  notice: { policyVersion: "0.1-draft", acknowledgedAt: "2026-08-01T10:00:00.000Z", method: "admin_recorded" } };
ok("(ב) רשומה ישנה עם acknowledgedAt עדיין נחשבת יידוע", hasNotice(legacyDrv));
eq("(ב) והתאריך שלה נקרא כיום", noticeDeliveredAt(legacyDrv), "2026-08-01");
eq("(ב) רשומה חדשה נקראת מ-deliveredAt",
  noticeDeliveredAt({ notice: { deliveredAt: "2026-08-10" } }), "2026-08-10");
ok("(ב) נהג בלי רישום אינו עובר את השער", !hasNotice(createDriver({ orgId: ORG })));
eq("(ב) והשער בקנס עדיין חוסם אותו",
  noticeGateError({ drivers: [nDrivers[0]] },
    { driverId: nDrivers[0].id, status: "transferred" }), "fine.err.driverNoNotice");
eq("(ב) ונפתח לנהג עם מסירה רשומה",
  noticeGateError({ drivers: [nDrivers[3]] },
    { driverId: nDrivers[3].id, status: "transferred" }), null);

// -- (ג) method כ-enum, מדורג לפי חוזק הראיה -------------------------------
eq("(ג) חמש השיטות, לפי דירוג הראיות של 4.2", NOTICE_METHODS,
  ["signed_form", "email_individual", "email_bulk", "meeting_minuted", "admin_recorded"]);
eq("(ג) החלשה ביותר אחרונה", NOTICE_METHODS[NOTICE_METHODS.length - 1], NOTICE_METHOD_WEAK);
eq("(ג) והיא גם ברירת המחדל — לא מצהירים ראיה חזקה מהמציאות",
  NOTICE_METHOD_DEFAULT, NOTICE_METHOD_WEAK);
eq("(ג) מחרוזת חופשית אינה מתקבלת", normalizeNoticeMethod("נמסר ביד"), NOTICE_METHOD_WEAK);
eq("(ג) ונופלת לחלשה, לא לחזקה", buildNoticeRecord({ method: "whatever" }).method, "admin_recorded");
eq("(ג) שיטה לא מוכרת נדחית בוולידציה",
  validateNoticeDelivery({ ...vBase, method: "carrier_pigeon", deliveredAt: "2026-08-10" },
    { today: "2026-08-16" }), ["notice.err.badMethod"]);
const weakDrv = { ...createDriver({ orgId: ORG }), notice: buildNoticeRecord({
  policyVersion: "0.1-draft", deliveredAt: "2026-08-10", method: "admin_recorded" }) };
const strongDrv = { ...createDriver({ orgId: ORG }), notice: buildNoticeRecord({
  policyVersion: "0.1-draft", deliveredAt: "2026-08-10", method: "signed_form" }) };
ok("(ג) רישום ידני מסומן כתיעוד חלש", isWeakNoticeEvidence(weakDrv));
ok("(ג) טופס חתום אינו", !isWeakNoticeEvidence(strongDrv));
ok("(ג) חיווי, לא חסימה — שניהם עוברים את השער", hasNotice(weakDrv) && hasNotice(strongDrv));
ok("(ג) נהג בלי רישום כלל אינו 'תיעוד חלש' אלא חסר",
  !isWeakNoticeEvidence(createDriver({ orgId: ORG })));

// -- (ד) odo.purposeLink ---------------------------------------------------
// ⚠️ **הבדיקה הזו שונתה ב-21.8, ביודעין.** עד כה היא אכפה שהמחרוזת מכילה
// {version}. עדי חזרה בה (2026-08-17, ס' 2.4.3): אחרי הכרעת G1 **אין מסמך
// בשם "הודעה לעובד"** — יש נוהל רכב שהעובד חתם עליו — ולכן הפניה לגרסה של
// מסמך שאיש אינו יכול להשיג היא "אות שקיפות כוזב": נראית כמו גילוי נאות
// ואינה כזה. הבדיקה החדשה אוכפת את ההפך: **אין {version}, ואין "0.1-draft"
// מול העובד.** בדיקה שנועלת נוסח שנפסל אינה בדיקה — היא הנצחה.
for (const lang of LANGS) {
  ok(`(ד) odo.purposeLink קיים (${lang})`, Boolean(dict[lang]["odo.purposeLink"]));
  ok(
    `(ד) והוא **אינו** מפנה עוד לגרסת "הודעה לעובד" (${lang})`,
    !dict[lang]["odo.purposeLink"].includes("{version}")
  );
  ok(`(ד) odo.purposeNote נשאר קיים (${lang})`, Boolean(dict[lang]["odo.purposeNote"]));
  // 2.4(1)+(2) — שני המשפטים שנוספו לנקודת האיסוף מול העובד.
  ok(`(ד) odo.whoSees קיים (${lang})`, Boolean(dict[lang]["odo.whoSees"]));
  ok(`(ד) odo.correction קיים (${lang})`, Boolean(dict[lang]["odo.correction"]));
}
// ואף מחרוזת ממשק אינה מציגה את מספר גרסת הטיוטה לעובד.
for (const lang of LANGS) {
  const leaked = Object.entries(dict[lang]).filter(([, v]) => String(v).includes("0.1-draft"));
  eq(`(ד) אין "0.1-draft" קשיח במילון (${lang})`, leaked.length, 0);
}
// עדי אימתה את הנוסח הקיים ופסקה שאין לשנותו — הבדיקה נועלת אותו מילה במילה.
eq("(ד) הנוסח העברי הקיים לא שונה", dict.he["odo.purposeNote"],
  "הקריאה משמשת למעקב מכסת הק\"מ מול חברת הליסינג ולתזמון טיפולים בלבד. המערכת אינה אוספת מיקום ואינה עוקבת אחר נסיעות, והמידע אינו משמש לפיקוח על שעות עבודה או להערכת ביצועים.");
// הצהרת המטרה עצמה נשארת נעולה מילה במילה — עדי אימתה אותה שוב ב-17.8.

// -- i18n parity לכל המפתחות שהשער הזה הוסיף ------------------------------
const g1Keys = [
  "odo.purposeLink",
  "driver.noticeMethodLine", "driver.noticeRecordedLine", "driver.noticeWeakEvidence",
  "notice.recordTitle", "notice.bulkAction", "notice.bulkActionCount", "notice.intro",
  "notice.backdateWarning", "notice.deliveredAt", "notice.deliveredAtHint",
  "notice.method", "notice.methodHint", "notice.evidenceRef", "notice.evidenceRefHint",
  "notice.selectTitle", "notice.selectedCount", "notice.selectAll", "notice.clearAll",
  "notice.none", "notice.summary", "notice.summaryEmpty", "notice.confirm",
  "notice.done", "notice.skipped",
  "notice.err.noDrivers", "notice.err.noPolicyVersion", "notice.err.badDate",
  "notice.err.futureDate", "notice.err.badMethod",
  "settings.noticeDelivery.title", "settings.noticeDelivery.value",
  "settings.noticeDelivery.recorded", "settings.noticeDelivery.none",
  "settings.noticeDelivery.hint",
  ...NOTICE_METHODS.map((m) => `notice.method.${m}`),
];
for (const k of g1Keys) {
  ok(`מפתח G1 קיים (he): ${k}`, Boolean(dict.he[k]));
  ok(`מפתח G1 קיים (en): ${k}`, Boolean(dict.en[k]));
}

// -- חיווט: השדרוגים אינם נשארים בשכבת ה-utils -----------------------------
const actionsSrcG1 = readFileSync(join(SRC, "hooks", "useActions.js"), "utf8");
ok("(א) הפעולה הקבוצתית קיימת ב-useActions", actionsSrcG1.includes("recordNoticeDelivery"));
ok("(א) והיא כותבת רשומת אירוע ל-settings", actionsSrcG1.includes("noticeDelivery: buildNoticeDelivery"));
ok("(ב) המסלול הפר-נהג עובר על אותו קוד",
  /acknowledgeNotice[\s\S]{0,200}api\.recordNoticeDelivery/.test(actionsSrcG1));
ok("(ב) nowIso כבר אינו מייצג את תאריך המסירה",
  !/acknowledgedAt:\s*nowIso\(\)/.test(actionsSrcG1));
const noticeModalSrc = readFileSync(join(SRC, "components", "NoticeDeliveryModal.jsx"), "utf8");
ok("(א) מסך הבחירה מציג את הנהגים לפני האישור", noticeModalSrc.includes("notice.selectTitle"));
ok("(ב) שדה תאריך המסירה חסום לעתיד", noticeModalSrc.includes("max={today}"));
ok("(ג) השיטות נבחרות מה-enum", noticeModalSrc.includes("NOTICE_METHODS.map"));
const driverPageSrc = readFileSync(join(SRC, "components", "DriverPage.jsx"), "utf8");
ok("(ג) כרטיס הנהג מציג את חיווי התיעוד החלש", driverPageSrc.includes("driver.noticeWeakEvidence"));
ok("(ב) והתאריך המוצג הוא תאריך המסירה", driverPageSrc.includes("noticeDeliveredAt"));
const odoSrc = readFileSync(join(SRC, "components", "tabs", "OdometerTab.jsx"), "utf8");
ok("(ד) הקישור מוצג בנקודת האיסוף", odoSrc.includes("odo.purposeLink"));
// ⚠️ התהפך ב-21.8 (עדי 17.8, ס' 2.4.3): הטקסט **לא** מצביע עוד לגרסת
// "הודעה לעובד" — אין מסמך כזה, והמספר מול העובד הוא אות שקיפות כוזב.
ok("(ד) והוא כבר לא מזריק מספר גרסה", !odoSrc.includes('odo.purposeLink", { version'));

// -- מה שאסור שיחזור: POLICY_VERSION ומנגנון ניכוי -------------------------
eq("POLICY_VERSION נשאר 0.1-draft — אין מסמך מוקפא, אין עו\"ד, אין רישום גרסאות",
  POLICY_VERSION, "0.1-draft");
const noticeSrc = readFileSync(join(SRC, "utils", "notice.js"), "utf8");
ok("אין מנגנון ניכוי משכר בשום מקום בקוד המסירה",
  !/deduct|salary|ניכוי|קיזוז/i.test(noticeSrc + noticeModalSrc));

// ============================================================================
section("29. אדמין שני 17.8 — allowlist של מיילים (הלוגיקה הטהורה)");
// ============================================================================
// הבאג: מנהלת הכספים קיבלה את הקישור, התחברה, וראתה **מסך הקמה ראשונית**
// במקום את הצי. השורש היה `useData.js:63` — `orgId = user.uid` קשיח.
// המודל החדש: orgId קבוע בזמן build + allowlist של מיילים במסמך הארגון.
const {
  normalizeEmail: normEmail,
  isValidEmail: validEmail,
  adminEmails: adminList,
  isOrgAdminEmail,
  isLegacyMemberAdmin,
  hasAdminAccess,
  validateAddAdmin,
  canRemoveAdmin,
  addToList,
  removeFromList,
} = await import("../src/utils/admins.js");

// -- נרמול: ההבדל בין "עובד" ל"אף אחד לא מבין למה זה לא עובד" --------------
eq("נרמול מוריד רישיות ורווחים", normEmail("  HildaVazana@Gmail.COM "), "hildavazana@gmail.com");
eq("נרמול של undefined אינו קורס", normEmail(undefined), "");
ok("מייל תקין", validEmail("a.b@c.co.il"));
ok("בלי @ נדחה", !validEmail("nope"));
ok("בלי TLD נדחה", !validEmail("a@b"));
ok("עם רווח נדחה", !validEmail("a b@c.com"));
// ⚠️ **אין הנחת דומיין** — מנהלת הכספים נכנסה דווקא מ-Gmail פרטי, ולכן
// הגבלת דומיין (R-b של עדי) אינה ישימה כאן. שני הספקים תקינים באותה מידה.
ok("Gmail פרטי תקין בדיוק כמו מייל ארגוני", validEmail("hildavazana@gmail.com"));
ok("ומייל ארגוני תקין גם כן", validEmail("hildav@promall.co.il"));

// -- הרשימה מוחזקת מנורמלת, ללא כפילויות, ממוינת ---------------------------
{
  const org = { adminEmails: ["B@x.com", "a@x.com", "b@x.com", "", null] };
  eq("הרשימה מנורמלת, ייחודית וממוינת", adminList(org).join(","), "a@x.com,b@x.com");
  eq("addToList מוסיף מנורמל", addToList(org, "C@X.com").join(","), "a@x.com,b@x.com,c@x.com");
  eq("addToList אינו מכפיל", addToList(org, "A@x.com").join(","), "a@x.com,b@x.com");
  eq("removeFromList מסיר לפי נרמול", removeFromList(org, "A@X.COM").join(","), "b@x.com");
}

// -- email_verified הוא **התנאי שהופך מייל למפתח** -------------------------
{
  const org = { adminEmails: ["hilda@gmail.com"], members: { legacyUid: "admin" } };
  ok("מייל ברשימה + מאומת = אדמין",
    isOrgAdminEmail(org, { email: "hilda@gmail.com", emailVerified: true }));
  ok("**אותו מייל בדיוק, לא מאומת = לא אדמין**",
    !isOrgAdminEmail(org, { email: "hilda@gmail.com", emailVerified: false }));
  ok("מייל באותיות גדולות + מאומת = אדמין",
    isOrgAdminEmail(org, { email: "Hilda@Gmail.com", emailVerified: true }));
  ok("מייל שאינו ברשימה = לא אדמין",
    !isOrgAdminEmail(org, { email: "other@gmail.com", emailVerified: true }));
  ok("בלי מייל בכלל = לא אדמין", !isOrgAdminEmail(org, { emailVerified: true }));
  // legacy — גשר ההגירה: מסמך הארגון שכבר בענן אינו מכיל adminEmails, ולכן
  // בלי המסלול הזה ה-deploy היה נועל את המשתמש מחוץ לצי שלו.
  ok("legacy: org.members מעניק גישה", isLegacyMemberAdmin(org, "legacyUid"));
  ok("legacy: uid אחר לא", !isLegacyMemberAdmin(org, "someoneElse"));
  ok("hasAdminAccess מכסה את שני המסלולים",
    hasAdminAccess(org, { uid: "legacyUid", email: "x@y.com", emailVerified: true }));
  ok("ומי שאינו באף אחד מהם — לא",
    !hasAdminAccess(org, { uid: "nobody", email: "x@y.com", emailVerified: true }));
}

// -- ולידציית הוספה --------------------------------------------------------
{
  const org = { adminEmails: ["a@x.com"] };
  eq("מייל לא תקין נחסם בטופס", validateAddAdmin({ email: "oops" }, { org })[0], "team.err.email");
  eq("כתובת שכבר ברשימה נחסמת", validateAddAdmin({ email: "A@X.com" }, { org })[0], "team.err.duplicate");
  eq("כתובת חדשה תקינה עוברת", validateAddAdmin({ email: "b@x.com" }, { org }).length, 0);
}

// -- ⚠️ האדמין האחרון אינו ניתן להסרה --------------------------------------
// ארגון בלי אף אדמין אינו ניתן לשחזור מתוך האפליקציה — צריך גישת קונסולה
// ל-Firestore. זו ההגנה שהכדורסל לא צריך ואנחנו כן, והיא נאכפת גם ב-rules.
{
  const one = { adminEmails: ["a@x.com"] };
  const two = { adminEmails: ["a@x.com", "b@x.com"] };
  eq("אדמין אחרון — חסום", canRemoveAdmin(one, "a@x.com").errorKey, "team.err.lastAdmin");
  ok("אדמין אחרון — לא ok", !canRemoveAdmin(one, "a@x.com").ok);
  ok("כשיש שניים — מותר להסיר", canRemoveAdmin(two, "a@x.com").ok);
  ok("וגם את השני", canRemoveAdmin(two, "b@x.com").ok);
  eq("כתובת שאינה ברשימה", canRemoveAdmin(two, "c@x.com").errorKey, "team.err.notFound");
  ok("הרשימה אחרי הסרה אינה מתרוקנת כשיש שניים", removeFromList(two, "a@x.com").length === 1);
}

// -- ⚠️ F1 של עדי: ה-allowlist הוא **לאדמינים בלבד** ----------------------
// בידוד הנהגים בפרוסה 2 נשאר לפי uid, כי שם יושב ה-PII הפרטני. הבדיקה הזו
// היא השומר: אם מישהו יחליף את ההשוואה ב-access.js למייל, היא תיפול.
{
  const accessSrc = readFileSync(join(SRC, "utils", "access.js"), "utf8");
  ok("driverForUid משווה userId ל-uid, לא למייל", /d\.userId === uid/.test(accessSrc));
  // מסירים הערות לפני הבדיקה: המילה email מופיעה שם בהערת ה-F1 עצמה
  // ("לפי uid בלבד, לעולם לא לפי email"), ומה שנבדק הוא הקוד ולא הפרוזה.
  const accessCode = accessSrc.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  ok("אין השוואת מייל בקוד הגישה של הנהגים", !/email/i.test(accessCode));
  const rulesSrc = readFileSync(join(ROOT_DIR, "firestore.rules"), "utf8");
  ok("vehiclesPrivate נשאר isOrgAdmin בלבד",
    /match \/vehiclesPrivate\/\{docId\}\s+\{ allow read, write: if isOrgAdmin\(orgId\); \}/.test(rulesSrc));
  ok("ה-allowlist דורש email_verified ב-rules",
    /tokenEmailVerified\(\)[\s\S]{0,200}adminEmails/.test(rulesSrc));
  ok("אין הגבלת דומיין ב-rules (מנהלת הכספים נכנסה מ-Gmail פרטי)",
    !/endsWith\(|matches\('.*@/.test(rulesSrc));
  ok("האדמין האחרון נאכף ב-rules ולא רק ב-UI", /adminEmails.*\n?.*size\(\) >= 1|size\(\) >= 1/.test(rulesSrc));
}

// -- ⚠️ ה-orgId אינו user.uid יותר ----------------------------------------
// הבאג עצמו, כשומר-סף: אם מישהו יחזיר את השורה, הבדיקה תיפול.
{
  const dataSrc = readFileSync(join(SRC, "hooks", "useData.js"), "utf8");
  ok("useData מקבל orgId מבחוץ", /export function useData\(user, orgId = null\)/.test(dataSrc));
  // גם כאן מסירים הערות: השורה הבאגית מצוטטת **בכוונה** בהערת התיעוד
  // שמסבירה את הבאג, וזה בדיוק מה שאנחנו רוצים שיישאר שם.
  const dataCode = dataSrc.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  ok("ואין בקוד יותר orgId = user.uid",
    !/const orgId = isFirebaseConfigured \? user\?\.uid/.test(dataCode));
  const fbSrc = readFileSync(join(SRC, "firebase.js"), "utf8");
  ok("מזהה הארגון מגיע מדגל build", /VITE_FLEET_ORG_ID/.test(fbSrc));
  const accessHookSrc = readFileSync(join(SRC, "hooks", "useOrgAccess.js"), "utf8");
  ok("orgId מוחזר רק ל-member/bootstrap",
    /status === "member" \|\| state\.status === "bootstrap"/.test(accessHookSrc));
  const appSrc = readFileSync(join(SRC, "App.jsx"), "utf8");
  ok("מי שאין לו הרשאה מקבל NoAccessScreen ולא Onboarding",
    /access\.status === "none"[\s\S]{0,200}NoAccessScreen/.test(appSrc));
  ok("וה-onboarding נשאר מאחורי settings.onboarded", /!data\.settings\?\.onboarded/.test(appSrc));
}

// -- i18n parity למפתחות שהמקטע הזה הוסיף ---------------------------------
for (const k of [
  "noAccess.title", "noAccess.body", "noAccess.unverified", "noAccess.recheck",
  "noAccess.hint", "noAccess.errorTitle", "noAccess.errorBody",
  "team.title", "team.intro", "team.emailLabel", "team.add", "team.added",
  "team.current", "team.empty", "team.you", "team.selfMissing", "team.addSelf",
  "team.remove", "team.removeConfirm", "team.linkNote",
  "team.err.email", "team.err.duplicate", "team.err.notFound",
  "team.err.lastAdmin", "team.err.failed", "role.admin", "role.driver",
]) {
  ok(`מפתח ${k} קיים בעברית`, Boolean(dict.he[k]));
  ok(`מפתח ${k} קיים באנגלית`, Boolean(dict.en[k]));
}

// ============================================================================
console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} הבדיקות עברו`);
