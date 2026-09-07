// ============================================================================
// importInsurance.js — הפיכת אקסל הביטוחים של ויצמן ל-payload. פונקציה טהורה.
//
// באותה תבנית כמו `importWorkbook.js`: מקבלת חוברת SheetJS, מחזירה
// `{ ok, checks, failed, payload, report }`, **לא זורקת ולא יוצאת מהתהליך**,
// ורצה גם ב-CLI וגם בדפדפן — כדי שלא ייווצרו שני מסלולי ייבוא שיכולים להיפרד.
//
// ⚠ **הייבוא הזה מוסיף אוסף, ואינו מחליף את המערכת.** הקורא חייב להחיל אותו
// דרך `applyBatch("policies", …)` ולעולם לא דרך `replaceAll`: קובץ הביטוחים
// אינו מכיל בניינים, חוזים או הערות, ו-`replaceAll` עליו היה מוחק אותם.
//
// ⚠ **הפרמיות אינן נכנסות לרווחיות.** ראה את ההסבר בראש `policies.js` —
// 898,940 ₪ בשנה, שרובם כסף של הוועד ולא של ויצמן.
// ============================================================================

import { addressKey } from "./id.js";

/**
 * ⚠ **שלוש השורות האחרונות בקובץ אינן פוליסות אלא מקרא צבעים.**
 *
 * זה לא נראה בקריאה שטחית: הן מתחילות באמצע השורה, בעמודות ״מספר בית״
 * ו״מספר דירות״, ולכן `sheet_to_json` מחזיר אותן כשורות תקינות לכל דבר —
 * ״סימון צהוב | ויצמן משלמים״. ספירתן הייתה נותנת 142 פוליסות במקום 139,
 * ומייצרת שלוש רשומות בלי כתובת, בלי תאריך ובלי סכום, שהיו יושבות לנצח
 * בתור ״חסרות שיוך״.
 *
 * המקרא עצמו הוא **מידע אמיתי שאבד**: הוא מלמד שההדגשה בצהוב פירושה
 * ״ויצמן משלמים״, בירוק ״משלמים חלקית״ ובאדום ״דואגים לתשלום מחשבון הוועד״.
 * שתי המשמעויות האחרונות אינן קיימות בשום עמודה — הן קיימות **רק בצבע**.
 * לכן הן נרשמות בדוח כשאלה פתוחה לרונן, ולא מומצאות כערך.
 */
const LEGEND_MARKERS = ["סימון צהוב", "סימון ירוק", "אדום", "ויצמן משלמים"];

/** תרגום סריאל אקסל (epoch 1899-12-30) ל-ISO. מחרוזת תאריך מתקבלת כמות שהיא. */
function toISO(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 0) return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // "31/07/2026" ו-"31.7.26" — שני הכתיבים שמופיעים בקבצים של המשרד
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const yyyy = y.length === 2 ? `20${y}` : y;
  const p = (n) => String(n).padStart(2, "0");
  return `${yyyy}-${p(mo)}-${p(d)}`;
}

const txt = (v) => (v == null ? "" : String(v).trim().replace(/\s+/g, " "));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * ״קיים-מבנה״ → תלת-ערכי.
 * ⚠ ״כו״ הוא שגיאת הקלדה של ״כן״, אבל **לא מתוקן אוטומטית**: הפרש של אות
 * אחת בין ״כן״ ל״לא״ אינו ראיה. חוזר `null` = ״לא ידוע״, ונרשם בדוח.
 */
function toStructure(v) {
  const s = txt(v);
  if (s === "כן") return true;
  if (s === "לא") return false;
  return null;
}

/** ״ועד״ → הבניין משלם · ״ויצמן״ → ויצמן משלמת · כל השאר → לא ידוע. */
function toPayer(v) {
  const s = txt(v);
  if (s === "ויצמן") return "vitzman";
  if (s === "ועד" || s === "הועד" || s === "הוועד") return "building";
  return null;
}

/**
 * מיפוי הכותרות.
 *
 * ⚠ **שתי עמודות נושאות את הכותרת ״הערות״.** הראשונה היא טקסט חופשי
 * ("אנחנו מחדשים מחשבון הבנק של הועד"), השנייה היא **מי משלם** (ועד/ויצמן).
 * חיפוש לפי שם היה מחזיר את אותה עמודה פעמיים ומאבד את עמודת המשלם לגמרי —
 * ולכן ההבחנה היא **לפי סדר ההופעה**, לא לפי השם.
 *
 * ⚠ **לעמודת הסוכנות אין כותרת בכלל.** היא העמודה שאחרי ״הערות״ השנייה.
 * חיפוש שם היה מחזיר -1 בשקט, וכל 102 המופעים של ״ברעוז״ היו נעלמים.
 */
