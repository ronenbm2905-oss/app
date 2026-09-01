// הסצנות: זרימות משתמש אמיתיות באפליקציה, בקצב צפייה.
//
// כל סצנה עצמאית ומחזירה יומן ביטים. ההרכבה והתסריט קוראים את היומן — אף טיימקוד
// בפרויקט הזה לא נמדד ידנית.
//
// ניווט: לאפליקציה אין סרגל טאבים קבוע. מסך הבית הוא רשת אריחים, וחוזרים אליו
// בכפתור "חזרה לבית". כל סצנה מתחילה ומסיימת בבית.

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { click, glide, type, smoothScroll, zoomTo, zoomReset, settle, wait } from "./harness.mjs";

const DOWNLOADS = path.resolve("work/downloads");

async function goHome(page) {
  const back = page.getByRole("button", { name: /חזרה לבית/ });
  if (await back.count()) {
    await click(page, back.first(), { after: 700 });
  }
  await settle(page, 300);
}

async function openTile(page, label) {
  await goHome(page);
  const tile = page.getByRole("button").filter({ hasText: label }).first();
  await click(page, tile, { after: 900 });
  await settle(page, 400);
}

// לוכד הורדה ושומר אותה. בהדלס אין מדף הורדות ואין navigator.share — התוצר
// היה נעלם מהמסך. שומרים אותו כדי להציג אותו אחר כך כהוכחה.
async function grabDownload(page, action, name) {
  await mkdir(DOWNLOADS, { recursive: true });
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 25000 }).catch(() => null),
    action(),
  ]);
  if (!dl) return null;
  const file = path.join(DOWNLOADS, name);
  await dl.saveAs(file);
  return file;
}

// ---------- 01 — פתיחה ----------
export async function sceneHome(page, cue) {
  cue.mark("home:start");
  await settle(page, 900);
  await wait(1400); // שהייה פותחת — נותנת לעין לקלוט את המסך ובולעת סטיית תזמון
  cue.mark("home:tiles");
  await smoothScroll(page, 260, 900);
  await wait(700);
  await smoothScroll(page, -260, 700);
  cue.mark("home:end");
}

// ---------- 02 — לוח שבועי + שיתוף ----------
export async function sceneWeekly(page, cue, ctx = {}) {
  await openTile(page, "לוח שבועי");
  cue.mark("weekly:open");
  await wait(900);

  // הלוח עצמו יושב מתחת לקפל — הפקדים תופסים את המסך הראשון.
  await smoothScroll(page, 620, 1100);
  cue.mark("weekly:board");
  await wait(1600);

  // סינון לפי מאמן — הלוח מצטמצם לשורות של מאמן אחד, ואז חוזר.
  await smoothScroll(page, -420, 800);
  const coachChip = page.getByRole("button", { name: "רן אלמוג" }).first();
  if (await coachChip.count()) {
    await click(page, coachChip, { after: 800 });
    cue.mark("weekly:filter-coach");
    await smoothScroll(page, 500, 800);
    await wait(1500);
    await smoothScroll(page, -500, 700);
    const all = page.getByRole("button", { name: "כולם" }).first();
    if (await all.count()) await click(page, all, { after: 700 });
  }
  cue.mark("weekly:filter-clear");

  // ניווט שבועות — קדימה ואחורה, כדי שרואים שזה לוח חי ולא צילום סטטי.
  const next = page.getByRole("button", { name: "שבוע הבא" }).first();
  if (await next.count()) {
    await click(page, next, { after: 900 });
    cue.mark("weekly:next-week");
    await wait(900);
    const prev = page.getByRole("button", { name: "שבוע קודם" }).first();
    if (await prev.count()) await click(page, prev, { after: 900 });
  }
  cue.mark("weekly:back-to-week");

  // פרסום הלו"ז לשבוע — שינוי מצב קטן ומספק. שים לב לגרשיים (U+05F4) בתווית.
  const publish = page.getByRole("button", { name: /פרסם לו/ }).first();
  if (await publish.count()) {
    await click(page, publish, { after: 1100 });
    cue.mark("weekly:published");
    await wait(900);
  }

  // אזהרת אי-זמינות המאמנים — הביט של "המערכת מסמנת לך לפני שהילדים מגיעים".
  const warn = page.locator("text=לא זמינים השבוע").first();
  if (await warn.count()) {
    await zoomTo(page, warn, 1.3, 700);
    cue.mark("weekly:absence-warning");
    await wait(1600);
    await zoomReset(page, 600);
  }

  // השיתוף — הביט המרכזי של הסרטון כולו.
  const shareBtn = page.getByRole("button", { name: /שיתוף \/ שמירת תמונה/ }).first();
  await glide(page, shareBtn, { hold: 400 });
  cue.mark("weekly:share-hover");
  const file = await grabDownload(page, async () => {
    await page.mouse.down(); await wait(80); await page.mouse.up();
  }, "board.png");
  cue.mark("weekly:share-click");
  await wait(2200); // מצב "מכין תמונה…"
  cue.mark("weekly:share-done");
  ctx.boardImage = file;

  await goHome(page);
  cue.mark("weekly:end");
}

