// ============================================================================
// smoke.mjs — בדיקות על המנוע. בלי framework, כמו ב-project-budget.
//
// הרצה: npm run smoke
//
// שתי קבוצות:
//   · בדיקות מנוע — רצות תמיד, על נתונים סינתטיים.
//   · בדיקות נאמנות — רצות מול `seed/vitzman.json` האמיתי. בלעדיו הן
//     **מדולגות ומדווחות**, לא עוברות בשקט. בדיקה שעוברת כי אין לה נתונים
//     היא בדיקה שמשקרת.
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { makeBuilding, makeContract, makeInspection, makeVendor, makeFeeAgreement, normalize } from "../src/schema.js";
import {
  indexContracts, buildingProfit, portfolioTotals, categoryBreakdown,
  activeContract, priceHistory, unassignedBuildings, imputedVatIncluded,
  indexFees, activeFee, feeHistory, employeeLoad,
} from "../src/utils/profitability.js";
import {
  inspectionStatus, inspectionSummary, planBulkRecord, indexInspections,
  buildingInspections, worstStatus, warnWindowDays,
} from "../src/utils/inspections.js";
import { vendorSpend, vendorConcentration, stalePriceContracts } from "../src/utils/vendors.js";
import { planPriceChange, canDeleteEntry, activeAsOf, sortByEffective } from "../src/utils/pricing.js";
import { addMonths, daysBetween, fmtDate, todayISO } from "../src/utils/dates.js";
import {
  makeBackup, validateBackup, backupFilename, toCsv, BOM,
  profitabilityCsv, inspectionsCsv, priceHistoryCsv,
} from "../src/utils/backup.js";
import { round2, withVat, fromGross, sum } from "../src/utils/money.js";
import { addressKey } from "../src/utils/id.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(HERE, "../seed/vitzman.json");

let pass = 0, fail = 0, skipped = 0;
const failures = [];

const ok = (name, cond, detail = "") => {
  if (cond) { pass++; return true; }
  fail++; failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  return false;
};
const eq = (name, actual, expected, tol = 0.005) => {
  const good = typeof expected === "number" && typeof actual === "number"
    ? Math.abs(actual - expected) <= tol
    : Object.is(actual, expected);
  return ok(name, good, good ? "" : `קיבלנו ${JSON.stringify(actual)}, ציפינו ${JSON.stringify(expected)}`);
};
const skip = (name, why) => { skipped++; console.log(`  ⊘ ${name} — דולג: ${why}`); };

// ============================================================================
// 1. אריתמטיקה של כסף
// ============================================================================
eq("round2 מעגל לאגורה", round2(423914.07999999996), 423914.08);
eq("sum לא צובר שאריות float", sum([0.1, 0.2, 0.3]), 0.6);
{
  const v = withVat(1000, 0.18);
  eq("withVat: net+vat===gross", round2(v.amountNet + v.vatAmount), v.amountGross);
  eq("withVat: ברוטו נכון", v.amountGross, 1180);
  const g = fromGross(1180, 0.18);
  eq("fromGross מחזיר לנטו", g.amountNet, 1000);
}

// ============================================================================
// 2. מפתח הכתובת — הבאג המרכזי של הגיליון
// ============================================================================
eq("רווח לפני אות סופית לא יוצר בניין נוסף",
  addressKey("הר הצופים 7ג"), addressKey("הר הצופים 7 ג"));
eq("רווח כפול לא יוצר בניין נוסף",
  addressKey("הנשיא הראשון 52 ג"), addressKey("הנשיא הראשון 52ג"));
eq("גרשיים לא יוצרים בניין נוסף", addressKey('הגר"א 6'), addressKey("הגרא 6"));
ok("כתובות שונות באמת נשארות שונות",
  addressKey("תמרי 6") !== addressKey("יעקב תמרי 6"),
  "מיזוג אגרסיבי מדי היה מאחד בניינים שונים");

// ============================================================================
// 3. margin מול markup — ממצא 1
// ============================================================================
{
  const b = makeBuilding({ id: "b1", address: "בדיקה 1", managementFee: 1000 });
  const contracts = [makeContract({ buildingId: "b1", categoryId: "cleaning", amount: 800 })];
  const idx = indexContracts(contracts);
  const p = buildingProfit(b, idx, "2026-01-01");
  eq("רווח = הכנסה פחות עלות", p.profit, 200);
  eq("margin = רווח/הכנסה", p.margin, 0.2);
  eq("markup = רווח/עלות", p.markup, 0.25);
  ok("margin ו-markup אינם שווים", p.margin !== p.markup,
    "אם הם שווים הבדיקה חסרת ערך");
}
{
  // מכנה 0 → null ולא 0. "אין רווח" ו"אי אפשר לחשב" אינם אותו דבר.
  const b = makeBuilding({ id: "b0", address: "ללא הכנסה", managementFee: 0 });
  const p = buildingProfit(b, indexContracts([]), "2026-01-01");
  eq("margin ללא הכנסה הוא null", p.margin, null);
  eq("markup ללא עלות הוא null", p.markup, null);
}

