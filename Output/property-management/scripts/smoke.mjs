// בדיקת עשן ללוגיקה הטהורה (בלי React/DOM): schema, finance, i18n.
import assert from "node:assert";
import { createProperty, createTenant, createLease, createTransaction, createTicket, createDocument, createReminder, createDebt, createUnit } from "../src/schema.js";
import { computeYield, portfolioTotals, annualIncome, annualExpenses, netAnnualCashflow, openDebtForProperty, openTicketsForProperty } from "../src/utils/finance.js";
import { formatCurrency, formatPercent, formatDate, daysUntil, whatsappLink } from "../src/utils/format.js";
import dict, { translate } from "../src/i18n.js";
import { EMPTY } from "../src/constants.js";
import {
  tenantForIdentity,
  assigneeKeyForIdentity,
  tenantView,
  maintenanceView,
  maintenanceSafeTicket,
  isMaintenanceUpdateAllowed,
} from "../src/utils/access.js";
import { mockExtract, extractDocument, EXTRACTION_SCHEMA, AI_DOC_TYPES } from "../src/utils/aiExtract.js";
import { computeReminders, activeReminders, DEFAULT_LEAD_DAYS } from "../src/utils/reminders.js";
import { removeTenantCascade } from "../src/utils/retention.js";
import { AI_SCANNABLE_TYPES } from "../src/constants.js";

let pass = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("  ok:", name);
  pass++;
}

// --- 1. כל 9 ה-factories מייצרים ownerId (B1) ---
const factories = {
  property: createProperty({ ownerId: "u1" }),
  unit: createUnit("p1", { ownerId: "u1" }),
  tenant: createTenant({ ownerId: "u1" }),
  lease: createLease({ ownerId: "u1" }),
  transaction: createTransaction({ ownerId: "u1" }),
  debt: createDebt({ ownerId: "u1" }),
  ticket: createTicket({ ownerId: "u1" }),
  document: createDocument({ ownerId: "u1" }),
  reminder: createReminder({ ownerId: "u1" }),
};
for (const [name, ent] of Object.entries(factories)) {
  ok(`${name} has ownerId`, ent.ownerId === "u1");
  ok(`${name} has id`, typeof ent.id === "string" && ent.id.length > 0);
}

// --- 2. Property: מדינה+מטבע נפרדים; מטבע ברירת מחדל לפי מדינה ---
const cyProp = createProperty({ ownerId: "u1", country: "CY" });
ok("CY property currency defaults EUR", cyProp.currency === "EUR");
ok("CY property country stored on address", cyProp.address.country === "CY");
const usProp = createProperty({ ownerId: "u1", country: "US" });
ok("US property currency defaults USD", usProp.currency === "USD");

// --- 3. Transaction.source ברירת מחדל manual ---
ok("transaction source defaults manual", createTransaction({}).source === "manual");

// --- 4. תשואה מחושבת (נטו/הון עצמי) ---
const p = createProperty({ ownerId: "u1", country: "IL" });
p.finance.equity = 1000000;
const txns = [
  { propertyId: p.id, type: "income", category: "rent", amount: 5000, date: isoMonthsAgo(1) },
  { propertyId: p.id, type: "income", category: "rent", amount: 5000, date: isoMonthsAgo(2) },
  { propertyId: p.id, type: "expense", category: "maintenance", amount: 2000, date: isoMonthsAgo(1) },
];
const y = computeYield(p, txns, []);
// income 10000, expense 2000 → net 8000 / 1,000,000 = 0.8%
ok("computeYield = 0.8%", Math.abs(y - 0.8) < 1e-9);
ok("annualIncome from txns = 10000", annualIncome(p, txns, []) === 10000);
ok("annualExpenses = 2000", annualExpenses(p, txns) === 2000);
ok("netAnnualCashflow = 8000", netAnnualCashflow(p, txns, []) === 8000);

// --- 4b. נפילה לשכ"ד מהחוזה כשאין תנועות הכנסה ---
const p2 = createProperty({ ownerId: "u1" });
p2.finance.purchasePrice = 1200000;
const lease = createLease({ ownerId: "u1", propertyId: p2.id, tenantId: "t1", monthlyRent: 4000 });
lease.status = "active";
ok("annualIncome falls back to lease rent*12 = 48000", annualIncome(p2, [], [lease]) === 48000);
const y2 = computeYield(p2, [], [lease]); // 48000/1,200,000 = 4%
ok("computeYield from lease = 4%", Math.abs(y2 - 4) < 1e-9);

