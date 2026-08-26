// ============================================================================
// import-pinsker.mjs — ייבוא פרויקט פינסקר 9 משלושת קבצי האקסל של רונן.
//
// הרצה:  npm run import:pinsker
// פלט:   seed/pinsker-9.json  (gitignored — נתונים אמיתיים)
//
// ----------------------------------------------------------------------------
// שלוש הכרעות מקור שהייבוא הזה מקבל, ולמה
// ----------------------------------------------------------------------------
// 1. **הקובץ המצורף הוא העדכני.** "תזרים פינסקר 9 - מעוצב" מסתכם ב-9,226,353
//    ו"תקציב פרוייקט פינסקר 9" ב-9,256,727. ההפרש הוא בדיוק 30,374 — שורת
//    "אבדן דמי ניהול" שקיימת רק בחדש (ומאוזנת שם גם בשורת אריאל פרטי:
//    661,579 מול 631,205). לכן העלויות והתזרים נלקחים מהקובץ המצורף.
//
// 2. **גיליון הסיכום הוא מקור האמת ל"אושר סופי" — לא גיליון כתב הכמויות.**
//    גיליון `גיליון1 (3)` מסתכם ב-4,051,030 לפני מע"מ = 4,780,215 כולל,
//    בדיוק סכום ההחזר שכל התזרים בנוי עליו. גיליון `כתב_כמויות` מסתכם
//    ב-3,515,921 — גרסת עבודה מוקדמת. לכן:
//      · "הוגש למס רכוש"  → **ברמת שורה** מכתב הכמויות (מסתכם ל-6,177,238 ✓)
//      · "ראשוני"/"אושר"  → **ברמת פרק** מגיליון הסיכום
//    פרק שבו הפירוט לא מתלכד עם הסיכום מסומן `needsReview` — לא ממציאים
//    פיצול לשורות שאין לו מקור.
//
// 3. **כותרת עמודה J בגיליון היא 1.1.2026 במקום 1.1.2027** (serial 46023
//    במקום 46388). לכן החודשים נגזרים ברצף מעמודה E ולא מקריאת כל תא בנפרד;
//    הסריאלים כן נבדקים מול הרצף, וכל סטייה מדווחת.
// ============================================================================

import XLSX from "xlsx";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SRC_DIR = process.env.PINSKER_SRC || "C:/Users/RONEN/Desktop";
const OUT = resolve(ROOT, "seed/pinsker-9.json");

const FILE_BUDGET = `${SRC_DIR}/תקציב פרוייקט פינסקר 9 תל אביב.xlsx`;
const FILE_DIFF = `${SRC_DIR}/הפרשים בין ראשון למאושר פינסקר 9.xlsx`;

const VAT = 0.18;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const sum = (a, f = (x) => x) => round2(a.reduce((s, x) => s + num(f(x)), 0));
const clean = (s) => String(s ?? "").trim();

const problems = [];
const notes = [];
const warn = (m) => problems.push(m);

// --- עזרי גיליון ------------------------------------------------------------
const cell = (sheet, addr) => {
  const c = sheet[addr];
  return c ? c.v : undefined;
};
const COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const colAt = (i) => COLS[i];

const excelToMonth = (serial) =>
  new Date(Date.UTC(1899, 11, 30) + Number(serial) * 86400000).toISOString().slice(0, 7);

