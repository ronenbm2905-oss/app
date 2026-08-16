// ============================================================================
// e2e-check.mjs — QA **חי** בדפדפן אמיתי, בלי שום תלות חדשה.
//
// למה הקובץ הזה נולד: באג איבוד הנתונים ("הרכב נשמר" → `vehicles: []` ומשימת
// טסט יתומה) חמק גם מ-602 אסרשני `smoke` וגם מ-217 אסרשני `render:check`,
// כי שניהם בודקים **פונקציה טהורה** או **רינדור אחד**. הוא נתפס רק בלחיצה
// אמיתית על מסך אמיתי. זו השכבה שהייתה חסרה.
//
// המנגנון: Edge/Chrome ב-headless + פרוטוקול CDP מעל ה-WebSocket המובנה של
// Node. **בלי puppeteer, בלי playwright, בלי חבילה נוספת.**
//
//   npm run e2e            — מריץ מול build קיים ב-dist/
//
// ⚠️ רץ במצב fallback מקומי (בלי .env). את המסלול הענני הוא **לא** מכסה.
// ============================================================================

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.E2E_PORT || 4188);
const CDP_PORT = Number(process.env.E2E_CDP_PORT || 9333);
const BASE = `http://localhost:${PORT}`;

const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

let pass = 0;
let failed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, detail === undefined ? "" : `\n    got: ${JSON.stringify(detail)}`);
  }
}
function eq(name, a, b) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  if (good) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name, "\n    got:", JSON.stringify(a), "\n    want:", JSON.stringify(b));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* עוד לא עלה */
    }
    await sleep(300);
  }
  return false;
}

// -- דרייבר CDP מינימלי -----------------------------------------------------
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      const res = this.pending.get(msg.id);
      if (res) {
        this.pending.delete(msg.id);
        msg.error ? res.reject(new Error(msg.error.message)) : res.resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    }
    return r.result?.value;
  }
  // ממתין עד שביטוי מחזיר ערך אמיתי (או נכשל בטיימאאוט).
  async waitFor(expression, { timeout = 15000, label = expression } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const v = await this.eval(expression);
      if (v) return v;
      await sleep(200);
    }
    throw new Error(`timeout waiting for: ${label}`);
  }
}

// -- עוזרים שרצים **בתוך** הדף ---------------------------------------------
const PAGE_HELPERS = `
window.__byText = (sel, text) =>
  [...document.querySelectorAll(sel)].find((e) => (e.textContent || "").includes(text)) || null;
window.__clickText = (sel, text) => {
  const el = window.__byText(sel, text);
  if (!el) return false;
  el.click();
  return true;
};
window.__setInput = (selector, value) => {
  const el = document.querySelector(selector);
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
};
window.__data = () => JSON.parse(localStorage.getItem("nrcar_data") || "null");
window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message)));
`;

const SEED = {
  schemaVersion: 1,
  household: { id: "local", name: "", createdAt: null, members: { "local-owner": "owner" } },
  settings: {
    onboarded: true,
    policyVersion: "0.1-draft",
    leadDays: 30,
    emergencyAuth: "session",
    emergencyOffline: "text",
    language: "he",
    textSize: "default",
  },
  profile: {
    uid: "local-owner",
    displayName: "רונן",
    phone: "0500000000",
    notices: [{ policyVersion: "0.1-draft", acknowledgedAt: "2026-08-13T00:00:00Z", method: "inApp" }],
    serviceChannels: { push: true, sms: false, email: false },
    marketingConsent: null,
  },
  vehicles: [],
  vehiclesPrivate: [],
  drivers: [],
  vehicleAccess: [],
  tasks: [],
  documents: [],
  personalDocs: [],
  serviceRecords: [],
  odometerReadings: [],
};

// ============================================================================
let preview;
let browser;
let profileDir;