// --- 5. אגרגציית פורטפוליו + סף תשואה נמוכה ---
const state = {
  ...EMPTY,
  properties: [p, p2],
  transactions: txns,
  leases: [lease],
  debts: [createDebt({ ownerId: "u1", propertyId: p.id, amount: 3000 })],
  tickets: [createTicket({ ownerId: "u1", propertyId: p.id, status: "open" })],
  settings: { ...EMPTY.settings, lowYieldThreshold: 3 },
};
const totals = portfolioTotals(state);
ok("portfolio count = 2", totals.propertyCount === 2);
ok("open debt = 3000", totals.openDebt === 3000);
ok("low-yield count = 1 (p at 0.8%)", totals.lowYieldCount === 1);
ok("openDebtForProperty p = 3000", openDebtForProperty(p.id, state.debts) === 3000);
ok("openTicketsForProperty p = 1", openTicketsForProperty(p.id, state.tickets) === 1);

// --- 6. פורמט מטבע/תאריך/אחוז לפי locale ---
ok("ILS formatting contains 5,000", formatCurrency(5000, "ILS", "he").includes("5,000"));
ok("USD formatting contains $", formatCurrency(5000, "USD", "en").includes("$"));
ok("EUR formatting", /€|EUR/.test(formatCurrency(5000, "EUR", "en")));
ok("percent format", formatPercent(4, "he") === "4.0%");
ok("null currency → dash", formatCurrency(null, "ILS", "he") === "—");
ok("daysUntil future positive", daysUntil(isoInDays(10)) === 10);
ok("whatsapp link normalizes 0 prefix", whatsappLink("0501234567") === "https://wa.me/972501234567");

// --- 7. i18n: כל מפתח ב-he קיים גם ב-en (וההפך), ואין ערכים ריקים ---
const heKeys = Object.keys(dict.he);
const enKeys = Object.keys(dict.en);
const missingInEn = heKeys.filter((k) => !(k in dict.en));
const missingInHe = enKeys.filter((k) => !(k in dict.he));
ok("no keys missing in en: " + missingInEn.join(","), missingInEn.length === 0);
ok("no keys missing in he: " + missingInHe.join(","), missingInHe.length === 0);
ok("no empty he values", heKeys.every((k) => String(dict.he[k]).length > 0));
ok("translate interpolates vars", translate("he", "maint.openCount", { count: 3 }) === "3 תקלות פתוחות");
ok("translate falls back to he for unknown lang", translate("xx", "nav.lobby") === dict.he["nav.lobby"]);
ok("unknown key returns key (fail-visible)", translate("he", "nope.key") === "nope.key");

// --- 8. EMPTY schema completeness ---
for (const arr of ["properties", "units", "tenants", "leases", "transactions", "debts", "tickets", "documents", "reminders"]) {
  ok(`EMPTY has array ${arr}`, Array.isArray(EMPTY[arr]));
}
ok("EMPTY onboarding not complete", EMPTY.settings.onboardingComplete === false);
ok("EMPTY plan = free", EMPTY.settings.plan === "free");

// --- 9. בידוד תפקידים (פרוסה 2) ---
// שני בעלים-דיירים שונים בתוך אותו פורטפוליו של בעלים אחד; ודא ש-tenant אחד
// לא רואה את נכס/חוזה/מסמך/תקלה של השני, ואת שום נתון כלכלי.
const owner = "owner-uid";
const propA = createProperty({ ownerId: owner, country: "IL" });
const propB = createProperty({ ownerId: owner, country: "IL" });
propA.finance.equity = 1000000; // נתון כלכלי שאסור לחשוף לדייר
const tenantA = createTenant({ ownerId: owner, fullName: "דייר A", email: "a@x.com", userId: "uidA" });
const tenantB = createTenant({ ownerId: owner, fullName: "דייר B", email: "b@x.com", userId: "uidB" });
const leaseA = createLease({ ownerId: owner, propertyId: propA.id, tenantId: tenantA.id, monthlyRent: 5000 });
leaseA.status = "active";
const leaseB = createLease({ ownerId: owner, propertyId: propB.id, tenantId: tenantB.id, monthlyRent: 6000 });
leaseB.status = "active";
const docA = createDocument({ ownerId: owner, propertyId: propA.id, tenantId: tenantA.id, type: "leaseContract" });
const docB = createDocument({ ownerId: owner, propertyId: propB.id, tenantId: tenantB.id, type: "leaseContract" });
const debtA = createDebt({ ownerId: owner, propertyId: propA.id, tenantId: tenantA.id, amount: 1500 });
// תקלות: אחת שדיווח דייר A, אחת של דייר B, ואחת משויכת לאיש תחזוקה M
const tkA = createTicket({ ownerId: owner, propertyId: propA.id, reportedByTenantId: tenantA.id, type: "plumbing" });
const tkB = createTicket({ ownerId: owner, propertyId: propB.id, reportedByTenantId: tenantB.id, type: "electricity" });
const tkM = createTicket({ ownerId: owner, propertyId: propA.id, assigneeEmail: "m@x.com", assigneeUserId: "uidM", type: "structural", cost: 900 });