function mapHeaders(header) {
  const cells = header.map(txt);
  const find = (name, from = 0) => {
    const i = cells.findIndex((c, idx) => idx >= from && c === name);
    return i;
  };
  const notes1 = find("הערות");
  const notes2 = notes1 >= 0 ? find("הערות", notes1 + 1) : -1;
  return {
    customerNumber: find("מספר לקוח"),
    committeeName: find("שם הועד"),
    committeePhone: find("נייד הוועד"),
    city: find("עיר"),
    street: find("רחוב"),
    houseNumber: find("מספר בית"),
    unitCount: find("מספר דירות"),
    insurerName: find("שם חברה"),
    startDate: find("תאריך התחלת ביטוח"),
    endDate: find("תאריך סיום ביטוח"),
    premiumAnnual: find("סכום"),
    hasStructureCover: find("קיים-מבנה"),
    notes: notes1,
    payer: notes2,
    // ללא כותרת — נגזרת מהמיקום
    agencyName: notes2 >= 0 ? notes2 + 1 : -1,
  };
}

const REQUIRED_HEADERS = ["city", "street", "insurerName", "endDate", "premiumAnnual"];

/**
 * ⚠ **שני הגיליונות כותבים את אותה כתובת אחרת, ולא במקרה אחד אלא בשישה
 * דפוסים.** זו אותה נקודת כשל שהפילה את האקסל מלכתחילה — הכתובת כמפתח:
 *
 *   · שם רחוב מלא מול מקוצר — ״אהרוני ישראל 10״ מול ״אהרוני 10״
 *   · מחבר שונה לבניין מרובה-כניסות — ״קציר 21/הרשקו 8״ מול ״הרשקו8+קציר 21״
 *   · עיר שנדבקה לכתובת — ״החושן 7 נס ציונה״
 *   · אות לפני המספר במקום אחרי — ״הר הצופים ג7״ מול ״הר הצופים 7ג״
 *   · נקודה בראשי תיבות — ״ש בן ציון 14״ מול ״ש. בן ציון 14״
 *   · שם הבניין כקידומת — ״מגדלי המוזיאון יעקב 32-34״ מול ״יעקב 32-34״
 *
 * השוואת מחרוזות מצאה 81 מתוך 139; פירוק לזוגות ⟨רחוב, מספר⟩ מוצא 116.
 * ⚠ **הפירוק אינו מרשה יותר חופש — הוא מרשה פחות:** ההתאמה נדרשת להיות
 * **חד-חד-ערכית בשני הכיוונים**, ולכן ״אינשטיין 12״ **אינה** מותאמת ל״אינשטיין
 * 12+14״. בניין אחד ושתי כניסות הוא בדיוק המקום שבו שיוך שגוי היה שקט.
 */
const CITY_SUFFIXES = ["נס ציונה", "ראשון לציון", "ראשלצ", "רחובות"];

/** ⟨רחוב, מספר⟩ לכל כניסה שבכתובת. ״הרשקו 2 +ברמן 8״ → שני זוגות. */
export function addressParts(raw) {
  let s = addressKey(raw).replace(/\./g, " ").replace(/\s+/g, " ").trim();
  for (const c of CITY_SUFFIXES) {
    const k = addressKey(c);
    if (s.endsWith(` ${k}`)) s = s.slice(0, -k.length - 1).trim();
  }
  const out = [];
  let lastStreet = "";
  for (const seg of s.split(/[/+,;]+/).map((x) => x.trim()).filter(Boolean)) {
    // ״ג7״ → ״7ג״: אות לפני המספר היא אותו בניין, לא בניין אחר
    const t = seg.replace(/(?:^|\s)([א-ת])(\d+)$/, (_, letter, n) => ` ${n}${letter}`).trim();
    const m = t.match(/^(.*?)\s*(\d+\s*[א-ת]?(?:-\d+\s*[א-ת]?)?)$/);
    if (!m) continue;                       // ״בנייני גינדי״ — תיאור בלי מספר
    const street = m[1].trim() || lastStreet;   // ״כהנמן 5+7״: ה-7 יורש את הרחוב
    if (m[1].trim()) lastStreet = m[1].trim();
    if (street) out.push({ street, no: m[2].replace(/\s+/g, "") });
  }
  return out;
}

