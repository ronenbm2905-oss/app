// ============================================================================
// smoke.mjs — בדיקות עשן על שלושת המנועים.
//
// הרצה: npm run smoke
//
// חלק מהבדיקות רצות על **נתוני פינסקר 9 האמיתיים** אם `seed/pinsker-9.json`
// קיים (נוצר ע"י `npm run import:pinsker`). בלעדיו הן מדולגות ומדווחות —
// אף פעם לא "עוברות בשקט". זו הייתה טעות אמיתית בפרויקט קודם: בדיקה עם
// רגקס שגוי שעברה על מחרוזת ריקה ונחשבה ירוקה.
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { round2, sum, withVat, fromGross } from "../src/utils/money.js";
import { addMonths, monthDiff, monthRange, addDays, excelSerialToISO } from "../src/utils/dates.js";
import { normalize, makeInvoice, makeClaimBatch, allocatedTotal, unallocated } from "../src/schema.js";
import { batchSummary, suggestedTopUp, availableForBatch, expectedRefundDate, derivedBatchStatus, claimsOverview } from "../src/utils/claims.js";
import { buildCashflow, stressTest, delayToMonths } from "../src/utils/cashflow.js";
import { chapterRollup, boqSummary, costLineRollup, itemActuals, paidOnInvoice } from "../src/utils/variance.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(HERE, "../seed/pinsker-9.json");

let pass = 0;
let fail = 0;
let skipped = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (cond) pass++;
  else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const eq = (name, actual, expected, tol = 0.01) =>
  ok(name, Math.abs(actual - expected) <= tol, `קיבלנו ${actual}, ציפינו ${expected}`);
