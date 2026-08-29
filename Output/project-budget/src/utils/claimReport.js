// ============================================================================
// claimReport.js — בניית דוח ההגשה למנה.
//
// זה המסמך שרונן מוסר לרשות (או לשמאי) כדי להצדיק את המנה: רשימת החשבוניות,
// הסכומים, וההשלמה — מול היעד.
//
// חוק ברזל: **הדוח מכין הגשה, הוא לא מגיש.** לכן הוא נושא כותרת שמצהירה זאת,
// והוא מדפיס גם את מה שלא בסדר במקום להסתיר: חשבונית בלי מספר, בלי תאריך,
// או פער שנותר מול היעד. מסמך שמסתיר את החורים שלו גרוע ממסמך שאין.
// ============================================================================

import { round2, sum } from "./money.js";
import { fmtDate } from "./dates.js";
import { batchSummary, claimAmountOf } from "./claims.js";

/**
 * @returns {{ header, rows, totals, warnings }}
 */
export function buildClaimReport({ project, batch, invoices }) {
  const mine = invoices
    .filter((i) => i.claimBatchId === batch.id)
    .sort((a, b) => (a.issueDate || "9999").localeCompare(b.issueDate || "9999"));

  const s = batchSummary(batch, invoices);

  const rows = mine.map((inv, idx) => ({
    n: idx + 1,
    vendorName: inv.vendorName || "—",
    invoiceNumber: inv.invoiceNumber || "",
    issueDate: inv.issueDate || "",
    amountNet: inv.amountNet,
    vatAmount: inv.vatAmount,
    amountGross: inv.amountGross,
    claimAmount: claimAmountOf(inv),
    /** דרישה חלקית — הרשות רואה סכום שונה מהחשבונית, וזה חייב להיות גלוי. */
    isPartial: Math.abs(claimAmountOf(inv) - inv.amountGross) > 0.01,
  }));

  const totals = {
    count: rows.length,
    net: sum(rows, (r) => r.amountNet),
    vat: sum(rows, (r) => r.vatAmount),
    gross: sum(rows, (r) => r.amountGross),
    claimTotal: sum(rows, (r) => r.claimAmount),
    topUp: round2(batch.topUpAmount),
    submitted: s.submittedTotal,
    target: s.targetAmount,
    gap: s.gapToTarget,
  };

  const warnings = [];
  const noDate = rows.filter((r) => !r.issueDate).length;
  const noNumber = rows.filter((r) => !r.invoiceNumber).length;
  if (!rows.length) warnings.push("אין חשבוניות משויכות למנה — הדוח ריק.");
  if (noDate) warnings.push(`${noDate} חשבוניות בלי תאריך.`);
  if (noNumber) warnings.push(`${noNumber} חשבוניות בלי מספר חשבונית.`);
  if (totals.gap > 0.01)
    warnings.push(`חסרים ${Math.round(totals.gap).toLocaleString("he-IL")} ₪ כדי להגיע ליעד המנה.`);
  if (totals.gap < -0.01)
    warnings.push(`המנה חורגת ב-${Math.round(-totals.gap).toLocaleString("he-IL")} ₪ מעל היעד.`);
  if (s.unbacked > 0.01)
    warnings.push(
      `${Math.round(s.unbacked).toLocaleString("he-IL")} ₪ מתוכננים בגיליון ועדיין בלי חשבונית מאחור.`,
    );
  if (rows.some((r) => r.isPartial)) warnings.push("יש חשבוניות שנדרשות בחלקן בלבד.");

  return {
    header: {
      projectName: project.name,
      // הייבוא מציב את שם הפרויקט גם ככתובת; הדפסת שניהם נראית כמו תקלה.
      address: project.address === project.name ? "" : project.address,
      authority: project.taxAuthorityName,
      batchTitle: batch.title,
      /** כותרת המנה כבר מזכירה לרוב את שם הרשות — בלי זה יוצא "…למס רכוש — הגשה למס רכוש". */
      titleMentionsAuthority: String(batch.title || "").includes(project.taxAuthorityName),
      seq: batch.seq,
      plannedDate: batch.plannedDate,
      submittedDate: batch.submittedDate,
      isSubmitted: !!batch.submittedDate,
    },
    rows,
    totals,
    warnings,
  };
}

/** ציטוט לשדה CSV — פסיק, גרשיים ושורה חדשה שוברים את הקובץ בלי זה. */
const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV לאקסל. **ה-BOM אינו קישוט**: בלעדיו אקסל בעברית קורא UTF-8 כ-Windows-1255
 * ומציג ג׳יבריש — התקלה הכי נפוצה בייצוא עברי, ובדיוק זו שהופכת דוח שימושי
 * לקובץ שאי אפשר לפתוח.
 */
export function claimReportCsv(report) {
  const { header, rows, totals } = report;
  const lines = [];

  lines.push([header.projectName, header.address].filter(Boolean).map(csvCell).join(","));
  lines.push(csvCell(header.titleMentionsAuthority ? header.batchTitle : `${header.batchTitle} — הגשה ל${header.authority}`));
  lines.push(
    csvCell(
      header.isSubmitted
        ? `הוגש בתאריך ${fmtDate(header.submittedDate)}`
        : `מועד הגשה מתוכנן ${fmtDate(header.plannedDate) || "—"} · טרם הוגש`,
    ),
  );
  lines.push("");

  lines.push(["#", "ספק", "מס׳ חשבונית", "תאריך", "לפני מע״מ", "מע״מ", "כולל מע״מ", "נדרש"].join(","));
  for (const r of rows) {
    lines.push(
      [
        r.n,
        csvCell(r.vendorName),
        csvCell(r.invoiceNumber),
        fmtDate(r.issueDate),
        r.amountNet,
        r.vatAmount,
        r.amountGross,
        r.claimAmount,
      ].join(","),
    );
  }

  lines.push("");
  lines.push(["", "סה״כ חשבוניות", "", "", totals.net, totals.vat, totals.gross, totals.claimTotal].join(","));
  if (totals.topUp > 0) lines.push(["", "השלמת חשבונית", "", "", "", "", "", totals.topUp].join(","));
  lines.push(["", "סה״כ להגשה", "", "", "", "", "", totals.submitted].join(","));
  lines.push(["", "יעד המנה", "", "", "", "", "", totals.target].join(","));
  if (Math.abs(totals.gap) > 0.01) lines.push(["", "פער ליעד", "", "", "", "", "", totals.gap].join(","));

  return "﻿" + lines.join("\r\n");
}

export function downloadClaimCsv(report) {
  const name = `הגשה-מנה-${report.header.seq}-${report.header.projectName}.csv`.replace(
    /[\\/:*?"<>|]/g,
    "",
  );
  const blob = new Blob([claimReportCsv(report)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
