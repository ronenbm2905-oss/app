// ============================================================================
// access.js — לוגיקת תפקידים ובידוד נתונים (פונקציות טהורות).
// זהו הקו הלוגי המקביל ל-firestore.rules: מה כל תפקיד רואה. הבידוד האמיתי בענן
// נאכף ב-rules; כאן זו האכיפה בצד-לקוח למצב מקומי + הסתרת שדות ב-UI.
//
// עיקרון: tenant רואה אך ורק ישויות שבהן הוא ה-tenant המקושר, ובלי שום נתון
// כלכלי של הבעלים. maintenance רואה אך ורק tickets שהוא ה-assignee שלהם, בלי
// נתונים כלכליים ובלי PII של דיירים.
// ============================================================================

export const ROLES = ["owner", "tenant", "maintenance"];

// זיהוי הדייר של המשתמש הנוכחי (לפי userId או email).
export function tenantForIdentity(state, identity) {
  if (!identity) return null;
  return (
    (state.tenants || []).find(
      (t) =>
        (identity.uid && t.userId === identity.uid) ||
        (identity.email && t.email && t.email.toLowerCase() === identity.email.toLowerCase())
    ) || null
  );
}

// זיהוי מפתח-שיוך של איש תחזוקה (userId או email) שקיים על tickets.
export function assigneeKeyForIdentity(state, identity) {
  if (!identity) return null;
  const byUid =
    identity.uid &&
    (state.tickets || []).some((tk) => tk.assigneeUserId === identity.uid);
  if (byUid) return { userId: identity.uid };
  const emailLc = identity.email && identity.email.toLowerCase();
  const byEmail =
    emailLc &&
    (state.tickets || []).some(
      (tk) => tk.assigneeEmail && tk.assigneeEmail.toLowerCase() === emailLc
    );
  if (byEmail) return { email: emailLc };
  return null;
}

function ticketBelongsToAssignee(tk, key) {
  if (!key) return false;
  if (key.userId) return tk.assigneeUserId === key.userId;
  if (key.email)
    return tk.assigneeEmail && tk.assigneeEmail.toLowerCase() === key.email;
  return false;
}

// --- תצוגת נכס מצומצמת: כתובת/סוג/סטטוס/מטבע בלבד. בלי finance/תשואה/הצמדות פרטיות. ---
export function publicPropertyView(property) {
  if (!property) return null;
  return {
    id: property.id,
    address: property.address,
    type: property.type,
    status: property.status,
    currency: property.currency,
  };
}

// ============ פורטל דייר (מסך 6) ============
// מחזיר אך ורק את הישויות של הדייר. אין גישה לנכסים/דיירים אחרים או לנתוני בעלים.
export function tenantView(state, tenantId) {
  const tenant = (state.tenants || []).find((t) => t.id === tenantId) || null;
  if (!tenant) return null;

  const leases = (state.leases || []).filter((l) => l.tenantId === tenantId);
  const propertyIds = new Set(leases.map((l) => l.propertyId));
  const properties = (state.properties || [])
    .filter((p) => propertyIds.has(p.id))
    .map(publicPropertyView); // ← ללא נתונים כלכליים

  const leaseIds = new Set(leases.map((l) => l.id));
  const documents = (state.documents || []).filter(
    (d) => d.tenantId === tenantId || (d.leaseId && leaseIds.has(d.leaseId))
  );

  // תקלות שהדייר עצמו דיווח (הוא לא רואה תקלות אחרות של הנכס).
  const tickets = (state.tickets || [])
    .filter((tk) => tk.reportedByTenantId === tenantId)
    .map(maintenanceSafeTicket); // בלי שדות כלכליים

  // יתרת תשלומים: חובות פתוחים המשויכים לדייר בלבד (לא תזרים הבעלים).
  const openBalance = (state.debts || [])
    .filter((d) => d.tenantId === tenantId && !d.resolved)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return { tenant, leases, properties, documents, tickets, openBalance };
}

// ============ אפליקציית תחזוקה (מסך 7) ============
// מחזיר אך ורק tickets המשויכים לאיש התחזוקה, עם נתוני נכס מצומצמים.
export function maintenanceView(state, assigneeKey) {
  const propById = Object.fromEntries((state.properties || []).map((p) => [p.id, p]));
  const tickets = (state.tickets || [])
    .filter((tk) => ticketBelongsToAssignee(tk, assigneeKey))
    .map((tk) => ({
      ...maintenanceSafeTicket(tk),
      property: publicPropertyView(propById[tk.propertyId]), // כתובת בלבד, בלי finance
    }));
  return { tickets };
}

// תקלה "בטוחה" לתפקידים לא-בעלים: מסירה שדות כלכליים ו-handler פרטי.
// משאירה: סוג, תיאור, סטטוס, תאריך פתיחה, תמונות שטח, שיוך.
export function maintenanceSafeTicket(tk) {
  return {
    id: tk.id,
    propertyId: tk.propertyId,
    openedDate: tk.openedDate,
    type: tk.type,
    description: tk.description,
    status: tk.status,
    assigneeUserId: tk.assigneeUserId,
    assigneeEmail: tk.assigneeEmail,
    reportedByTenantId: tk.reportedByTenantId,
    fieldPhotos: tk.fieldPhotos || [],
    // הושמטו במכוון: quote, cost, receiptRef, insurance, underWarranty, handler
  };
}

// אילו שדות מותר ל-maintenance לשנות (מקביל לבדיקת ה-diff ב-rules).
export const MAINTENANCE_WRITABLE_FIELDS = ["status", "fieldPhotos"];

// בדיקה: עדכון של maintenance נוגע רק בשדות המותרים (סטטוס/תמונות).
export function isMaintenanceUpdateAllowed(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (MAINTENANCE_WRITABLE_FIELDS.includes(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) return false;
  }
  return true;
}