// ============================================================================
// 4. `null` אינו אפס — ממצא 8
// ============================================================================
{
  const b = makeBuilding({ id: "b2", address: "בר שאול 8", managementFee: 1400 });
  const contracts = [
    makeContract({ buildingId: "b2", categoryId: "cleaning", amount: 870 }),
    makeContract({ buildingId: "b2", categoryId: "gardening", amount: null, paidByVaad: true }),
  ];
  const p = buildingProfit(b, indexContracts(contracts), "2026-01-01");
  eq("חוזה ללא סכום לא נספר כאפס בעלות", p.cost, 870);
  eq("חוזה ללא סכום נספר בנפרד", p.detail.unpricedCount, 1);
  eq("הרווח מחושב על מה שידוע", p.profit, 530);
}

// ============================================================================
// 5. היסטוריית מחירים — 27 ההערות
// ============================================================================
{
  const contracts = [
    makeContract({ id: "old", buildingId: "b3", categoryId: "cleaning", amount: 4650, effectiveFrom: null }),
    makeContract({ id: "new", buildingId: "b3", categoryId: "cleaning", amount: 5500, effectiveFrom: "2022-07-01" }),
  ];
  const idx = indexContracts(contracts);
  eq("לפני התחולה — המחיר הישן", activeContract(idx.get("b3").get("cleaning"), "2022-06-30").id, "old");
  eq("ביום התחולה — המחיר החדש", activeContract(idx.get("b3").get("cleaning"), "2022-07-01").id, "new");
  eq("אחרי התחולה — המחיר החדש", activeContract(idx.get("b3").get("cleaning"), "2026-08-30").id, "new");
  eq("היסטוריה מחזירה את שניהם", priceHistory("b3", "cleaning", idx).length, 2);

  const b = makeBuilding({ id: "b3", address: "בדיקה 3", managementFee: 6000 });
  eq("הרווח ב-2022 לפי המחיר הישן", buildingProfit(b, idx, "2022-06-30").cost, 4650);
  eq("הרווח היום לפי המחיר החדש", buildingProfit(b, idx, "2026-08-30").cost, 5500);
}

// ============================================================================
// 6. מע"מ רעיוני — ממצא 6
// ============================================================================
{
  const std = makeContract({ amount: 1180, vatMode: "standard", vatRate: 0.18 });
  const imp = makeContract({ amount: 1180, vatMode: "imputed", vatRate: 0.18 });
  eq("חוזה רגיל: אין רכיב רעיוני", imputedVatIncluded(std), 0);
  eq("חוזה עוסק פטור: הרעיוני נגזר מתוך הסכום", imputedVatIncluded(imp), 180);

  const b = makeBuilding({ id: "b4", address: "בדיקה 4", managementFee: 2000 });
  const p = buildingProfit(b, indexContracts([{ ...imp, buildingId: "b4", categoryId: "cleaning" }]), "2026-01-01");
  eq("העלות נשמרת כפי שהיא בגיליון", p.cost, 1180);
  eq("הרווח מחושב על העלות הרשומה", p.profit, 820);
  eq("הרווח בניכוי הרעיוני הוא נפרד", p.profitExImputedVat, 1000);
  ok("שני מספרי הרווח נבדלים", p.profit !== p.profitExImputedVat);
}

// ============================================================================
// 7. הפירוק חייב להתאזן לסה"כ — ממצא 2
// ============================================================================
{
  const buildings = Array.from({ length: 40 }, (_, i) =>
    makeBuilding({ id: `x${i}`, address: `רחוב ${i}`, managementFee: 1000 + i }));
  const contracts = buildings.flatMap((b, i) => [
    makeContract({ buildingId: b.id, categoryId: "cleaning", amount: 300 + i }),
    makeContract({ buildingId: b.id, categoryId: "gardening", amount: 100 + i }),
    makeContract({ buildingId: b.id, categoryId: "collectionLegal", amount: i % 3 === 0 ? 200 : 0 }),
  ]);
  const idx = indexContracts(contracts);
  const totals = portfolioTotals(buildings, idx, "2026-01-01");
  const bd = categoryBreakdown(buildings, idx, "2026-01-01");
  eq("סכום הפירוק שווה לסה\"כ ההוצאה", bd.actualTotal, totals.cost);
  ok("הפירוק מכסה את כל 40 הבניינים — אין טווח שנעצר מוקדם",
    bd.categories.find((c) => c.categoryId === "cleaning").buildingCount === 40,
    "זה בדיוק הבאג של SUBTOTAL(9,Y2:Y118)");
}

// ============================================================================
// 8. זיהוי הפסדים ובניינים ללא עובד
// ============================================================================
{
  const loss = makeBuilding({ id: "L", address: "נווה אלון 8-20", managementFee: 20160 });
  const thin = makeBuilding({ id: "T", address: "משה לרר 2", managementFee: 6050 });
  const good = makeBuilding({ id: "G", address: "רווחי", managementFee: 10000, assignedEmployeeId: "e1" });
  const idx = indexContracts([
    makeContract({ buildingId: "L", categoryId: "cleaning", amount: 20847 }),
    makeContract({ buildingId: "T", categoryId: "cleaning", amount: 5955 }),
    makeContract({ buildingId: "G", categoryId: "cleaning", amount: 5000 }),
  ]);
  const t = portfolioTotals([loss, thin, good], idx, "2026-01-01");
  eq("בניין בהפסד מזוהה", t.losses.length, 1);
  eq("ההפסד מדויק", t.losses[0].profit, -687);
  eq("בניין בשוליים דקים מזוהה", t.thin.length, 1);
  eq("בניין רווחי אינו מסומן", t.rows.find((r) => r.buildingId === "G").isThin, false);
  eq("בניינים ללא עובד אחראי", unassignedBuildings([loss, thin, good]).length, 2);
}

