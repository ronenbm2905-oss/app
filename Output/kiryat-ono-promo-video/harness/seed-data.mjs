// מערך נתוני הדמו לסרטון השיווקי.
//
// חוק ברזל: כל שם, כל טלפון וכל תאריך לידה כאן הוא **בדוי**. האפליקציה האמיתית מחזיקה
// פרטים של קטינים, ולכן שום נתון אמיתי לא נכנס לפריים. הטלפונים בנויים בתבנית
// 050-000-XXXX — בלוק שאינו בשימוש, כדי שגם צופה מזדמן יראה שהמספר אינו אמיתי.
//
// המבנה נגזר מ-`EMPTY` ב-src/constants.js. התאריכים מחושבים יחסית לשבוע ההרצה, כך
// שהלוח השבועי תמיד נראה מלא — הסרטון לא יכול להציג שבוע ריק.

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDMY = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

// יום ראשון של השבוע המכיל את התאריך — זהה ל-weekStartOf באפליקציה.
function weekStartOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
const shift = (d, days) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// ---------- מאמנים ----------
const coaches = [
  { id: "c1", name: "רן אלמוג",    phone: "050-000-0001", birthDate: "1985-03-14" },
  { id: "c2", name: "יונתן ברקת",  phone: "050-000-0002", birthDate: "1990-11-02" },
  { id: "c3", name: "מאיה גלעדי",  phone: "050-000-0003", birthDate: "1993-06-21" },
  { id: "c4", name: "עידו נבון",   phone: "050-000-0004", birthDate: "1988-09-09" },
  { id: "c5", name: "טל שריג",     phone: "050-000-0005", birthDate: "1996-01-30" },
  { id: "c6", name: "אורי כספי",   phone: "050-000-0006", birthDate: "1982-12-05" },
];

// ---------- אולמות ----------
// אולמות בדויים. השמות והכתובות האמיתיים של המועדון אינם נכנסים לפריים: בשילוב עם
// "שעת התייצבות" הם מספרים איפה ומתי קטינים מתאספים, בפילוח לפי שכבת גיל.
const halls = [
  { id: "h1", name: "אולם המרכז",  address: "רחוב הדקל 5" },
  { id: "h2", name: "אולם הרימון", address: "רחוב האלון 14" },
  { id: "h3", name: "אולם נווה",   address: "רחוב הברוש 8" },
];

// ---------- קבוצות ----------
// vehicleType נדרש לייצוא ההסעות; weekly הוא מספר האימונים הקבועים בשבוע.
const teams = [
  { id: "t1", name: "ילדים א'",  coachId: "c1", vehicleType: "16", weekly: 2 },
  { id: "t2", name: "ילדים ב'",  coachId: "c2", vehicleType: "16", weekly: 2 },
  { id: "t3", name: "קדטים א'",  coachId: "c3", vehicleType: "20", weekly: 3 },
  { id: "t4", name: "קדטים ב'",  coachId: "c4", vehicleType: "20", weekly: 2 },
  { id: "t5", name: "נערים א'",  coachId: "c1", vehicleType: "20", weekly: 3 },
  { id: "t6", name: "נערים ב'",  coachId: "c5", vehicleType: "16", weekly: 2 },
  { id: "t7", name: "נוער",      coachId: "c6", vehicleType: "20", weekly: 3 },
  { id: "t8", name: "בוגרים",    coachId: "c6", vehicleType: "20", weekly: 2 },
];

// ---------- שמות בדויים לשחקנים ----------
const FIRST = [
  "איתי", "נועם", "יובל", "אורי", "רועי", "עידו", "אלון", "גיא", "עומר", "דניאל",
  "יהלי", "ליאם", "אריאל", "שקד", "תומר", "אדם", "רן", "יונתן", "מתן", "עידן",
  "נדב", "אמיר", "הראל", "בן", "אסף", "טל", "עמית", "ניר", "יואב", "רותם",
];
const LAST = [
  "אלמוג", "ברקת", "גלעדי", "דגן", "הרוש", "ויצמן", "זהבי", "חן", "טובול", "יערי",
  "כרמי", "לביא", "מזרחי", "נבון", "סלע", "עומר", "פלד", "צור", "קדם", "רוזן",
];
const SIZES = ["XS", "S", "M", "L", "XL"];