/**
 * ⚠ **שקילות שמות רחוב היא הסכמה בין ווריאנטים של אותו שם, ולא דמיון.**
 * מילות השם הקצר חייבות להופיע **בסדרן** בשם הארוך: ״קציר״ ⊂ ״אפרים קציר״.
 * ״גורודיסקי״ ו״גורודסקי״ **אינן** שקולות — אות שונה היא שם אחר, וההכרעה
 * עליהן היא של רונן. זה אותו קו בדיוק שנמתח ב״פניקס״ מול ״הפניקס״.
 */
function streetEquivalent(a, b) {
  if (a === b) return true;
  const wa = a.split(" ").filter(Boolean);
  const wb = b.split(" ").filter(Boolean);
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  let i = 0;
  for (const w of long) if (w === short[i]) i += 1;
  return i === short.length;
}

const samePart = (a, b) => a.no === b.no && streetEquivalent(a.street, b.street);

/** התאמה מלאה: אותו מספר כניסות, וזיווג חד-חד-ערכי ביניהן. */
function partsMatch(policyParts, buildingParts) {
  if (!policyParts.length || policyParts.length !== buildingParts.length) return false;
  const used = new Set();
  for (const p of policyParts) {
    const j = buildingParts.findIndex((b, i) => !used.has(i) && samePart(b, p));
    if (j < 0) return false;
    used.add(j);
  }
  return true;
}

/**
 * התאמת פוליסה לבניין קיים.
 *
 * ⚠ **לא משייך מקרה דו-משמעי.** `exact` רק כשההתאמה המלאה מחזירה בניין אחד
 * ויחיד; חפיפה חלקית חוזרת כ-`candidates` להכרעת רונן במסך. זה אותו כלל
 * שנקבע למיזוג הכתובות בייבוא הראשון, ומאותה סיבה: שיוך שגוי בשקט גרוע
 * מחוסר שיוך, כי איש לא יחפש אותו.
 *
 * ⚠ **העיר אינה חוסמת התאמה.** בתחילה היא כן חסמה — בהנחה שכל הבניינים
 * ברחובות. ההנחה שגויה: ברשימת הבניינים יש ״החושן 7 נס ציונה״ ו״הצבר 25
 * ראשל״צ״. החסימה עלתה 13 התאמות נכונות ולא מנעה אף שגויה.
 */
