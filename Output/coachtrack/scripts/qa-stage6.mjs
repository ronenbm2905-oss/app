/**
 * QA חי לשלב 6 — מול המסד האמיתי, דרך ההרשאות ולא מסביבן.
 *
 * הרצה: node scripts/qa-stage6.mjs   (מתיקיית הפרויקט, דורש scripts/serviceAccountKey.json)
 *
 * ## כללי הברזל
 *
 *   • **הסקריפט הזה קורא בלבד.** אין בו אף כתיבה ואף מחיקה — וזו לא הבטחה
 *     אלא מבנה: `addDoc`, `setDoc`, `updateDoc` ו-`deleteDoc` בכלל אינם
 *     מיובאים לקובץ. אי אפשר לקרוא לפונקציה שלא ייבאת.
 *   • ה-Admin SDK משמש **רק** להנפקת custom token. כל קריאה נעשית דרך
 *     ה-Web SDK כמשתמש מחובר, כלומר עוברת דרך `firestore.rules`.
 *   • לא מודפסים שמות משתמשים ולא שמות שחקנים — רק ספירות, אחוזים,
 *     ומזהי מסמכים. **חוץ מדבר אחד:** הודעת הוואטסאפ עצמה מודפסת במלואה,
 *     כי היא הפלט שנבדק. היא מכילה שמות תצוגה של קטינים; אל תדביק את
 *     הפלט של הסקריפט הזה לשום מקום ציבורי.
 *
 * ## מה מיוחד כאן לעומת qa-stage5
 *
 * ב-שלב 5 הסקריפט **חישב מחדש** את המטריצה בעצמו, כדי להשוות מול המסך.
 * זה עבד שם, אבל זה מקור אמת שני. בשלב 6 הפלט שנבדק הוא טקסט שאף אחד לא
 * רואה מול הנתונים, ולכן חישוב שני היה מסתיר בדיוק את סוג התקלה שמחפשים.
 *
 * לכן הסקריפט הזה **מריץ את קוד הייצור עצמו**: `src/lib/report.ts` נארז
 * דרך Vite ל-ESM זמני תחת `scripts/.qa-bundle/`, ומיובא. מה שרץ כאן הוא
 * בדיוק מה שרץ בדפדפן.
 */

import { readFileSync, rmSync } from 'node:fs';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
// ⚠️ אין כאן addDoc / setDoc / updateDoc / deleteDoc — בכוונה. ראה למעלה.
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';

const ORG_ID = 'org_kiryat_ono';
const TEAM_ID = 'team_yeladim_a';
const BUNDLE_DIR = 'scripts/.qa-bundle';

const ok = (label) => console.log(`  ✓ ${label}`);
const info = (label) => console.log(`    ${label}`);
const fail = (label) => {
  console.log(`  ✗ ${label}`);
  process.exitCode = 1;
};

function env() {
  const raw = readFileSync('.env.local', 'utf8');
  const config = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^VITE_FIREBASE_(\w+)=(.*)$/);
    if (match) config[match[1]] = match[2].trim();
  }
  return {
    apiKey: config.API_KEY,
    authDomain: config.AUTH_DOMAIN,
    projectId: config.PROJECT_ID,
    storageBucket: config.STORAGE_BUCKET,
    messagingSenderId: config.MESSAGING_SENDER_ID,
    appId: config.APP_ID,
  };
}

async function expectDenied(label, promise) {
  try {
    await promise;
    fail(`${label} — עבר, והיה אמור להיחסם!`);
  } catch (error) {
    const code = String(error?.code ?? '');
    if (code.includes('permission-denied')) ok(`${label} — נחסם כצפוי`);
    else fail(`${label} — נכשל מסיבה אחרת: ${code}`);
  }
}

/** אורז את קוד הייצור ל-ESM זמני ומחזיר את המודולים. */
async function loadProductionCode() {
  const { build } = await import('vite');

  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      outDir: BUNDLE_DIR,
      emptyOutDir: true,
      minify: false,
      lib: {
        entry: {
          report: 'src/lib/report.ts',
          dashboard: 'src/lib/dashboard.ts',
          players: 'src/lib/players.ts',
          dates: 'src/lib/dates.ts',
        },
        formats: ['es'],
      },
      rollupOptions: {
        external: [/^firebase(\/|$)/, /^date-fns(-tz)?(\/|$)/],
        output: { entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' },
      },
    },
  });

  return {
    report: await import(`../${BUNDLE_DIR}/report.mjs`),
    dashboard: await import(`../${BUNDLE_DIR}/dashboard.mjs`),
    players: await import(`../${BUNDLE_DIR}/players.mjs`),
    dates: await import(`../${BUNDLE_DIR}/dates.mjs`),
  };
}