const addMonths = (month, n) => {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

let idSeq = 0;
const mkId = (p) => `${p}_${String(++idSeq).padStart(4, "0")}`;

// ============================================================================
// 1. גריד החודשים
// ============================================================================
function readMonths(sheet) {
  const FIRST = 4; // עמודה E
  const LAST = 23; // עמודה X
  const serials = [];
  for (let i = FIRST; i <= LAST; i++) serials.push(cell(sheet, `${colAt(i)}4`));

  const base = excelToMonth(serials[0]); // 2026-08
  const months = serials.map((_, i) => addMonths(base, i));

  serials.forEach((s, i) => {
    const actual = excelToMonth(s);
    if (actual !== months[i]) {
      warn(
        `כותרת עמודה ${colAt(FIRST + i)} בגיליון התקציב היא ${actual} אך לפי הרצף היא ${months[i]} — תוקן בייבוא.`,
      );
    }
  });

  return { months, colOf: (i) => colAt(FIRST + i), FIRST, LAST };
}

/** קורא שורת תזרים אחת (E..X) ומחזיר [{ month, amount }] רק לחודשים עם סכום. */
function readScheduleRow(sheet, rowNum, grid) {
  const out = [];
  grid.months.forEach((month, i) => {
    const v = num(cell(sheet, `${grid.colOf(i)}${rowNum}`));
    if (v) out.push({ month, amount: round2(v) });
  });
  return out;
}

// ============================================================================
// 2. שורות העלות + לוח התשלומים
// ============================================================================
const COST_LINE_SPEC = [
  // summaryRow = שורת התקציב (6–10) · scheduleRows = שורות התזרים (15–20)
  { key: "works", kind: "works", summaryRow: 6, scheduleRows: [15, 16] },
  { key: "appraiser", kind: "appraiser", summaryRow: 7, scheduleRows: [17] },
  { key: "engineer", kind: "engineer", summaryRow: 8, scheduleRows: [18] },
  { key: "lostFees", kind: "other", summaryRow: 9, scheduleRows: [19] },
  { key: "management", kind: "management", summaryRow: 10, scheduleRows: [20] },
];

function readCostLines(sheet, grid, projectId) {
  return COST_LINE_SPEC.map((spec, idx) => {
    const merged = new Map();
    for (const r of spec.scheduleRows) {
      for (const { month, amount } of readScheduleRow(sheet, r, grid)) {
        merged.set(month, round2((merged.get(month) || 0) + amount));
      }
    }
    return {
      id: mkId("cl"),
      projectId,
      name: clean(cell(sheet, `A${spec.summaryRow}`)),
      kind: spec.kind,
      budgetGross: round2(num(cell(sheet, `B${spec.summaryRow}`))),
      paidBefore: round2(num(cell(sheet, `C${spec.summaryRow}`))),
      order: idx,
      schedule: [...merged.entries()]
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    };
  });
}

// ============================================================================
// 3. מקורות המימון
// ============================================================================
const FUNDING_SPEC = [
  { row: 23, type: "ownerMonthly", source: "אריאל" },
  { row: 24, type: "ownerLump", source: "אריאל" },
  { row: 25, type: "taxRefund", source: "מס רכוש" },
];

function readFunding(sheet, grid, projectId) {
  const out = [];
  for (const spec of FUNDING_SPEC) {
    const label = clean(cell(sheet, `A${spec.row}`));
    for (const { month, amount } of readScheduleRow(sheet, spec.row, grid)) {
      out.push({
        id: mkId("fnd"),
        projectId,
        type: spec.type,
        source: spec.source,
        month,
        plannedAmount: amount,
        actualAmount: null,
        actualDate: null,
        claimBatchId: null,
        notes: label,
      });
    }
  }
  return out;
}

// ============================================================================
// 4. מנות ההגשה למס רכוש (שורות 28–33)
// ============================================================================
// כל מנה יושבת בעמודה אחת: G=אוק׳26, I=דצמ׳26, L=מרץ׳27 (+M=אפר׳27 כהמשך).
// שורות: 28 חשבוניות עד כה · 29 רז וורדה פירוק · 30 תשלום לקבלן ·
//        31 סה"כ · 32 השלמת חשבונית · 33 סה"כ למס רכוש.
const BATCH_SPEC = [
  { seq: 1, cols: ["G"], plannedDate: "2026-10-11", target: 1500000 },
  { seq: 2, cols: ["I"], plannedDate: "2026-12-11", target: 1640000 },
  { seq: 3, cols: ["L", "M"], plannedDate: "2027-03-11", target: 1640215 },
];

function readBatches(sheet, projectId) {
  const componentRows = [28, 29, 30];
  return BATCH_SPEC.map((spec) => {
    const components = [];
    let componentsTotal = 0;
    for (const col of spec.cols) {
      for (const row of componentRows) {
        const v = round2(num(cell(sheet, `${col}${row}`)));
        if (!v) continue;
        components.push({ label: clean(cell(sheet, `C${row}`)) || `שורה ${row}`, amount: v });
        componentsTotal = round2(componentsTotal + v);
      }
    }
    const topUp = round2(spec.target - componentsTotal);
    if (topUp < -0.01) warn(`מנה ${spec.seq}: הרכיבים (${componentsTotal}) גדולים מהיעד (${spec.target}).`);
    return {
      id: mkId("btc"),
      projectId,
      seq: spec.seq,
      title: `מנה ${spec.seq} — הגשה למס רכוש`,
      plannedDate: spec.plannedDate,
      submittedDate: null,
      targetAmount: round2(spec.target),
      topUpAmount: Math.max(0, topUp),
      topUpNote: topUp > 0 ? "השלמת חשבונית לסגירת היעד (מהגיליון)" : "",
      refundLagDays: 60,
      expectedRefundDate: null,
      actualRefundDate: null,
      refundedAmount: null,
      status: "planning",
      notes: "",
      plannedComponents: components,
      _components: components,
      _componentsTotal: componentsTotal,
    };
  });
}

// ============================================================================
// 5. כתב הכמויות — שורות מהפירוט, בסיסים מהסיכום
// ============================================================================
function readChapterBaselines(wb) {
  const sheet = wb.Sheets["גיליון1 (3)"];
  const out = new Map();
  for (let row = 8; row <= 30; row++) {
    const label = clean(cell(sheet, `B${row}`));
    const m = label.match(/^(\d{2})\s*-\s*(.*)$/);
    if (!m) continue;
    out.set(m[1], {
      chapter: m[1],
      chapterName: m[2].trim(),
      initial: round2(num(cell(sheet, `D${row}`))),
      submitted: round2(num(cell(sheet, `C${row}`))),
      approved: round2(num(cell(sheet, `H${row}`))),
    });
  }
  return out;
}

function readBoqItems(wb, projectId, baselines) {
  const sheet = wb.Sheets["כתב_כמויות_אב_להעתקה_"];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const items = [];
  let chapter = "";
  let chapterName = "";

  for (let row = range.s.r + 1; row <= range.e.r + 1; row++) {
    const code = clean(cell(sheet, `A${row}`));
    const desc = clean(cell(sheet, `B${row}`));

    // כותרת פרק: קוד דו-ספרתי בלבד.
    if (/^\d{2}$/.test(code)) {
      chapter = code;
      chapterName = desc;
      continue;
    }
    // שורת עבודה: יש כמות, מחיר יחידה וסה"כ. כותרות תת-פרק ושורות סיכום נופלות כאן.
    const qty = cell(sheet, `D${row}`);
    const unitPrice = cell(sheet, `E${row}`);
    const total = cell(sheet, `F${row}`);
    if (typeof qty !== "number" || typeof unitPrice !== "number" || typeof total !== "number") continue;
    if (!chapter) continue;

    items.push({
      id: mkId("boq"),
      projectId,
      chapter,
      chapterName: baselines.get(chapter)?.chapterName || chapterName,
      code,
      description: desc,
      unit: clean(cell(sheet, `C${row}`)),
      qty,
      unitPrice: round2(unitPrice),
      priceInitial: 0, // נקבע למטה, רק אם יש לזה מקור
      priceSubmitted: round2(total),
      priceApproved: 0, // כנ"ל
      priceApprovedDraft: round2(num(cell(sheet, `J${row}`))), // גרסת העבודה המוקדמת
      reviewerNote: clean(cell(sheet, `O${row}`)),
      needsReview: false,
      isChapterTotal: false,
    });
  }
  return items;
}

/**
 * משלים את הבסיסים ברמת השורה **רק כשיש לזה מקור**, ומייצר שורת-סיכום פר-פרק
 * שנושאת את שלושת הבסיסים הרשמיים.
 */
function reconcileBoq(items, baselines, projectId) {
  const byChapter = new Map();
  for (const it of items) {
    if (!byChapter.has(it.chapter)) byChapter.set(it.chapter, []);
    byChapter.get(it.chapter).push(it);
  }

  const chapterTotals = [];
  for (const [chapter, base] of baselines) {
    const rows = byChapter.get(chapter) || [];
    const detailSubmitted = sum(rows, (r) => r.priceSubmitted);
    const detailApprovedDraft = sum(rows, (r) => r.priceApprovedDraft);

    const submittedMatches = Math.abs(detailSubmitted - base.submitted) < 1;
    const approvedMatches = Math.abs(detailApprovedDraft - base.approved) < 1;
    const initialEqualsSubmitted = Math.abs(base.initial - base.submitted) < 1;

    if (!submittedMatches && rows.length) {
      warn(
        `פרק ${chapter}: פירוט "הוגש" מסתכם ל-${detailSubmitted} מול ${base.submitted} בגיליון הסיכום.`,
      );
    }

    for (const r of rows) {
      // "ראשוני" ברמת שורה קיים רק כשהפרק לא השתנה בין ראשוני למוגש.
      if (initialEqualsSubmitted) r.priceInitial = r.priceSubmitted;
      // "אושר" ברמת שורה קיים רק כשהפירוט מתלכד עם הסיכום הרשמי.
      if (approvedMatches) r.priceApproved = r.priceApprovedDraft;
      else r.needsReview = true;
      if (!initialEqualsSubmitted) r.needsReview = true;
      delete r.priceApprovedDraft;
    }

    if (!approvedMatches) {
      notes.push(
        `פרק ${chapter} (${base.chapterName}): "אושר סופי" קיים ברמת פרק בלבד — ` +
          `הפירוט בגיליון כתב הכמויות (${detailApprovedDraft}) הוא גרסת עבודה מוקדמת ` +
          `ולא מתלכד עם ${base.approved} שבסיכום.`,
      );
    }

    chapterTotals.push({
      id: mkId("boq"),
      projectId,
      chapter,
      chapterName: base.chapterName,
      code: chapter,
      description: `סה"כ ${base.chapterName}`,
      unit: "",
      qty: 0,
      unitPrice: 0,
      priceInitial: base.initial,
      priceSubmitted: base.submitted,
      priceApproved: base.approved,
      reviewerNote: "",
      needsReview: !approvedMatches || !submittedMatches,
      isChapterTotal: true,
    });
  }
  return [...items, ...chapterTotals];
}

// ============================================================================
// 6. הערות הפרויקט (שורות 36–43 בגיליון)
// ============================================================================
function readProjectNotes(sheet) {
  const out = [];
  for (let row = 36; row <= 50; row++) {
    const v = clean(cell(sheet, `A${row}`));
    if (v) out.push(v);
  }
  return out;
}

// ============================================================================
// ריצה
// ============================================================================
function main() {
  for (const f of [FILE_BUDGET, FILE_DIFF]) {
    if (!existsSync(f)) {
      console.error(`✗ קובץ מקור חסר: ${f}`);
      console.error("  הגדר PINSKER_SRC לתיקייה שבה יושבים קבצי האקסל.");
      process.exit(1);
    }
  }

  const wbBudget = XLSX.readFile(FILE_BUDGET);
  const wbDiff = XLSX.readFile(FILE_DIFF);
  const sheet = wbBudget.Sheets[wbBudget.SheetNames[0]];

  const grid = readMonths(sheet);
  const projectId = mkId("prj");

  const costLines = readCostLines(sheet, grid, projectId);
  const fundingEvents = readFunding(sheet, grid, projectId);
  const batches = readBatches(sheet, projectId);
  const baselines = readChapterBaselines(wbDiff);
  const boqItems = reconcileBoq(readBoqItems(wbDiff, projectId, baselines), baselines, projectId);

  // --- קישור תקבולי מס רכוש למנות ------------------------------------------
  // המנה מצדיקה מקדמה שכבר התקבלה, והתקבול הבא משתחרר אחריה. לכן מנה 1
  // מקושרת לתקבול הראשון בגריד ומנה 2 לשני. מנה 3 היא ההצדקה האחרונה —
  // התקרה מוצתה ואין אחריה תקבול. (הנחת ייבוא — ניתנת לשינוי במסך המנות.)
  const refunds = fundingEvents.filter((f) => f.type === "taxRefund").sort((a, b) => a.month.localeCompare(b.month));
  refunds.forEach((f, i) => {
    if (batches[i]) f.claimBatchId = batches[i].id;
  });
  if (batches[2]) {
    batches[2].notes = "הצדקה אחרונה — תקרת ההחזר מוצתה, אין אחריה תקבול";
  }
  notes.push(
    `קישור תקבולים למנות הוא הנחת ייבוא: מנה 1 → ${refunds[0]?.month ?? "—"}, מנה 2 → ${refunds[1]?.month ?? "—"}, מנה 3 → ללא תקבול.`,
  );

  const entitlementCap = round2(num(cell(sheet, "B13")));
  const entitlementReceived = round2(num(cell(sheet, "C13")));

  const project = {
    id: projectId,
    name: "פינסקר 9, תל אביב",
    address: "פינסקר 9, תל אביב",
    vatRate: VAT,
    startMonth: grid.months[0],
    endMonth: grid.months[grid.months.length - 1],
    workMonths: 18,
    refundLagDays: 60,
    taxAuthorityName: "מס רכוש",
    openingCash: 0,
    entitlementCap,
    entitlementReceived,
    ownerUid: null,
    memberRoles: {},
    notes: readProjectNotes(sheet),
    createdAt: new Date().toISOString(),
  };

  const data = {
    schemaVersion: 1,
    projects: [project],
    boqItems,
    costLines,
    vendors: [],
    invoices: [],
    payments: [],
    claimBatches: batches.map(({ _componentsTotal, ...b }) => b),
    fundingEvents,
    documents: [],
    settings: { activeProjectId: projectId },
    _import: { notes, problems, generatedAt: new Date().toISOString() },
  };

  // --- מבחן ההתאמה: המספרים חייבים לצאת בדיוק כמו בגיליון -------------------
  const checks = [
    ["סה\"כ עלות הפרויקט", sum(costLines, (c) => c.budgetGross), 9256727],
    ["שולם עד כה", sum(costLines, (c) => c.paidBefore), 309933],
    ["סה\"כ לוח התשלומים", sum(costLines, (c) => sum(c.schedule, (s) => s.amount)), 8946794],
    ["סה\"כ מקורות", sum(fundingEvents, (f) => f.plannedAmount), 8946794],
    ["תקרת החזר מס רכוש", entitlementCap, 4780215],
    [
      "כתב כמויות — הוגש",
      sum(boqItems.filter((b) => b.isChapterTotal), (b) => b.priceSubmitted),
      6177238,
    ],
    [
      "כתב כמויות — ראשוני",
      sum(boqItems.filter((b) => b.isChapterTotal), (b) => b.priceInitial),
      6573052,
    ],
    [
      "כתב כמויות — אושר סופי",
      sum(boqItems.filter((b) => b.isChapterTotal), (b) => b.priceApproved),
      4051030,
    ],
    ["מנות — סה\"כ יעד", sum(batches, (b) => b.targetAmount), 4780215],
  ];

  console.log("\n מבחן ההתאמה מול הגיליון\n" + "─".repeat(58));
  let failed = 0;
  for (const [label, actual, expected] of checks) {
    const ok = Math.abs(actual - expected) < 1;
    if (!ok) failed++;
    console.log(
      `${ok ? "✓" : "✗"} ${label.padEnd(26)} ${String(actual).padStart(12)} ${ok ? "" : `(צפוי ${expected})`}`,
    );
  }

  // כל מנה חייבת להיסגר בדיוק על היעד שלה.
  for (const b of batches) {
    const total = round2(b._componentsTotal + b.topUpAmount);
    const ok = Math.abs(total - b.targetAmount) < 1;
    if (!ok) failed++;
    console.log(
      `${ok ? "✓" : "✗"} מנה ${b.seq}: רכיבים ${b._componentsTotal} + השלמה ${b.topUpAmount} = ${total} (יעד ${b.targetAmount})`,
    );
  }

  console.log("─".repeat(58));
  console.log(
    `סעיפי כתב כמויות: ${boqItems.filter((b) => !b.isChapterTotal).length} · פרקים: ${
      boqItems.filter((b) => b.isChapterTotal).length
    } · חודשי תזרים: ${grid.months.length} (${project.startMonth} → ${project.endMonth})`,
  );

  if (problems.length) {
    console.log("\n אי-התאמות במקור (תוקנו/סומנו):");
    problems.forEach((p) => console.log(`  ! ${p}`));
  }
  if (notes.length) {
    console.log("\n הערות ייבוא:");
    notes.forEach((p) => console.log(`  · ${p}`));
  }

  if (failed) {
    console.error(`\n✗ הייבוא נכשל: ${failed} בדיקות לא עברו. הקובץ לא נכתב.`);
    process.exit(1);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2), "utf8");
  console.log(`\n✓ נכתב ${OUT}`);
}

main();