function buildPlayers() {
  const out = [];
  let n = 0;
  teams.forEach((team, ti) => {
    const count = 7 + (ti % 3); // 7-9 שחקנים לקבוצה
    for (let i = 0; i < count; i++) {
      const first = FIRST[(ti * 5 + i * 3) % FIRST.length];
      const last = LAST[(ti * 7 + i * 5) % LAST.length];
      // גיל נגזר משכבת הגיל של הקבוצה, כדי שהרשימה תיראה הגיונית
      const birthYear = 2018 - ti * 2 - (i % 2);
      out.push({
        id: `p${++n}`,
        teamId: team.id,
        name: `${first} ${last}`,
        phone: `050-000-${String(1000 + n).slice(0, 4)}`,
        // שחקנים: DD-MM-YYYY (זה מה ש-formatDateFromExcel מייצר). מאמנים לעומת זאת ISO.
        birthDate: `${pad(((i * 7) % 27) + 1)}-${pad(((i * 3) % 12) + 1)}-${birthYear}`,
        shirtSize: SIZES[(i + ti) % SIZES.length],
        pantsSize: SIZES[(i + ti + 1) % SIZES.length],
        sweaterSize: SIZES[(i + ti + 2) % SIZES.length],
        jerseyNumber: String(4 + i * 2),
      });
    }
  });
  return out;
}

// ---------- אימונים ----------
// לוח שבועי צפוף אך קריא: כל יום נושא כמה אימונים בכמה אולמות במקביל.
// [יום, שעת התחלה, שעת סיום, קבוצה, מאמן, אולם, סוג]
const WEEK_TEMPLATE = [
  ["ראשון",  "16:00", "17:30", "t1", "c1", "h1", "אימון"],
  ["ראשון",  "17:30", "19:00", "t3", "c3", "h1", "אימון"],
  ["ראשון",  "17:00", "18:30", "t6", "c5", "h2", "אימון"],
  ["ראשון",  "19:00", "20:30", "t7", "c6", "h1", "אימון"],
  ["שני",    "16:00", "17:30", "t2", "c2", "h1", "אימון"],
  ["שני",    "17:30", "19:00", "t5", "c1", "h1", "אימון"],
  ["שני",    "16:30", "18:00", "t4", "c4", "h3", "ספורטתרפיה"],
  ["שני",    "19:00", "20:30", "t8", "c6", "h2", "אימון"],
  ["שלישי",  "16:00", "17:30", "t1", "c1", "h2", "אימון"],
  ["שלישי",  "17:30", "19:00", "t3", "c3", "h1", "אימון"],
  ["שלישי",  "17:00", "18:30", "t7", "c6", "h3", "חד\"כ"],
  ["שלישי",  "19:00", "20:30", "t5", "c1", "h1", "אימון"],
  ["רביעי",  "16:00", "17:30", "t2", "c2", "h2", "אימון"],
  ["רביעי",  "17:30", "19:00", "t4", "c4", "h1", "אימון"],
  ["רביעי",  "17:00", "18:30", "t6", "c5", "h3", "אימון"],
  ["רביעי",  "19:00", "20:30", "t8", "c6", "h1", "יורם"],
  ["חמישי",  "16:00", "17:30", "t3", "c3", "h1", "אימון"],
  ["חמישי",  "17:30", "19:00", "t5", "c1", "h1", "אימון"],
  ["חמישי",  "17:00", "18:30", "t1", "c1", "h2", "אימון"],
  ["חמישי",  "19:00", "20:30", "t7", "c6", "h1", "אימון"],
];

function buildSessions(weeks) {
  const out = [];
  let n = 0;
  weeks.forEach((weekOf) => {
    WEEK_TEMPLATE.forEach(([day, start, end, teamId, coachId, hallId, type]) => {
      out.push({
        id: `s${++n}`,
        teamId, coachId, hallId, day, start, end, type,
        notes: "",
        weekOf,
      });
    });
  });
  return out;
}

// ---------- משחקים ----------
const OPPONENTS = [
  "הפועל רמת גן", "מכבי ראשל\"צ", "אליצור יהוד", "הפועל אור יהודה",
  "מכבי גבעתיים", "בני הרצליה", "הפועל פ\"ת", "מכבי בת ים",
];
const AWAY_VENUES = [
  "אולם זיסמן, רמת גן", "היכל הספורט, ראשון לציון", "אולם יהוד מונוסון",
  "אולם אור יהודה", "אולם גבעתיים", "אולם הרצליה", "אולם פתח תקווה", "אולם בת ים",
];