// ============================================================================
// 9. normalize עמיד לנתונים חלקיים
// ============================================================================
{
  const n = normalize({ buildings: [{ address: "רק כתובת" }] });
  ok("שדה חסר מקבל ברירת מחדל", Array.isArray(n.buildings[0].aliases));
  eq("status מקבל ברירת מחדל", n.buildings[0].status, "active");
  eq("אוסף חסר הופך למערך ריק", n.contracts.length, 0);
  eq("normalize(null) לא קורס", normalize(null).buildings.length, 0);
}

// ============================================================================
// 10. תאריכים — פרוסה 2
// ============================================================================
eq("addMonths רגיל", addMonths("2026-01-15", 12), "2027-01-15");
eq("addMonths חוצה שנה", addMonths("2026-08-30", 6), "2027-02-28");
eq("31.1 + חודש נחתך ל-28.2 ולא גולש ל-3.3", addMonths("2026-01-31", 1), "2026-02-28");
eq("31.1 + חודש בשנה מעוברת", addMonths("2028-01-31", 1), "2028-02-29");
eq("addMonths על קלט לא תקין", addMonths("לא-תאריך", 1), null);
eq("daysBetween קדימה", daysBetween("2026-01-01", "2026-01-31"), 30);
eq("daysBetween אחורה שלילי", daysBetween("2026-02-01", "2026-01-01"), -31);
eq("fmtDate בעברית", fmtDate("2026-08-30"), "30.08.2026");
ok("todayISO בפורמט ISO", /^\d{4}-\d{2}-\d{2}$/.test(todayISO()));
{
  // באג אזור-זמן: `new Date("2026-08-30")` הוא חצות UTC = 29.8 בישראל.
  const local = todayISO(new Date(2026, 7, 30, 0, 30));
  eq("todayISO משתמש בשעון מקומי ולא ב-UTC", local, "2026-08-30");
}

// ============================================================================
// 11. מנוע הביקורות — ממצא 9
// ============================================================================
{
  const never = inspectionStatus("fireDetection", undefined, "2026-08-30");
  eq("ללא רשומה — מעולם לא תועד", never.status, "never");
  eq("ללא רשומה אין מועד הבא", never.nextDue, null);

  const ok1 = inspectionStatus("fireDetection", { lastDate: "2026-06-01" }, "2026-08-30");
  eq("בוצעה לאחרונה — בתוקף", ok1.status, "ok");
  eq("המועד הבא שנה אחרי", ok1.nextDue, "2027-06-01");

  const over = inspectionStatus("fireDetection", { lastDate: "2025-01-01" }, "2026-08-30");
  eq("עבר המועד — פג תוקף", over.status, "overdue");
  ok("ימים שליליים כשפג", over.daysUntil < 0);

  const soon = inspectionStatus("fireDetection", { lastDate: "2025-10-01" }, "2026-08-30");
  eq("בתוך חלון ההתראה — מתקרב", soon.status, "dueSoon");

  // הגנרטור חצי-שנתי, ולכן חלון ההתראה שלו קצר יותר
  const gen = inspectionStatus("generator", { lastDate: "2026-04-01" }, "2026-08-30");
  eq("גנרטור: תדירות 6 חודשים", gen.intervalMonths, 6);
  eq("חלון התראה קצר יותר לגנרטור", warnWindowDays(6), 45);
  eq("חלון התראה למחזור שנתי", warnWindowDays(12), 60);

  eq("עקיפת תדירות פר רשומה",
    inspectionStatus("fireDetection", { lastDate: "2026-06-01", intervalMonths: 3 }, "2026-08-30").nextDue,
    "2026-09-01");
  eq("מועד יעד ידני גובר על החישוב",
    inspectionStatus("fireDetection", { lastDate: "2026-06-01", nextDueDate: "2026-12-31" }, "2026-08-30").nextDue,
    "2026-12-31");

  ok("'מעולם' ו'פג תוקף' אינם אותו מצב", never.status !== over.status,
    "ערבובם מייצר רשימה של מאות פריטים אדומים שאי אפשר לעבוד איתה");
}

