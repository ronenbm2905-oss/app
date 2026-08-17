// ============================================================================
// team-render.mjs — QA אמיתי למסכי האדמין השני (17.8.2026): מרנדר את
// **TeamCard** ואת **NoAccessScreen** דרך react-dom/server ובודק שמה שמופיע
// על המסך הוא מה שהתוכנית אומרת.
//
//   npm run team:check
//
// למה בנפרד: אלה שני המסכים שהבאג נגע בהם ישירות. מנהלת הכספים קיבלה **מסך
// הקמה ראשונית** במקום להיכנס לצי, ומסך ניהול המנהלים לא היה קיים בכלל.
// `npm run build` עובר גם כשמסך מרנדר מפתח תרגום חסר כטקסט, או כשכפתור
// שאמור להיות חסום פעיל — ולכן צריך רינדור אמיתי.
//
// המלכודות שנבדקות כאן:
//   • כפתור ההסרה של האדמין **האחרון** חייב להיות disabled — ארגון בלי אדמין
//     הוא ארגון אבוד;
//   • מסך "אין הרשאה" חייב להציג את הכתובת שאיתה נכנס המשתמש, כדי שהוא יוכל
//     להקריא אותה למנהל המערכת;
//   • ובשום מצב לא להציע להקים ארגון חדש — זה הבאג;
//   • אזהרת "אתה עצמך לא ברשימה" חייבת להופיע בזמן ההגירה, אחרת האדמין רואה
//     רשימה ריקה ומניח שהמסך שבור;
//   • אפס מפתחות i18n שהודפסו כמפתח (fail-visible), בשתי השפות.
//
// לא מדפיס שמות אמיתיים — הפיקסטורה בדויה.
// ============================================================================

import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(ROOT, "node_modules", ".fleet-team-render");
mkdirSync(tmp, { recursive: true });
const entry = join(tmp, "entry.jsx");
const outfile = join(tmp, "out.mjs");
const p = (rel) => JSON.stringify(join(ROOT, rel).replace(/\\/g, "/"));

writeFileSync(
  entry,
  `
import { renderToStaticMarkup } from "react-dom/server";
import TeamCard from ${p("src/components/TeamCard.jsx")};
import NoAccessScreen from ${p("src/components/NoAccessScreen.jsx")};
import SettingsScreen from ${p("src/components/SettingsScreen.jsx")};
import { I18nProvider } from ${p("src/hooks/useI18n.jsx")};

const noopTeam = { add: async () => ({ ok: true }), remove: async () => ({ ok: true }) };

const wrap = (lang, node) =>
  renderToStaticMarkup(<I18nProvider initialLang={lang}>{node}</I18nProvider>);

export const renderTeam = (data, user, lang) =>
  wrap(lang, <TeamCard data={data} user={user} team={noopTeam} />);

export const renderNoAccess = (user, opts, lang) =>
  wrap(lang, <NoAccessScreen user={user} onRetry={() => {}} onSignOut={() => {}} {...opts} />);

// הגדרות **עם** team — כדי לאמת שהכרטיס באמת מחווט למסך ולא רק קיים כקובץ.
export const renderSettingsWithTeam = (data, user, lang) =>
  wrap(
    lang,
    <SettingsScreen
      data={data}
      orgId="org1"
      actions={{ setOrg: () => {}, setSettings: () => {} }}
      onResetLocal={() => {}}
      user={user}
      team={noopTeam}
    />
  );

// והגדרות **בלי** team — המצב שבו אין ענן; הכרטיס לא אמור להתרסק.
export const renderSettingsNoTeam = (data, lang) =>
  wrap(
    lang,
    <SettingsScreen
      data={data}
      orgId="org1"
      actions={{ setOrg: () => {}, setSettings: () => {} }}
      onResetLocal={() => {}}
    />
  );
`
);

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  logLevel: "error",
  mainFields: ["module", "main"],
  conditions: ["import", "module", "default"],
  define: { "import.meta.env": "undefined" },
  external: ["react", "react-dom", "react-dom/server"],
  plugins: [
    {
      name: "stub-firebase",
      setup(b) {
        b.onResolve({ filter: /(^|[\\/])firebase\.js$/ }, () => ({ path: "stub-firebase", namespace: "stubfb" }));
        b.onLoad({ filter: /.*/, namespace: "stubfb" }, () => ({
          contents:
            "export const isFirebaseConfigured=false;export const db=null;export const auth=null;" +
            "export const storage=null;export const googleProvider=null;export const CONFIGURED_ORG_ID=null;",
          loader: "js",
        }));
      },
    },
  ],
});

