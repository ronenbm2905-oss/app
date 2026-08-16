// ============================================================================
// he.js — המילון העברי.
// **המקור: `shira/Outputs/2026-08-13-nrcar-microcopy.md`.** המחרוזות הועתקו
// כלשונן. אם משהו כאן נראה מוזר — זו כנראה הכרעת קופי מכוונת, ולא באג.
//
// שלושה כללים של שירה שמשפיעים על הקוד ולא רק על הטקסט:
//   1. **אף פעם לא מצמידים אות שימוש ל-{vehicle} או ל-{title}** — הערכים
//      מגיעים מהמשתמש. "האוטו של אמא" → "בהאוטו של אמא" הוא ג'יבריש. כל
//      המחרוזות כאן כתובות "של {vehicle}". **אל תדרסו את זה בליטוש.**
//   2. `{days}` == 2 → ווריאנט `.two` ("יומיים"). `{days}` == 1 → הדלי כבר
//      כתוב "מחר"/"אתמול", בלי מספר.
//   3. **המילה "המערכת" אסורה בממשק.** מדברים בגוף ראשון רבים.
//
// ⚠️ `legal.notice.cta` = "קראתי", לא "אני מסכים" — הכרעה של עדי. לא לשנות.
// ============================================================================

export default {
  // -- כללי האפליקציה --
  "app.name": "NRCAR",
  "app.title": "NRCAR — הרכב שלי",
  "app.tagline": "כל מה שצריך לזכור ולנהל ברכב הפרטי",

  // ==========================================================================
  // 1. חמשת הסטטוסים
  // ==========================================================================
  "task.status.open": "פתוח",
  "task.status.open.hint": "עוד לא הגיע הזמן. נזכיר לך כשיתקרב.",
  "task.status.upcoming": "מתקרב",
  "task.status.upcoming.hint": "התאריך מתקרב — זה הזמן להתחיל לטפל.",
  "task.status.inProgress": "בטיפול",
  "task.status.inProgress.hint": "קבעת תור או שזה כבר בדרך.",
  "task.status.overdue": "באיחור",
  "task.status.overdue.hint": "התאריך עבר וזה עוד לא סומן כבוצע.",
  // המחרוזת שמסבירה את הכרעת המוצר: "באיחור" גובר על "בטיפול".
  // בלעדיה המשתמש חושב שיש באג — הוא כן קבע תור, ובכל זאת כתוב באיחור.
  "task.status.overdue.hintFromInProgress": "קבעת תור, אבל התאריך כבר עבר.",
  "task.status.done": "בוצע",
  "task.status.done.hint": "סימנת שביצעת. התזכורת הבאה כבר פתוחה.",

  "task.important.on": "חשוב",
  "task.important.off": "רגיל",
  "task.important.toggle": "לסמן כחשוב",
  "task.important.untoggle": "להוריד את הסימון",
  "task.due": "תאריך יעד: {date}",
  "task.dueIn": "בעוד {days} ימים",
  "task.dueIn.two": "בעוד יומיים",
  "task.dueIn.tomorrow": "מחר",
  "task.dueIn.today": "היום",
  "task.overdueBy": "באיחור של {days} ימים",
  "task.overdueBy.one": "באיחור של יום",
  "task.overdueBy.two": "באיחור של יומיים",

  // ==========================================================================
  // 2.1 מנוע — טסט
  // ==========================================================================
  "engine.test.d30.title": "הטסט של {vehicle} בעוד {days} ימים",
  "engine.test.d30.sub": "יש עוד זמן. שווה כבר לקבוע תור במוסך שנוח לך.",
  "engine.test.d14.title": "הטסט של {vehicle} בעוד {days} ימים",
  "engine.test.d14.sub": "זה הזמן הטוב לקבוע תור — עוד לא לחוץ.",
  "engine.test.d7.title": "נשארו {days} ימים לטסט של {vehicle}",
  "engine.test.d7.sub": "אם עוד לא קבעת תור, כדאי לעשות את זה השבוע.",
  "engine.test.d3.title": "עוד {days} ימים והטסט של {vehicle} נגמר",
  "engine.test.d3.title.two": "עוד יומיים והטסט של {vehicle} נגמר",
  "engine.test.d3.sub": "כדאי לסגור את זה בימים הקרובים.",
  "engine.test.d1.title": "מחר נגמר הטסט של {vehicle}",
  "engine.test.d1.sub": "אם כבר עשית טסט — סמן שביצעת ונקפוץ לשנה הבאה.",
  "engine.test.d0.title": "היום היום האחרון של הטסט של {vehicle}",
  "engine.test.d0.sub": "ממחר הרכב בלי טסט בתוקף. אם כבר עשית — סמן שביצעת.",
  "engine.test.overdue.title": "הטסט של {vehicle} נגמר לפני {days} ימים",
  "engine.test.overdue.title.one": "הטסט של {vehicle} נגמר אתמול",
  "engine.test.overdue.title.two": "הטסט של {vehicle} נגמר לפני יומיים",
  // ✅ אושר ע"י עדי (2026-08-13) בניסוח הזה בדיוק. ההנמקה, כדי שלא תידרס
  // בליטוש: הנוסח מייחס את **הכלל** לחוק ומשאיר את **העובדה** אצלנו.
  // "לא אמור להיות על הכביש" נדחה — נוסח מהסס מזמין את המשתמש להמציא חריגים.
  "engine.test.overdue.sub": "לפי החוק, נהיגה ברכב מחייבת רישיון רכב (טסט) בתוקף",

  // ==========================================================================
  // 2.2 מנוע — ביטוח. {coverage} כולל את ה"א הידיעה.
  // ==========================================================================
  "insurance.coverage.compulsory": "ביטוח החובה",
  "insurance.coverage.comprehensive": "הביטוח המקיף",
  "insurance.coverage.generic": "הביטוח",

  "engine.insurance.d30.title": "{coverage} של {vehicle} מסתיים בעוד {days} ימים",
  "engine.insurance.d30.sub": "יש זמן להשוות הצעות לפני שמחדשים.",
  "engine.insurance.d14.title": "{coverage} של {vehicle} מסתיים בעוד {days} ימים",
  "engine.insurance.d14.sub": "שבועיים זה בדיוק הזמן לדבר עם הסוכן.",
  "engine.insurance.d7.title": "נשארו {days} ימים עד סוף {coverage} של {vehicle}",
  "engine.insurance.d7.sub": "כדאי לסגור את החידוש השבוע.",
  "engine.insurance.d3.title": "עוד {days} ימים ו{coverage} של {vehicle} נגמר",
  "engine.insurance.d3.title.two": "עוד יומיים ו{coverage} של {vehicle} נגמר",
  "engine.insurance.d3.sub": "הכיסוי לא מתחדש מעצמו — צריך לאשר את החידוש.",
  "engine.insurance.d1.title": "מחר נגמר {coverage} של {vehicle}",
  "engine.insurance.d1.sub": "אם כבר חידשת — סמן שביצעת ונעדכן את התאריך.",
  "engine.insurance.d0.title": "היום היום האחרון של {coverage} של {vehicle}",
  "engine.insurance.d0.sub": "ממחר הרכב בלי כיסוי. אם כבר חידשת — סמן שביצעת.",
  "engine.insurance.overdue.title": "{coverage} של {vehicle} נגמר לפני {days} ימים",
  "engine.insurance.overdue.title.one": "{coverage} של {vehicle} נגמר אתמול",
  "engine.insurance.overdue.title.two": "{coverage} של {vehicle} נגמר לפני יומיים",
  // ⚠️ שתי שורות תמיכה שונות לפי סוג הכיסוי. **זו לא כפילות — זה דיוק,
  // והוא נעול.** נהיגה בלי ביטוח מקיף מותרת לחלוטין; מיזוג שתי השורות הוא
  // אמירה שגויה על החוק. נאכף ב-smoke: שום מפתח *.comprehensive.* לא מכיל
  // "החוק" או "אסור".
  // ✅ הנוסח של compulsory אושר ע"י עדי (2026-08-13) מילה במילה.
  "engine.insurance.overdue.sub.compulsory": "החוק אוסר לנהוג ברכב שאין לו ביטוח חובה בתוקף",
  "engine.insurance.overdue.sub.comprehensive": "הרכב כרגע בלי כיסוי מקיף. כדאי לחדש בהקדם.",

  // ============================================================================
  // ייחוס-עובדה על כרטיס ה-overdue. **לא disclaimer** — שורה קטנה שמפרידה בין
  // ה**כלל** (שהוא של החוק) לבין ה**עובדה** (שהיא שלנו, וניתנת לבדיקה).
  // היא גם מכסה את דרישת הטריות של tokef_dt: המאגר הוא snapshot תקופתי.
  // ============================================================================
  "engine.attribution.insurance": "לפי מה שהזנת באפליקציה. כדאי לוודא מול חברת הביטוח.",
  "engine.attribution.test": "לפי נתוני משרד התחבורה מ-{date}. כדאי לוודא.",
  "engine.attribution.manual": "לפי מה שהזנת באפליקציה. כדאי לוודא.",

  // ==========================================================================
  // 2.3 מנוע — טיפול
  // ==========================================================================
  "engine.service.d30.title": "הטיפול של {vehicle} בעוד {days} ימים",
  "engine.service.d30.sub": "מועד הטיפול הבא מתקרב. שווה כבר לתפוס תור.",
  "engine.service.d14.title": "הטיפול של {vehicle} בעוד {days} ימים",
  "engine.service.d14.sub": "כדאי לתפוס תור לפני שהיומן במוסך מתמלא.",
  "engine.service.d7.title": "נשארו {days} ימים לטיפול של {vehicle}",
  "engine.service.d7.sub": 'אם נוח לך, אפשר גם לעדכן כמה ק"מ יש עכשיו — זה מדייק לנו את החישוב.',
  "engine.service.d3.title": "עוד {days} ימים למועד הטיפול של {vehicle}",
  "engine.service.d3.title.two": "עוד יומיים למועד הטיפול של {vehicle}",
  "engine.service.d3.sub": "עדיף לא לדחות — טיפול בזמן שומר על הרכב.",
  "engine.service.d1.title": "מחר מגיע מועד הטיפול של {vehicle}",
  "engine.service.d1.sub": "אם כבר היית במוסך — סמן שביצעת.",
  "engine.service.d0.title": "היום מגיע מועד הטיפול של {vehicle}",
  "engine.service.d0.sub": "אם כבר היית במוסך — סמן שביצעת ונחשב את הטיפול הבא.",
  "engine.service.overdue.title": "מועד הטיפול של {vehicle} עבר לפני {days} ימים",
  "engine.service.overdue.title.one": "מועד הטיפול של {vehicle} עבר אתמול",
  "engine.service.overdue.title.two": "מועד הטיפול של {vehicle} עבר לפני יומיים",
  "engine.service.overdue.sub": "אם כבר עשית — סמן שביצעת. אם לא, כדאי לקבוע תור.",

  "engine.service.km.estimate": 'לפי הקצב שלך, הטיפול הבא בסביבות {km} ק"מ.',
  "engine.service.km.reached": 'עברת את {km} ק"מ — הטיפול כבר בזמנו.',
  "engine.service.km.noData": 'כדי לחשב גם לפי ק"מ, עדכן מדי פעם את מד האוץ.',
  "engine.service.km.update": 'לעדכן ק"מ',

  // ==========================================================================
  // 2.4 מנוע — תיקון (משימה שהמשתמש כתב; אין אחריה משימה הבאה)
  // ==========================================================================
  "engine.repair.d30.title": "{title} של {vehicle} בעוד {days} ימים",
  "engine.repair.d30.sub": "רשמת את זה בעצמך. נזכיר שוב כשיתקרב.",
  "engine.repair.d14.title": "{title} של {vehicle} בעוד {days} ימים",
  "engine.repair.d14.sub": "עוד לא בוער, אבל טוב שזה רשום.",
  "engine.repair.d7.title": "נשארו {days} ימים — {title} של {vehicle}",
  "engine.repair.d7.sub": "אם זה כבר טופל, אפשר לסמן שביצעת.",
  "engine.repair.d3.title": "עוד {days} ימים — {title} של {vehicle}",
  "engine.repair.d3.title.two": "עוד יומיים — {title} של {vehicle}",
  "engine.repair.d3.sub": "כדאי לסגור את זה בימים הקרובים.",
  "engine.repair.d1.title": "מחר — {title} של {vehicle}",
  "engine.repair.d1.sub": "אם זה כבר מאחוריך, סמן שביצעת.",
  "engine.repair.d0.title": "היום — {title} של {vehicle}",
  "engine.repair.d0.sub": "אם זה כבר מאחוריך, סמן שביצעת.",
  "engine.repair.overdue.title": "{title} של {vehicle} — התאריך עבר לפני {days} ימים",
  "engine.repair.overdue.title.one": "{title} של {vehicle} — התאריך עבר אתמול",
  "engine.repair.overdue.title.two": "{title} של {vehicle} — התאריך עבר לפני יומיים",
  "engine.repair.overdue.sub": "אפשר לקבוע תאריך חדש, או לסמן שביצעת.",

  // ==========================================================================
  // 2.5 מנוע — אחר
  // ==========================================================================
  "engine.other.d30.title": "{title} של {vehicle} בעוד {days} ימים",
  "engine.other.d30.sub": "נזכיר לך שוב כשיתקרב.",
  "engine.other.d14.title": "{title} של {vehicle} בעוד {days} ימים",
  "engine.other.d14.sub": "עוד יש זמן.",
  "engine.other.d7.title": "נשארו {days} ימים — {title} של {vehicle}",
  "engine.other.d7.sub": "כדאי להתחיל לטפל.",
  "engine.other.d3.title": "עוד {days} ימים — {title} של {vehicle}",
  "engine.other.d3.title.two": "עוד יומיים — {title} של {vehicle}",
  "engine.other.d3.sub": "כדאי לסגור את זה בימים הקרובים.",
  "engine.other.d1.title": "מחר — {title} של {vehicle}",
  "engine.other.d1.sub": "אם זה כבר מאחוריך, סמן שביצעת.",
  "engine.other.d0.title": "היום — {title} של {vehicle}",
  "engine.other.d0.sub": "אם זה כבר מאחוריך, סמן שביצעת.",
  "engine.other.overdue.title": "{title} של {vehicle} — התאריך עבר לפני {days} ימים",
  // הערה 2 של שירה: "overdue צריך גם .one בכל סוגי המשימה". בסוג "אחר" הן
  // חסרו בטבלה; הועתקו מ-repair, שהמשפט שלו זהה מילה במילה.
  "engine.other.overdue.title.one": "{title} של {vehicle} — התאריך עבר אתמול",
  "engine.other.overdue.title.two": "{title} של {vehicle} — התאריך עבר לפני יומיים",
  "engine.other.overdue.sub": "אפשר לקבוע תאריך חדש, או לסמן שביצעת.",

  // ==========================================================================
  // 2.6 עטיפת הכרטיס והדשבורד
  // ==========================================================================
  "dashboard.hero.label": "הכי דחוף עכשיו",
  "dashboard.hero.cta.done": "סימנתי שביצעתי",
  "dashboard.hero.cta.open": "לפרטים",
  "dashboard.hero.cta.snooze": "להזכיר לי מאוחר יותר",
  "dashboard.allClear.title": "הכול מסודר 👍",
  "dashboard.allClear.sub": "אין כרגע שום דבר שדורש טיפול. נודיע לך בזמן.",
  "dashboard.vehicles.title": "הרכבים שלי",
  "dashboard.vehicleCard.next": "הכי קרוב: {title}",
  "dashboard.vehicleCard.nothing": "אין כרגע מה לטפל",
  "dashboard.vehicleCard.archived": "בארכיון",
  "dashboard.addVehicle": "הוספת רכב",
  "snooze.title": "מתי להזכיר שוב?",
  "snooze.option.tomorrow": "מחר",
  "snooze.option.week": "בעוד שבוע",
  "snooze.option.custom": "בתאריך אחר",
  "snooze.done": "נזכיר לך שוב ב-{date}.",

  // ==========================================================================
  // 3. זרימת הוספת רכב
  // ==========================================================================
  "vehicle.add.title": "בוא נוסיף רכב",
  "vehicle.add.sub": "מספיק מספר הרישוי — את השאר נמשוך בשבילך.",
  "vehicle.add.plate.label": "מספר רישוי",
  "vehicle.add.plate.hint": "אפשר עם מקפים או בלי. למשל: 12-345-67",
  "vehicle.add.plate.placeholder": "12-345-67",
  "vehicle.add.submit": "חיפוש הרכב",
  "vehicle.add.manualLink": "אני מעדיף להזין את הפרטים ידנית",
  "vehicle.add.plate.error.empty": "צריך להזין מספר רישוי כדי להמשיך.",
  // ⚠️ ההודעה **לא נוקבת במספר ספרות** בכוונה: הוולידציה מקבלת 5-8 כדי לא
  // לחסום רכב ותיק או דו-גלגלי, ומספר בהודעה היה סותר אותה.
  "vehicle.add.plate.error.invalid":
    "המספר הזה לא נראה כמו מספר רישוי. מספר הרישוי מופיע ברישיון הרכב.",

  "vehicle.add.loading": "רגע, מושכים את פרטי הרכב…",
  "vehicle.add.loading.slow": "עוד רגע — המאגר של משרד התחבורה קצת איטי כרגע.",
  "vehicle.add.loading.cancel": "ביטול והזנה ידנית",

  "vehicle.add.found.title": "מצאנו את הרכב — זה הוא?",
  "vehicle.add.found.sub": "הפרטים הגיעו ממאגר משרד התחבורה. אפשר לתקן כל שדה.",
  "vehicle.add.found.plate": "מספר רישוי",
  "vehicle.add.found.model": "יצרן ודגם",
  "vehicle.add.found.year": "שנת ייצור",
  "vehicle.add.found.color": "צבע",
  "vehicle.add.found.fuel": "סוג דלק",
  "vehicle.add.found.testValid": "תוקף טסט",
  "vehicle.add.found.testValid.none": "לא מצאנו תוקף טסט — אפשר להשלים ידנית.",
  "vehicle.add.found.taskNotice": "נפתח לך תזכורת לטסט ל-{date}, ונזכיר לך חודש מראש.",
  "vehicle.add.found.confirm": "כן, זה הרכב שלי",
  "vehicle.add.found.reject": "לא, זה לא הרכב",
  "vehicle.add.found.rejectHint": "אפשר לתקן את מספר הרישוי ולחפש שוב.",
  "vehicle.add.found.disclaimer":
    "הפרטים מגיעים ממאגר ציבורי של משרד התחבורה ומתעדכנים מדי פעם. אם משהו לא מדויק — אפשר לתקן.",

  "vehicle.add.deregistered.title": "הרכב הזה כבר לא רשום כפעיל",
  "vehicle.add.deregistered.body":
    "לפי משרד התחבורה, הרישום של {plate} בוטל ב-{date}. מכרת אותו או שהוא ירד מהכביש?",
  "vehicle.add.deregistered.body.noDate":
    "לפי משרד התחבורה, הרישום של {plate} כבר לא פעיל. מכרת אותו או שהוא ירד מהכביש?",
  "vehicle.add.deregistered.hint":
    "אם זה בכל זאת הרכב שלך, אפשר להוסיף אותו ידנית — המסמכים וההיסטוריה יישמרו.",
  "vehicle.add.deregistered.cta.manual": "להוסיף אותו ידנית",
  "vehicle.add.deregistered.cta.back": "לתקן את מספר הרישוי",

  "vehicle.add.notFound.title": "לא מצאנו רכב עם המספר הזה",
  "vehicle.add.notFound.body":
    "אולי נפלה טעות בספרה. אפשר לנסות שוב, או להזין את הפרטים ידנית — זה לוקח דקה.",
  "vehicle.add.notFound.cta.retry": "לנסות מספר אחר",
  "vehicle.add.notFound.cta.manual": "להזין ידנית",

  "vehicle.add.network.title": "לא הצלחנו להתחבר למאגר",
  "vehicle.add.network.body":
    "כנראה תקלה זמנית. אפשר לנסות שוב עוד רגע, או להזין את הפרטים ידנית — זה לוקח דקה.",
  "vehicle.add.network.cta.retry": "לנסות שוב",
  "vehicle.add.network.cta.manual": "להזין ידנית",
  "vehicle.add.offline.title": "אין כרגע חיבור לאינטרנט",
  "vehicle.add.offline.body":
    "בלי חיבור אי אפשר למשוך את הפרטים ממשרד התחבורה. אפשר להזין ידנית עכשיו, או לחזור לזה כשהחיבור יחזור.",
  "vehicle.add.offline.cta.manual": "להזין ידנית",

  "vehicle.manual.title": "פרטי הרכב",
  "vehicle.manual.sub": "רק מה שאתה יודע. אפשר להשלים בהמשך.",
  "vehicle.field.nickname": "כינוי לרכב",
  "vehicle.field.nickname.hint": "כדי שיהיה קל לזהות. למשל: האוטו של אמא",
  "vehicle.field.manufacturer": "יצרן",
  "vehicle.field.model": "דגם",
  "vehicle.field.year": "שנת ייצור",
  "vehicle.field.color": "צבע",
  "vehicle.field.fuel": "סוג דלק",
  "vehicle.field.testValidUntil": "תוקף הטסט",
  "vehicle.field.testValidUntil.hint": 'מופיע ברישיון הרכב, בשורה "תוקף רישוי".',
  "vehicle.field.compulsoryUntil": "ביטוח חובה בתוקף עד",
  "vehicle.field.comprehensiveUntil": "ביטוח מקיף בתוקף עד",
  "vehicle.field.insurer": "חברת הביטוח",
  "vehicle.field.policyNumber": "מספר פוליסה",
  "vehicle.field.insurerPhone": "טלפון חירום של חברת הביטוח",
  "vehicle.field.insurerPhone.hint": "מופיע על הפוליסה. יופיע כאן ככפתור חיוג במסך החירום.",
  "vehicle.field.agentName": "סוכן הביטוח",
  "vehicle.field.agentPhone": "טלפון הסוכן",
  "vehicle.field.garageName": "המוסך שלי",
  "vehicle.field.garagePhone": "טלפון המוסך",
  "vehicle.field.lastService": "תאריך הטיפול האחרון",
  "vehicle.field.currentKm": 'כמה ק"מ יש עכשיו',
  "vehicle.field.currentKm.hint": "המספר שמופיע בלוח המחוונים. עוזר לנו לחשב מתי הטיפול הבא.",
  "vehicle.field.photo": "תמונה של הרכב",
  "vehicle.field.photo.hint": "תמונה אמיתית עוזרת לזהות את הרכב במבט אחד.",
  "vehicle.field.photo.cta": "צילום או בחירת תמונה",
  "vehicle.save": "שמירת הרכב",
  "vehicle.saved.toast": "הרכב נשמר. מכאן אנחנו זוכרים במקומך.",
  "vehicle.saved.withTask": "הרכב נשמר, ופתחנו תזכורת לטסט ל-{date}.",

  "vehicle.mot.refresh.cta": "לבדוק עדכון במשרד התחבורה",
  "vehicle.mot.conflict.title": "מצאנו תאריך אחר במאגר",
  "vehicle.mot.conflict.body":
    "במשרד התחבורה רשום שתוקף הטסט הוא {motDate}, ואצלך רשום {userDate}. מה לשמור?",
  "vehicle.mot.conflict.keepMine": "להשאיר את התאריך שלי",
  "vehicle.mot.conflict.useMot": "לעדכן לפי המאגר",
  "vehicle.mot.noChange": "אין שינוי — התאריך אצלך מעודכן.",
  "vehicle.mot.filled": "השלמנו {n} שדות ריקים מהמאגר.",

  // ==========================================================================
  // 4. סימון "בוצע" + החידוש האוטומטי
  // ==========================================================================
  // ============================================================================
  // פעולת התיקון על כרטיס ה-overdue — **גלויה ומיידית, בלחיצה אחת.**
  // כשהאפליקציה אומרת משהו בשם החוק והיא טועה, למשתמש חייבת להיות יציאה
  // מיידית — לא דרך מסך המשימה.
  // ============================================================================
  "task.fix.insurance": "כבר חידשתי",
  "task.fix.test": "עשיתי טסט",
  "task.fix.generic": "כבר טיפלתי בזה",

  "task.complete.cta": "סימנתי שביצעתי",
  "task.complete.title": "יופי. רק נוודא שני דברים",
  "task.complete.date.label": "מתי ביצעת?",
  "task.complete.date.today": "היום",
  "task.complete.date.other": "בתאריך אחר",
  "task.complete.km.label": 'כמה ק"מ יש עכשיו?',
  "task.complete.km.hint": "אפשר לדלג — נעדכן בפעם הבאה.",
  "task.complete.km.skip": "דלג",
  "task.complete.confirm": "אישור ושמירה",
  "task.complete.cancel": "חזרה",

  "task.next.heading": "מה יקרה עכשיו",
  "task.next.test": "נפתח לך תזכורת חדשה לטסט של {vehicle} ל-{date} — שנה מהיום שביצעת.",
  "task.next.insurance":
    "נפתח לך תזכורת לחידוש {coverage} של {vehicle} ל-{date} — שנה מהתאריך הקודם, לא מהיום.",
  "task.next.service":
    'נפתח לך תזכורת לטיפול הבא של {vehicle}: {date}, או בסביבות {km} ק"מ — מה שיגיע קודם.',
  "task.next.service.noKm":
    'נפתח לך תזכורת לטיפול הבא של {vehicle} ל-{date}. כשתעדכן ק"מ, נדייק את התאריך.',
  "task.next.repair": "זו משימה חד-פעמית — לא ניצור אחריה משימה חדשה.",
  "task.next.other": "זו משימה חד-פעמית — לא ניצור אחריה משימה חדשה.",
  "task.next.editHint": "התאריך לא מתאים? אפשר לשנות אותו כאן.",
  "task.next.edit": "לשנות את התאריך",
  "task.next.remindLead": "נזכיר לך חודש מראש, ואז שוב כשיתקרב.",

  "task.complete.test.motCheck": "לבדוק את התאריך החדש במשרד התחבורה",
  "task.complete.test.motLoading": "רגע, בודקים במשרד התחבורה…",
  "task.complete.test.motFound": "במאגר רשום שהטסט בתוקף עד {date}. להשתמש בתאריך הזה?",
  "task.complete.test.motUse": "כן, לפי המאגר",
  "task.complete.test.motKeep": "לא, להשאיר {date}",
  "task.complete.test.motMissing":
    "המאגר עוד לא מעודכן — לפעמים לוקח לו כמה ימים. נשתמש בתאריך שחישבנו, ואפשר לתקן בכל רגע.",

  "task.completed.toast": "מעולה. סימנו שביצעת, והתזכורת הבאה כבר מחכה ל-{date}.",
  "task.completed.toast.noNext": "מעולה. סימנו שביצעת.",
  "task.completed.undo": "ביטול הסימון",
  "task.completed.undone": "ביטלנו את הסימון. המשימה חזרה לרשימה.",

  // ==========================================================================
  // 5. מסך החירום — הטקסט הקצר בפרויקט. אדם בהלם קורא אותו.
  // ==========================================================================
  "emergency.title": "חירום",
  "emergency.calm": "הכול כאן. קח רגע.",
  "emergency.vehiclePicker": "באיזה רכב?",
  "emergency.loading": "רגע, טוענים…",

  "emergency.field.plate": "מספר רישוי",
  "emergency.field.vehicle": "הרכב",
  "emergency.field.year": "שנה",
  "emergency.field.color": "צבע",
  "emergency.field.insurer": "חברת הביטוח",
  "emergency.field.policy": "מספר פוליסה",
  "emergency.field.owner": "בעל הרכב",
  "emergency.field.ownerPhone": "טלפון",
  "emergency.field.driver": "הנהג",
  "emergency.field.missing": "לא הוזן",

  "emergency.doc.vehicleLicence": "רישיון הרכב",
  "emergency.doc.compulsory": "ביטוח חובה",
  "emergency.doc.drivingLicence": "רישיון הנהיגה שלי",
  "emergency.doc.open": "הצגה",
  "emergency.doc.missing": "לא הועלה",
  "emergency.doc.add": "להעלות עכשיו",

  "emergency.call.insurer": "חיוג לחברת הביטוח",
  "emergency.call.insurer.missing": "לא הוזן טלפון של חברת הביטוח",
  "emergency.call.insurer.add": "להוסיף טלפון",
  "emergency.call.police": "משטרה 100",
  "emergency.call.mda": 'מד"א 101',

  "emergency.offline.promise": "המסמכים יישמרו על המכשיר שלך כדי שיהיו זמינים בלי אינטרנט.",
  "emergency.offline.now": "אין כרגע אינטרנט. זה מה ששמור אצלך על המכשיר.",
  "emergency.offline.saved": "נשמר אצלך ב-{date}.",
  "emergency.offline.docsUnavailable": "קובצי המסמכים לא זמינים בלי אינטרנט. הפרטים למעלה כן.",

  "emergency.empty.title": "עוד לא הוספת מסמכים",
  "emergency.empty.body":
    "כשתעלה את רישיון הרכב וביטוח החובה, הם יופיעו כאן — גם בלי אינטרנט.",
  "emergency.empty.cta": "העלאת מסמכים",
  "emergency.empty.noVehicle.title": "עוד אין כאן רכב",
  "emergency.empty.noVehicle.body": "ברגע שתוסיף רכב, המסך הזה יהיה מוכן.",
  "emergency.empty.noVehicle.cta": "הוספת רכב",

  // ==========================================================================
  // 6. מצבים מיוחדים — ריק · טעינה · שגיאה
  // ==========================================================================
  "empty.vehicles.title": "בוא נוסיף את הרכב הראשון שלך 🚗",
  "empty.vehicles.body": "מספיק מספר הרישוי — את השאר נמשוך בשבילך.",
  "empty.vehicles.cta": "הוספת רכב",
  "empty.tasks.title": "אין משימות פתוחות ברכב הזה",
  "empty.tasks.body": "כשנדע על טסט או ביטוח, נפתח תזכורת לבד.",
  "empty.tasks.cta": "הוספת משימה",
  "empty.tasksAll.title": "אין כרגע מה לטפל",
  "empty.tasksAll.body": "כל המשימות סגורות. נודיע לך כשיתקרב משהו.",
  "empty.docs.title": "עוד אין כאן מסמכים",
  "empty.docs.body": "רישיון הרכב וביטוח החובה הם ההתחלה — הם גם מה שיופיע במסך החירום.",
  "empty.docs.cta": "העלאת מסמך",
  "empty.docsFilter": "אין מסמכים בקטגוריה הזאת.",
  "empty.docsFilter.cta": "להצגת הכול",
  "empty.personalDocs.title": "רישיון הנהיגה שלך עוד לא כאן",
  "empty.personalDocs.body": "הוא נשמר רק אצלך, ומופיע במסך החירום.",
  "empty.personalDocs.cta": "העלאת רישיון נהיגה",
  "empty.archive.title": "אין רכבים בארכיון",
  "empty.archive.body": "רכב שתעביר לארכיון יופיע כאן, עם כל המסמכים שלו.",
  "empty.search": 'לא מצאנו כלום עבור "{query}".',
  "empty.search.hint": "אפשר לנסות מספר רישוי, כינוי של רכב או שם של מסמך.",

  "loading.generic": "רגע…",
  "loading.dashboard": "רגע, אוספים את הכול…",
  "loading.vehicles": "רגע, טוענים את הרכבים…",
  "loading.vehicle": "רגע, טוענים את הרכב…",
  "loading.tasks": "רגע, טוענים את המשימות…",
  "loading.docs": "רגע, טוענים את המסמכים…",
  "loading.mot": "רגע, מושכים את פרטי הרכב…",
  "loading.emergency": "רגע, טוענים…",
  "loading.saving": "שומרים…",
  "loading.upload": "מעלים את הקובץ…",
  "loading.upload.progress": "מעלים… {n}%",
  "loading.deleting": "מוחקים…",
  "loading.signIn": "רגע, נכנסים…",

  "error.generic.title": "משהו לא הסתדר",
  "error.generic.body": "זו כנראה תקלה זמנית. אפשר לנסות שוב.",
  "error.generic.cta": "לנסות שוב",
  "error.offline.title": "אין כרגע חיבור לאינטרנט",
  "error.offline.body": "מה שכבר שמור אצלך מוצג כאן. נסנכרן ברגע שהחיבור יחזור.",
  "error.offline.cta": "לבדוק שוב",
  "error.load.title": "לא הצלחנו לטעון את המידע",
  "error.load.body": "אפשר לנסות שוב, או לחזור למסך הבית.",
  "error.load.cta.retry": "לנסות שוב",
  "error.load.cta.home": "חזרה לבית",
  "error.save.title": "לא הצלחנו לשמור",
  "error.save.body": "מה שהזנת עדיין כאן, לא איבדת כלום. אפשר לנסות לשמור שוב.",
  "error.save.cta": "לשמור שוב",
  "error.upload.title": "הקובץ לא עלה",
  "error.upload.body": "אפשר לנסות שוב, או לבחור קובץ אחר.",
  "error.upload.cta.retry": "לנסות שוב",
  "error.upload.cta.other": "לבחור קובץ אחר",
  "error.upload.tooLarge": "הקובץ גדול מדי (עד {max}). אפשר לצלם שוב באיכות רגילה.",
  "error.upload.type": "אפשר להעלות תמונה או קובץ PDF.",
  "error.form.required": "צריך למלא את השדה הזה.",
  "error.form.date": "התאריך לא נראה תקין. הפורמט הוא יום.חודש.שנה.",
  "error.form.datePast": "התאריך הזה כבר עבר. זה בסדר?",
  "error.form.number": "כאן צריך מספר.",
  "error.form.phone": "מספר הטלפון לא נראה תקין.",
  "error.form.summary": "יש {n} שדות שצריך לתקן. סימנו אותם.",
  "error.permission.title": "אין לך הרשאה לפעולה הזאת",
  "error.permission.body": "רק בעל החשבון יכול לשנות את זה.",
  "error.permission.cta": "חזרה",
  "error.notFound.title": "לא מצאנו את מה שחיפשת",
  "error.notFound.body": "אולי זה נמחק, או שהרכב עבר לארכיון.",
  "error.notFound.cta": "חזרה לבית",
  "error.session.title": "הכניסה שלך פגה",
  "error.session.body": "צריך להיכנס שוב כדי להמשיך. שום דבר לא אבד.",
  "error.session.cta": "כניסה מחדש",
  "error.delete.title": "לא הצלחנו למחוק",
  "error.delete.body": "אפשר לנסות שוב עוד רגע.",
  // ההודעה שמופיעה כשמנסים להעלות מסמך אישי במצב מקומי. ההחלטה שמאחוריה:
  // base64 של רישיון נהיגה ב-localStorage הוא ת.ז. בטקסט גלוי על הדיסק.
  "error.localMode.docs": "כדי לשמור מסמכים אישיים צריך להתחבר לחשבון.",

  // ==========================================================================
  // 7. Onboarding + כניסה
  // ==========================================================================
  "onboarding.title": "מעכשיו אנחנו זוכרים במקומך",
  "onboarding.sub": "טסט, ביטוח וטיפולים — נזכיר לך בזמן, ולא ניתן לזה ליפול.",
  "onboarding.why": "כל מה שצריך זה מספר הרישוי. דקה אחת עכשיו, ואפשר להפסיק לדאוג.",
  "onboarding.emergency": "ואם קורית תאונה — כל המסמכים כאן, בכפתור אחד.",
  "onboarding.cta": "בוא נתחיל",
  "onboarding.privacyNote": "המסמכים שלך נשמרים בחשבון שלך, ורק מי שנתת לו גישה רואה אותם.",
  "onboarding.privacyLink": "מדיניות הפרטיות",

  // ============================================================================
  // "תרגול חירום" — הנוסח של עדי, סעיף 6.3. **זה לא נספח משפטי, זה מוצר טוב:**
  // מראים למשתמש את מסך החירום בשקט, לפני שהוא צריך אותו, ובאותו מסך בדיוק
  // אומרים את האמת על עוצמת ההגנה בפועל.
  // חובת היידוע המורחבת בתיקון 13 חלה על **אמצעי האבטחה כפי שהם**: אסור
  // שהמשתמש יבין "המסמכים שלי נעולים באפליקציה" כשבפועל הם נעולים במכשיר.
  // המקום שבו זה נקרא הוא כאן — לא בקובץ מדיניות שאיש לא פותח.
  // ============================================================================
  "onboarding.drill.title": "ככה זה ייראה בתאונה",
  "onboarding.drill.body":
    "לחיצה אחת, וכל מה שצריך על המסך: מספר הרישוי, פרטי הביטוח, וטלפון החירום של חברת הביטוח.",
  "onboarding.drill.noticeTitle": "חשוב שתדע:",
  "onboarding.drill.notice1": "המסך הזה נפתח מיד, בלי סיסמה — כדי שיהיה שם כשתצטרך אותו.",
  "onboarding.drill.notice2":
    "מי שמחזיק את הטלפון שלך פתוח יכול לראות אותו. לכן חשוב שיהיה למכשיר שלך נעילת מסך.",
  "onboarding.drill.notice3": "אפשר להתנתק מהאפליקציה בכל רגע דרך ההגדרות.",
  "onboarding.drill.cta": "הבנתי, ממשיכים",

  "auth.title": "כניסה",
  "auth.sub": "בלי סיסמה לזכור.",
  "auth.google": "כניסה עם חשבון Google",
  "auth.error": "הכניסה לא הצליחה. אפשר לנסות שוב.",
  "auth.error.cta": "לנסות שוב",
  "auth.localMode": "מצב הדגמה מקומי",
  "auth.localMode.note": "הנתונים נשמרים רק בדפדפן הזה, ולא נשמרים מסמכים אישיים.",

  // ==========================================================================
  // 8. הגדרות + משפטי
  // ==========================================================================
  "settings.title": "הגדרות",
  "settings.section.profile": "הפרטים שלי",
  "settings.profile.name": "שם",
  "settings.profile.phone": "טלפון",
  "settings.profile.email": "מייל",
  "settings.section.reminders": "תזכורות",
  "settings.reminders.lead": "כמה זמן מראש להזכיר?",
  "settings.reminders.lead.hint":
    "ברירת המחדל: חודש מראש לטסט ולביטוח. אפשר לשנות גם לכל משימה בנפרד.",
  "settings.reminders.lead.month": "חודש מראש",
  "settings.reminders.lead.twoWeeks": "שבועיים מראש",
  "settings.reminders.lead.week": "שבוע מראש",
  "settings.reminders.channels": "איך להזכיר לי",
  "settings.reminders.push": "התראה בטלפון",
  "settings.reminders.sms": "הודעת SMS",
  "settings.reminders.email": "מייל",
  "settings.reminders.soon": "בקרוב",
  "settings.section.emergency": "מסך חירום",
  "settings.emergency.offline": "לשמור את פרטי החירום על המכשיר",
  "settings.emergency.offline.hint":
    "המסמכים יישמרו על המכשיר שלך כדי שיהיו זמינים בלי אינטרנט.",
  "settings.emergency.offline.docs": "לשמור גם את קובצי המסמכים",
  "settings.emergency.offline.docs.hint":
    "תופס יותר מקום במכשיר, אבל המסמכים יהיו זמינים גם בלי קליטה.",
  // ============================================================================
  // הנוסח של עדי, סעיף 6.4. **"textAndDocs" הוא שינוי מהותי, לא הרחבה:** הוא
  // לוקח סריקות של מסמכי זהות שישבו רק בצד השרת מתחת ל-storage.rules, ויוצר
  // עותק מתמיד על המכשיר ששום rule לא שולט בו.
  // ⚠️ המשפט האחרון **חייב להיות אמת** — זה N1. purgeLocalCache ביציאה.
  // ============================================================================
  "settings.emergency.offline.docs.confirm.title": "לשמור גם את המסמכים על הטלפון?",
  "settings.emergency.offline.docs.confirm.body":
    "כך הם יהיו זמינים גם בלי אינטרנט — למשל בכביש בין-עירוני.",
  "settings.emergency.offline.docs.confirm.meaning":
    "המשמעות: עותק של המסמכים יישמר על המכשיר עצמו. הוא יימחק כשתתנתק מהאפליקציה.",
  "settings.emergency.offline.docs.confirm.cta": "כן, לשמור גם מסמכים",
  "settings.emergency.offline.docs.confirm.cancel": "לא, רק את הפרטים",

  "settings.emergency.auth": "לבקש אימות לפני פתיחת מסך החירום",
  "settings.emergency.auth.session": "סשן קיים מספיק",
  "settings.emergency.auth.always": "אימות בכל פתיחה",
  "settings.emergency.auth.soon": "בקרוב",
  "settings.section.display": "תצוגה",
  "settings.display.language": "שפה",
  "settings.display.textSize": "גודל טקסט",
  "settings.section.drivers": "נהגים ברכב",
  "settings.drivers.soon": "בקרוב — אפשר יהיה לצרף בני משפחה ולראות מי נוהג במה.",
  "settings.section.legal": "מידע ומסמכים",
  "settings.legal.privacy": "מדיניות פרטיות",
  "settings.legal.terms": "תנאי שימוש",
  "settings.legal.accessibility": "הצהרת נגישות",
  "settings.legal.about": "על האפליקציה",
  "settings.section.account": "החשבון",
  "settings.account.signOut": "יציאה מהחשבון",
  "settings.account.signOut.confirm": "לצאת מהחשבון? הנתונים יישארו שמורים.",
  "settings.account.delete": "מחיקת החשבון והנתונים",
  "settings.account.delete.confirm.title": "למחוק את החשבון?",
  "settings.account.delete.confirm.body":
    "כל הרכבים, המשימות והמסמכים יימחקו לצמיתות. אי אפשר לשחזר.",
  "settings.account.delete.confirm.cta": "כן, למחוק הכול",
  "settings.account.delete.cancel": "לא, חזרה",
  "settings.account.delete.done": "הנתונים נמחקו.",
  // N6 — זכות העיון של תיקון 13. גלוי במסך, לא מוסתר.
  "settings.account.export": "ייצוא הנתונים שלי",
  "settings.account.export.hint": "קובץ אחד עם כל הרכבים, המשימות והמסמכים שרשומים אצלך.",
  "settings.account.export.cta": "להוריד את הקובץ",
  "settings.account.export.done": "הקובץ ירד אליך.",
  "settings.version": "גרסה {n}",

  "legal.notice.title": "לפני שמתחילים",
  "legal.notice.body": "כאן כתוב איזה מידע נשמר, איפה הוא נשמר, ומי יכול לראות אותו. שווה דקה.",
  "legal.notice.privacy": "מדיניות הפרטיות",
  "legal.notice.terms": "תנאי השימוש",
  // ⚠️ "קראתי", לא "אני מסכים" — הכרעה של עדי. לא לשנות בליטוש.
  "legal.notice.cta": "קראתי",
  "legal.notice.hint": "הכפתור מאשר שראית את המסמכים. אפשר לחזור אליהם בכל רגע מההגדרות.",
  "legal.notice.reopen": "לקריאה חוזרת",
  "legal.notice.updated": "עדכנו את המסמכים. שווה להעיף מבט.",

  "legal.disclaimer.mot":
    "פרטי הרכב מגיעים ממאגר ציבורי של משרד התחבורה. NRCAR לא מאמת בעלות ולא מחליף מסמך רשמי.",
  "legal.disclaimer.reminders":
    "התזכורות הן עזר בלבד. האחריות לעמידה במועדים נשארת אצל בעל הרכב.",
  "legal.disclaimer.docs": "המסמכים נשמרים בחשבון שלך ונגישים רק למי שנתת לו גישה.",
  "legal.disclaimer.personalDocs": "רישיון הנהיגה שלך נשמר רק אצלך. גם בעל החשבון לא רואה אותו.",
  "legal.disclaimer.emergency":
    "המסך הזה מציג את מה ששמרת. הוא לא מחליף מסמך מקורי ולא קורא לשירותי חירום בעצמו.",
  "legal.retention.pending": "תקופת השמירה טרם נקבעה.",

  // ==========================================================================
  // 9. ניווט תחתון — אייקון **ועוד** טקסט, תמיד.
  // ==========================================================================
  "nav.home": "בית",
  "nav.vehicles": "רכבים",
  "nav.docs": "מסמכים",
  "nav.emergency": "חירום",
  "nav.settings": "הגדרות",
  "nav.home.aria": "מסך הבית",
  "nav.vehicles.aria": "הרכבים שלי",
  "nav.docs.aria": "המסמכים שלי",
  "nav.emergency.aria": "מסך חירום — המסמכים לזירת תאונה",
  "nav.settings.aria": "הגדרות",
  "nav.main.aria": "ניווט ראשי",
  "nav.back": "חזרה",
  "nav.add": "הוספה",
  "nav.add.vehicle": "רכב חדש",
  "nav.add.task": "משימה חדשה",
  "nav.add.doc": "מסמך חדש",
  "nav.add.close": "סגירה",

  // ==========================================================================
  // 10. רשימות סגורות
  // ==========================================================================
  "task.type.test": "טסט",
  "task.type.insurance": "חידוש ביטוח",
  "task.type.insurance.short": "ביטוח",
  "task.type.service": "טיפול",
  "task.type.repair": "תיקון",
  "task.type.other": "אחר",
  "task.type.select": "מה צריך לעשות?",
  "task.title.label": "על מה מדובר?",
  "task.title.hint": "למשל: החלפת צמיגים",

  "tag.insurance": "ביטוח",
  "tag.maintenance": "תחזוקה",
  "tag.authorities": "רשויות",
  "tag.money": "כספים",
  "tag.other": "אחר",
  "tag.select": "תגית",
  "tag.none": "בלי תגית",

  "doc.type.vehicleLicence": "רישיון רכב",
  "doc.type.compulsory": "ביטוח חובה",
  "doc.type.comprehensive": "ביטוח מקיף",
  "doc.type.testCertificate": "אישור טסט",
  "doc.type.serviceReport": "דוח טיפול",
  "doc.type.receipt": "קבלה",
  "doc.type.drivingLicence": "רישיון נהיגה",
  "doc.type.other": "אחר",
  "doc.type.select": "איזה מסמך זה?",

  "doc.filter.all": "הכול",
  "doc.filter.licences": "רישיונות",
  "doc.filter.insurance": "ביטוח",
  "doc.filter.service": "טיפולים",
  "doc.filter.receipts": "קבלות",

  "doc.visibility.shared": "זמין גם לנהגים ברכב",
  "doc.visibility.owner": "רק אני רואה את זה",
  "doc.visibility.personal": "אישי — רק אתה רואה את זה",
  "doc.validUntil": "בתוקף עד {date}",
  "doc.badge.expired": "פג תוקף",
  "doc.badge.expiring": "מתקרב לסיום",
  "doc.expired.body": "התוקף של {document} נגמר ב-{date}. פתחנו לך משימת חידוש.",
  "doc.expiring.body": "התוקף של {document} נגמר ב-{date}.",
  "doc.upload.cta": "העלאת מסמך",
  "doc.upload.camera": "צילום מסמך",
  "doc.upload.file": "בחירת קובץ",
  "doc.uploaded.toast": "המסמך נשמר.",
  "doc.delete.confirm": "למחוק את {document}? אי אפשר לשחזר.",

  "vehicle.status.active": "פעיל",
  "vehicle.status.archived": "בארכיון",
  "vehicle.archive.cta": "הרכב כבר לא אצלי",
  "vehicle.archive.confirm.title": "להעביר את {vehicle} לארכיון?",
  "vehicle.archive.confirm.body":
    "התזכורות ייפסקו, אבל המסמכים וההיסטוריה יישמרו. אפשר להחזיר בכל רגע.",
  "vehicle.archive.confirm.cta": "כן, לארכיון",
  "vehicle.archived.toast": "{vehicle} עבר לארכיון.",
  "vehicle.restore.cta": "להחזיר לרכבים שלי",
  "vehicle.restored.toast": "{vehicle} חזר לרכבים שלך.",
  "vehicle.delete.cta": "מחיקה לצמיתות",
  "vehicle.delete.confirm.title": "למחוק את {vehicle} לגמרי?",
  "vehicle.delete.confirm.body":
    "כל המשימות והמסמכים של הרכב יימחקו ואי אפשר לשחזר. אם רק מכרת אותו — עדיף ארכיון.",
  "vehicle.delete.confirm.cta": "כן, למחוק הכול",

  "common.save": "שמירה",
  "common.cancel": "ביטול",
  "common.back": "חזרה",
  "common.close": "סגירה",
  "common.edit": "עריכה",
  "common.delete": "מחיקה",
  "common.add": "הוספה",
  "common.done": "סיום",
  "common.next": "הבא",
  "common.yes": "כן",
  "common.no": "לא",
  "common.retry": "לנסות שוב",
  "common.skip": "דלג",
  "common.optional": "לא חובה",
  "common.notSet": "לא הוזן",
  "common.today": "היום",
  "common.tomorrow": "מחר",
  "common.km": 'ק"מ',
  "common.more": "עוד",
  "common.language": "English",

  // ==========================================================================
  // 11. תוספות מבניות למסכים (לא היו בטבלאות של שירה — נדרשות לפריסה).
  // ==========================================================================
  // תתי-לשוניות בדף הרכב. כאן **כן** role="tab" — זה תוכן שמתחלף באותו עמוד,
  // בניגוד לניווט התחתון שהוא מעבר בין מסכים.
  "vehicle.tab.tasks": "משימות",
  "vehicle.tab.docs": "מסמכים",
  "vehicle.tab.details": "פרטים",
  "vehicle.tabs.aria": "תוכן הרכב",
  "vehicle.details.mot": "מקור הפרטים",
  "vehicle.details.mot.fetched": "נמשך ממשרד התחבורה ב-{date}",
  "vehicle.details.mot.manual": "הוזן ידנית",
  "vehicle.addTask": "הוספת משימה",
  "vehicle.addDoc": "העלאת מסמך",
  "vehicles.archived.title": "רכבים בארכיון",
  "vehicles.archived.show": "להצגת הארכיון",
  "vehicles.archived.hide": "להסתיר את הארכיון",

  "task.field.vehicle": "לאיזה רכב?",
  "task.field.dueDate": "תאריך יעד",
  "task.field.coverage": "איזה ביטוח?",
  "task.field.leadDays": "כמה זמן מראש להזכיר?",
  "task.form.title.new": "משימה חדשה",
  "task.form.title.edit": "עריכת משימה",
  "task.markInProgress": "קבעתי תור",
  "task.unmarkInProgress": "לבטל את הסימון",
  "task.mute": "לא להזכיר לי על זה",
  "task.unmute": "להחזיר תזכורות",

  "doc.field.vehicle": "לאיזה רכב?",
  "doc.field.validUntil": "בתוקף עד",
  "doc.field.title": "שם המסמך",
  "doc.viewer.title": "תצוגת מסמך",
  "doc.viewer.hint": "אפשר להגדיל בשתי אצבעות.",
  "doc.viewer.failed": "לא הצלחנו לפתוח את המסמך.",
  "doc.personal.title": "רישיון הנהיגה שלי",
  "doc.personal.hint": "נשמר רק אצלך. גם בעל החשבון לא רואה אותו.",

  // הצהרת נגישות — **המסגרת בלבד.** הנוסח המחייב הוא של עדי (⚖️ L1), והוא
  // מתפרסם רק אחרי שהתיקונים בוצעו בפועל. הצהרה שמקדימה את המימוש היא מצג שווא.
  "accessibility.title": "הצהרת נגישות",
  "accessibility.standard": "האפליקציה נבנתה לפי ת\"י 5568 ברמה AA.",
  "accessibility.knownLimits.title": "מגבלות ידועות",
  "accessibility.knownLimits.docs":
    "מסמכים סרוקים שאתה מעלה אינם נגישים לקורא מסך. שדות המפתח — מספר רישוי, חברת ביטוח, מספר פוליסה ותאריכים — זמינים תמיד גם כטקסט.",
  "accessibility.contact.title": "פנייה בנושא נגישות",
  "accessibility.pending.title": "הנוסח המלא בהכנה",
  "accessibility.pending.body":
    "פרטי רכז הנגישות והנוסח המשפטי המלא יתפרסמו כאן לפני שהאפליקציה עולה לאוויר.",

  "emergency.quickCall": "חיוג מהיר",
  "emergency.drill.cta": "לראות איך נראה מסך החירום",
  "emergency.attribution": "המסך מציג את מה ששמרת באפליקציה.",

};