// ============================================================================
// 12. סיכום ביקורות + הזנה מרוכזת
// ============================================================================
{
  const bs = [
    makeBuilding({ id: "i1", address: "אלף 1" }),
    makeBuilding({ id: "i2", address: "בית 2" }),
  ];
  const insp = [
    makeInspection({ id: "r1", buildingId: "i1", type: "fireDetection", lastDate: "2026-06-01" }),
    makeInspection({ id: "r2", buildingId: "i1", type: "generator", lastDate: "2024-01-01" }),
  ];
  const s = inspectionSummary(bs, insp, "2026-08-30");
  eq("סה\"כ תאים = בניינים × סוגים", s.total, 8);
  eq("תועדו 2", s.recorded, 2);
  eq("כיסוי 25%", Number((s.coverage * 100).toFixed(0)), 25);
  eq("מעולם לא תועדו 6", s.counts.never, 6);
  eq("פג תוקף 1", s.counts.overdue, 1);
  eq("בתוקף 1", s.counts.ok, 1);
  eq("התור מתחיל בפג תוקף", s.queue[0].status, "overdue");
  ok("התור מסתיים בתקין", s.queue[s.queue.length - 1].status === "ok");

  // תצוגה מקדימה: מה בדיוק ישתנה
  const plan = planBulkRecord({
    buildingIds: ["i1", "i2"], type: "fireDetection", date: "2026-08-30", inspections: insp,
  });
  eq("רשומה קיימת מסומנת לעדכון", plan.updates.length, 1);
  eq("רשומה חסרה מסומנת ליצירה", plan.creates.length, 1);
  eq("העדכון נושא את התאריך הקודם להצגה", plan.updates[0].previous, "2026-06-01");
  eq("התוכנית לא נוגעת במקור", insp[0].lastDate, "2026-06-01");
  ok("תאריך לא תקין נדחה",
    planBulkRecord({ buildingIds: ["i1"], type: "fireDetection", date: "30/08/2026", inspections: insp }).error !== null);
  ok("סוג לא מוכר נדחה",
    planBulkRecord({ buildingIds: ["i1"], type: "לא-קיים", date: "2026-08-30", inspections: insp }).error !== null);
  eq("worstStatus מחזיר את החמור", worstStatus(buildingInspections(bs[0], indexInspections(insp), "2026-08-30")), "overdue");
}

// ============================================================================
// 13. ספקים וותק מחיר
// ============================================================================
{
  const bs = [
    makeBuilding({ id: "v1", address: "גימל 3", status: "active" }),
    makeBuilding({ id: "v2", address: "דלת 4", status: "active" }),
    makeBuilding({ id: "v3", address: "הא 5", status: "inactive" }),
  ];
  const vendors = [makeVendor({ id: "vend1", name: "קבלן א" }), makeVendor({ id: "vend2", name: "קבלן ב" })];
  const contracts = [
    makeContract({ buildingId: "v1", categoryId: "cleaning", vendorId: "vend1", amount: 1000, effectiveFrom: "2020-01-01" }),
    makeContract({ buildingId: "v2", categoryId: "cleaning", vendorId: "vend1", amount: 1500, effectiveFrom: "2026-01-01" }),
    makeContract({ buildingId: "v2", categoryId: "gardening", vendorId: "vend2", amount: 400 }),
    makeContract({ buildingId: "v3", categoryId: "cleaning", vendorId: "vend1", amount: 9999, effectiveFrom: "2020-01-01" }),
  ];
  const idx = indexContracts(contracts);
  const spend = vendorSpend(vendors, bs, idx, "2026-08-30");
  eq("ספק ראשי בראש הרשימה", spend[0].id, "vend1");
  eq("ההוצאה מצטברת על פני בניינים", spend[0].monthlySpend, 2500);
  ok("בניין לא-פעיל אינו נספר", spend[0].monthlySpend === 2500,
    "9,999 של הבניין הלא-פעיל היו מנפחים את התמונה");
  eq("מספר הבניינים לספק", spend[0].buildingCount, 2);
  eq("ממוצע לבניין", vendorConcentration(spend, 2900)[0].avgPerBuilding, 1250);
  eq("נתח מההוצאה", Number((vendorConcentration(spend, 2900)[0].share * 100).toFixed(1)), 86.2);

  const stale = stalePriceContracts(bs, idx, "2026-08-30");
  eq("חוזה מ-2020 מסומן כוותיק", stale.contracts.length, 1);
  eq("הוותיק הוא של הבניין הפעיל", stale.contracts[0].buildingId, "v1");
  eq("חוזה בלי תאריך נספר כלא-ידוע ולא כוותיק", stale.undatedCount, 1);
  ok("חוזה בלי תאריך אינו ברשימת הוותיקים",
    !stale.contracts.some((c) => c.categoryId === "gardening"),
    "ספירת הלא-ידועים כוותיקים הייתה הופכת את הרשימה לחסרת ערך");
}