const section = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`);

// ============================================================================
section("כסף ותאריכים");
// ============================================================================
eq("round2 מגלגל אגורה", round2(0.1 + 0.2), 0.3);
eq("sum על ריק", sum([]), 0);
{
  const v = withVat(7695682, 0.18);
  eq("מע\"מ 18% על סכום הגיליון", v.amountGross, 9080904.76);
  eq("נטו + מע\"מ = ברוטו", round2(v.amountNet + v.vatAmount), v.amountGross);
}
{
  const v = fromGross(1500000, 0.18);
  eq("פירוק ברוטו חזרה לברוטו", v.amountGross, 1500000);
  eq("פירוק ברוטו — הרכיבים נסגרים", round2(v.amountNet + v.vatAmount), 1500000);
}
ok("addMonths חוצה שנה", addMonths("2026-12", 1) === "2027-01");
ok("addMonths אחורה", addMonths("2027-01", -1) === "2026-12");
eq("monthDiff על טווח הפרויקט", monthDiff("2026-08", "2028-03"), 19);
eq("monthRange כולל את שני הקצוות", monthRange("2026-08", "2028-03").length, 20);
ok("addDays חוצה חודש", addDays("2026-10-11", 60) === "2026-12-10");
ok("סריאל אקסל → ISO", excelSerialToISO(46296) === "2026-10-01");
ok(
  "הסריאל השגוי בגיליון אכן מצביע על 2026 ולא 2027",
  excelSerialToISO(46023).startsWith("2026-01"),
);

// ============================================================================
section("סכימה");
// ============================================================================
{
  const inv = makeInvoice({ amountNet: 100000, vatRate: 0.18 });
  eq("חשבונית מנטו — מע\"מ", inv.vatAmount, 18000);
  eq("חשבונית מנטו — ברוטו", inv.amountGross, 118000);
  ok("ברירת מחדל: טיוטה + זכאית", inv.status === "draft" && inv.claimStatus === "eligible");
  ok("boqAllocations תמיד מערך", Array.isArray(inv.boqAllocations));
}
{
  const inv = makeInvoice({ amountGross: 63190, vatRate: 0.18 });
  eq("חשבונית מברוטו נשמרת על הברוטו", inv.amountGross, 63190);
}
{
  const inv = makeInvoice({
    amountGross: 100000,
    vatRate: 0,
    boqAllocations: [{ boqItemId: "a", amount: 60000 }, { boqItemId: "b", amount: 30000 }],
  });
  eq("סכום ההקצאות", allocatedTotal(inv), 90000);
  eq("יתרה לא מוקצית", unallocated(inv), 10000);
}
{
  const n = normalize({ invoices: [{ amountGross: 5 }], junk: 1 });
  ok("normalize ממלא אוספים חסרים", Array.isArray(n.payments) && Array.isArray(n.boqItems));
  ok("normalize מריץ factory על שורות", n.invoices[0].id && n.invoices[0].status === "draft");
}

// ============================================================================
section("מנועי מנות (claims)");
// ============================================================================
{
  // שחזור מנה 1 מהגיליון של רונן: 317,486 + 63,190 + 897,500 = 1,278,176,
  // ואז השלמה של 221,824 כדי לסגור על 1.5 מיליון.
  const batch = makeClaimBatch({ id: "b1", seq: 1, targetAmount: 1500000, plannedDate: "2026-10-11" });
  const invoices = [317486, 63190, 897500].map((amountGross, i) =>
    makeInvoice({ id: `i${i}`, amountGross, vatRate: 0, claimBatchId: "b1", claimStatus: "submitted" }),
  );
  eq("מנה 1 — סכום החשבוניות", batchSummary(batch, invoices).invoicesTotal, 1278176);
  eq("מנה 1 — ההשלמה המוצעת", suggestedTopUp(batch, invoices), 221824);

  batch.topUpAmount = 221824;
  const s = batchSummary(batch, invoices);
  eq("מנה 1 — סה\"כ להגשה", s.submittedTotal, 1500000);
  eq("מנה 1 — פער ליעד", s.gapToTarget, 0);
  ok("מנה 1 — מאוזנת", s.isBalanced);

  ok("מנה שטרם הוגשה = בהכנה", derivedBatchStatus(batch, invoices) === "planning");
  batch.submittedDate = "2026-10-11";
  ok("מנה שהוגשה = הוגשה", derivedBatchStatus(batch, invoices) === "submitted");
  ok("מועד החזר צפוי = הגשה + 60", expectedRefundDate(batch) === "2026-12-10");

  batch.actualRefundDate = "2026-12-20";
  batch.refundedAmount = 1400000;
  const s2 = batchSummary(batch, invoices);
  eq("קיצוץ הרשות מזוהה", s2.reduction, 100000);
  ok("החזר חלקי מזוהה", derivedBatchStatus(batch, invoices) === "partiallyRefunded");
}
{
  // אין השלמה שלילית: מנה שעברה את היעד מציעה 0, לא מספר שלילי.
  const batch = makeClaimBatch({ id: "b2", targetAmount: 100000 });
  const invoices = [makeInvoice({ amountGross: 150000, vatRate: 0, claimBatchId: "b2" })];
  eq("השלמה לא יורדת מתחת לאפס", suggestedTopUp(batch, invoices), 0);
  eq("חריגה מעל היעד מדווחת כשלילי", batchSummary(batch, invoices).gapToTarget, -50000);
}
{
  const invoices = [
    makeInvoice({ projectId: "p", claimStatus: "eligible" }),
    makeInvoice({ projectId: "p", claimStatus: "eligible", claimBatchId: "b1" }),
    makeInvoice({ projectId: "p", claimStatus: "notEligible" }),
    makeInvoice({ projectId: "other", claimStatus: "eligible" }),
  ];
  eq("זמינות למנה: רק זכאיות פנויות מהפרויקט", availableForBatch(invoices, "p").length, 1);
}

// ============================================================================
section("מנוע תזרים (cashflow)");
// ============================================================================
eq("60 יום = 2 חודשים", delayToMonths(60), 2);
eq("90 יום = 3 חודשים", delayToMonths(90), 3);
{
  const slice = {
    project: { startMonth: "2026-01", endMonth: "2026-04", openingCash: 0 },
    costLines: [{ schedule: [{ month: "2026-02", amount: 100 }, { month: "2026-03", amount: 100 }] }],
    payments: [],
    fundingEvents: [
      { type: "ownerMonthly", month: "2026-01", plannedAmount: 150, actualAmount: null },
      { type: "taxRefund", month: "2026-02", plannedAmount: 50, actualAmount: null },
    ],
  };
  const base = buildCashflow(slice);
  eq("יתרת סגירה מאוזנת", base.totals.closingBalance, 0);
  ok("בלי דחייה — אין חודש שלילי", base.firstNegative === null);

  const delayed = buildCashflow(slice, { delayDays: 60 });
  ok("עם דחייה — נפתח חור", delayed.firstNegative !== null);
  eq("גודל החור", delayed.shortfall, 50);
  eq("יתרת הסגירה לא משתנה מדחייה", delayed.totals.closingBalance, 0);

  const stress = stressTest(slice, [0, 30, 60]);
  eq("stressTest מחזיר שורה לכל תרחיש", stress.length, 3);
  ok("תרחיש 0 נקי", stress[0].shortfall === 0);
}
{
  // asOfMonth: עד החודש הזה סופרים ביצוע, אחריו תכנון.
  const slice = {
    project: { startMonth: "2026-01", endMonth: "2026-02", openingCash: 1000 },
    costLines: [{ schedule: [{ month: "2026-01", amount: 500 }, { month: "2026-02", amount: 500 }] }],
    payments: [{ date: "2026-01-15", amount: 200 }],
    fundingEvents: [],
  };
  const r = buildCashflow(slice, { asOfMonth: "2026-01" });
  eq("חודש שעבר משתמש בביצוע", r.months[0].effectiveOut, 200);
  eq("חודש עתידי משתמש בתכנון", r.months[1].effectiveOut, 500);
  const plan = buildCashflow(slice);
  eq("בלי asOf — תכנון טהור", plan.months[0].effectiveOut, 500);
}
{
  const slice = {
    project: { startMonth: "2026-01", endMonth: "2026-01", openingCash: 0 },
    costLines: [{ schedule: [{ month: "2026-01", amount: 500 }] }],
    payments: [],
    fundingEvents: [],
  };
  ok("חודש שעבר בלי ביצוע מסומן", buildCashflow(slice, { asOfMonth: "2026-01" }).months[0].missingActuals);
}

// ============================================================================
section("מנוע תקציב מול ביצוע (variance)");
// ============================================================================
{
  const boq = [
    { id: "x1", chapter: "02", chapterName: "בטון", priceInitial: 0, priceSubmitted: 100, priceApproved: 0, isChapterTotal: false },
    { id: "x2", chapter: "02", chapterName: "בטון", priceInitial: 1000, priceSubmitted: 900, priceApproved: 400, isChapterTotal: true },
  ];
  const invoices = [
    makeInvoice({ id: "iA", amountGross: 600, vatRate: 0, status: "paid", boqAllocations: [{ boqItemId: "x1", amount: 600 }] }),
    makeInvoice({ id: "iB", amountGross: 900, vatRate: 0, status: "draft", boqAllocations: [{ boqItemId: "x1", amount: 900 }] }),
  ];
  const payments = [{ invoiceId: "iA", amount: 300, date: "2026-01-01" }];
  const [row] = chapterRollup(boq, invoices, payments);
  eq("בסיסים נלקחים משורת הפרק", row.initial, 1000);
  eq("קיצוץ הרשות", row.taxCut, -500);
  eq("טיוטה לא נספרת כמחויבת", row.committed, 600);
  eq("תשלום חלקי מתגלגל", row.paid, 300);
  eq("חריגה מול אושר", row.varianceVsApproved, 200);
  eq("חריגה מול ראשוני", row.varianceVsInitial, -400);
  eq("שורת הפרק לא נספרת כסעיף", row.items.length, 1);
}
{
  // תשלום מתחלק בין סעיפים לפי חלקם היחסי בחשבונית.
  const inv = makeInvoice({
    id: "i1",
    amountGross: 1000,
    vatRate: 0,
    status: "paid",
    boqAllocations: [{ boqItemId: "a", amount: 750 }, { boqItemId: "b", amount: 250 }],
  });
  const m = itemActuals([inv], [{ invoiceId: "i1", amount: 400 }]);
  eq("פיצול יחסי — סעיף א", m.get("a").paid, 300);
  eq("פיצול יחסי — סעיף ב", m.get("b").paid, 100);
  eq("סכום התשלומים על חשבונית", paidOnInvoice(inv, [{ invoiceId: "i1", amount: 400 }]), 400);
}
{
  const lines = [{ id: "cl1", name: "עבודות", order: 0, budgetGross: 1000, paidBefore: 100, schedule: [{ month: "2026-01", amount: 900 }] }];
  const invoices = [makeInvoice({ id: "i", costLineId: "cl1", amountGross: 500, vatRate: 0, status: "approved" })];
  const [row] = costLineRollup(lines, invoices, [{ invoiceId: "i", amount: 200 }]);
  eq("מחויב על שורת-על", row.committed, 500);
  eq("שולם כולל תשלומי-עבר", row.paid, 300);
  eq("טרם מחויב", row.uncommitted, 400);
  eq("חריגה מהתקציב", row.overBudget, -400);
}

// ============================================================================
section("נתוני פינסקר 9 האמיתיים");
// ============================================================================
if (!existsSync(SEED)) {
  skipped += 1;
  console.log("  ⚠ seed/pinsker-9.json חסר — הרץ `npm run import:pinsker`. הבדיקות האלה דולגו.");
} else {
  const raw = JSON.parse(readFileSync(SEED, "utf8"));
  const data = normalize(raw);
  // מכוון: הפרויקט נלקח **אחרי** normalize ולא מהקובץ הגולמי. מיזוג של השניים
  // מסתיר שדות שה-factory שוכח להעביר — כך בדיוק נעלמה תקרת ההחזר והמסך הראה 0.
  const project = data.projects[0];
  eq("תקרת ההחזר שורדת את הנרמול", project.entitlementCap, 4780215);
  eq("מקדמה שהתקבלה שורדת את הנרמול", project.entitlementReceived, 1500000);

  // ה-seed קיים בשני מצבים לגיטימיים: לפני `import:payments` ואחריו. בדיקות
  // שתקפות רק לאחד מהם מסומנות במפורש — אחרת ייבוא התשלומים "שובר" בדיקות
  // שפשוט מתארות מצב קודם, וזה מרעיל את האמון בכל החבילה.
  const withPayments = data.invoices.some((i) => i.notes?.includes("ייבוא תשלומים"));

  eq("5 שורות עלות", data.costLines.length, 5);
  eq("תקציב הפרויקט", sum(data.costLines, (c) => c.budgetGross), 9256727);
  if (!withPayments) {
    eq("שולם לפני תחילת המעקב", sum(data.costLines, (c) => c.paidBefore), 309933);
  }
  eq("20 חודשי תזרים", monthRange(project.startMonth, project.endMonth).length, 20);
  eq("91 סעיפי כתב כמויות", data.boqItems.filter((b) => !b.isChapterTotal).length, 91);
  eq("23 פרקים", data.boqItems.filter((b) => b.isChapterTotal).length, 23);

  const rollup = chapterRollup(data.boqItems, data.invoices, data.payments);
  const bs = boqSummary(rollup);
  eq("כתב כמויות — ראשוני", bs.initial, 6573052);
  eq("כתב כמויות — הוגש", bs.submitted, 6177238);
  eq("כתב כמויות — אושר סופי", bs.approved, 4051030);
  eq("קיצוץ מס רכוש (לפני מע\"מ)", bs.taxCut, -2126208);
  eq("קיצוץ מס רכוש (כולל מע\"מ)", round2(bs.taxCut * 1.18), -2508925.44);

  const ch02 = rollup.find((r) => r.chapter === "02");
  eq("פרק 02 — ראשוני", ch02.initial, 1267865);
  eq("פרק 02 — אושר", ch02.approved, 425040);
  eq("פרק 02 — קיצוץ", ch02.taxCut, -842825);

  // התזרים חייב לשחזר את הגריד: מקורות = עלויות = 8,946,794.
  const slice = {
    project,
    costLines: data.costLines,
    payments: data.payments,
    fundingEvents: data.fundingEvents,
  };
  const cf = buildCashflow(slice);
  eq("תזרים — סה\"כ יוצא", cf.totals.plannedOut, 8946794);
  eq("תזרים — סה\"כ נכנס", cf.totals.plannedIn, 8946794);
  eq("תזרים — 20 חודשים", cf.months.length, 20);
  ok("תזרים תכנוני — הקופה לא נשברת", cf.firstNegative === null,
     `נשבר ב-${cf.firstNegative?.month}`);
  // התזרים מאוזן: מקורות = עלויות. מה שנשאר בסוף הוא בדיוק יתרת הפתיחה.
  eq("תזרים — יתרת סגירה = יתרת הפתיחה", cf.totals.closingBalance, project.openingCash);
  console.log(`  חודשים בלי כרית מזומנים בתוכנית: ${cf.zeroBufferMonths} מתוך ${cf.months.length}`);

  if (!withPayments) {
    // ★ הממצא כשמניחים יתרת פתיחה 0 (כמו בגיליון המקורי): התוכנית מאוזנת
    // אבל נוחתת על אפס בתשעה חודשים — כלומר בלי שום כרית.
    eq("בלי יתרת פתיחה — תשעה חודשים על אפס", cf.zeroBufferMonths, 9);
    eq("בלי יתרת פתיחה — עיכוב 60 יום פותח חור", stressTest(slice, [60])[0].shortfall, 915000);
  } else {
    // ★ ועם 809,451 שנותרו מהמקדמות: הכרית קיימת, והחור מצטמצם פי תשעה.
    eq("יתרת פתיחה מהמקדמות", project.openingCash, 809451);
    eq("עם יתרת פתיחה — אין חודש בלי כרית", cf.zeroBufferMonths, 0);
    eq("עם יתרת פתיחה — החור ב-60 יום מצטמצם", stressTest(slice, [60])[0].shortfall, 105549);
    eq("עיכוב 30 יום נספג לגמרי", stressTest(slice, [30])[0].shortfall, 0);
  }

  // ★ הבדיקה שבגללה נבנה המנוע: מה קורה כשמס רכוש מאחר.
  const stress = stressTest(slice, [0, 30, 60, 90]);
  ok("תרחיש 0 — אין חור", stress[0].shortfall === 0);
  ok("תרחיש 60 — נפתח חור מזומנים", stress[2].shortfall > 0,
     `shortfall=${stress[2].shortfall}`);
  ok("ככל שהדחייה גדלה החור לא קטן",
     stress[1].shortfall <= stress[2].shortfall && stress[2].shortfall <= stress[3].shortfall);
  console.log(
    "  תרחישי דחיית מס רכוש: " +
      stress.map((s) => `${s.delayDays}י→${s.shortfall ? `חסר ${Math.round(s.shortfall).toLocaleString("he-IL")} מ-${s.firstNegative.month}` : "תקין"}`).join(" · "),
  );

  const ov = claimsOverview(
    data.claimBatches,
    data.invoices,
    project.entitlementCap,
    project.entitlementReceived,
  );
  eq("3 מנות", ov.batches.length, 3);
  eq("סה\"כ יעדי המנות = תקרת ההחזר", sum(ov.batches, (b) => b.targetAmount), 4780215);
  eq("מנה 1 — יעד", ov.batches[0].targetAmount, 1500000);
  eq("מנה 1 — השלמה מהגיליון", ov.batches[0].topUpAmount, 221824);
  eq("טרם הוגש דבר", ov.submittedTotal, 0);

  if (!withPayments) {
    // לפני ייבוא התשלומים המנות **מתוכננות ולא מגובות**: יש להן יעד ורכיבים
    // מהגיליון, אבל אין מאחוריהן חשבוניות במערכת.
    for (const b of ov.batches) {
      eq(`מנה ${b.batch.seq}: רכיבים מתוכננים + השלמה = יעד`,
         round2(b.plannedTotal + b.topUpAmount), b.targetAmount);
      eq(`מנה ${b.batch.seq}: הכול עדיין לא מגובה בחשבוניות`, b.unbacked, b.plannedTotal);
      eq(`מנה ${b.batch.seq}: אין חשבוניות משויכות`, b.invoiceCount, 0);
    }
    eq("מנה 1 — רכיבים מהגיליון", ov.batches[0].plannedTotal, 1278176);
  } else {
    // אחרי הייבוא, "חשבוניות עד כה" הוחלף בחשבוניות אמיתיות. הרכיב המתוכנן
    // הוסר כדי שאותו כסף לא ייספר פעמיים — פעם כתוכנית ופעם כחשבונית.
    eq("מנה 1 — רכיבים שנותרו מתוכננים", ov.batches[0].plannedTotal, 960690);
    eq("מנה 1 — רכיבים + חשבוניות + השלמה = יעד",
       round2(ov.batches[0].plannedTotal + ov.batches[0].invoicesTotal + ov.batches[0].topUpAmount),
       1500000);
    for (const b of ov.batches.slice(1)) {
      eq(`מנה ${b.batch.seq}: לא הושפעה מהייבוא`,
         round2(b.plannedTotal + b.topUpAmount), b.targetAmount);
    }
  }
  // המקדמה שכבר התקבלה מנוכה מהזכאות גם בלי מנה מאחוריה — אחרת המסך מבטיח
  // 4.78 מיליון שכבר לא כולם זמינים.
  eq("יתרת זכאות מנכה את המקדמה", ov.remainingEntitlement, 3280215);

  const lines = costLineRollup(data.costLines, data.invoices, data.payments);
  eq("סה\"כ מתוכנן בלוח התשלומים", sum(lines, (r) => r.plannedTotal), 8946794);

  // --- שכבת התשלומים בפועל (רק אם `import:payments` רץ) --------------------
  const imported = data.invoices.filter((i) => i.notes?.includes("ייבוא תשלומים"));
  if (!imported.length) {
    skipped += 1;
    console.log("  ⚠ תשלומים לא יובאו — הרץ `npm run import:payments`. הבדיקות האלה דולגו.");
  } else {
    eq("14 תשלומים יובאו", imported.length, 14);
    eq("סה\"כ ששולם בפועל", sum(data.payments, (p) => p.amount), 690549);
    eq("כל התשלומים משויכים לחשבונית", data.payments.filter((p) => !p.invoiceId).length, 0);

    // ★ ההצלבה המרכזית: "חשבוניות עד כה 317,486" בגיליון הן בדיוק עשר השורות
    // שאחרי הטיל — לא הפירוקים שקדמו לו ולא שכר השמאי.
    const b1 = data.claimBatches.find((b) => b.seq === 1);
    const s1 = batchSummary(b1, data.invoices);
    eq("מנה 1 — מגובה בחשבוניות אמיתיות", s1.invoicesTotal, 317486);
    eq("מנה 1 — עשר חשבוניות", s1.invoiceCount, 10);
    eq(
      "פירוקים קודם לטיל אינם בדרישה",
      sum(data.invoices.filter((i) => i.claimStatus === "notEligible" && i.vendorName.startsWith("פירוק")), (i) => i.amountGross),
      63130,
    );

    // ספירה כפולה: שכר השמאי עבר מ-paidBefore לחשבוניות. אם שניהם נשארו,
    // "שולם" על שורת השמאי יציג 619,866 במקום 309,933.
    const appraiser = costLineRollup(data.costLines, data.invoices, data.payments).find(
      (l) => l.kind === "appraiser",
    );
    eq("שורת השמאי — שולם", appraiser.paid, 309933);
    eq("שורת השמאי — paidBefore אופס", appraiser.paidBefore, 0);
    eq("סה\"כ שולם בפרויקט", sum(costLineRollup(data.costLines, data.invoices, data.payments), (l) => l.paid), 690549);

    // לתשלומים אין תאריך במקור — הם חייבים להיספר ב"שולם" אך לא לשבש את
    // גרף היתרה החודשי, אחרת חודש מומצא היה נראה כמו חריגה אמיתית.
    const cfAfter = buildCashflow(slice, { asOfMonth: "2026-08" });
    eq("תשלומים בלי תאריך לא נכנסים לתזרים החודשי", cfAfter.totals.actualOut, 0);
    ok("התזרים התכנוני לא השתנה מהייבוא", buildCashflow(slice).firstNegative === null);
  }
}

// ============================================================================
// תפקידים — חייב להישאר תואם ל-firestore.rules (שנבדק מול האמולטור).

// ============================================================================
{
  const A = await import("../src/utils/access.js");
  const project = {
    memberRoles: { "ronen@x.com": "owner", "nihul@x.com": "manager", "ariel@x.com": "viewer" },
  };
  ok("בעלים מזוהה", A.roleOf(project, "ronen@x.com") === "owner");
  ok("זיהוי לא רגיש לאותיות גדולות", A.roleOf(project, "RONEN@X.com") === "owner");
  ok("זר אינו חבר", A.roleOf(project, "zar@x.com") === null);
  ok("ניהול כותב חשבוניות", A.canWriteCollection("manager", "invoices"));
  ok("ניהול כותב תשלומים", A.canWriteCollection("manager", "payments"));
  ok("ניהול נחסם משורות עלות", !A.canWriteCollection("manager", "costLines"));
  ok("ניהול נחסם מכתב כמויות", !A.canWriteCollection("manager", "boqItems"));
  ok("ניהול נחסם ממנות", !A.canWriteCollection("manager", "claimBatches"));
  ok("צופה לא כותב כלום", !A.canWriteCollection("viewer", "invoices"));
  ok("בעלים כותב הכול", A.canWriteCollection("owner", "claimBatches"));
  ok("רק בעלים נוגע בשדות הדרישה", A.canEditClaimFields("owner") && !A.canEditClaimFields("manager"));
  ok("רק בעלים מנהל הרשאות", A.canManageProject("owner") && !A.canManageProject("manager"));
  ok("אי אפשר להסיר בעלים יחיד", !A.canRemoveMember(project, "ronen@x.com"));
  ok("אפשר להסיר ניהול", A.canRemoveMember(project, "nihul@x.com"));
  ok("אפשר להסיר בעלים כשיש שניים",
     A.canRemoveMember({ memberRoles: { a: "owner", b: "owner" } }, "a"));
  ok("רשימת המיילים נגזרת ממפת התפקידים",
     A.memberEmailsOf(project).join(",") === "ariel@x.com,nihul@x.com,ronen@x.com");
  ok("בעלים ראשון ברשימה", A.memberList(project)[0].role === "owner");
}

// ============================================================================
// דוח ההגשה למנה.
// ============================================================================
{
  const { buildClaimReport, claimReportCsv } = await import("../src/utils/claimReport.js");
  const project = { name: "פינסקר 9", address: "פינסקר 9 ת\"א", taxAuthorityName: "מס רכוש" };
  const batch = makeClaimBatch({ id: "b1", seq: 1, title: "מנה 1", targetAmount: 1000, topUpAmount: 100, plannedDate: "2026-10-11" });
  const invoices = [
    makeInvoice({ id: "a", claimBatchId: "b1", vendorName: "ספק א", invoiceNumber: "111", issueDate: "2026-02-01", amountGross: 590, vatRate: 0.18 }),
    makeInvoice({ id: "b", claimBatchId: "b1", vendorName: "ספק ב", issueDate: null, amountGross: 236, vatRate: 0.18 }),
    makeInvoice({ id: "c", vendorName: "לא במנה", amountGross: 999, vatRate: 0.18 }),
  ];
  const rep = buildClaimReport({ project, batch, invoices });
  eq("רק חשבוניות המנה נכנסות לדוח", rep.rows.length, 2);
  eq("סה\"כ ברוטו בדוח", rep.totals.gross, 826);
  eq("נטו + מע\"מ = ברוטו בדוח", round2(rep.totals.net + rep.totals.vat), rep.totals.gross);
  eq("סה\"כ להגשה כולל השלמה", rep.totals.submitted, 926);
  eq("פער ליעד", rep.totals.gap, 74);
  ok("מיון לפי תאריך — המתוארך ראשון", rep.rows[0].vendorName === "ספק א");
  ok("אזהרה על חשבונית בלי תאריך", rep.warnings.some((w) => w.includes("בלי תאריך")));
  ok("אזהרה על חשבונית בלי מספר", rep.warnings.some((w) => w.includes("בלי מספר")));
  ok("אזהרה על פער ליעד", rep.warnings.some((w) => w.includes("חסרים")));

  // דרישה חלקית חייבת להיות גלויה — הרשות רואה סכום אחר מהחשבונית.
  const partial = [makeInvoice({ id: "p", claimBatchId: "b1", vendorName: "חלקי", amountGross: 1000, vatRate: 0, claimedAmount: 400 })];
  const rep2 = buildClaimReport({ project, batch, invoices: partial });
  ok("דרישה חלקית מסומנת", rep2.rows[0].isPartial);
  ok("אזהרה על דרישה חלקית", rep2.warnings.some((w) => w.includes("בחלקן")));
  eq("הדרישה החלקית היא שנספרת", rep2.totals.claimTotal, 400);

  const csv = claimReportCsv(rep);
  ok("CSV נפתח ב-BOM (אחרת אקסל בעברית מציג גיבריש)", csv.charCodeAt(0) === 0xfeff);
  ok("CSV מכיל את שורות החשבוניות", csv.includes("ספק א") && csv.includes("ספק ב"));
  ok("CSV לא מכיל חשבונית שאינה במנה", !csv.includes("לא במנה"));
  ok("CSV משתמש ב-CRLF", csv.includes("\r\n"));
  {
    const withComma = claimReportCsv(
      buildClaimReport({
        project,
        batch,
        invoices: [makeInvoice({ id: "q", claimBatchId: "b1", vendorName: "כהן, יוסי", amountGross: 100, vatRate: 0 })],
      }),
    );
    ok("פסיק בשם ספק מצוטט", withComma.includes(String.fromCharCode(34) + "כהן, יוסי" + String.fromCharCode(34)));
  }

  const emptyRep = buildClaimReport({ project, batch, invoices: [] });
  ok("מנה ריקה מסומנת כריקה", emptyRep.warnings.some((w) => w.includes("ריק")));
}

// ============================================================================
// גיבוי — הרשת היחידה כל עוד אין ענן.
// ============================================================================
{
  const { backupFileName, validateBackup } = await import("../src/utils/backup.js");
  const name = backupFileName("פינסקר 9, תל אביב");
  // כולל לוכסן הפוך — ב-Windows הוא מפריד נתיבים ושם קובץ שמכיל אותו נשבר.
  ok("שם קובץ גיבוי בלי תווים אסורים", !/[\\/:*?"<>|]/.test(name), name);
  ok("שם הגיבוי נושא חותמת זמן", /\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(name), name);
  ok("גיבוי תקין עובר", validateBackup({ projects: [{ id: "p" }], invoices: [] }) === null);
  ok("קובץ בלי פרויקטים נדחה", validateBackup({ projects: [] }) !== null);
  ok("לא-אובייקט נדחה", validateBackup("nope") !== null);
  ok("אוסף פגום נדחה", validateBackup({ projects: [{ id: "p" }], invoices: "x" }) !== null);
}

console.log("\n" + "═".repeat(58));
if (fail) {
  console.log(`✗ ${fail} נכשלו · ${pass} עברו${skipped ? ` · ${skipped} מקטעים דולגו` : ""}`);
  failures.forEach((f) => console.log(`   ✗ ${f}`));
  process.exit(1);
}
console.log(`✓ ${pass} בדיקות עברו${skipped ? ` · ${skipped} מקטעים דולגו` : ""}`);