const roleState = {
  ...EMPTY,
  properties: [propA, propB],
  tenants: [tenantA, tenantB],
  leases: [leaseA, leaseB],
  documents: [docA, docB],
  debts: [debtA],
  tickets: [tkA, tkB, tkM],
};

// זיהוי תפקיד לפי זהות
ok("identity a@x.com → tenant A", tenantForIdentity(roleState, { email: "a@x.com" })?.id === tenantA.id);
ok("identity uidB → tenant B", tenantForIdentity(roleState, { uid: "uidB" })?.id === tenantB.id);
ok("identity m@x.com → maintenance key", assigneeKeyForIdentity(roleState, { email: "m@x.com" })?.email === "m@x.com");
ok("owner identity → not a tenant", tenantForIdentity(roleState, { uid: owner, email: "owner@x.com" }) === null);

// תצוגת דייר A
const viewA = tenantView(roleState, tenantA.id);
ok("tenant A sees exactly 1 property", viewA.properties.length === 1);
ok("tenant A sees only their property", viewA.properties[0].id === propA.id);
ok("tenant A does NOT see property B", !viewA.properties.some((p) => p.id === propB.id));
ok("tenant A property view has NO finance field", viewA.properties[0].finance === undefined);
ok("tenant A property view has NO yield", viewA.properties[0].yield === undefined);
ok("tenant A sees only their lease", viewA.leases.length === 1 && viewA.leases[0].id === leaseA.id);
ok("tenant A sees only their document", viewA.documents.length === 1 && viewA.documents[0].id === docA.id);
ok("tenant A does NOT see document B", !viewA.documents.some((d) => d.id === docB.id));
ok("tenant A sees only tickets they reported", viewA.tickets.length === 1 && viewA.tickets[0].id === tkA.id);
ok("tenant A does NOT see maintenance ticket tkM", !viewA.tickets.some((t) => t.id === tkM.id));
ok("tenant A balance = their debt only (1500)", viewA.openBalance === 1500);
// דייר A לא נחשף לנתונים כלכליים דרך התקלה
ok("tenant ticket has no cost field", viewA.tickets[0].cost === undefined);

// תצוגת דייר B — מבודדת מ-A
const viewB = tenantView(roleState, tenantB.id);
ok("tenant B sees only property B", viewB.properties.length === 1 && viewB.properties[0].id === propB.id);
ok("tenant B balance = 0 (no debt)", viewB.openBalance === 0);

// תצוגת תחזוקה — רק tickets משויכים ל-M
const mView = maintenanceView(roleState, { email: "m@x.com" });
ok("maintenance M sees exactly 1 ticket", mView.tickets.length === 1);
ok("maintenance M sees only their assigned ticket", mView.tickets[0].id === tkM.id);
ok("maintenance does NOT see tenant-reported tkA", !mView.tickets.some((t) => t.id === tkA.id));
ok("maintenance ticket has NO cost (financial hidden)", mView.tickets[0].cost === undefined);
ok("maintenance ticket has NO handler PII", mView.tickets[0].handler === undefined);
ok("maintenance ticket has NO insurance field", mView.tickets[0].insurance === undefined);
ok("maintenance sees property address only (no finance)", mView.tickets[0].property.finance === undefined);
// תחזוקה עם מפתח uid
const mViewUid = maintenanceView(roleState, { userId: "uidM" });
ok("maintenance by uid also resolves the ticket", mViewUid.tickets.length === 1 && mViewUid.tickets[0].id === tkM.id);
// מפתח תחזוקה זר → אפס
const mViewOther = maintenanceView(roleState, { email: "zzz@x.com" });
ok("unknown maintenance sees nothing", mViewOther.tickets.length === 0);