// ============================================================================
// 14. שינוי מחיר — פרוסה 3
// ============================================================================
{
  const base = { id: "e1", amount: 1000, effectiveFrom: null };
  const entries = [base];

  // --- תיקון: דורס, בלי שורת היסטוריה ---
  const fix = planPriceChange({ entries, currentId: "e1", newAmount: 1100, mode: "correct" });
  eq("תיקון מעדכן במקום", fix.updates.length, 1);
  eq("תיקון לא יוצר שורה חדשה", fix.creates.length, 0);
  eq("תיקון נושא את הסכום החדש", fix.updates[0].patch.amount, 1100);
  ok("תיקון של אותו סכום נחסם",
    planPriceChange({ entries, currentId: "e1", newAmount: 1000, mode: "correct" }).error !== null);

  // --- מחיר חדש: שומר היסטוריה ---
  const nu = planPriceChange({
    entries, currentId: "e1", newAmount: 1200, mode: "newPrice",
    effectiveFrom: "2026-09-01", template: { buildingId: "b1", categoryId: "cleaning" }, asOf: "2026-08-30",
  });
  eq("מחיר חדש יוצר שורה", nu.creates.length, 1);
  eq("מחיר חדש לא דורס", nu.updates.length, 0);
  eq("השורה נושאת את התאריך", nu.creates[0].effectiveFrom, "2026-09-01");
  eq("השורה יורשת את ה-template", nu.creates[0].categoryId, "cleaning");
  ok("תאריך עתידי מייצר אזהרה", /עתידי/.test(nu.warning || ""));
  ok("התוכנית לא נגעה במקור", entries.length === 1 && base.amount === 1000);

  // --- מלכודת: תאריך שכבר קיים → עדכון, לא כפילות ---
  const withHist = [base, { id: "e2", amount: 1200, effectiveFrom: "2026-09-01" }];
  const dup = planPriceChange({
    entries: withHist, currentId: "e1", newAmount: 1300, mode: "newPrice",
    effectiveFrom: "2026-09-01", asOf: "2026-08-30",
  });
  eq("תאריך קיים → מעדכן את אותה שורה", dup.updates.length, 1);
  eq("תאריך קיים → לא יוצר כפילות", dup.creates.length, 0);
  eq("העדכון על השורה הנכונה", dup.updates[0].id, "e2");
  ok("ומייצר אזהרה", (dup.warning || "").length > 0);
  ok("סכום זהה באותו תאריך נחסם",
    planPriceChange({ entries: withHist, currentId: "e1", newAmount: 1200, mode: "newPrice",
      effectiveFrom: "2026-09-01", asOf: "2026-08-30" }).error !== null);

  // --- מלכודת: רטרואקטיבי ---
  const past = [base, { id: "e3", amount: 1500, effectiveFrom: "2026-06-01" }];
  const retro = planPriceChange({
    entries: past, currentId: "e3", newAmount: 1400, mode: "newPrice",
    effectiveFrom: "2026-03-01", asOf: "2026-08-30",
  });
  eq("רטרואקטיבי מותר", retro.error, null);
  ok("רטרואקטיבי מייצר אזהרה", /דווחה|לא תשנה/.test(retro.warning || ""));
  // רטרואקטיבי מול "מאז ומעולם" — אין תאריך להשוות אליו, ובכל זאת זו תקופה שדווחה
  const retroVsNull = planPriceChange({
    entries: [base], currentId: "e1", newAmount: 1400, mode: "newPrice",
    effectiveFrom: "2026-06-01", asOf: "2026-08-30",
  });
  ok("רטרואקטיבי מול 'מאז ומעולם' גם הוא מזהיר", /דווחה/.test(retroVsNull.warning || ""),
    "מחיר מיוני משנה יוני-אוגוסט גם כשהמחיר שהוא מחליף הוא חסר-תאריך");
  // מלכודת: תאריך בעבר שלא ישנה את המחיר הנוכחי כי יש רשומה מאוחרת יותר
  const shadowed = planPriceChange({
    entries: [base, { id: "e9", amount: 1600, effectiveFrom: "2026-07-01" }],
    currentId: "e1", newAmount: 1450, mode: "newPrice",
    effectiveFrom: "2026-06-01", asOf: "2026-08-30",
  });
  ok("שורה שלא תשנה את המחיר התקף מסומנת ככזו", /לא תשנה/.test(shadowed.warning || ""));

  // --- מלכודות קלט ---
  ok("תאריך לא תקין נחסם",
    planPriceChange({ entries, currentId: "e1", newAmount: 1200, mode: "newPrice", effectiveFrom: "1.9.2026" }).error !== null);
  ok("סכום שלילי נחסם",
    planPriceChange({ entries, currentId: "e1", newAmount: -5, mode: "correct" }).error !== null);
  ok("מצב לא מוכר נחסם",
    planPriceChange({ entries, currentId: "e1", newAmount: 1200, mode: "לא-קיים" }).error !== null);
  eq("null מותר (הוועד משלם)",
    planPriceChange({ entries, currentId: "e1", newAmount: null, mode: "correct" }).updates[0].patch.amount, null);

  // --- מחיקה ---
  eq("אי אפשר למחוק את השורה האחרונה", canDeleteEntry(entries, "e1").ok, false);
  eq("אפשר למחוק כשיש יותר מאחת", canDeleteEntry(withHist, "e2").ok, true);
  eq("מחיקת רשומה לא קיימת נחסמת", canDeleteEntry(withHist, "אין-כזה").ok, false);

  // --- מיון ובחירה ---
  eq("המיון מציב את החדש בראש", sortByEffective(withHist)[0].id, "e2");
  eq("null מפסיד לתאריך שכבר עבר", activeAsOf(past, "2026-08-30").id, "e3");
  eq("לפני התאריך — null מנצח", activeAsOf(past, "2026-05-01").id, "e1");
  eq("תאריך עתידי מתעלמים ממנו", activeAsOf(withHist, "2026-08-30").id, "e1");
}