// ---------- 03 — משחקים, ייבוא מהאיגוד, הסעות ----------
export async function sceneGames(page, cue, ctx = {}) {
  // הבאנר של הייבוא הממתין יושב על מסך הבית — מתחילים ממנו.
  await goHome(page);
  const review = page.getByRole("button", { name: /סקור ואשר/ }).first();
  if (await review.count()) {
    await zoomTo(page, review, 1.25, 650);
    cue.mark("games:pending-banner");
    await wait(1200);
    await zoomReset(page, 550);
    await click(page, review, { after: 1100 });
    cue.mark("games:review-dialog");
    await wait(2400); // שהייה על "מה ישתנה אם תאשר"
    const approve = page.getByRole("button", { name: /אשר ועדכן/ }).first();
    if (await approve.count()) {
      await click(page, approve, { after: 1400 });
      cue.mark("games:approved");
      await wait(1200);
    } else {
      const close = page.getByRole("button", { name: /ביטול|סגור/ }).first();
      if (await close.count()) await click(page, close, { after: 700 });
    }
  }

  await openTile(page, "משחקים");
  cue.mark("games:open");
  await wait(1200);
  await smoothScroll(page, 520, 1000);
  cue.mark("games:list");
  await wait(1800);

  // ההסעות — נקודת איסוף ושעת יציאה מומלצת, מחושבות מהמשחק.
  const transport = page.locator("text=הסעות למשחקי חוץ").first();
  if (await transport.count()) {
    await transport.scrollIntoViewIfNeeded();
    await settle(page, 500);
    cue.mark("games:transport");
    await wait(1800);
    const exportImg = page.getByRole("button", { name: /שיתוף \/ הורדת תמונה/ }).first();
    if (await exportImg.count()) {
      await glide(page, exportImg, { hold: 350 });
      const f = await grabDownload(page, async () => {
        await page.mouse.down(); await wait(80); await page.mouse.up();
      }, "transport.png");
      ctx.transportImage = f;
      cue.mark("games:transport-export");
      await wait(2000);
    }
  }
  await goHome(page);
  cue.mark("games:end");
}

// ---------- 04 — תצוגת מאמן, תוכנית אימון, סקיצת מגרש ----------
export async function sceneCoach(page, cue) {
  await openTile(page, "תצוגת מאמן");
  cue.mark("coach:open");
  await wait(1000);

  // בחירת מאמן — משם והלאה המסך הוא השבוע שלו בלבד.
  const select = page.locator("select").first();
  if (await select.count()) {
    await glide(page, select, { hold: 350 });
    await select.selectOption({ label: "רן אלמוג" }).catch(async () => {
      const opts = await select.locator("option").allTextContents();
      const hit = opts.find((o) => o.includes("רן"));
      if (hit) await select.selectOption({ label: hit });
    });
    await settle(page, 700);
    cue.mark("coach:selected");
    await wait(1400);
  }

  await smoothScroll(page, 420, 900);
  cue.mark("coach:week");
  await wait(1500);

  // תוכנית אימון דיגיטלית — נכתבת על המסך, לא מוצגת מוכנה.
  const planBtn = page.getByRole("button", { name: /מלא מערך אימון/ }).first();
  if (await planBtn.count()) {
    await click(page, planBtn, { after: 1100 });
    cue.mark("coach:plan-open");
    await wait(1200);

    // שדות הטופס נכתבים בלי type מפורש, ולכן הסלקטור input[type="text"] לא תופס
    // אותם בכלל — CSS בודק את התכונה, לא את ברירת המחדל.
    const drill = page.locator('input:not([type="date"])').first();
    if (await drill.count()) {
      await type(page, drill, "כדרור יד חלשה", { delay: 70 });
      cue.mark("coach:plan-typing");
      await wait(700);
      const detail = page.locator('input:not([type="date"])').nth(1);
      if (await detail.count()) {
        await type(page, detail, "לאורך המגרש, החלפת יד בכל קונוס", { delay: 45 });
        await wait(600);
      }
    }

    // סקיצת המגרש — הדבר שהכי קשה להסביר במילים והכי קל להראות.
    const sketch = page.getByRole("button", { name: /^שרטוט, שורה 1/ }).first();
    if (await sketch.count()) {
      await click(page, sketch, { after: 1200 });
      cue.mark("coach:sketch-open");
      await wait(1000);
      await drawOnCourt(page, cue);
    }
  }

  await goHome(page);
  cue.mark("coach:end");
}