// בדיקת diff לעדכון תחזוקה — מותר רק status/fieldPhotos
ok(
  "maintenance update status only → allowed",
  isMaintenanceUpdateAllowed(tkM, { ...tkM, status: "inProgress" })
);
ok(
  "maintenance update fieldPhotos → allowed",
  isMaintenanceUpdateAllowed(tkM, { ...tkM, fieldPhotos: [{ id: "p1", name: "photo" }] })
);
ok(
  "maintenance update cost → BLOCKED",
  !isMaintenanceUpdateAllowed(tkM, { ...tkM, cost: 5 })
);
ok(
  "maintenance update description → BLOCKED",
  !isMaintenanceUpdateAllowed(tkM, { ...tkM, description: "hacked" })
);
ok(
  "maintenance update assignee → BLOCKED",
  !isMaintenanceUpdateAllowed(tkM, { ...tkM, assigneeUserId: "someoneElse" })
);

// maintenanceSafeTicket לא מדליף שדות כלכליים
const safe = maintenanceSafeTicket(tkM);
ok("safe ticket keeps status", safe.status === "open");
ok("safe ticket drops quote/cost/receipt/insurance/handler", [safe.quote, safe.cost, safe.receiptRef, safe.insurance, safe.handler].every((v) => v === undefined));