// ============================================================================
// 15. הכנסה כהסכם עם היסטוריה
// ============================================================================
{
  const b = makeBuilding({ id: "fb", address: "הכנסה 1", managementFee: 5000 });
  const fees = [
    makeFeeAgreement({ id: "f1", buildingId: "fb", amount: 4600, effectiveFrom: null }),
    makeFeeAgreement({ id: "f2", buildingId: "fb", amount: 5400, effectiveFrom: "2021-11-01" }),
  ];
  const fi = indexFees(fees);
  eq("ההכנסה נגזרת מההסכם התקף", activeFee(b, fi, "2026-08-30"), 5400);
  eq("ולפני התחולה — מההסכם הקודם", activeFee(b, fi, "2021-10-31"), 4600);
  eq("היסטוריה מוחזרת, החדש בראש", feeHistory("fb", fi)[0].id, "f2");
  eq("בלי feeIndex — נפילה לאחור ל-managementFee",
    buildingProfit(b, indexContracts([]), "2026-08-30").income, 5000);
  eq("עם feeIndex — ההסכם גובר",
    buildingProfit(b, indexContracts([]), "2026-08-30", fi).income, 5400);

  const idx = indexContracts([makeContract({ buildingId: "fb", categoryId: "cleaning", amount: 1000 })]);
  const t = portfolioTotals([b], idx, "2026-08-30", fi);
  eq("הרווח מחושב מההכנסה התקפה", t.profit, 4400);
  eq("ובתאריך מוקדם — מההכנסה שהייתה אז", portfolioTotals([b], idx, "2021-10-31", fi).profit, 3600);
}

// ============================================================================
// 16. הגירת normalize — נתונים מלפני פרוסה 3
// ============================================================================
{
  const old = { buildings: [{ id: "ob", address: "ישן 1", managementFee: 7000 }] };
  const n = normalize(old);
  eq("נוצר הסכם פותח מ-managementFee", n.feeAgreements.length, 1);
  eq("בסכום הנכון", n.feeAgreements[0].amount, 7000);
  eq("ובלי תאריך תחולה (מאז ומעולם)", n.feeAgreements[0].effectiveFrom, null);
  eq("ההכנסה נשמרת אחרי ההגירה",
    buildingProfit(n.buildings[0], indexContracts([]), "2026-08-30", indexFees(n.feeAgreements)).income, 7000);

  // אידמפוטנטיות: הרצה חוזרת לא מכפילה ולא דורסת עריכה
  const twice = normalize(n);
  eq("הגירה חוזרת לא מכפילה", twice.feeAgreements.length, 1);
  const edited = normalize({ ...n, feeAgreements: [{ ...n.feeAgreements[0], amount: 7500 }] });
  eq("הגירה חוזרת לא דורסת עריכה", edited.feeAgreements[0].amount, 7500);

  eq("בניין בלי managementFee לא מקבל הסכם",
    normalize({ buildings: [{ id: "z", address: "ללא", managementFee: 0 }] }).feeAgreements.length, 0);
}

// ============================================================================
// 17. עדשת "נכון לתאריך" — התיק כולו, לא רק השורה
// ============================================================================
{
  const b = makeBuilding({ id: "t1", address: "עדשה 1", managementFee: 0 });
  const contracts = [
    makeContract({ id: "c-old", buildingId: "t1", categoryId: "cleaning", amount: 1000, effectiveFrom: null }),
    makeContract({ id: "c-new", buildingId: "t1", categoryId: "cleaning", amount: 1500, effectiveFrom: "2026-07-01" }),
  ];
  const fees = [
    makeFeeAgreement({ id: "f-old", buildingId: "t1", amount: 2000, effectiveFrom: null }),
    makeFeeAgreement({ id: "f-new", buildingId: "t1", amount: 2400, effectiveFrom: "2026-05-01" }),
  ];
  const ci = indexContracts(contracts);
  const fi = indexFees(fees);

  const before = portfolioTotals([b], ci, "2026-04-01", fi);
  const middle = portfolioTotals([b], ci, "2026-06-01", fi);
  const now = portfolioTotals([b], ci, "2026-08-30", fi);

  eq("אפריל: מחיר ישן משני הצדדים", before.profit, 1000);   // 2000 - 1000
  eq("יוני: ההכנסה עלתה, ההוצאה עוד לא", middle.profit, 1400); // 2400 - 1000
  eq("היום: שתיהן עלו", now.profit, 900);                    // 2400 - 1500
  ok("שלושת התאריכים נותנים שלוש תמונות שונות",
    new Set([before.profit, middle.profit, now.profit]).size === 3);

  // הפירוק חייב להתאזן **בכל תאריך**, לא רק היום
  for (const d of ["2026-04-01", "2026-06-01", "2026-08-30"]) {
    const t = portfolioTotals([b], ci, d, fi);
    eq(`הפירוק מתאזן לסה"כ ב-${d}`, categoryBreakdown([b], ci, d).actualTotal, t.cost);
  }

  // עומס העובדים נגזר מהתאריך **ומההסכם התקף** — לא מ-managementFee הסקלרי
  const emp = [{ id: "e1", name: "עובד", active: true }];
  const assigned = makeBuilding({ ...b, assignedEmployeeId: "e1" });
  eq("עומס העובד באפריל לפי ההסכם שהיה אז",
    employeeLoad(emp, [assigned], ci, "2026-04-01", fi)[0].income, 2000);
  eq("ובאוגוסט לפי ההסכם החדש",
    employeeLoad(emp, [assigned], ci, "2026-08-30", fi)[0].income, 2400);
  eq("והרווח נגזר משניהם", employeeLoad(emp, [assigned], ci, "2026-08-30", fi)[0].profit, 900);
  // בלי feeIndex ההכנסה נופלת ל-managementFee הסקלרי (0 כאן) — ולכן הוא נמסר תמיד
  ok("בלי feeIndex ההכנסה מתנתקת מההסכם",
    employeeLoad(emp, [assigned], ci, "2026-08-30")[0].income === 0,
    "זו הסיבה ש-feeIndex נמסר בכל קריאה אמיתית");
}