export function matchPolicyToBuilding(policy, buildings, index = null) {
  const parts = addressParts(`${policy.street || ""} ${policy.houseNumber || ""}`.trim());
  if (!parts.length) return { kind: "none", buildingId: null, candidates: [] };
  const idx = index || buildBuildingIndex(buildings);

  const full = idx.filter((b) => partsMatch(parts, b.parts));
  if (full.length === 1) {
    return { kind: "exact", buildingId: full[0].id, candidates: [full[0].building], literal: full[0].literal === addressKey(`${policy.street} ${policy.houseNumber}`.trim()) };
  }

  const overlap = idx
    .map((b) => ({ b, n: parts.filter((p) => b.parts.some((q) => samePart(q, p))).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.b.parts.length - b.b.parts.length);
  if (!overlap.length) return { kind: "none", buildingId: null, candidates: [] };
  return { kind: "candidates", buildingId: null, candidates: overlap.slice(0, 5).map((x) => x.b.building) };
}

/** פירוק הבניינים פעם אחת, ולא לכל פוליסה מחדש. */
export function buildBuildingIndex(buildings) {
  return (buildings || []).map((b) => ({
    id: b.id,
    building: b,
    literal: addressKey(b.address),
    parts: addressParts(b.address),
  }));
}

/**
 * @param {object} wb  חוברת SheetJS
 * @param {string} sourceName  שם הקובץ, לתיעוד
 * @param {object[]} buildings  הבניינים שכבר במערכת, להתאמה. ריק = בלי התאמה.
 */
export function importInsurance(wb, sourceName = "insurance.xlsx", buildings = []) {
  const sheetName = (wb?.SheetNames || [])[0] || null;
  if (!sheetName || !wb.Sheets?.[sheetName]) {
    return {
      ok: false, checks: [], failed: [{ name: "לא נמצא גיליון בקובץ", actual: "(אין)", expected: "גיליון אחד" }],
      payload: null, report: null,
      error: "הקובץ אינו מכיל גיליון קריא. ודא שזה קובץ האקסל של הביטוחים.",
    };
  }
  const rows = sheetToRows(wb.Sheets[sheetName]);

  if (!rows.length) {
    return {
      ok: false, checks: [], failed: [{ name: "הגיליון ריק", actual: 0, expected: "לפחות שורה אחת" }],
      payload: null, report: null, error: `הגיליון ״${sheetName}״ ריק.`,
    };
  }

  const col = mapHeaders(rows[0]);
  const missing = REQUIRED_HEADERS.filter((k) => col[k] < 0);
  if (missing.length) {
    return {
      ok: false, checks: [],
      failed: [{ name: "כותרות חסרות", actual: rows[0].map(txt).filter(Boolean).join(" · "), expected: missing.join(" · ") }],
      payload: null, report: null,
      error:
        `לא נמצאו הכותרות: ${missing.join(", ")}. ` +
        `הכותרות שנמצאו בשורה הראשונה: ${rows[0].map(txt).filter(Boolean).map((h) => `״${h}״`).join(", ") || "(אין)"}.`,
    };
  }

  const at = (r, k) => (col[k] >= 0 ? r[col[k]] ?? null : null);

  // --- סיווג השורות ---------------------------------------------------------
  const policies = [];
  const legendRows = [];
  const blankRows = [];
  const anomalies = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const sheetRow = i + 1;
    if (r.every((c) => c === null || c === "")) { blankRows.push(sheetRow); continue; }

    // מקרא: אין כתובת, אין עיר ואין מספר לקוח — או שאחד התאים נושא נוסח מקרא.
    const looksLegend =
      (!txt(at(r, "city")) && !txt(at(r, "street")) && !txt(at(r, "customerNumber"))) ||
      LEGEND_MARKERS.some((m) => r.some((c) => txt(c) === m));
    if (looksLegend) {
      legendRows.push({ sheetRow, text: r.map(txt).filter(Boolean).join(" | ") });
      continue;
    }

    const structureRaw = txt(at(r, "hasStructureCover"));
    const hasStructureCover = toStructure(at(r, "hasStructureCover"));
    if (structureRaw && hasStructureCover === null) {
      anomalies.push({ sheetRow, field: "קיים-מבנה", raw: structureRaw, kept: "null (לא ידוע)" });
    }
    const unitsRaw = at(r, "unitCount");
    if (unitsRaw != null && unitsRaw !== "" && num(unitsRaw) === null) {
      anomalies.push({ sheetRow, field: "מספר דירות", raw: txt(unitsRaw), kept: "null" });
    }
    const endRaw = at(r, "endDate");
    if (endRaw != null && endRaw !== "" && !toISO(endRaw)) {
      anomalies.push({ sheetRow, field: "תאריך סיום", raw: txt(endRaw), kept: "null" });
    }

    const street = txt(at(r, "street"));
    const house = txt(at(r, "houseNumber"));
    policies.push({
      buildingIds: [],
      insurerName: txt(at(r, "insurerName")),
      agencyName: txt(at(r, "agencyName")),
      payer: toPayer(at(r, "payer")),
      /**
       * ⚠ **הקובץ אינו יודע לומר אם הביטוח כלול בדמי הניהול.** אין בו עמודה
       * כזו, והשאלה שרונן שאל אינה נגזרת ממי משלם: ויצמן יכולה לשלם ולחייב
       * בנפרד. `null` = טרם נקבע, ורונן מסמן במסך.
       */
      includedInFee: null,
      startDate: toISO(at(r, "startDate")),
      endDate: toISO(endRaw),
      premiumAnnual: num(at(r, "premiumAnnual")),
      hasStructureCover,
      city: txt(at(r, "city")),
      street,
      houseNumber: house,
      sourceAddress: `${street} ${house}`.trim(),
      unitCount: num(unitsRaw),
      customerNumber: txt(at(r, "customerNumber")),
      committeeName: txt(at(r, "committeeName")),
      committeePhone: txt(at(r, "committeePhone")),
      notes: txt(at(r, "notes")),
      sourceRow: sheetRow,
    });
  }

  // --- התאמה לבניינים ------------------------------------------------------
  const index = buildBuildingIndex(buildings);
  const matches = { exact: 0, candidates: 0, none: 0 };
  const unmatched = [];
  /**
   * ⚠ התאמה שנעשתה דרך **ווריאנט של שם** ולא דרך זהות מחרוזות נרשמת בנפרד
   * ומודפסת בדוח. הכלל אינו ״להתאים רק כשבטוח״ אלא ״להתאים כשבטוח **ולומר
   * על מה הסתמכנו**״ — 22 השורות האלה הן מה שרונן צריך לעבור עליו, ולא 116.
   */
  const variantMatches = [];
  for (const p of policies) {
    const m = matchPolicyToBuilding(p, buildings, index);
    matches[m.kind] += 1;
    if (m.kind === "exact") {
      p.buildingIds = [m.buildingId];
      if (!m.literal) {
        const b = index.find((x) => x.id === m.buildingId);
        variantMatches.push({ sourceRow: p.sourceRow, policy: p.sourceAddress, building: b?.building?.address || "" });
      }
    } else {
      unmatched.push({
        sourceRow: p.sourceRow, address: p.sourceAddress, city: p.city,
        candidates: m.candidates.map((c) => c.address),
      });
    }
  }

  // --- מבחנים ---------------------------------------------------------------
  //
  // ⚠ אותה הבחנה כמו בייבוא הבניינים: `check` = **עקביות פנימית** (נגזרת
  // מהקובץ, תקפה לכל גרסה שלו, וכישלון בה חוסם). `info` = ספירות של הגרסה
  // הזו (139 פוליסות, 29 שפגו) — צילום מצב, ולכן **לא חוסמות**. אילו היו
  // חוסמות, פוליסה אחת שרונן יוסיף לקובץ הייתה פוסלת ייבוא תקין לחלוטין.
  const checks = [];
  const info = (name, actual, note = "לידיעה") =>
    checks.push({ name, actual, expected: note, ok: true, informational: true });
  const check = (name, actual, expected) =>
    checks.push({ name, actual, expected, ok: actual === expected, informational: false });

  const accounted = policies.length + legendRows.length + blankRows.length;
  check("כל שורות הגיליון סווגו", accounted, rows.length - 1);
  check("לכל פוליסה יש שורת מקור", policies.filter((p) => p.sourceRow).length, policies.length);
  check("כל תאריך שנקלט תקין", policies.filter((p) => p.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(p.endDate)).length, 0);
  check("כל פוליסה שהותאמה שויכה לבניין אחד",
    policies.filter((p) => p.buildingIds.length > 1).length, 0);

  const priced = policies.filter((p) => p.premiumAnnual != null);
  const annualPremium = Math.round(priced.reduce((a, p) => a + p.premiumAnnual, 0) * 100) / 100;
  info("פוליסות", policies.length);
  info("שורות מקרא שדולגו", legendRows.length, legendRows.length ? "צבע = מי משלם" : "לידיעה");
  info("סה\"כ פרמיה שנתית", annualPremium, `${priced.length} פוליסות עם סכום`);
  info("ללא סכום", policies.length - priced.length);
  info("ללא תאריך סיום", policies.filter((p) => !p.endDate).length);
  info("ללא ציון מי משלם", policies.filter((p) => !p.payer).length);
  info("הותאמו לבניין קיים", matches.exact, buildings.length ? "לידיעה" : "לא הועברו בניינים");
  info("דורשות הכרעה ידנית", matches.candidates + matches.none);

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) return { ok: false, checks, failed, payload: null, report: null };

  const report = buildReport({
    sourceName, sheetName, rows: rows.length, policies, legendRows, blankRows,
    anomalies, annualPremium, priced: priced.length, matches, unmatched, variantMatches,
  });

  return {
    ok: true,
    checks,
    failed: [],
    payload: {
      policies,
      meta: {
        sourceFile: sourceName,
        importedAt: new Date().toISOString(),
        sheetName,
        checks,
        legendRows,
        anomalies,
        variantMatches,
        unmatched,
      },
    },
    report,
  };
}

