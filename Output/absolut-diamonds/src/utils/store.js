import { LOCAL_DATA_KEY } from "../constants.js";
import { makeDemoData, EMPTY_DATA } from "./seed.js";

// ============================================================================
// store.js — קריאה/כתיבה ל-localStorage למצב המקומי.
//
// שלוש הגנות שנלמדו בכאב:
//   1. `try/catch` על הכול — גלישה פרטית זורקת על setItem, ואפליקציה שקורסת
//      בגלל שמירת מטמון היא באג מטופש.
//   2. JSON שבור (משתמש ערך ידנית, גרסה ישנה) → חוזרים לדמו במקום מסך לבן.
//   3. חריגת מכסה (QuotaExceeded) מדווחת החוצה, כי במצב מקומי תמונות נשמרות
//      כ-dataURL וזה **יקרה**.
// ============================================================================

export function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_DATA_KEY);
    if (!raw) {
      // ריצה ראשונה — נתוני דמו, כדי שיהיה מה לראות ומה לבדוק.
      const demo = makeDemoData();
      saveLocal(demo);
      return demo;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.models)) {
      return makeDemoData();
    }
    return {
      ...EMPTY_DATA,
      ...parsed,
      models: parsed.models || [],
      diamonds: parsed.diamonds || [],
      leads: parsed.leads || [],
      settingsPublic: parsed.settingsPublic || EMPTY_DATA.settingsPublic,
      settingsPrivate: parsed.settingsPrivate || EMPTY_DATA.settingsPrivate,
    };
  } catch (err) {
    console.warn("[store] local data unreadable, falling back to demo", err);
    return makeDemoData();
  }
}

export function saveLocal(data) {
  try {
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (err) {
    console.error("[store] save failed", err);
    const quota =
      err?.name === "QuotaExceededError" || err?.code === 22 || /quota/i.test(String(err?.message));
    return { ok: false, quota, error: err };
  }
}

export function resetLocal() {
  const demo = makeDemoData();
  saveLocal(demo);
  return demo;
}

export function clearLocal() {
  try {
    localStorage.removeItem(LOCAL_DATA_KEY);
  } catch {
    /* מצב פרטי — לא נורא */
  }
}