// ============================================================================
// 18. גיבוי, שחזור וייצוא
// ============================================================================
{
  const data = normalize({ buildings: [{ id: "bk", address: "גיבוי 1", managementFee: 3000 }] });
  const backup = makeBackup(data);
  eq("הגיבוי נושא חותמת זיהוי", backup.kind, "vitzman-backup");
  eq("והוא סופר את הישויות", backup.counts.buildings, 1);

  const round = validateBackup(JSON.parse(JSON.stringify(backup)));
  eq("גיבוי חוזר תקין", round.ok, true);
  eq("והנתונים שרדו את המסע", round.data.buildings[0].address, "גיבוי 1");

  // גם פלט הייבוא הגולמי מתקבל — הוא מצב שלם, רק בלי העטיפה
  eq("פלט הייבוא מתקבל כשחזור", validateBackup(data).ok, true);

  // אימות לפני דריסה: קלט לא תקין חייב להיחסם עם סיבה
  for (const [label, input] of [
    ["null", null], ["מחרוזת", "לא JSON"], ["אובייקט ריק", {}],
    ["בלי בניינים", { contracts: [] }], ["בניינים ריקים", { buildings: [] }],
  ]) {
    const r = validateBackup(input);
    ok(`שחזור נחסם: ${label}`, r.ok === false && typeof r.reason === "string" && r.reason.length > 0);
  }

  ok("שם הגיבוי נושא תאריך", /^vitzman-backup-\d{4}-\d{2}-\d{2}\.json$/.test(backupFilename("2026-08-30")));
}
{
  // ⚠ BOM — בלעדיו אקסל בעברית קורא UTF-8 כ-Windows-1255 ומציג ג'יבריש.
  const csv = toCsv([["כתובת", "סכום"], ["רחוב א", 100]]);
  ok("CSV מתחיל ב-BOM", csv.startsWith(BOM), "בלי זה אקסל בעברית מציג ג'יבריש");
  ok("שורות מופרדות בשורה חדשה", csv.split("\n").length === 2);
  // ציטוט: פסיק, גרשיים ושורה חדשה בתוך ערך
  ok("פסיק בערך מצוטט", toCsv([["א,ב"]]).includes('"א,ב"'));
  ok("גרשיים מוכפלים", toCsv([['הוא אמר "שלום"']]).includes('""שלום""'));
  ok("שורה חדשה בערך מצוטטת", toCsv([["שורה\nשנייה"]]).includes('"שורה\nשנייה"'));
  eq("null הופך למחרוזת ריקה", toCsv([[null, 1]]).replace(BOM, ""), ",1");
}