// ציור על הסקיצה דרך אירועי עכבר אמיתיים — כך משטח הציור מגיב בדיוק כמו למשתמש.
// בוחרים כלי מהסרגל לפני כל קבוצת סימונים: זה גם מה שמשתמש אמיתי עושה, וגם מה
// שמייצר סקיצה שנראית כמו מהלך ולא כמו נקודה בודדת.
async function drawOnCourt(page, cue) {
  const box = await page.evaluate(() => {
    let best = null, area = 0;
    for (const el of document.querySelectorAll("svg, canvas")) {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > area) { area = r.width * r.height; best = r; }
    }
    return best && area > 40000
      ? { x: best.x, y: best.y, width: best.width, height: best.height } : null;
  });
  if (!box) return;
  const at = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

  const pickTool = async (name) => {
    const b = page.getByRole("button", { name, exact: true }).first();
    if (await b.count()) {
      await b.click();
      await wait(420);
      return true;
    }
    return false;
  };

  const tap = async (fx, fy) => {
    const p = at(fx, fy);
    await page.mouse.move(p.x, p.y, { steps: 16 });
    await wait(260);
    await page.mouse.down(); await wait(90); await page.mouse.up();
    await wait(520);
  };

  const drag = async (from, to, steps = 26) => {
    const a = at(...from), b2 = at(...to);
    await page.mouse.move(a.x, a.y, { steps: 12 });
    await wait(240);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(a.x + (b2.x - a.x) * (i / steps), a.y + (b2.y - a.y) * (i / steps));
      await wait(30);
    }
    await page.mouse.up();
    await wait(560);
  };

  await pickTool("שחקן");
  await tap(0.3, 0.62);
  await tap(0.5, 0.72);
  await tap(0.7, 0.62);
  cue.mark("coach:sketch-players");

  if (await pickTool("קונוס")) {
    await tap(0.5, 0.45);
    cue.mark("coach:sketch-cone");
  }

  if (await pickTool("מסירה")) {
    await drag([0.3, 0.62], [0.5, 0.72]);
    await drag([0.5, 0.72], [0.7, 0.62]);
    cue.mark("coach:sketch-passes");
  }

  if (await pickTool("תנועה")) {
    await drag([0.7, 0.62], [0.62, 0.34]);
    cue.mark("coach:sketch-cut");
  }

  await wait(1500);
}

// ---------- 05 — ניהול: שחקנים, זמינות, דו"ח שעות ----------
export async function sceneAdmin(page, cue) {
  await openTile(page, "שחקנים");
  cue.mark("admin:players");
  await wait(1400);
  await smoothScroll(page, 450, 950);
  await wait(1600);
  await smoothScroll(page, -450, 700);

  await openTile(page, "זמינות מאמנים");
  cue.mark("admin:availability");
  await wait(1600);
  await smoothScroll(page, 320, 800);
  await wait(1400);
  await smoothScroll(page, -320, 600);

  await openTile(page, 'דו"ח שעות');
  cue.mark("admin:report");
  await wait(1200);
  await smoothScroll(page, 380, 900);
  cue.mark("admin:report-table");
  await wait(2200);

  await goHome(page);
  cue.mark("admin:end");
}

export const SCENES = {
  "01-home": sceneHome,
  "02-weekly": sceneWeekly,
  "03-games": sceneGames,
  "04-coach": sceneCoach,
  "05-admin": sceneAdmin,
};