try {
  if (!existsSync(join(ROOT, "dist", "index.html"))) {
    console.error("dist/ חסר — הרץ קודם `npm run build`");
    process.exit(1);
  }

  const browserPath = BROWSERS.find((p) => existsSync(p));
  if (!browserPath) {
    console.error("לא נמצא Edge/Chrome — מדלגים על ה-QA החי (ולא מדווחים עליו כאילו רץ)");
    process.exit(2);
  }

  preview = spawn("node", [join(ROOT, "node_modules", "vite", "bin", "vite.js"), "preview", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
    shell: false,
  });
  if (!(await waitForHttp(`${BASE}/`))) throw new Error("preview server לא עלה");

  profileDir = mkdtempSync(join(tmpdir(), "nrcar-e2e-"));
  browser = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${CDP_PORT}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  if (!(await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`))) {
    throw new Error("הדפדפן לא נפתח ל-CDP");
  }

  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("error", rej);
  });
  const cdp = new Cdp(ws);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Log.enable");

  // אוספים שגיאות קונסול אמיתיות מהדפדפן.
  const consoleErrors = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Log.entryAdded" && m.params?.entry?.level === "error") {
      consoleErrors.push(m.params.entry.text);
    }
    if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push(m.params?.exceptionDetails?.exception?.description || "exception");
    }
  });

  // -- זריעת המצב ההתחלתי ואז טעינת המסך -----------------------------------
  await cdp.send("Page.navigate", { url: `${BASE}/` });
  await sleep(1200);
  await cdp.eval(`localStorage.clear(); localStorage.setItem('nrcar_data', ${JSON.stringify(JSON.stringify(SEED))}); true`);
  await cdp.send("Page.navigate", { url: `${BASE}/#/vehicles/new` });
  await sleep(1200);
  await cdp.eval(`location.reload(); true`);
  await sleep(1500);
  await cdp.eval(PAGE_HELPERS);

  console.log("— טעינה");
  ok("האפליקציה נטענה", Boolean(await cdp.eval(`!!document.querySelector('#root')?.children.length`)));
  ok("★ הטופס הידני גלוי בלי שום לחיצה", Boolean(await cdp.eval(`!!window.__byText('h2','פרטי הרכב')`)));

  // ==========================================================================
  console.log("— ★ הזרימה הקריטית: מספר רישוי → משיכה → tokef_dt → משימת טסט");
  // ==========================================================================
  const PLATE = "68708404"; // רשומה אמיתית במאגר משרד התחבורה
  ok("שדה מספר הרישוי קיים", Boolean(await cdp.eval(`window.__setInput('input[inputmode=numeric]', '${PLATE}')`)));
  ok("כפתור החיפוש נלחץ", Boolean(await cdp.eval(`window.__clickText('button','חיפוש הרכב')`)));

  // המשיכה יוצאת מהדפדפן ישירות ל-data.gov.il — זו קריאת רשת אמיתית.
  await cdp.waitFor(`!!window.__byText('h2','מצאנו את הרכב')`, { label: "כרטיס האישור מהמאגר" });
  ok("★ המשיכה ממשרד התחבורה הצליחה (רשת אמיתית)", true);
  const shownTest = await cdp.eval(
    `(() => { const dd=[...document.querySelectorAll('dd')].map(e=>e.textContent.trim()); return dd; })()`
  );
  ok("★ תוקף הטסט שנמשך מוצג למשתמש", shownTest.some((v) => v.includes("2027")), shownTest);

  ok("כפתור האישור נלחץ", Boolean(await cdp.eval(`window.__clickText('button','כן, זה הרכב שלי')`)));
  await sleep(500);
  ok("כפתור השמירה נלחץ", Boolean(await cdp.eval(`window.__clickText('button','שמירת הרכב')`)));
  await cdp.waitFor(`!!window.__byText('p','נשמר') || !!window.__byText('div','נשמר')`, { label: "אישור שמירה" });

  // ==========================================================================
  console.log("— 🔴 האסרשן שתופס את באג איבוד הנתונים");
  // ==========================================================================
  const saved = await cdp.eval(`window.__data()`);
  eq("★ הרכב באמת נשמר ב-localStorage", saved.vehicles.length, 1);
  eq("★ עם מספר הרישוי הנכון", saved.vehicles[0].plate, PLATE);
  eq("★ ועם tokef_dt מהמאגר", saved.vehicles[0].testValidUntil, "2027-08-01");
  ok("★ נוצרה משימת טסט", saved.tasks.some((t) => t.type === "test"), saved.tasks.map((t) => t.type));
  eq("★ ובתאריך שהגיע מהמאגר", saved.tasks.find((t) => t.type === "test")?.dueDate, "2027-08-01");
  ok(
    "★★ ואין אף משימה יתומה — כל vehicleId מצביע לרכב קיים",
    saved.tasks.length > 0 && saved.tasks.every((t) => saved.vehicles.some((v) => v.id === t.vehicleId)),
    { vehicles: saved.vehicles.length, tasks: saved.tasks.length }
  );
  ok("★ למשימה יש nextFireAt מחושב", Boolean(saved.tasks.find((t) => t.type === "test")?.schedule?.nextFireAt));
  ok("★ ואין שדה אסור על הרכב", !("misgeret" in saved.vehicles[0]) && !("url" in saved.vehicles[0]));

  // ==========================================================================
  console.log("— הדשבורד אחרי השמירה");
  // ==========================================================================
  await cdp.eval(`location.hash = '#/'; true`);
  await sleep(900);
  await cdp.eval(PAGE_HELPERS);
  const dashText = await cdp.eval(`document.body.innerText`);
  ok("★ הדשבורד מציג את הרכב (ולא מצב ריק)", dashText.includes("JAECOO") || dashText.includes("ג'אקו"), dashText.slice(0, 200));
  ok("★ ואינו מציג את המסך הריק", !dashText.includes("בוא נוסיף את הרכב הראשון שלך"));
  ok("כרטיס-גיבור או 'הכול מסודר' מוצג", dashText.includes("הכי דחוף עכשיו") || dashText.includes("הכול מסודר"));

  // ==========================================================================
  console.log("— ★ סימון 'בוצע' + המשימה הבאה לפני השמירה");
  // ==========================================================================
  const taskId = saved.tasks.find((t) => t.type === "test").id;
  await cdp.eval(`location.hash = '#/task/${taskId}'; true`);
  await sleep(900);
  await cdp.eval(PAGE_HELPERS);
  ok("מסך המשימה נטען", Boolean(await cdp.eval(`!!window.__byText('h1','טסט') || !!window.__byText('h1','הטסט')`)));
  ok("כפתור 'סימנתי שביצעתי' נלחץ", Boolean(await cdp.eval(`window.__clickText('button','סימנתי שביצעתי')`)));
  await cdp.waitFor(`!!window.__byText('h3','מה יקרה עכשיו')`, { label: "תצוגת המשימה הבאה" });
  ok("★ המשימה הבאה מוצגת **לפני** השמירה", true);

  const beforeConfirm = await cdp.eval(`window.__data()`);
  eq("★ ושום דבר עוד לא נשמר", beforeConfirm.tasks.filter((t) => t.completedAt).length, 0);

  ok("כפתור 'אישור ושמירה' נלחץ", Boolean(await cdp.eval(`window.__clickText('button','אישור ושמירה')`)));
  await sleep(900);
  const afterComplete = await cdp.eval(`window.__data()`);
  eq("★ המשימה סומנה בוצע", afterComplete.tasks.filter((t) => t.completedAt).length, 1);
  eq("★★ והמשימה הבאה נוצרה — באותה כתיבה", afterComplete.tasks.length, beforeConfirm.tasks.length + 1);
  const nextTask = afterComplete.tasks.find((t) => !t.completedAt && t.type === "test");
  ok("★ למשימה הבאה יש sourceTaskId", Boolean(nextTask?.sourceTaskId));
  eq("★ והרכב עדיין שם (לא נדרס בכתיבה)", afterComplete.vehicles.length, 1);

  // ==========================================================================
  console.log("— מסך החירום");
  // ==========================================================================
  await cdp.eval(`location.hash = '#/emergency'; true`);
  await sleep(900);
  const emergencyHtml = await cdp.eval(`document.body.innerHTML`);
  ok("★ מספר הרישוי מוצג", emergencyHtml.includes("687-08-404"));
  ok("★ חיוג למשטרה כקישור tel:", emergencyHtml.includes('href="tel:100"'));
  ok("★ חיוג למד״א כקישור tel:", emergencyHtml.includes('href="tel:101"'));
  ok("★ אין דליפת כתובת Storage ל-DOM", !emergencyHtml.includes("firebasestorage.googleapis.com"));
  const cacheKeys = await cdp.eval(`Object.keys(localStorage).filter(k => k.startsWith('nrcar:emergency'))`);
  ok("★ מפתח המטמון כולל uid", cacheKeys.every((k) => k.startsWith("nrcar:emergency:local-owner:")), cacheKeys);

  // ==========================================================================
  console.log("— קונסול");
  // ==========================================================================
  const pageErrors = await cdp.eval(`window.__errors`);
  eq("★ אפס שגיאות JS בדף", pageErrors, []);
  const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  eq("★ אפס שגיאות קונסול", realErrors, []);

  ws.close();
} catch (err) {
  failed++;
  failures.push(String(err.message));
  console.error("  FAIL:", err.message);
} finally {
  browser?.kill();
  preview?.kill();
  if (profileDir) {
    try {
      rmSync(profileDir, { recursive: true, force: true });
    } catch {
      /* Windows נועל לפעמים את תיקיית הפרופיל — לא קריטי */
    }
  }
}

console.log("\n" + "=".repeat(60));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות ה-QA החי עברו`);
process.exit(0);