// --- 10. סריקת מסמכים ב-AI: mock מחזיר בדיוק את הסכימה (פרוסה 3) ---
const schemaKeys = EXTRACTION_SCHEMA.required;
const mock = mockExtract("חשבון חשמל ינואר.pdf");
ok("mock returns all schema keys", schemaKeys.every((k) => k in mock));
ok("mock has no extra keys beyond schema", Object.keys(mock).every((k) => schemaKeys.includes(k)));
ok("mock detects electricity from filename", mock.docType === "electricity");
ok("mock docType within allowed enum", AI_DOC_TYPES.includes(mock.docType));
ok("mock arnona detection", mockExtract("ארנונה.pdf").docType === "municipalTax");
ok("mock water detection", mockExtract("water bill.pdf").docType === "water");
ok("mock sale contract detection", mockExtract("חוזה מכר.pdf").docType === "saleContract");
ok("mock lease detection", mockExtract("lease_agreement.pdf").docType === "leaseContract");
ok("mock unknown fallback", mockExtract("random.pdf").docType === "unknown");
ok("mock amount is number or null", typeof mock.amount === "number" || mock.amount === null);
ok("mock date is YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(mock.date));
// extractDocument במצב מקומי (אין firebase) → mock:true, בלי מפתח/רשת
const localExtract = await extractDocument({ fileName: "ארנונה.pdf" });
ok("extractDocument local → mock flag true", localExtract.mock === true);
ok("extractDocument local → schema-shaped", schemaKeys.every((k) => k in localExtract));
// הסכימה נעולה: additionalProperties:false + required מלא
ok("EXTRACTION_SCHEMA additionalProperties false", EXTRACTION_SCHEMA.additionalProperties === false);
ok("EXTRACTION_SCHEMA required = 5 fields", EXTRACTION_SCHEMA.required.length === 5);

// --- 11. מנוע תזכורות (פרוסה 3) ---
const remToday = "2026-08-04";
function isoPlus(days) {
  const d = new Date(remToday);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const remOwner = "ro";
const remProp = createProperty({ ownerId: remOwner });
const remTenant = createTenant({ ownerId: remOwner });
// חוזה פעיל שמסתיים בעוד 15 יום → בתוך חלון 30 יום
const remLeaseSoon = createLease({ ownerId: remOwner, propertyId: remProp.id, tenantId: remTenant.id });
remLeaseSoon.status = "active";
remLeaseSoon.endDate = isoPlus(15);
// חוזה פעיל שמסתיים בעוד 200 יום → מחוץ לחלון
const remLeaseFar = createLease({ ownerId: remOwner, propertyId: remProp.id, tenantId: remTenant.id });
remLeaseFar.status = "active";
remLeaseFar.endDate = isoPlus(200);
// חוזה שהסתיים → לא מייצר תזכורת
const remLeaseEnded = createLease({ ownerId: remOwner, propertyId: remProp.id, tenantId: remTenant.id });
remLeaseEnded.status = "ended";
remLeaseEnded.endDate = isoPlus(5);
// תזכורת ביטוח שמורה שעברה (באיחור 3 ימים) בתוך החלון
const remInsurance = createReminder({ ownerId: remOwner, type: "insurance", propertyId: remProp.id });
remInsurance.dueDate = isoPlus(-3);
remInsurance.leadDays = 30;
// תזכורת מס שכבר טופלה → מסוננת
const remTaxDone = createReminder({ ownerId: remOwner, type: "taxReport" });
remTaxDone.dueDate = isoPlus(10);
remTaxDone.status = "done";

const remState = {
  ...EMPTY,
  properties: [remProp],
  tenants: [remTenant],
  leases: [remLeaseSoon, remLeaseFar, remLeaseEnded],
  reminders: [remInsurance, remTaxDone],
};
const rems = computeReminders(remState, remToday);
ok("reminders: default lead days = 30", DEFAULT_LEAD_DAYS === 30);
ok("reminders: ended lease produces none", !rems.some((r) => r.leaseId === remLeaseEnded.id));
ok("reminders: done reminder filtered out", !rems.some((r) => r.id === remTaxDone.id));
const soon = rems.find((r) => r.leaseId === remLeaseSoon.id);
ok("reminders: soon lease present", !!soon);
ok("reminders: soon lease daysUntil = 15", soon.daysUntil === 15);
ok("reminders: soon lease within window", soon.within === true);
ok("reminders: soon lease type leaseRenewal", soon.type === "leaseRenewal");
ok("reminders: soon lease source derived", soon.source === "derived");
const far = rems.find((r) => r.leaseId === remLeaseFar.id);
ok("reminders: far lease NOT within window", far.within === false);
const ins = rems.find((r) => r.id === remInsurance.id);
ok("reminders: overdue insurance flagged overdue", ins.overdue === true);
ok("reminders: overdue insurance daysUntil = -3", ins.daysUntil === -3);
ok("reminders: sorted by urgency (overdue first)", rems[0].daysUntil <= rems[rems.length - 1].daysUntil);
const active = activeReminders(remState, remToday);
ok("activeReminders returns only within-window (2: soon + overdue)", active.length === 2);

// ---- שער עדי: B-AI-2 (חסימת סריקת ת.ז.) + B-RET (מחיקת דייר cascade) ----
ok("B-AI-2: id NOT in AI-scannable allowlist", !AI_SCANNABLE_TYPES.includes("id"));
ok("B-AI-2: structured types ARE scannable", ["municipalTax", "electricity", "water", "leaseContract", "saleContract"].every((x) => AI_SCANNABLE_TYPES.includes(x)));
ok("B-AI-2: houseRegulations/insurance NOT scannable", !AI_SCANNABLE_TYPES.includes("houseRegulations") && !AI_SCANNABLE_TYPES.includes("insurance"));

const retState = {
  ...EMPTY,
  tenants: [{ id: "t1", ownerId: "o" }, { id: "t2", ownerId: "o" }],
  leases: [{ id: "l1", tenantId: "t1", ownerId: "o" }, { id: "l2", tenantId: "t2", ownerId: "o" }],
  documents: [
    { id: "d1", tenantId: "t1", ownerId: "o" },
    { id: "d2", leaseId: "l1", ownerId: "o" },
    { id: "d3", tenantId: "t2", ownerId: "o" },
  ],
  tickets: [{ id: "tk1", reportedByTenantId: "t1", ownerId: "o" }, { id: "tk2", reportedByTenantId: "t2", ownerId: "o" }],
  debts: [{ id: "db1", tenantId: "t1", ownerId: "o" }, { id: "db2", tenantId: "t2", ownerId: "o" }],
};
const afterDel = removeTenantCascade(retState, "t1");
ok("B-RET: deleted tenant removed", !afterDel.tenants.some((x) => x.id === "t1"));
ok("B-RET: other tenant kept", afterDel.tenants.some((x) => x.id === "t2"));
ok("B-RET: tenant's lease removed", !afterDel.leases.some((x) => x.tenantId === "t1"));
ok("B-RET: doc by tenantId removed", !afterDel.documents.some((x) => x.id === "d1"));
ok("B-RET: doc by leaseId removed (cascade)", !afterDel.documents.some((x) => x.id === "d2"));
ok("B-RET: other tenant's doc kept", afterDel.documents.some((x) => x.id === "d3"));
ok("B-RET: tenant's reported ticket removed", !afterDel.tickets.some((x) => x.reportedByTenantId === "t1"));
ok("B-RET: tenant's debt removed", !afterDel.debts.some((x) => x.tenantId === "t1"));
ok("B-RET: other tenant's debt kept", afterDel.debts.some((x) => x.id === "db2"));

console.log(`\nALL ${pass} CHECKS PASSED`);

function isoMonthsAgo(m) {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString().slice(0, 10);
}
function isoInDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
