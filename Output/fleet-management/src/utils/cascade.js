// ============================================================================
// cascade.js — מחיקות עם ניקוי תלויות. טהור: מקבל data ומחזיר data חדש.
//
// מונע רשומות יתומות, כולל המסמכים ה"פרטיים" של D1 (vehiclesPrivate/
// finesPrivate/incidentsPrivate) שקל לשכוח כי הם לא מוצגים בשום מסך.
// נתיבי ה-Storage נאספים בנפרד (utils/retention.js) ונמחקים ע"י הקורא — D6.
//
// ⚠️ מחיקת **נהג** לא נמצאת כאן בכוונה: עובד שעזב עובר ארכוב+אנונימיזציה
//    (retention.js), לא מחיקה. ראה D6.
// ============================================================================

export function removeVehicleCascade(data, vehicleId) {
  const byVehicle = (arr) => (arr || []).filter((x) => x.vehicleId !== vehicleId);
  const removedFineIds = new Set(
    (data.fines || []).filter((f) => f.vehicleId === vehicleId).map((f) => f.id)
  );
  const removedIncidentIds = new Set(
    (data.incidents || []).filter((i) => i.vehicleId === vehicleId).map((i) => i.id)
  );

  return {
    ...data,
    vehicles: (data.vehicles || []).filter((v) => v.id !== vehicleId),
    vehiclesPrivate: (data.vehiclesPrivate || []).filter((p) => p.vehicleId !== vehicleId),
    assignments: byVehicle(data.assignments),
    fines: byVehicle(data.fines),
    finesPrivate: (data.finesPrivate || []).filter((p) => !removedFineIds.has(p.fineId)),
    fineScans: (data.fineScans || []).filter((s) => !removedFineIds.has(s.fineId)),
    odometerReadings: byVehicle(data.odometerReadings),
    serviceRecords: byVehicle(data.serviceRecords),
    documents: byVehicle(data.documents),
    incidents: byVehicle(data.incidents),
    incidentsPrivate: (data.incidentsPrivate || []).filter((p) => !removedIncidentIds.has(p.incidentId)),
  };
}

export function removeFineCascade(data, fineId) {
  return {
    ...data,
    fines: (data.fines || []).filter((f) => f.id !== fineId),
    finesPrivate: (data.finesPrivate || []).filter((p) => p.fineId !== fineId),
    fineScans: (data.fineScans || []).filter((s) => s.fineId !== fineId),
  };
}

// מחיקת חברת ליסינג: הרכבים נשארים, הקישור מתנתק.
export function removeLeaseCompanyDetach(data, companyId) {
  return {
    ...data,
    leaseCompanies: (data.leaseCompanies || []).filter((c) => c.id !== companyId),
    vehicles: (data.vehicles || []).map((v) =>
      v.leaseCompanyId === companyId ? { ...v, leaseCompanyId: null } : v
    ),
  };
}

export function removeDocument(data, documentId) {
  return {
    ...data,
    documents: (data.documents || []).filter((d) => d.id !== documentId),
  };
}

export function removeFineScan(data, scanId) {
  return {
    ...data,
    fineScans: (data.fineScans || []).filter((s) => s.id !== scanId),
    fines: (data.fines || []).map((f) => (f.scanId === scanId ? { ...f, scanId: null } : f)),
  };
}