function buildGames(sunday) {
  const out = [];
  // משחקים בשישי ובשבת של השבוע הנוכחי ושל השבוע הבא — בית וחוץ מעורבבים.
  const plan = [
    { team: "t3", dayOffset: 5, time: "10:00", isHome: true,  round: "7" },
    { team: "t5", dayOffset: 5, time: "12:00", isHome: false, round: "7" },
    { team: "t7", dayOffset: 6, time: "09:30", isHome: true,  round: "7" },
    { team: "t1", dayOffset: 6, time: "11:00", isHome: false, round: "7" },
    { team: "t8", dayOffset: 6, time: "18:00", isHome: true,  round: "7" },
    { team: "t4", dayOffset: 12, time: "10:00", isHome: false, round: "8" },
    { team: "t6", dayOffset: 13, time: "09:30", isHome: true,  round: "8" },
    { team: "t2", dayOffset: 13, time: "11:30", isHome: false, round: "8" },
  ];
  plan.forEach((g, i) => {
    const d = shift(sunday, g.dayOffset);
    const team = teams.find((t) => t.id === g.team);
    out.push({
      federationCode: `G${7100 + i}`,
      teamId: g.team,
      league: `ליגה א' ${team.name}`,
      date: toDMY(d),
      time: g.time,
      weekDay: HEB_DAYS[d.getDay()],
      round: g.round,
      isHome: g.isHome,
      opponent: OPPONENTS[i % OPPONENTS.length],
      venue: g.isHome ? "אולם המרכז, רחוב הדקל 5" : AWAY_VENUES[i % AWAY_VENUES.length],
      ourScore: null,
      theirScore: null,
    });
  });
  return out;
}