/** קריאת גיליון לשורות בלי SheetJS — כדי שהמנוע יישאר בלי תלות. */
function sheetToRows(ws) {
  const ref = ws["!ref"];
  if (!ref) return [];
  const m = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return [];
  const colNum = (s) => s.split("").reduce((a, c) => a * 26 + (c.charCodeAt(0) - 64), 0);
  const colName = (n) => { let s = ""; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; } return s; };
  const [, c1, r1, c2, r2] = m;
  const out = [];
  for (let r = Number(r1); r <= Number(r2); r++) {
    const row = [];
    for (let c = colNum(c1); c <= colNum(c2); c++) {
      const cell = ws[`${colName(c)}${r}`];
      row.push(cell ? (cell.v ?? null) : null);
    }
    out.push(row);
  }
  return out;
}

function buildReport(d) {
  const nf = (n) => (n == null ? "—" : Number(n).toLocaleString("he-IL"));
  return `# ייבוא ביטוחים — ${d.sourceName}

גיליון: \`${d.sheetName}\` · ${d.rows} שורות · **${d.policies.length} פוליסות**.

---

## 1 · שלוש השורות שאינן פוליסות

הקובץ מסתיים ב**מקרא צבעים**, לא בנתונים. השורות מתחילות באמצע השורה ולכן
נראות כרשומות תקינות; ספירתן הייתה נותנת ${d.policies.length + d.legendRows.length}
פוליסות במקום ${d.policies.length}.

${d.legendRows.length ? `| שורה | תוכן |
|---|---|
${d.legendRows.map((l) => `| ${l.sheetRow} | ${l.text} |`).join("\n")}` : "— לא נמצאו"}

⚠ **המקרא מלמד שהצבע נושא מידע שאין באף עמודה:** ירוק = ״ויצמן משלמים חלקית
לפי מה שכתוב״, אדום = ״ויצמן משלמים, דואגים לתשלום מחשבון הוועד״. שתי
המשמעויות האלה **אינן ניתנות לייבוא** — הן קיימות רק בצבע התא. הן נשארות
שאלה פתוחה, ולא הומצא עבורן ערך.

---

## 2 · סיכום

| | |
|---|---|
| פוליסות | ${d.policies.length} |
| סה״כ פרמיה שנתית | **${nf(d.annualPremium)} ₪** (${d.priced} עם סכום) |
| ללא סכום | ${d.policies.length - d.priced} |
| ללא תאריך סיום | ${d.policies.filter((p) => !p.endDate).length} |
| ללא ציון מי משלם | ${d.policies.filter((p) => !p.payer).length} |

⚠ **הפרמיה אינה עלות של ויצמן ואינה נכנסת לרווחיות.** ברוב השורות הוועד משלם
ישירות. אין לפוליסה \`categoryId\` ואין לה נתיב אל \`buildingCost\`.

---

## 3 · התאמה לבניינים

| | |
|---|---|
| התאמה ודאית | ${d.matches.exact} |
| מועמדים (דו-משמעי) | ${d.matches.candidates} |
| ללא התאמה | ${d.matches.none} |

**שיוך דו-משמעי לא נעשה אוטומטית.** ${d.unmatched.length} פוליסות נשארות בלי
בניין, וממתינות להכרעה במסך ההתאמה.

${d.unmatched.length ? `| שורה | כתובת בקובץ | עיר | מועמדים |
|---|---|---|---|
${d.unmatched.map((u) => `| ${u.sourceRow} | ${u.address || "—"} | ${u.city || "—"} | ${u.candidates.join(" · ") || "—"} |`).join("\n")}` : ""}

### התאמות שנשענו על ווריאנט של שם (${d.variantMatches.length})

שתי הרשימות כותבות את אותה כתובת אחרת. ההתאמות האלה **נעשו**, כי הזיווג בין
הכניסות היה חד-חד-ערכי — ומודפסות כאן כדי שתעבור עליהן, ולא על כל ${d.matches.exact}.

${d.variantMatches.length ? `| שורה | בקובץ הביטוחים | ברשימת הבניינים |
|---|---|---|
${d.variantMatches.map((v) => `| ${v.sourceRow} | ${v.policy} | ${v.building} |`).join("\n")}` : "— אין"}

---

## 4 · תאים שלא נקלטו כערך

${d.anomalies.length ? `| שורה | שדה | בקובץ | נשמר |
|---|---|---|---|
${d.anomalies.map((a) => `| ${a.sheetRow} | ${a.field} | \`${a.raw}\` | ${a.kept} |`).join("\n")}` : "— אין"}

״כו״ בעמודת ״קיים-מבנה״ הוא ככל הנראה שגיאת הקלדה של ״כן״, **ולא תוקן**:
אות אחת מפרידה בין ״כן״ ל״לא״, וזו אינה ראיה.

---

## 5 · מה הקובץ אינו יודע

- **״כלול בדמי הניהול״** — אין עמודה כזו. זו שאלה נפרדת מ״מי משלם״, והיא
  נשארת \`null\` עד שרונן יסמן במסך.
- **תוכן הכיסוי** — ״קיים-מבנה״ הוא הסימון היחיד, והוא חסר ב-${d.policies.filter((p) => p.hasStructureCover === null).length} שורות.
`;
}
