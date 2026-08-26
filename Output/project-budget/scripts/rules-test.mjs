// ============================================================================
// rules-test.mjs — בדיקות אמיתיות של firestore.rules מול האמולטור.
//
// הרצה: npm run test:rules      (מפעיל אמולטור, מריץ, מכבה)
//
// למה מול אמולטור ולא "קריאה של הכללים": כללי Firestore נכשלים בדרכים
// לא-אינטואיטיביות — `get()` על מסמך חסר מפיל את כל ההערכה, ושאילתה בלי
// `where` תואם נחסמת גם כשהמסמכים עצמם מותרים. את שני אלה אי אפשר לתפוס
// בעין; אפשר רק להריץ.
// ============================================================================

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const OWNER = "ronen@example.com";
const MANAGER = "nihul@example.com";
const VIEWER = "ariel@example.com";
const STRANGER = "someone@example.com";
const PID = "prj1";

let pass = 0;
let fail = 0;
const failures = [];

async function check(name, promise) {
  try {
    await promise;
    pass++;
  } catch (e) {
    fail++;
    failures.push(`${name} — ${e.message.split("\n")[0]}`);
  }
}

const authed = (env, email) =>
  env.authenticatedContext(email.replace(/[^a-z]/g, ""), { email, email_verified: true }).firestore();

const projectDoc = (roles) => ({
  name: "פינסקר 9",
  vatRate: 0.18,
  memberRoles: roles,
  memberEmails: Object.keys(roles).sort(),
});

const testEnv = await initializeTestEnvironment({
  projectId: "rules-test-project-budget",
  firestore: {
    rules: readFileSync(resolve(ROOT, "firestore.rules"), "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

await testEnv.clearFirestore();

// --- זריעה בעקיפת כללים ------------------------------------------------------
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "projects", PID), projectDoc({
    [OWNER]: "owner",
    [MANAGER]: "manager",
    [VIEWER]: "viewer",
  }));
  await setDoc(doc(db, "projects", PID, "invoices", "inv1"), {
    vendorName: "רז וורדה", amountGross: 63190, claimBatchId: null, claimStatus: "eligible", status: "paid",
  });
  await setDoc(doc(db, "projects", PID, "invoices", "inv2"), {
    vendorName: "בוריס", amountGross: 56050, claimBatchId: "b1", claimStatus: "submitted", status: "paid",
  });
  await setDoc(doc(db, "projects", PID, "costLines", "cl1"), { name: "עלות עבודות", budgetGross: 8377844 });
  await setDoc(doc(db, "projects", PID, "claimBatches", "b1"), { seq: 1, targetAmount: 1500000 });
  await setDoc(doc(db, "projects", "other", "invoices", "x"), { vendorName: "פרויקט אחר" });
  await setDoc(doc(db, "projects", "other"), projectDoc({ [STRANGER]: "owner" }));
});

const owner = authed(testEnv, OWNER);
const manager = authed(testEnv, MANAGER);
const viewer = authed(testEnv, VIEWER);
const stranger = authed(testEnv, STRANGER);
const anon = testEnv.unauthenticatedContext().firestore();

console.log("\n── קריאה ────────────────────────────────────────────");
await check("בעלים קורא את הפרויקט", assertSucceeds(getDoc(doc(owner, "projects", PID))));
await check("ניהול קורא את הפרויקט", assertSucceeds(getDoc(doc(manager, "projects", PID))));
await check("צופה קורא את הפרויקט", assertSucceeds(getDoc(doc(viewer, "projects", PID))));
await check("זר נחסם מהפרויקט", assertFails(getDoc(doc(stranger, "projects", PID))));
await check("אנונימי נחסם", assertFails(getDoc(doc(anon, "projects", PID))));
await check("צופה קורא חשבוניות", assertSucceeds(getDocs(collection(viewer, "projects", PID, "invoices"))));
await check("זר נחסם מחשבוניות", assertFails(getDocs(collection(stranger, "projects", PID, "invoices"))));
await check(
  "זר לא רואה פרויקט של אחר דרך הפרויקט שלו",
  assertFails(getDocs(collection(stranger, "projects", PID, "costLines"))),
);

console.log("── שאילתת רשימת פרויקטים ───────────────────────────");
// ★ המלכודת: שאילתה בלי `where` על המייל נחסמת, גם כשהמסמך עצמו מותר.
await check(
  "שאילתה בלי where נחסמת",
  assertFails(getDocs(query(collection(owner, "projects")))),
);
await check(
  "שאילתה עם array-contains על המייל עוברת",
  assertSucceeds(
    getDocs(query(collection(owner, "projects"), where("memberEmails", "array-contains", OWNER))),
  ),
);
await check(
  "שאילתה עם המייל של מישהו אחר נחסמת",
  assertFails(
    getDocs(query(collection(owner, "projects"), where("memberEmails", "array-contains", STRANGER))),
  ),
);

console.log("── התקציב: בעלים בלבד ──────────────────────────────");
await check("בעלים עורך שורת עלות", assertSucceeds(updateDoc(doc(owner, "projects", PID, "costLines", "cl1"), { budgetGross: 1 })));
await check("ניהול נחסם משורת עלות", assertFails(updateDoc(doc(manager, "projects", PID, "costLines", "cl1"), { budgetGross: 1 })));
await check("צופה נחסם משורת עלות", assertFails(updateDoc(doc(viewer, "projects", PID, "costLines", "cl1"), { budgetGross: 1 })));
await check("בעלים עורך מנה", assertSucceeds(updateDoc(doc(owner, "projects", PID, "claimBatches", "b1"), { targetAmount: 2 })));
await check("ניהול נחסם ממנה", assertFails(updateDoc(doc(manager, "projects", PID, "claimBatches", "b1"), { targetAmount: 2 })));

