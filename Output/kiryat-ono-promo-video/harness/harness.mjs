// תשתית ההקלטה: הקשר דפדפן, זריעת נתונים, סמן סינתטי, ועוזרי תנועה.
//
// עיקרון מנחה אחד: הפוטג' צריך להיראות כאילו אדם משתמש באפליקציה. לכן כל תנועה מואטת
// ומעוקלת, יש סמן שרואים, ולכל קליק יש הד ויזואלי. Playwright לבדו מפיק וידאו שבו
// דברים קורים לבד — וזה נראה שבור, לא מרשים.

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSeed, KEYS } from "./seed-data.mjs";

export const BASE_URL = process.env.PROMO_BASE_URL || "http://localhost:4173";

// שני דברים נלמדו כאן בניסוי, ולא מהתיעוד:
//
// 1. `recordVideo.size` **לא** מותח את ה-viewport. Playwright ממקם אותו בפינה וממלא
//    את השאר באפור. גודל ההקלטה חייב להיות זהה לגודל ה-viewport בפיקסלי מכשיר.
// 2. `deviceScaleFactor` ברמת ה-context **מתעלמים ממנו** ב-screencast — הפריים עדיין
//    נלכד ב-CSS px. מה שכן עובד הוא הדגל `--force-device-scale-factor` ברמת הדפדפן:
//    הוא מרנדר את כל העמוד ב-DPI גבוה, וההקלטה יוצאת ברזולוציה המלאה.
//
// לכן `dsf` הוא דגל שיגור, וכל preset דורש שיגור דפדפן משלו. זה מה שנותן טקסט חד
// ברזולוציית המסירה בלי שום הגדלה ב-ffmpeg.
export const PRESETS = {
  landscape: {
    viewport: { width: 1280, height: 720 },
    dsf: 1.5,
    recordSize: { width: 1920, height: 1080 },
  },
  vertical: {
    // מתחת ל-breakpoint של sm (640) — הלייאאוט המובייל האמיתי של האפליקציה.
    viewport: { width: 600, height: 1067 },
    dsf: 1.8,
    recordSize: { width: 1080, height: 1920 },
    hasTouch: true,
  },
};

// ---------- הסתרת מה שאסור שייכנס לפריים ----------
// באנר "מצב מקומי" (App.jsx:191) הוא הדבר היחיד שהכי מהר שורף את האמינות של סרטון
// מכירה. מסתירים אותו גם ב-CSS וגם ב-MutationObserver, כדי שריפקטור של מחלקות
// באפליקציה לא יחזיר אותו בשקט לתוך הצילום.
const DEMO_CHROME = `
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
  html { scrollbar-width: none !important; }
`;

// נקודת האיסוף היא קבוע מקושח באפליקציה (`src/constants.js:6`) ולא נתון — הזריעה
// לא יכולה לדרוס אותה. בלי הטיפול הזה הסרטון משדר **איפה ומתי ילדי המועדון הנקוב
// בשמו מתאספים**, בפילוח לפי שכבת גיל: מסך ההסעות מציג את הכתובת האמיתית לצד
// "שעת התייצבות". זה גם היה הופך את הצהרת "כל הנתונים בדויים" לאמירה לא נכונה.
// לכן מחליפים את המחרוזת בצומת הטקסט עצמו, בלי לגעת בקוד האפליקציה.
const TEXT_SWAPS = [
  ["אולם עלומים, הכפר 2, קריית אונו", "אולם המרכז, רחוב הדקל 5"],
];

function injectedChrome([css, swaps]) {
  const swapIn = (node) => {
    if (node.nodeType === 3) {
      let v = node.nodeValue;
      for (const [from, to] of swaps) if (v.includes(from)) v = v.split(from).join(to);
      if (v !== node.nodeValue) node.nodeValue = v;
      return;
    }
    if (node.nodeType !== 1) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const hits = [];
    while (walker.nextNode()) hits.push(walker.currentNode);
    hits.forEach(swapIn);
  };

  const isLocalBanner = (el) =>
    el.nodeType === 1 &&
    el.tagName === "P" &&
    (el.textContent || "").trim().startsWith("⚠ מצב מקומי");

  const sweep = (root) => {
    if (!root) return;
    if (root.nodeType === 3) { swapIn(root); return; }
    if (root.nodeType !== 1) return;
    if (isLocalBanner(root)) { root.remove(); return; }
    swapIn(root);
    root.querySelectorAll && root.querySelectorAll("p").forEach((p) => {
      if (isLocalBanner(p)) p.remove();
    });
  };

  // ה-init script רץ לפני שה-document קיים, ולכן כל נגיעה ב-documentElement כאן
  // חייבת להיות מוגנת: appendChild על מסמך שטרם נוצר זורק, ומפיל בשקט את כל
  // הסקריפט — כולל הסרת הבאנר. זה בדיוק מה שהחזיר את הבאנר לתוך הפריים.
  const start = () => {
    const style = document.createElement("style");
    // הסלקטור המדויק מ-App.jsx:191 כגיבוי, בנוסף להסרה ב-JS למטה.
    style.textContent =
      css + "\np.text-xs.text-amber-700.bg-amber-50{display:none !important}";
    document.documentElement.appendChild(style);

    sweep(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach(sweep);
        if (m.type === "characterData") swapIn(m.target);
      }
    }).observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
    });
  };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
}