// ============================================================================
// 19. נאמנות מול הנתונים האמיתיים — מדולג בלי seed
// ============================================================================
console.log("\n--- נאמנות מול seed/vitzman.json ---");
if (!existsSync(SEED)) {
  skip("כל בדיקות הנאמנות", "seed/vitzman.json לא קיים — הרץ `npm run import:vitzman`");
} else {
  const raw = JSON.parse(readFileSync(SEED, "utf8"));
  const data = normalize(raw);
  const active = data.buildings.filter((b) => b.status === "active");
  // החוזים ההיסטוריים (מחיר קודם) לא אמורים להשפיע על התמונה הנוכחית
  const idx = indexContracts(data.contracts);
  const fidx = indexFees(data.feeAgreements);
  const totals = portfolioTotals(active, idx, "2026-08-30", fidx);
  const bd = categoryBreakdown(active, idx, "2026-08-30");
  const sheet = raw.meta?.sheetTotals || {};

  eq("131 בניינים פעילים", active.length, 131);
  eq("סה\"כ הכנסות מתאים לגיליון", totals.income, sheet.income);
  eq("סה\"כ הוצאות מתאים לגיליון", totals.cost, sheet.expenses);
  eq("רווח מתאים לגיליון", totals.profit, sheet.profit);
  eq("הפירוק מתאזן לסה\"כ", bd.actualTotal, totals.cost);
  eq("margin", Number((totals.margin * 100).toFixed(2)), 13.68);
  eq("markup", Number((totals.markup * 100).toFixed(2)), 15.84);
  ok("margin נמוך מ-markup", totals.margin < totals.markup);
  eq("2 בניינים בהפסד", totals.losses.length, 2);
  eq("212 הערות נשמרו", data.notes.length, 212);

  // --- פרוסה 3: ההכנסה עברה להסכמים בלי לזוז בשקל ---
  eq("הסכם דמי ניהול לכל בניין פעיל", new Set(data.feeAgreements.map((f) => f.buildingId)).size, 131);
  eq("ההכנסה דרך ההסכמים זהה לגיליון", totals.income, sheet.income);
  {
    const drift = active.filter((b) => Math.abs(activeFee(b, fidx, "2026-08-30") - b.managementFee) > 0.01);
    eq("אף בניין לא סוטה מדמי הניהול שבגיליון", drift.length, 0);
  }
  // --- עדשת התאריך על הנתונים האמיתיים ---
  {
    const early = portfolioTotals(active, idx, "2021-01-01", fidx);
    ok("התיק בינואר 2021 שונה מהיום", early.income !== totals.income,
      `2021: ${early.income} · היום: ${totals.income}`);
    eq("הפירוק מתאזן גם בתאריך היסטורי",
      categoryBreakdown(active, idx, "2021-01-01").actualTotal, early.cost);
  }

  // --- ייצוא על הנתונים האמיתיים ---
  {
    const prof = profitabilityCsv(data, "2026-08-30").split("\n");
    eq("דוח הרווחיות: שורה לכל בניין פעיל", prof.length - 1, 131);
    const insp = inspectionsCsv(data, "2026-08-30").split("\n");
    eq("דוח הביקורות: שורה לכל בניין×סוג", insp.length - 1, 524);
    const hist = priceHistoryCsv(data).split("\n");
    eq("היסטוריית המחירים: שורה לכל חוזה והסכם",
      hist.length - 1, data.contracts.length + data.feeAgreements.length);
    ok("כל שלושת הדוחות נושאים BOM",
      [prof, insp, hist].every((r) => r[0].startsWith(BOM)));
    // סבב מלא: גיבוי → אימות → אותם מספרים
    const back = validateBackup(makeBackup(data));
    eq("סבב גיבוי־שחזור שומר את כל הבניינים", back.data.buildings.length, data.buildings.length);
    eq("ואת כל החוזים", back.data.contracts.length, data.contracts.length);
  }

  const withFeeHistory = active.filter((b) => feeHistory(b.id, fidx).length > 1);
  eq("3 בניינים עם היסטוריית הכנסה מההערות", withFeeHistory.length, 3);
  ok("היסטוריית ההכנסה נושאת תאריכי תחולה",
    withFeeHistory.every((b) => feeHistory(b.id, fidx).some((f) => f.effectiveFrom)));
  eq("3 עובדים", data.employees.length, 3);

  // הבניינים שנפלו מ-SUBTOTAL(9,Y2:Y118) — הסכום שלהם חייב להיות בפנים
  const lost = raw.meta?.sheetFindings?.truncatedRanges?.find((t) => t.col === "Y");
  if (lost) {
    eq("14 הבניינים שנפלו מהסיכום זוהו", lost.missedCount, 14);
    eq("הסכום שנפל מהסיכום", lost.lostAmount, 3300);
    const collection = bd.categories.find((c) => c.categoryId === "collectionLegal");
    eq("קטגוריית הגבייה מסתכמת לסכום המלא", collection.actual, 32950);
  } else {
    skip("בדיקת הטווח הקטוע", "meta.sheetFindings.truncatedRanges חסר");
  }

  // --- פרוסה 2: ביקורות ---
  const insp = inspectionSummary(active, data.inspections, "2026-08-30");
  eq("אף ביקורת תקופתית לא תועדה בגיליון", data.inspections.length, 0);
  eq("524 תאי ביקורת (131 × 4)", insp.total, 524);
  eq("כיסוי התיעוד ההתחלתי הוא אפס", insp.recorded, 0);
  eq("כולם במצב 'מעולם לא תועד' ולא 'פג תוקף'", insp.counts.never, 524);
  eq("אין פג-תוקף כשאין תיעוד כלל", insp.counts.overdue, 0);

  // --- פרוסה 2: ספקים ---
  const vspend = vendorSpend(data.vendors, data.buildings, idx, "2026-08-30");
  const covered = vspend.reduce((a, v) => a + v.monthlySpend, 0);
  eq("82 ספקים עם הוצאה בפועל", vspend.length, 82);
  ok("ההוצאה המכוסה בחוזי ספק קטנה מסך ההוצאה", covered < totals.cost,
    "לא לכל קטגוריה יש עמודת ספק בגיליון");
  // ריכוזיות: ספק הניקיון הראשי הוא לבדו יותר משליש מההוצאה כולה
  eq("הספק הגדול משרת 82 בניינים", vspend[0].buildingCount, 82);
  ok("הספק הגדול הוא מעל 30% מההוצאה",
    vspend[0].monthlySpend / totals.cost > 0.3,
    `בפועל ${((vspend[0].monthlySpend / totals.cost) * 100).toFixed(1)}%`);

  const vstale = stalePriceContracts(data.buildings, idx, "2026-08-30");
  ok("נמצאו חוזים שמחירם לא זז מעל 3 שנים", vstale.contracts.length > 0);
  ok("רוב החוזים ללא תאריך תחולה ידוע ולא נספרו כוותיקים",
    vstale.undatedCount > vstale.contracts.length * 10,
    `ותיקים ${vstale.contracts.length} מול לא-ידועים ${vstale.undatedCount}`);

  // aliases ממזגים כתובות
  const withAliases = data.buildings.filter((b) => b.aliases.length > 0);
  ok("נמצאו בניינים עם איותים חלופיים", withAliases.length > 0,
    "אם אין — מנגנון ה-aliases לא נבדק על נתונים אמיתיים");
}

// ============================================================================
console.log(`\n${"=".repeat(50)}`);
console.log(`  עברו ${pass} · נכשלו ${fail} · דולגו ${skipped}`);
if (failures.length) {
  console.log("\n  כשלונות:");
  for (const f of failures) console.log(`    ✗ ${f}`);
}
console.log(`${"=".repeat(50)}\n`);
process.exit(fail ? 1 : 0);