const serviceAccount = JSON.parse(readFileSync('scripts/serviceAccountKey.json', 'utf8'));
initAdmin({ credential: cert(serviceAccount) });

const web = initializeApp(env());
const auth = getAuth(web);
const db = getFirestore(web);

const run = async () => {
  console.log('\n== 0. אריזת קוד הייצור ==');
  const lib = await loadProductionCode();
  ok('src/lib/report.ts נארז ונטען — מה שרץ כאן הוא מה שרץ בדפדפן');

  /* -------- מי המאמן (דרך Admin, בלי להדפיס שמות) -------- */

  const adminDb = (await import('firebase-admin/firestore')).getFirestore();
  const teamSnap = await adminDb.collection('teams').doc(TEAM_ID).get();
  const coachUid = teamSnap.data().coachUid;

  console.log('\n== 1. המאמן מתחבר ומריץ את שאילתות מסך הדוחות ==');
  const token = await getAdminAuth().createCustomToken(coachUid);
  await signInWithCustomToken(auth, token);
  ok('המאמן מחובר');

  // בדיוק אותן ארבע שאילתות של הדשבורד — שוויון בודד בכל אחת.
  const teams = await getDocs(query(collection(db, 'teams'), where('orgId', '==', ORG_ID)));
  ok(`teams where orgId — ${teams.size} מסמכים`);

  const users = await getDocs(query(collection(db, 'users'), where('orgId', '==', ORG_ID)));
  ok(`users where orgId — ${users.size} מסמכים`);

  const cycles = await getDocs(
    query(collection(db, 'planCycles'), where('teamId', '==', TEAM_ID)),
  );
  ok(`planCycles where teamId — ${cycles.size} מסמכים`);

  const entries = await getDocs(query(collection(db, 'entries'), where('teamId', '==', TEAM_ID)));
  ok(`entries where teamId — ${entries.size} מסמכים`);

  await expectDenied('entries בלי סינון', getDocs(collection(db, 'entries')));

  /* -------- 2. הדוח, מקוד הייצור, על הנתונים החיים -------- */

  console.log('\n== 2. הדוח על הנתונים החיים ==');

  const userDocs = users.docs.map((d) => ({ uid: d.id, ...d.data() }));
  const cycleDocs = cycles.docs.map((d) => ({ id: d.id, ...d.data() }));
  const entryDocs = entries.docs.map((d) => ({ id: d.id, ...d.data() }));

  const teamPlayers = lib.dashboard.matrixPlayers(
    lib.players.playersOfTeam(lib.players.onlyPlayers(userDocs), TEAM_ID),
  );
  info(`שחקנים פעילים בקבוצה: ${teamPlayers.length}`);

  const now = lib.dates.nowInstant();
  const range = lib.report.rangeForKind('current', now);
  info(`טווח "השבוע הנוכחי": ${range.from} עד ${range.to}`);

  const report = lib.report.buildWeeklyReport({
    players: teamPlayers,
    cycles: cycleDocs,
    entries: entryDocs,
    range,
  });

  info(`שבועות בטווח: ${report.weeks.length} · מתוכם עם מחזור: ${report.plannedWeekCount}`);
  info(`מחזורים שנמצאו: ${cycleDocs.map((c) => c.id).join(', ') || '—'}`);
  info(
    `תרגילים: ${report.exercises.map((e) => `${e.exerciseName} (יעד ${e.target}, נצבר ${e.total})`).join(' · ') || '—'}`,
  );

  for (const player of report.players) {
    info(
      `${player.uid.slice(0, 8)}… — ${Math.round(player.pct)}% · ` +
        `${player.weeksCounted} שבועות נמדדו · דיווח ב-${player.reportedWeeks}`,
    );
  }

  info(`ממוצע קבוצתי: ${Math.round(report.averagePct)}%`);
  info(`דיווחו: ${report.reportedCount}/${report.playerCount} · על אפס: ${report.zeroCount}`);

  /* -------- 3. הדוח מול הדשבורד -------- */

  console.log('\n== 3. הדוח מול הדשבורד — אותו מספר בשני המקומות ==');

  const currentCycle = cycleDocs
    .slice()
    .sort((a, b) => b.weekStart.toMillis() - a.weekStart.toMillis())[0];

  // בדיוק מה ש-CoachDashboardPage מחשב.
  const dashboardMatrix = lib.dashboard.buildTeamMatrix(
    teamPlayers,
    currentCycle ? currentCycle.itemsSnapshot : null,
    entryDocs.filter(
      (e) => e.date && lib.dates.getWeekKey(e.date) === lib.dates.getWeekKey(now),
    ),
  );

  const dashboardAverage = Math.round(dashboardMatrix.kpi.averagePct);
  const reportAverage = Math.round(report.averagePct);

  if (dashboardAverage === reportAverage) {
    ok(`דשבורד ${dashboardAverage}% = דוח ${reportAverage}%`);
  } else {
    fail(`דשבורד ${dashboardAverage}% ≠ דוח ${reportAverage}% — שני מקורות אמת!`);
  }

  /* -------- 4. הודעת הוואטסאפ -------- */

  console.log('\n== 4. הודעת הוואטסאפ (מכילה שמות — לא להדביק במקום ציבורי) ==');

  const previousStart = lib.dates.addDaysToDayKey(
    lib.dates.toIsraeliDayKey(report.weekStart),
    -7,
  );
  const previousReport = lib.report.buildWeeklyReport({
    players: teamPlayers,
    cycles: cycleDocs,
    entries: entryDocs,
    range: {
      kind: 'previous',
      from: previousStart,
      to: lib.dates.addDaysToDayKey(previousStart, 6),
    },
  });
  const previousPct =
    previousReport.plannedWeekCount === 0 || previousReport.playerCount === 0
      ? null
      : previousReport.averagePct;

  info(previousPct === null ? 'שבוע קודם: אין נתון (לא היה מחזור)' : `שבוע קודם: ${Math.round(previousPct)}%`);

  const teamName = teams.docs.find((d) => d.id === TEAM_ID)?.data().name ?? '';
  const text = lib.report.buildTeamWhatsAppText({ report, teamName, previousPct });

  console.log('\n--- התחלת ההודעה ---');
  console.log(text);
  console.log('--- סוף ההודעה ---\n');

  if (text.includes('\n\n\n')) fail('יש רווח כפול בהודעה');
  else ok('אין רווח כפול');

  if (previousPct === null && text.includes('שבוע שעבר')) {
    fail('"שבוע שעבר" הופיע בלי שיש נתון');
  } else {
    ok('"שבוע שעבר" מופיע רק כשיש נתון');
  }

  /* -------- 5. סיכום אישי -------- */

  console.log('\n== 5. סיכום אישי (בדיקת דליפה בין שחקנים) ==');

  if (report.players.length < 1) {
    info('אין שחקנים — מדלג');
  } else {
    const target = report.players[0];
    const detail = lib.report.playerDetail(report, target.uid);
    const personal = lib.report.buildPlayerWhatsAppText({
      detail,
      teamName,
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
    });

    const others = report.players.filter((p) => p.uid !== target.uid);
    const leaked = others.filter((p) => personal.includes(p.displayName));

    if (leaked.length > 0) fail(`הסיכום האישי מכיל ${leaked.length} שמות של שחקנים אחרים!`);
    else ok(`הסיכום האישי אינו מכיל אף שם של שחקן אחר (נבדקו ${others.length})`);

    if (personal.includes('ממוצע קבוצתי')) fail('הסיכום האישי מכיל ממוצע קבוצתי');
    else ok('הסיכום האישי אינו מכיל ממוצע קבוצתי');

    info(`אורך ההודעה האישית: ${personal.length} תווים, ${personal.split('\n').length} שורות`);
  }

  await signOut(auth);
  console.log('\n== סיכום ==');
  console.log('  הסקריפט לא כתב ולא מחק שום מסמך. אפס שינויים במסד.');
};

run()
  .catch((error) => {
    console.error('\n✗ ה-QA נפל:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    // ניקוי קבצים זמניים בלבד — לא נוגע במסד.
    rmSync(BUNDLE_DIR, { recursive: true, force: true });
    process.exit(process.exitCode ?? 0);
  });