// ---------- סמן סינתטי ----------
// נתלה על documentElement ולא על #root: כל רינדור מחדש של React היה מוחק אותו.
function injectedCursor() {
  const install = () => {
    const wrap = document.createElement("div");
    wrap.id = "__promo_cursor";
    wrap.style.cssText =
      "position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;" +
      "transform:translate3d(-100px,-100px,0);will-change:transform;";
    wrap.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 26 26" style="display:block;' +
      'filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))">' +
      '<path d="M3 2 L3 19 L8 14.5 L11.2 21.5 L14.4 20 L11.2 13.2 L18 13 Z" ' +
      'fill="#ffffff" stroke="#111827" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(wrap);

    const ripples = document.createElement("div");
    ripples.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden;";
    document.documentElement.appendChild(ripples);

    const style = document.createElement("style");
    style.textContent =
      "@keyframes __promo_ring{0%{transform:translate(-50%,-50%) scale(.25);opacity:.85}" +
      "100%{transform:translate(-50%,-50%) scale(1);opacity:0}}";
    document.documentElement.appendChild(style);

    let x = -100, y = -100;
    addEventListener("mousemove", (e) => {
      x = e.clientX; y = e.clientY;
      wrap.style.transform = `translate3d(${x}px,${y}px,0)`;
    }, true);

    addEventListener("mousedown", () => {
      wrap.style.transform = `translate3d(${x}px,${y}px,0) scale(.82)`;
      const r = document.createElement("div");
      r.style.cssText =
        `position:absolute;left:${x}px;top:${y}px;width:46px;height:46px;border-radius:50%;` +
        "border:2.5px solid #2355A5;background:rgba(35,85,165,.18);" +
        "animation:__promo_ring .42s ease-out forwards;";
      ripples.appendChild(r);
      setTimeout(() => r.remove(), 460);
    }, true);

    addEventListener("mouseup", () => {
      wrap.style.transform = `translate3d(${x}px,${y}px,0) scale(1)`;
    }, true);
  };

  if (document.documentElement) install();
  else document.addEventListener("DOMContentLoaded", install);
}