const R = await import(pathToFileURL(outfile).href);
const load = async (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const { EMPTY } = await load("src/constants.js");
const dictMod = await load("src/i18n.js");
const dict = dictMod.default;

let pass = 0;
let failed = 0;
const failures = [];
const ok = (name, cond) => {
  if (cond) pass++;
  else {
    failed++;
    failures.push(name);
    console.error("  FAIL:", name);
  }
};
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
const has = (html, s) => html.includes(esc(s));
const section = (title) => console.log(`\n— ${title}`);

const RONEN = { uid: "u1", email: "owner@example.test", emailVerified: true };
const HILDA_EMAIL = "second.admin@gmail.test";
const mk = (adminEmails, over = {}) => ({
  ...JSON.parse(JSON.stringify(EMPTY)),
  org: { ...EMPTY.org, id: "org1", name: "צי בדיקה", adminEmails, ...over },
  settings: { ...EMPTY.settings, onboarded: true },
});

// -- אפס מפתחות i18n שהודפסו כמפתח -----------------------------------------
// t() מחזיר מפתח חסר כפי שהוא (fail-visible), ולכן חיפוש "team." / "noAccess."
// בפלט תופס בדיוק את מה ש-build לא תופס.
const noRawKeys = (html, label) => {
  const raw = [...html.matchAll(/\b(team|noAccess|role|join)\.[a-zA-Z.]+/g)].map((m) => m[0]);
  ok(`${label}: אפס מפתחות i18n גולמיים${raw.length ? " — " + raw.slice(0, 3).join(", ") : ""}`, raw.length === 0);
};

// ============================================================================
section("1. TeamCard — שני מנהלים: אפשר להסיר, והמסך אומר מי אתה");
// ============================================================================
for (const lang of ["he", "en"]) {
  const html = R.renderTeam(mk([RONEN.email, HILDA_EMAIL]), RONEN, lang);
  ok(`(${lang}) כותרת הכרטיס`, has(html, dict[lang]["team.title"]));
  ok(`(${lang}) שדה הוספת מייל`, has(html, dict[lang]["team.emailLabel"]));
  ok(`(${lang}) כפתור ההוספה`, has(html, dict[lang]["team.add"]));
  ok(`(${lang}) שתי הכתובות מוצגות`, has(html, RONEN.email) && has(html, HILDA_EMAIL));
  ok(`(${lang}) המונה מציג 2`, has(html, dict[lang]["team.current"].replace("{n}", "2")));
  ok(`(${lang}) מסומן מי הכתובת שלי`, has(html, dict[lang]["team.you"]));
  ok(`(${lang}) הערת "אין שליחת מייל" מוצגת`, has(html, dict[lang]["team.linkNote"]));
  // שני מנהלים ⇒ **אין** כפתור נעול, ואין אזהרת "אתה לא ברשימה".
  ok(`(${lang}) אין אזהרת selfMissing כשאני ברשימה`, !has(html, dict[lang]["team.selfMissing"]));
  ok(`(${lang}) כפתורי ההסרה אינם disabled`, !/aria-label="[^"]*"[^>]*disabled/.test(html));
  noRawKeys(html, `TeamCard/${lang}`);
}

// ============================================================================
section("2. ⚠️ מנהל אחד — כפתור ההסרה **חייב** להיות חסום");
// ============================================================================
// ארגון בלי אף מנהל אינו ניתן לשחזור מתוך האפליקציה. הכלל נאכף ב-rules,
// אבל אם המסך מציג כפתור פעיל המשתמש ילחץ ויקבל שגיאה בלי להבין למה.
for (const lang of ["he", "en"]) {
  const html = R.renderTeam(mk([RONEN.email]), RONEN, lang);
  ok(`(${lang}) הכתובת היחידה מוצגת`, has(html, RONEN.email));
  ok(`(${lang}) המונה מציג 1`, has(html, dict[lang]["team.current"].replace("{n}", "1")));
  ok(`(${lang}) יש כפתור disabled`, /disabled/.test(html));
  ok(
    `(${lang}) וה-title מסביר שזה המנהל האחרון`,
    has(html, dict[lang]["team.err.lastAdmin"])
  );
  noRawKeys(html, `TeamCard-last/${lang}`);
}

// ============================================================================
section("3. ⚠️ מצב ההגירה — הרשימה ריקה, הגישה דרך legacy");
// ============================================================================
// זה המצב **מיד אחרי ה-deploy**: מסמך הארגון בענן עדיין בלי adminEmails.
// בלי האזהרה, האדמין רואה רשימה ריקה, מניח שהמסך שבור, ולא מוסיף את עצמו.
for (const lang of ["he", "en"]) {
  const html = R.renderTeam(mk([], { members: { u1: "admin" } }), RONEN, lang);
  ok(`(${lang}) אזהרת "אתה עצמך לא ברשימה" מוצגת`, has(html, dict[lang]["team.selfMissing"]));
  ok(`(${lang}) עם קישור "הוסיפו אותי"`, has(html, dict[lang]["team.addSelf"]));
  ok(`(${lang}) והרשימה מוצגת כריקה`, has(html, dict[lang]["team.empty"]));
  ok(`(${lang}) המונה מציג 0`, has(html, dict[lang]["team.current"].replace("{n}", "0")));
  noRawKeys(html, `TeamCard-empty/${lang}`);
}

// ============================================================================
section("4. ⚠️ NoAccessScreen — **הבאג עצמו**: לא מציעים להקים ארגון");
// ============================================================================
for (const lang of ["he", "en"]) {
  const user = { uid: "u9", email: "outsider@gmail.test", emailVerified: true };
  const html = R.renderNoAccess(user, {}, lang);
  ok(`(${lang}) כותרת "אין הרשאה"`, has(html, dict[lang]["noAccess.title"]));
  ok(`(${lang}) ההסבר "פנה למנהל המערכת"`, has(html, dict[lang]["noAccess.body"]));
  // ⬅ הכתובת חייבת להופיע: המשתמש צריך להקריא אותה למנהל, וטעות הקלדה כאן
  //   היא הדבר שהכי קל לפספס.
  ok(`(${lang}) הכתובת שאיתה נכנס מוצגת`, has(html, user.email));
  ok(`(${lang}) כפתור "בדוק שוב"`, has(html, dict[lang]["noAccess.recheck"]));
  ok(`(${lang}) כפתור יציאה`, has(html, dict[lang]["nav.signOut"]));
  // ⬅ **הבדיקה המרכזית**: אין שום רמז להקמת ארגון חדש במסך הזה.
  ok(
    `(${lang}) אין הצעה להקים ארגון — זה הבאג ש-17.8 תיקן`,
    !has(html, dict[lang]["onb.welcomeTitle"]) &&
      !has(html, dict[lang]["onb.orgName"]) &&
      !has(html, dict[lang]["onb.title"])
  );
  ok(`(${lang}) ואין אזהרת מייל לא מאומת כשהוא מאומת`, !has(html, dict[lang]["noAccess.unverified"]));
  noRawKeys(html, `NoAccess/${lang}`);
}

// ============================================================================
section("5. NoAccessScreen — מייל לא מאומת, ומצב שגיאה");
// ============================================================================
for (const lang of ["he", "en"]) {
  const unv = { uid: "u8", email: "unverified@gmail.test", emailVerified: false };
  const html = R.renderNoAccess(unv, { emailVerified: false }, lang);
  ok(`(${lang}) הסבר "המייל אינו מאומת" מוצג`, has(html, dict[lang]["noAccess.unverified"]));
  ok(`(${lang}) והכתובת עדיין מוצגת`, has(html, unv.email));

  const err = R.renderNoAccess(unv, { isError: true }, lang);
  ok(`(${lang}) מצב שגיאה מציג כותרת אחרת`, has(err, dict[lang]["noAccess.errorTitle"]));
  ok(`(${lang}) ולא את "אין הרשאה"`, !has(err, dict[lang]["noAccess.title"]));
  noRawKeys(err, `NoAccess-err/${lang}`);
}

// ============================================================================
section("6. הכרטיס מחווט למסך ההגדרות (ולא רק קיים כקובץ)");
// ============================================================================
{
  const data = mk([RONEN.email, HILDA_EMAIL]);
  const withTeam = R.renderSettingsWithTeam(data, RONEN, "he");
  ok("הגדרות עם team מציגות את כרטיס ניהול המנהלים", has(withTeam, dict.he["team.title"]));
  ok("ואת שתי הכתובות", has(withTeam, RONEN.email) && has(withTeam, HILDA_EMAIL));
  ok("ולא שברו את שאר המסך", has(withTeam, dict.he["settings.leaseCompanies"]));
  noRawKeys(withTeam, "Settings+team");

  // בלי team (מצב שבו אין ענן) — הכרטיס נעלם, והמסך לא מתרסק.
  const noTeam = R.renderSettingsNoTeam(data, "he");
  ok("הגדרות בלי team אינן מציגות את הכרטיס", !has(noTeam, dict.he["team.emailLabel"]));
  ok("ושאר המסך עדיין שם", has(noTeam, dict.he["settings.leaseCompanies"]));
}

// ============================================================================
console.log("\n" + "=".repeat(50));
if (failed) {
  console.error(`נכשלו ${failed} בדיקות מתוך ${pass + failed}`);
  for (const f of failures) console.error("  ✗", f);
  process.exit(1);
}
console.log(`✓ כל ${pass} בדיקות הרינדור של מסכי האדמין השני עברו`);
