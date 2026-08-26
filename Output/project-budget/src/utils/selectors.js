// ============================================================================
// selectors.js — חיתוך המצב הגלובלי לפרויקט אחד.
//
// המודל רב-פרויקטי מהיום הראשון: כל ישות נושאת `projectId`, וכל מסך עובד על
// חתך של פרויקט יחיד. הפונקציה הזו היא הגבול — מעבר לה אף מסך לא רואה נתונים
// של פרויקט אחר, וזה גם מה שיהפוך אחר כך לגבול ההרשאות בענן.
// ============================================================================

import { ENTITY_COLLECTIONS } from "../constants.js";

export function projectSlice(data, projectId) {
  const project = (data.projects || []).find((p) => p.id === projectId) || null;
  const slice = { project };
  for (const key of ENTITY_COLLECTIONS) {
    slice[key] = (data[key] || []).filter((x) => x.projectId === projectId);
  }
  return slice;
}

export const byId = (list, id) => (list || []).find((x) => x.id === id) || null;

export const vendorName = (invoice, vendors) =>
  invoice.vendorName || byId(vendors, invoice.vendorId)?.name || "—";

/** החודש הנוכחי כמחרוזת "YYYY-MM" — נקודת ה-asOf של התזרים. */
export const currentMonth = () => new Date().toISOString().slice(0, 7);

/** האם שורה זקוקה לתשומת לב — משמש לסימון ברשימות. */
export const invoiceFlags = (invoice, payments) => {
  const paid = (payments || [])
    .filter((p) => p.invoiceId === invoice.id)
    .reduce((s, p) => s + p.amount, 0);
  const overdue =
    invoice.dueDate &&
    invoice.status !== "paid" &&
    invoice.status !== "rejected" &&
    invoice.dueDate < new Date().toISOString().slice(0, 10);
  return {
    paid: Math.round(paid * 100) / 100,
    balance: Math.round((invoice.amountGross - paid) * 100) / 100,
    overdue: !!overdue,
    unallocated: !invoice.costLineId,
  };
};