// ---------- הקשר דפדפן ----------
export async function launch(preset = "landscape") {
  const p = PRESETS[preset];
  return chromium.launch({
    args: [
      `--force-device-scale-factor=${p.dsf}`,
      "--hide-scrollbars",
      "--force-color-profile=srgb",
      "--disable-lcd-text",            // subpixel AA מייצר שוליים צבעוניים תחת H.264
      "--font-render-hinting=none",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  });
}

export async function newClip(browser, { preset = "landscape", outDir, name, seedOverride } = {}) {
  const p = PRESETS[preset];
  const videoDir = path.join(outDir, "_tmp", name);
  await mkdir(videoDir, { recursive: true });

  const context = await browser.newContext({
    viewport: p.viewport,
    isMobile: false,
    hasTouch: p.hasTouch ?? false,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    colorScheme: "light",
    acceptDownloads: true,
    recordVideo: { dir: videoDir, size: p.recordSize },
  });

  // דיאלוג חוסם משאיר קליפ מת: כמה מסלולי ייצוא קוראים ל-alert() בכשל, וה-recording
  // היה נתקע עד ה-timeout המלא.
  context.on("dialog", (d) => d.dismiss().catch(() => {}));

  const seed = seedOverride || buildSeed();
  await context.addInitScript(
    ([keys, payload]) => {
      try {
        localStorage.setItem(keys.club, JSON.stringify(payload.club));
        localStorage.setItem(keys.trainingPlans, JSON.stringify(payload.trainingPlans));
        localStorage.setItem(keys.gameNotes, JSON.stringify(payload.gameNotes));
        localStorage.setItem(keys.pendingImport, JSON.stringify(payload.pendingImport));
        localStorage.setItem(keys.videos, JSON.stringify(payload.videos));
      } catch { /* quota */ }
    },
    [KEYS, seed]
  );
  await context.addInitScript(injectedChrome, [DEMO_CHROME, TEXT_SWAPS]);
  await context.addInitScript(injectedCursor);

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  return { context, page, seed, videoDir };
}

// ---------- עוזרי תנועה ----------
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// מצב הסמן נשמר בצד Node, כי page.mouse לא חושף אותו.
const pos = new WeakMap();

export async function glide(page, target, { steps = 38, ms = 620, hold = 200 } = {}) {
  const loc = typeof target === "string" ? page.locator(target) : target;
  await loc.first().waitFor({ state: "visible" });
  await loc.first().scrollIntoViewIfNeeded();
  await wait(120);
  const box = await loc.first().boundingBox();
  if (!box) throw new Error("glide: no bounding box");
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const from = pos.get(page) || { x: to.x, y: to.y + 220 };

  const dt = ms / steps;
  for (let i = 1; i <= steps; i++) {
    const t = easeInOutCubic(i / steps);
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await wait(dt);
  }
  pos.set(page, to);
  await wait(hold); // שהייה על ה-hover, כדי שהעין תספיק לקלוט
  return loc.first();
}

export async function click(page, target, opts = {}) {
  const loc = await glide(page, target, opts);
  await page.mouse.down();
  await wait(80);
  await page.mouse.up();
  await wait(opts.after ?? 450);
  return loc;
}

export async function type(page, target, text, { delay = 55 } = {}) {
  const loc = await glide(page, target, { hold: 120 });
  await page.mouse.down();
  await wait(60);
  await page.mouse.up();
  await wait(200);
  await loc.pressSequentially(text, { delay });
  await wait(300);
  return loc;
}

export async function smoothScroll(page, dy, ms = 900) {
  const steps = 50;
  const dt = ms / steps;
  let prev = 0;
  for (let i = 1; i <= steps; i++) {
    const t = easeInOutCubic(i / steps);
    const cur = dy * t;
    await page.mouse.wheel(0, cur - prev);
    prev = cur;
    await wait(dt);
  }
  await wait(200);
}

// זום נעשה בדפדפן ולא ב-ffmpeg: ברזולוציה מקורית, בלי דגימה מחדש ובלי ריצוד.
export async function zoomTo(page, target, scale = 1.35, ms = 800) {
  const loc = typeof target === "string" ? page.locator(target) : target;
  const box = target ? await loc.first().boundingBox() : null;
  await page.evaluate(
    ([s, b, d]) => {
      const el = document.documentElement;
      const origin = b
        ? `${b.x + b.width / 2}px ${b.y + b.height / 2 + window.scrollY}px`
        : "50% 50%";
      el.style.transition = `transform ${d}ms cubic-bezier(.4,0,.2,1)`;
      el.style.transformOrigin = origin;
      el.style.transform = `scale(${s})`;
    },
    [scale, box, ms]
  );
  await wait(ms + 120);
}

export async function zoomReset(page, ms = 700) {
  await page.evaluate((d) => {
    const el = document.documentElement;
    el.style.transition = `transform ${d}ms cubic-bezier(.4,0,.2,1)`;
    el.style.transform = "scale(1)";
  }, ms);
  await wait(ms + 120);
}

export async function settle(page, ms = 300) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  await wait(ms);
}

// ---------- יומן ביטים ----------
// כל טיימקוד בהרכבה ובתסריט הקריינות נגזר מהיומן הזה, ולא ממדידה ידנית.
export function cueLog() {
  const t0 = Date.now();
  const cues = [];
  return {
    mark(label) {
      cues.push({ label, t: +((Date.now() - t0) / 1000).toFixed(2) });
    },
    async save(file) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(cues, null, 2), "utf8");
      return cues;
    },
    cues,
  };
}

// בדיקת שפיות לפני כל צילום: אם האפליקציה עלתה במצב ענן, נקבל מסך התחברות
// במקום דמו — ועדיף לדעת את זה מיד ולא אחרי חמש דקות של הקלטה.
export async function assertLocalMode(page) {
  const seeded = await page.evaluate((k) => !!localStorage.getItem(k), KEYS.club);
  if (!seeded) throw new Error("הזריעה נכשלה — האפליקציה כנראה רצה במצב ענן");
  const login = await page.getByRole("button", { name: /התחבר/ }).count();
  if (login > 0) throw new Error("מסך התחברות על המסך — לא מצב מקומי");
}
