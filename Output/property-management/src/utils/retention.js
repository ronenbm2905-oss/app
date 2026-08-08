// ============================================================================
// retention.js — B-RET (שער עדי): מימוש טכני של זכות המחיקה פר-דייר (תיקון 13).
// חוזה מסתיים / דייר עוזב → חייבת להיות דרך למחוק את כל ה-PII שלו. הפונקציה
// כאן היא היכולת הטכנית; מדיניות תקופת-השמירה הסופית תיקבע במדיניות הפרטיות
// (טיוטת שלד של עדי — ⚖️ לאישור עו"ד). ZDR של Anthropic מכסה את צד המעבד;
// המסמכים שנשמרים אצל הבעלים נמחקים דרך מסלול זה (Firestore diff + Storage).
// ============================================================================

export const RETENTION_NOTE =
  "מחיקת דייר מסירה לצמיתות את פרטיו וכל הנתונים המקושרים אליו (חוזים, מסמכים, " +
  "תקלות שדיווח, חובות). מדיניות תקופת-השמירה לאחר סוף חוזה — בטיוטת מדיניות הפרטיות.";

// מסיר דייר וכל הישויות המקושרות אליו. פונקציה טהורה — מחזירה state חדש (ל-smoke).
// המחיקה מתפשטת לענן דרך writeOwnerDiff (שמזהה מסמכים שנעלמו מהמערכים).
export function removeTenantCascade(state, tenantId) {
  if (!state || !tenantId) return state;
  const leaseIdSet = new Set(
    (state.leases || []).filter((l) => l.tenantId === tenantId).map((l) => l.id)
  );
  return {
    ...state,
    tenants: (state.tenants || []).filter((tn) => tn.id !== tenantId),
    leases: (state.leases || []).filter((l) => l.tenantId !== tenantId),
    documents: (state.documents || []).filter(
      (d) => d.tenantId !== tenantId && !leaseIdSet.has(d.leaseId)
    ),
    tickets: (state.tickets || []).filter((tk) => tk.reportedByTenantId !== tenantId),
    debts: (state.debts || []).filter((db) => db.tenantId !== tenantId),
  };
}
