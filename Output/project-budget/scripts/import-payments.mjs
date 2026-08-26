// ============================================================================
// import-payments.mjs — ייבוא התשלומים ששולמו בפועל ("פינסקר 9 - ניהול תזרים").
//
// הרצה:  npm run import:payments      (אחרי import:pinsker)
// פלט:   מעדכן את seed/pinsker-9.json במקום
//
// ----------------------------------------------------------------------------
// מקור הנתונים
// ----------------------------------------------------------------------------
// השורות למטה **הועתקו מצילום מסך** של הגיליון (רונן שלח תמונה, לא קובץ).
// לכן הן נבדקות מול שלושה עוגנים בלתי-תלויים שהיו קיימים כבר קודם, וכל אחד
// מהם חייב להתאים לשקל — אם לא, הייבוא נעצר:
//
//   1. סה"כ ברוטו                     = 690,549   (הסיכום בגיליון עצמו)
//   2. שתי שורות השמאי                = 309,933   (עמודת "שולם" בגיליון התקציב)
//   3. עשר השורות שאחרי הטיל          = 317,486   (שורה 28: "חשבוניות עד כה")
//
// ההתאמה השלישית היא הממצא: **"חשבוניות עד כה" במנה 1 הן בדיוק עשר השורות
// האלה** — כלומר שתי הדירות שפורקו לפני הטיל ושכר השמאי אינם נכללים בדרישה.
//
// כשיגיע קובץ האקסל עצמו — יש להחליף את `ROWS` בקריאה מהקובץ; הבדיקות נשארות.
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(HERE, "../seed/pinsker-9.json");

const VAT = 0.18;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (a, f = (x) => x) => round2(a.reduce((s, x) => s + (Number(f(x)) || 0), 0));

/**
 * הסכומים נגזרים מ**הברוטו** ולא מהנטו: עמודת הברוטו בגיליון מסתכמת במדויק
 * ל-690,549, בעוד עמודת הנטו מסתכמת ל-585,210 מול 585,211 שרשום שם — שקל של
 * עיגול תצוגה. הברוטו הוא גם מה שהמנות והתקציב מודדים.
 *
 * `claimable`: האם השורה נכללת ב"חשבוניות עד כה" של מנה 1.
 */
const ROWS = [
  { name: "פירוק דירת ורדה",           gross: 17700,  claimable: false, note: "קודם לטיל, לאחר הפתחה 1500" },
  { name: "פירוק דירת יוסי רז",        gross: 45430,  claimable: false, note: "קודם לטיל, לאחר הפתחה 6500" },
  { name: "פינוי הריסות מהבניין",       gross: 159300, claimable: true,  note: "בעקבות הטיל" },
  { name: "גל חן מהנדס",               gross: 4130,   claimable: true,  note: "קודם לטיל - מדרגות/עמוד/גג" },
  { name: "שמאי - רונן פורת",          gross: 20000,  claimable: false, note: "לפי 8% + מע\"מ", kind: "appraiser" },
  { name: "בוריס מהנדס",               gross: 56050,  claimable: true,  note: "" },
  { name: "מדידות - טרידיגו",           gross: 10089,  claimable: true,  note: "" },
  { name: "מפה טופוגרפית - ליאוניד",    gross: 4425,   claimable: true,  note: "" },
  { name: "גורלניק מהנדסים - תיק מידע", gross: 4720,   claimable: true,  note: "" },
  { name: "תיק מידע - עיריית תל אביב",  gross: 456,    claimable: true,  note: "" },
  { name: "השלמת מדידת ביוב - ליאוניד", gross: 944,    claimable: true,  note: "" },
  { name: "בדיקות מעבדה - סיסטם",       gross: 10112,  claimable: true,  note: "" },
  { name: "איטום פתחים - א.מ. ארגמן",   gross: 67260,  claimable: true,  note: "" },
  { name: "שמאי - רונן פורת",          gross: 289933, claimable: false, note: "", kind: "appraiser" },
];

/** מקדמות מס רכוש שהתקבלו — הצד השני של אותו גיליון. */
const ADVANCES = [
  { date: "2025-06-20", amount: 250000 },
  { date: "2026-05-05", amount: 750000 },
  { date: "2026-06-17", amount: 500000 },
];