// ---------- הרכבת הדאטהסט ----------
export function buildSeed(baseDate = new Date()) {
  const sunday = weekStartOf(baseDate);
  const prevWeek = toISO(shift(sunday, -7));
  const thisWeek = toISO(sunday);

  const players = buildPlayers();
  // ארבעה שבועות אחורה ועד השבוע הנוכחי. זה לא נוי: דו"ח השעות סופר לפי חודש
  // קלנדרי (ReportView), ושבוע אחד בלבד היה מפיק דו"ח של "6 שעות" — נתון שמחליש
  // בדיוק את הטענה שהסרטון בא להוכיח. השבוע הבא נשאר ריק בכוונה, כדי שאפשר יהיה
  // לצלם את "שכפול השבוע הקודם" כזרימה אמיתית.
  const weeks = [3, 2, 1, 0].map((back) => toISO(shift(sunday, -7 * back)));
  const sessions = buildSessions(weeks);

  const club = {
    teams,
    coaches,
    halls,
    sessions,
    constraints: [
      // הסכימה היא { type: "coach"|"hall", refId } — לא coachId. ConstraintsView.jsx:256.
      { id: "k1", type: "coach", refId: "c2", day: "שלישי", start: "16:00", end: "22:00", note: "לימודים" },
      { id: "k2", type: "coach", refId: "c5", day: "חמישי", start: "18:00", end: "22:00", note: "עבודה" },
      { id: "k3", type: "coach", refId: "c4", day: "ראשון", start: "16:00", end: "19:00", note: "מילואים — קבוע" },
      { id: "k4", type: "hall",  refId: "h3", day: "שני",   start: "19:00", end: "22:00", note: "האולם מושכר בערב" },
    ],
    games: buildGames(sunday),
    gameMapping: teams.map((t, i) => ({ teamId: t.id, federationCodes: [String(715510 + i)] })),
    players,
    holidays: [
      { id: "hol1", date: toISO(shift(sunday, 9)), endDate: "", name: "ערב חג — אין אימונים" },
    ],
    absences: [
      { id: "a1", coachId: "c3", date: toISO(shift(sunday, 3)), note: "אירוע משפחתי" },
      { id: "a2", coachId: "c6", date: toISO(shift(sunday, 4)), start: "19:00", end: "21:00", note: "מגיע באיחור" },
    ],
    fixedWeekSkips: [],
    hideFixedTeams: false,
    announcement: {
      text: "לו\"ז השבוע פורסם. שימו לב — אימון נערים א' ביום שלישי עבר לאולם המרכז.",
      updatedAt: new Date().toISOString(),
    },
    // פורסם לשבוע שעבר בלבד — כך שכפתור הפרסום של השבוע הנוכחי עדיין ניתן ללחיצה בצילום.
    schedulePublished: { weekOf: prevWeek, at: new Date().toISOString() },
    weeklyAssignments: {},
    admins: [],
    members: [],
  };


  // ---- ספריית סרטוני אימון ----
  // הערה: האפליקציה שומרת קישורים בלבד ולא מטמיעה נגן — ראו סקירת השער של עדי #8.
  const now = new Date().toISOString();
  const videos = [
    { id: "v1", title: "תרגיל מסירות בשלשות", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      provider: "youtube", category: "מסירות וכדרור", note: "טוב לחימום, מגיל 10 ומעלה",
      author: "רן אלמוג", authorEmail: "", createdAt: now },
    { id: "v2", title: "הגנת אזור 2-3 — יסודות", url: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
      provider: "youtube", category: "הגנה", note: "לקדטים ומעלה",
      author: "מאיה גלעדי", authorEmail: "", createdAt: now },
    { id: "v3", title: "קליעה מהעמדה — טכניקה", url: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
      provider: "youtube", category: "קליעה", note: "",
      author: "יונתן ברקת", authorEmail: "", createdAt: now },
    { id: "v4", title: "פיק אנד רול — מהלך פתיחה", url: "https://www.youtube.com/watch?v=ccccccccccc",
      provider: "youtube", category: "מהלכים", note: "לנוער ובוגרים",
      author: "אורי כספי", authorEmail: "", createdAt: now },
    { id: "v5", title: "סולם זריזות — חימום קבוע", url: "https://www.youtube.com/watch?v=ddddddddddd",
      provider: "youtube", category: "כושר וחימום", note: "10 דקות בתחילת כל אימון",
      author: "טל שריג", authorEmail: "", createdAt: now },
    { id: "v6", title: "כדרור יד חלשה", url: "https://www.youtube.com/watch?v=eeeeeeeeeee",
      provider: "youtube", category: "מסירות וכדרור", note: "",
      author: "עידו נבון", authorEmail: "", createdAt: now },
  ];

  // ---- תוכניות אימון (מפתח נפרד) ----
  const planKey = `c1__${thisWeek}`;
  const trainingPlans = {
    [planKey]: {
      players: "12 שחקנים",
      missing: "2 — מחלה",
      rows: [
        { drill: "חימום ומתיחות", detail: "ריצה קלה, סולם זריזות, מתיחות דינמיות", focus: "כושר", time: "10" },
        { drill: "כדרור שתי ידיים", detail: "לאורך המגרש, החלפת יד בכל קונוס", focus: "כדרור", time: "15" },
        { drill: "מסירות בזוגות", detail: "מסירת חזה ומסירת קרקע בתנועה", focus: "מסירות", time: "15" },
        { drill: "קליעה מהעמדה", detail: "5 עמדות, 10 קליעות מכל עמדה", focus: "קליעה", time: "20" },
        { drill: "משחקון 3 על 3", detail: "חצי מגרש, דגש על מסירה לפני קליעה", focus: "מהלכים", time: "20" },
      ],
      units: {},
      summary: "אימון טוב. לחזור על מסירת קרקע בתנועה — עדיין לא זורם.",
      author: "רן אלמוג",
      authorEmail: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  // ---- הערות אחרי משחק ----
  const gameNotes = {
    G7100: {
      text: "ניצחון 62:54. ההגנה באזור עבדה מצוין ברבע השלישי. לשפר: זריקות עונשין — 9 מתוך 18.",
      author: "מאיה גלעדי",
      updatedAt: new Date().toISOString(),
    },
  };

  // ---- ייבוא ממתין מהאיגוד ----
  // נזרע ישירות, כי הזרימה המעניינת לצילום היא הסקירה והאישור — לא העלאת הקובץ.
  const nextRound = buildGames(sunday).slice(5).map((g) => ({ ...g, round: "8" }));
  const pendingImport = {
    id: "imp1",
    status: "pending",
    sourceFile: "לוז_משחקים_מחזור_8.xlsx",
    createdAt: new Date().toISOString(),
    summary: { added: 3, updated: 2, removed: 0, skipped: 0, total: 5, ratio: 0.0, suspicious: false },
    games: nextRound,
  };

  return { club, trainingPlans, gameNotes, pendingImport, videos, thisWeek, prevWeek };
}

// מפתחות ה-localStorage, כפי שהם מוגדרים באפליקציה.
export const KEYS = {
  club: "bball-schedule-v1",
  trainingPlans: "bball-training-plans-v1",
  gameNotes: "bball-game-notes-v1",
  pendingImport: "bball-pending-import-v1",
  videos: "bball-videos-v1",
};