console.log("── חשבוניות: ניהול מדווח, לא דורש ──────────────────");
await check(
  "ניהול יוצר חשבונית מחוץ למנה",
  assertSucceeds(setDoc(doc(manager, "projects", PID, "invoices", "new1"), {
    vendorName: "ספק", amountGross: 100, claimBatchId: null, claimStatus: "eligible",
  })),
);
await check(
  "ניהול נחסם מיצירת חשבונית שכבר בתוך מנה",
  assertFails(setDoc(doc(manager, "projects", PID, "invoices", "new2"), {
    vendorName: "ספק", amountGross: 100, claimBatchId: "b1", claimStatus: "submitted",
  })),
);
await check(
  "ניהול מעדכן סכום",
  assertSucceeds(updateDoc(doc(manager, "projects", PID, "invoices", "inv1"), { amountGross: 999 })),
);
await check(
  "ניהול נחסם משיוך למנה",
  assertFails(updateDoc(doc(manager, "projects", PID, "invoices", "inv1"), { claimBatchId: "b1" })),
);
await check(
  "ניהול נחסם משינוי סטטוס הדרישה",
  assertFails(updateDoc(doc(manager, "projects", PID, "invoices", "inv1"), { claimStatus: "approvedByTax" })),
);
await check(
  "ניהול נחסם משינוי סכום שאושר ע\"י הרשות",
  assertFails(updateDoc(doc(manager, "projects", PID, "invoices", "inv1"), { taxApprovedAmount: 5 })),
);
await check(
  "ניהול נחסם ממחיקת חשבונית שכבר במנה",
  assertFails(deleteDoc(doc(manager, "projects", PID, "invoices", "inv2"))),
);
await check(
  "בעלים משייך למנה",
  assertSucceeds(updateDoc(doc(owner, "projects", PID, "invoices", "inv1"), { claimBatchId: "b1", claimStatus: "submitted" })),
);
await check(
  "צופה נחסם מכתיבת חשבונית",
  assertFails(updateDoc(doc(viewer, "projects", PID, "invoices", "inv1"), { amountGross: 1 })),
);

console.log("── תשלומים וספקים: ניהול כן ────────────────────────");
await check("ניהול רושם תשלום", assertSucceeds(setDoc(doc(manager, "projects", PID, "payments", "p1"), { invoiceId: "inv1", amount: 100 })));
await check("ניהול מוסיף ספק", assertSucceeds(setDoc(doc(manager, "projects", PID, "vendors", "v1"), { name: "ספק" })));
await check("צופה נחסם מתשלום", assertFails(setDoc(doc(viewer, "projects", PID, "payments", "p2"), { amount: 1 })));

console.log("── ניהול חברים: בעלים בלבד ─────────────────────────");
await check(
  "בעלים מוסיף חבר",
  assertSucceeds(updateDoc(doc(owner, "projects", PID), {
    memberRoles: { [OWNER]: "owner", [MANAGER]: "manager", [VIEWER]: "viewer", "new@example.com": "viewer" },
    memberEmails: [OWNER, MANAGER, VIEWER, "new@example.com"].sort(),
  })),
);
await check(
  "ניהול נחסם משינוי חברים",
  assertFails(updateDoc(doc(manager, "projects", PID), {
    memberRoles: { [MANAGER]: "owner" }, memberEmails: [MANAGER],
  })),
);
await check(
  "רשימות לא עקביות נחסמות",
  assertFails(updateDoc(doc(owner, "projects", PID), {
    memberRoles: { [OWNER]: "owner", [MANAGER]: "manager" },
    memberEmails: [OWNER], // חסר MANAGER — אפשר "להיעלם" מהשאילתה
  })),
);
await check(
  "הסרת הבעלים האחרון נחסמת",
  assertFails(updateDoc(doc(owner, "projects", PID), {
    memberRoles: { [MANAGER]: "manager" }, memberEmails: [MANAGER],
  })),
);

console.log("── יצירת פרויקט ────────────────────────────────────");
await check(
  "משתמש יוצר פרויקט שבו הוא הבעלים",
  assertSucceeds(setDoc(doc(stranger, "projects", "mine"), projectDoc({ [STRANGER]: "owner" }))),
);
await check(
  "יצירת פרויקט שבו אני לא הבעלים נחסמת",
  assertFails(setDoc(doc(stranger, "projects", "sneaky"), projectDoc({ [OWNER]: "owner", [STRANGER]: "viewer" }))),
);
await check(
  "יצירה בלי memberEmails נחסמת",
  assertFails(setDoc(doc(stranger, "projects", "nolist"), { name: "x", memberRoles: { [STRANGER]: "owner" } })),
);

await testEnv.cleanup();

console.log("\n" + "═".repeat(58));
if (fail) {
  console.log(`✗ ${fail} נכשלו · ${pass} עברו`);
  failures.forEach((f) => console.log(`   ✗ ${f}`));
  process.exit(1);
}
console.log(`✓ ${pass} בדיקות כללים עברו מול האמולטור`);