let seq = 0;
const mkId = (p) => `${p}_imp${String(++seq).padStart(3, "0")}`;

function main() {
  if (!existsSync(SEED)) {
    console.error("✗ seed/pinsker-9.json חסר — הרץ קודם `npm run import:pinsker`.");
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(SEED, "utf8"));
  const project = data.projects[0];

  if (data.invoices.some((i) => i.notes?.includes("ייבוא תשלומים"))) {
    console.error("✗ התשלומים כבר יובאו לקובץ הזה. הרץ `npm run import:pinsker` כדי להתחיל נקי.");
    process.exit(1);
  }

  const appraiserLine = data.costLines.find((c) => c.kind === "appraiser");
  const worksLine = data.costLines.find((c) => c.kind === "works");
  const batch1 = data.claimBatches.find((b) => b.seq === 1);
  if (!appraiserLine || !worksLine || !batch1) {
    console.error("✗ מבנה ה-seed לא כצפוי (חסרה שורת שמאי / עבודות / מנה 1).");
    process.exit(1);
  }

  const invoices = [];
  const payments = [];

  for (const row of ROWS) {
    const gross = round2(row.gross);
    const net = round2(gross / (1 + VAT));
    const isAppraiser = row.kind === "appraiser";
    const inv = {
      id: mkId("inv"),
      projectId: project.id,
      vendorId: null,
      vendorName: row.name,
      invoiceNumber: "",
      // ⚠ בגיליון אין תאריך לכל תשלום — רק תאריך כותרת אחד. תאריך ריק פירושו
      // שהתשלום נספר ב"שולם" אבל **לא** משובץ לחודש בתזרים, וזה עדיף על
      // שיבוץ לחודש מומצא שיעוות את גרף היתרה.
      issueDate: null,
      dueDate: null,
      vatRate: VAT,
      amountNet: net,
      vatAmount: round2(gross - net),
      amountGross: gross,
      costLineId: isAppraiser ? appraiserLine.id : worksLine.id,
      boqAllocations: [],
      status: "paid",
      claimStatus: row.claimable ? "eligible" : "notEligible",
      claimBatchId: null,
      claimedAmount: null,
      taxApprovedAmount: null,
      documentId: null,
      extracted: null,
      notes: [
        "ייבוא תשלומים מגיליון ניהול התזרים",
        row.note,
        "תאריך תשלום חסר במקור — להשלים",
        isAppraiser ? null : "שיוך לשורת תקציב נקבע אוטומטית — לאמת",
      ]
        .filter(Boolean)
        .join(" · "),
      createdBy: null,
      createdAt: new Date().toISOString(),
    };
    invoices.push(inv);
    payments.push({
      id: mkId("pay"),
      projectId: project.id,
      invoiceId: inv.id,
      date: null,
      amount: gross,
      method: "transfer",
      reference: "",
      notes: "תאריך חסר במקור",
    });
  }

  // עשר השורות שאחרי הטיל נכנסות למנה 1 — זה מה שהגיליון קורא לו
  // "חשבוניות עד כה 317,486", ועכשיו יש מאחוריו חשבוניות אמיתיות.
  const claimable = invoices.filter((i) => i.claimStatus === "eligible");
  for (const inv of claimable) {
    inv.claimBatchId = batch1.id;
    inv.claimStatus = "submitted";
  }
  // הרכיב "חשבוניות עד כה" קיבל גיבוי אמיתי — מסירים אותו מרשימת המתוכננים
  // כדי שלא ייספר פעמיים מול אותן חשבוניות.
  const before = batch1.plannedComponents.length;
  batch1.plannedComponents = batch1.plannedComponents.filter(
    (c) => !c.label.includes("חשבוניות עד כה"),
  );

  // שכר השמאי היה רשום כ-`paidBefore` על שורת התקציב. עכשיו יש מאחוריו שתי
  // חשבוניות אמיתיות — להשאיר את שניהם זו ספירה כפולה של 309,933.
  const oldPaidBefore = appraiserLine.paidBefore;
  appraiserLine.paidBefore = 0;

  // --- יתרת הפתיחה ----------------------------------------------------------
  // המקדמות ממס רכוש (1,500,000) הגיעו לפני שגריד התזרים מתחיל, וחלקן כבר
  // הוצא (690,549). ההפרש הוא כסף שיושב בקופה ביום הראשון של הגריד.
  // הגיליון המקורי מניח יתרת פתיחה 0 ולכן מציג תוכנית הדוקה בהרבה ממה שהיא —
  // רונן אישר שהכסף עדיין בקופה, ולכן הוא נרשם כאן.
  const advancesTotal = sum(ADVANCES, (a) => a.amount);
  const paidTotal = sum(ROWS, (r) => r.gross);
  project.openingCash = round2(advancesTotal - paidTotal);

  data.invoices.push(...invoices);
  data.payments.push(...payments);
  data._import.notes.push(
    `יובאו ${invoices.length} תשלומים (${sum(invoices, (i) => i.amountGross)} ₪ ברוטו) מגיליון ניהול התזרים.`,
    `שכר השמאי (${oldPaidBefore} ₪) עבר מ-paidBefore לשתי חשבוניות אמיתיות — למניעת ספירה כפולה.`,
    `מקדמות מס רכוש בגיליון: ${ADVANCES.map((a) => `${a.date} ${a.amount.toLocaleString("he-IL")}`).join(" · ")} = ${sum(ADVANCES, (a) => a.amount).toLocaleString("he-IL")} ₪ — כבר מיוצגות בשדה entitlementReceived, לא נוספו כשורות מימון כדי לא לספור פעמיים.`,
  );

  // --- בדיקות ההתאמה --------------------------------------------------------
  const appraiserInvoices = invoices.filter((i) => i.costLineId === appraiserLine.id);
  const inBatch1 = invoices.filter((i) => i.claimBatchId === batch1.id);
  // הפירוקים שקדמו לטיל: לא זכאים, ולא שכר השמאי (שגם הוא לא זכאי אך נפרד).
  const preMissile = invoices.filter(
    (i) => i.claimStatus === "notEligible" && i.costLineId === worksLine.id,
  );

  const checks = [
    ["סה\"כ ברוטו", sum(invoices, (i) => i.amountGross), 690549],
    ["סה\"כ תשלומים", sum(payments, (p) => p.amount), 690549],
    ["שכר שמאי", sum(appraiserInvoices, (i) => i.amountGross), 309933],
    ["חשבוניות במנה 1", sum(inBatch1, (i) => i.amountGross), 317486],
    ["פירוקים קודם לטיל", sum(preMissile, (i) => i.amountGross), 63130],
    ["מספר חשבוניות", invoices.length, 14],
    ["מספר חשבוניות במנה 1", inBatch1.length, 10],
    ["יתרת פתיחה (מקדמות פחות ששולם)", project.openingCash, 809451],
  ];

  console.log("\n מבחן ההתאמה — תשלומים מול גיליון התקציב\n" + "─".repeat(60));
  let failed = 0;
  for (const [label, actual, expected] of checks) {
    const ok = Math.abs(actual - expected) < 1;
    if (!ok) failed++;
    console.log(
      `${ok ? "✓" : "✗"} ${label.padEnd(24)} ${String(actual).padStart(10)} ${ok ? "" : `(צפוי ${expected})`}`,
    );
  }
  console.log("─".repeat(60));
  console.log(`רכיבים מתוכננים במנה 1: ${before} → ${batch1.plannedComponents.length} (הוסר "חשבוניות עד כה")`);

  console.log("\n אי-התאמות שנשארות פתוחות:");
  console.log(
    `  ! מנה 1 רושמת "רז וורדה פירוק" 63,190 ₪, אך שתי שורות הפירוק בגיליון התשלומים מסתכמות ל-63,130 ₪ — פער 60 ₪.`,
  );
  console.log(
    `  ! "גל חן מהנדס" (4,130 ₪) מסומן בהערה "קודם לטיל" אך **כן** נכלל ב-317,486. שתי הדירות שפורקו קודם לטיל לא נכללות.`,
  );
  console.log(`  ! ל-14 התשלומים אין תאריך במקור — הם נספרים ב"שולם" אך לא משובצים לחודש בתזרים.`);

  if (failed) {
    console.error(`\n✗ ${failed} בדיקות נכשלו. הקובץ לא נכתב.`);
    process.exit(1);
  }

  writeFileSync(SEED, JSON.stringify(data, null, 2), "utf8");
  console.log(`\n✓ עודכן ${SEED}`);
}

main();
