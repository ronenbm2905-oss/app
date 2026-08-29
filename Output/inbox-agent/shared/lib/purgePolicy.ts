// ============================================================================
// purgePolicy.ts — ★★ המחיקה שרצה בפועל. A7 / B9.
//
// ---------------------------------------------------------------------------
// הלקח שהקובץ הזה נכתב בגללו
// ---------------------------------------------------------------------------
// `Output/hachzarei-mas/functions/src/index.ts:302-317` מתעד כשל מדויק, והוא
// נתפס **בשער המשפטי ולא בקוד**:
//
// > *"עד 22.8.2026 `purgeAfter` רק **נכתב** על כל ליד ואף אחד לא קרא אותו …
// > כלומר `privacy.html` §4 הצהיר 'המחיקה מתבצעת אוטומטית במועד זה' בזמן
// > שהמועד נרשם והמחיקה לא קרתה."*
//
// זו לא רשלנות — זו צורת הכשל הטבעית של מדיניות שמירה: השדה נכתב בשמחה
// (הוא בסכימה, הוא נראה במסמך), והקורא נדחה ל"אחר כך". אין תסמין, אין
// שגיאה, ואין מי שמתלונן.
//
// ---------------------------------------------------------------------------
// ★★ שלוש הכרעות שהופכות את זה למשהו שאפשר לבדוק
// ---------------------------------------------------------------------------
//  1. **הלוגיקה יושבת ב-`shared/` מול ממשק אחסון מוזרק**, ולא בתוך
//     `onSchedule`. פונקציה מתוזמנת דורשת אמולטור pubsub ואי אפשר לקרוא לה
//     ישירות — כלומר, אם ההיגיון יושב בתוכה, הוא לא נבדק. זו בדיוק הלוגיקה
//     שאסור שתישאר לא-נבדקת, כי היא מה שהופך את ההצהרה לנכונה.
//
//  2. **המחיקה היא מחיקת שדות אמיתית.** לא `deleted: true`, לא
//     `visible: false`. `PurgeStore.purgeRecipient` מסיר את המפה `recipient`
//     מהמסמך. רשומה שנמחקה **אינה מכילה** את הכתובת, ולא "אינה מציגה" אותה.
//
//  3. ★★ **הסריקה מכסה את מסמך "ההזמנות של היום".** זו המלכודת מ-8א.2(ב):
//     > *"מחיקת שדות במסמך ההזמנה אינה מספיקה אם קיים מסמך 'ההזמנות של
//     > היום' שמרנדר את הרשימה — הוא מחזיק את אותן כתובות והוא לא
//     > ב-`orders/`, ולכן `purgeExpired` לא יעבור עליו."*
//     ולכן שתי שכבות: `PURGE_SCOPE` (מה שידענו לרשום) ו**סריקת שדות
//     בעיוורון** לפי `RECIPIENT_FIELD_NAMES` (מה ששכחנו). כל מציאה בשכבה
//     השנייה היא **ממצא מדווח**, לא ניקוי שקט — מסמך שהחזיק כתובת במקום
//     שלא תוכנן הוא באג בסכימה, ואם הוא נמחק בשקט לעולם לא נדע עליו.
// ============================================================================

import {
  COLLECTIONS,
  PURGE_SCOPE,
  RECIPIENT_FIELD_NAMES,
  type CollectionName,
} from './firestorePaths';

/** מסמך כפי שהוא חוזר מהאחסון. `data` הוא מה שנשמר, בלי המרות. */
export interface StoredDoc {
  id: string;
  data: Record<string, unknown>;
}

/**
 * ★ ממשק האחסון. **מינימלי בכוונה.**
 *
 * ארבע פעולות. כל אחת מהן מתורגמת ישירות לקריאת Firestore אחת, וכולן ניתנות
 * למימוש ב-Map בזיכרון — וזה מה שהופך את המבחן לאמיתי ולא למוק של עצמו.
 */
export interface PurgeStore {
  /** כל המשתמשים במסד. במוצר הזה — אחת. */
  listUsers(): Promise<string[]>;
  /** כל המסמכים באוסף. הסינון לפי תאריך נעשה בלוגיקה, ולא בשאילתה — ראה למטה. */
  listAll(uid: string, collection: CollectionName): Promise<StoredDoc[]>;
  /** ★ מסירה את מפת `recipient` ומסמנת `recipientPurged`. */
  purgeRecipient(uid: string, orderId: string, at: string): Promise<void>;
  /** מוחקת מסמך שלם. */
  deleteDoc(uid: string, collection: CollectionName, id: string): Promise<void>;
  /** ★ מסירה שדות בשמם. משמשת רק לממצאי הסריקה העיוורת. */
  stripFields(
    uid: string,
    collection: CollectionName,
    id: string,
    fields: readonly string[],
  ): Promise<void>;
}

/**
 * ★ ממצא: מסמך שהחזיק שדה נמען במקום שבו הסכימה לא אמורה להחזיק אותו.
 *
 * לא "אזהרה". זה באג, והוא מוצג לרונן ב-`syncRuns` כדי שמישהו יתקן את
 * הכתיבה — ולא רק את התוצאה.
 */
export interface ResidueFinding {
  userId: string;
  collection: CollectionName;
  docId: string;
  fields: string[];
}

export interface PurgeSummary {
  /** כמה הזמנות נמחקו מהן פרטי נמען בריצה הזאת. */
  ordersPurged: number;
  /** כמה מסמכי "הזמנות של היום" נמחקו כי עברו את מועדם. */
  dailyListsDeleted: number;
  /** כמה רשומות יומן נמחקו. */
  accessLogDeleted: number;
  /** כמה ריצות ישנות נמחקו. */
  syncRunsDeleted: number;
  /** ★★ מסמכים שהחזיקו שדה נמען מחוץ ל-`orders`. אמור להיות ריק. */
  residue: ResidueFinding[];
  /** ★ הזמנות שהיה להן `purgeAfter` בעבר ולא נמחקו — כלומר כשל. אמור להיות 0. */
  missed: number;
  ranAt: string;
}

const isPast = (value: unknown, nowMs: number): boolean => {
  if (typeof value !== 'string' || value.length === 0) return false;
  const t = new Date(value).getTime();
  return Number.isFinite(t) && t <= nowMs;
};

/**
 * ★ שדות נמען שנמצאו במסמך — כולל בתוך מפה מקוננת.
 *
 * הסריקה עוברת רמה אחת פנימה ולא יותר: מבנה עמוק יותר אינו קיים בסכימה, וסורק
 * רקורסיבי על מסמכים שרירותיים הוא בדיוק הקוד שמתחיל למחוק דברים תקינים.
 * מה שמעבר לרמה אחת ייתפס על ידי המבחן, לא על ידי הסורק.
 */
function residueFieldsIn(data: Record<string, unknown>): string[] {
  const found = new Set<string>();
  for (const [key, value] of Object.entries(data)) {
    if (RECIPIENT_FIELD_NAMES.includes(key)) {
      // ערך ריק אינו שריד — הזמנה שכבר נמחקה מחזיקה `recipient` חסר, ולא
      // "מחזיקה שדה". בלי התנאי הזה כל ריצה שנייה הייתה מדווחת ממצא.
      if (value !== null && value !== undefined && value !== '') found.add(key);
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of Object.keys(value as Record<string, unknown>)) {
        if (RECIPIENT_FIELD_NAMES.includes(nested)) {
          const nestedValue = (value as Record<string, unknown>)[nested];
          if (nestedValue !== null && nestedValue !== undefined && nestedValue !== '') {
            found.add(key);
          }
        }
      }
    }
  }
  return Array.from(found).sort();
}

/**
 * ★★ הריצה.
 *
 * ---------------------------------------------------------------------------
 * למה `listAll` ולא שאילתה `where('purgeAfter','<=',now)`
 * ---------------------------------------------------------------------------
 * שאילתה כזאת יעילה יותר — והיא **מדלגת בשקט על בדיוק המסמכים המסוכנים**:
 * מסמך בלי שדה `purgeAfter` כלל, או עם ערך פגום, אינו מוחזר משאילתת אי-שוויון
 * ב-Firestore. כלומר רשומה שנכתבה בגרסה מוקדמת, או שנפגמה, הייתה שורדת לנצח
 * **ולא מופיעה בשום דוח**. זו אותה צורת כשל שהמנגנון כולו נועד למנוע.
 *
 * המחיר סביר בקנה המידה הזה (מאות מסמכים למשתמשת), והוא מתועד כאן כדי שמי
 * שיבוא לייעל יידע מה הוא מוותר עליו. אם המסד יגדל — התיקון הוא **שני**
 * מעברים: השאילתה המהירה לרוב, וסריקה מלאה שבועית שמדווחת `missed`.
 */
export async function runPurge(
  store: PurgeStore,
  now: Date | string = new Date(),
): Promise<PurgeSummary> {
  const at = now instanceof Date ? now : new Date(now);
  const nowMs = at.getTime();
  const nowIso = at.toISOString();

  const summary: PurgeSummary = {
    ordersPurged: 0,
    dailyListsDeleted: 0,
    accessLogDeleted: 0,
    syncRunsDeleted: 0,
    residue: [],
    missed: 0,
    ranAt: nowIso,
  };

  for (const uid of await store.listUsers()) {
    // --- ★ ההזמנות. מחיקת שדות, לא דגל. ------------------------------------
    for (const doc of await store.listAll(uid, COLLECTIONS.orders)) {
      const alreadyPurged = doc.data.recipientPurged === true;
      if (!isPast(doc.data.purgeAfter, nowMs)) continue;
      if (alreadyPurged) continue;
      await store.purgeRecipient(uid, doc.id, nowIso);
      summary.ordersPurged++;
    }

    // --- ★★ מסמך "ההזמנות של היום". ראה ההערה בראש הקובץ. ------------------
    for (const doc of await store.listAll(uid, COLLECTIONS.dailyLists)) {
      if (isPast(doc.data.purgeAfter, nowMs)) {
        await store.deleteDoc(uid, COLLECTIONS.dailyLists, doc.id);
        summary.dailyListsDeleted++;
      }
    }

    // --- יומן הגישה וריצות הסנכרון: מחיקה לפי `purgeAfter` משלהם. ----------
    for (const doc of await store.listAll(uid, COLLECTIONS.accessLog)) {
      if (isPast(doc.data.purgeAfter, nowMs)) {
        await store.deleteDoc(uid, COLLECTIONS.accessLog, doc.id);
        summary.accessLogDeleted++;
      }
    }
    for (const doc of await store.listAll(uid, COLLECTIONS.syncRuns)) {
      if (isPast(doc.data.purgeAfter, nowMs)) {
        await store.deleteDoc(uid, COLLECTIONS.syncRuns, doc.id);
        summary.syncRunsDeleted++;
      }
    }

    // --- ★★ הסריקה העיוורת, **אחרי** המחיקות. -----------------------------
    //
    // אחרי ולא לפני, בכוונה: מה שנשאר עכשיו הוא מה ששרד את המדיניות, ולכן
    // כל שדה נמען שנמצא כאן הוא באמת שריד ולא רשומה שעוד לא הגיע זמנה.
    for (const collection of PURGE_SCOPE) {
      for (const doc of await store.listAll(uid, collection)) {
        // ב-`orders` השדה `recipient` לגיטימי כל עוד לא הגיע מועד המחיקה.
        const due = isPast(doc.data.purgeAfter, nowMs);
        if (collection === COLLECTIONS.orders && !due) continue;

        const fields = residueFieldsIn(doc.data);
        if (fields.length === 0) continue;

        await store.stripFields(uid, collection, doc.id, fields);
        summary.residue.push({ userId: uid, collection, docId: doc.id, fields });
        if (collection === COLLECTIONS.orders) summary.missed++;
      }
    }
  }

  return summary;
}

/**
 * ★ המשפט שנשמר ב-`syncRuns` ומוצג לדורית.
 *
 * "לא נמחק כלום" הוא **תוצאה תקינה** ונאמר במפורש. ריצה שלא מדווחת דבר
 * נראית כמו ריצה שלא קרתה, ואז אף אחד לא שם לב ליום שבו היא באמת לא קרתה.
 */
export function purgeSummaryHe(summary: PurgeSummary): string {
  const parts: string[] = [];
  if (summary.ordersPurged > 0) {
    parts.push(
      summary.ordersPurged === 1
        ? 'נמחקו פרטי המשלוח בהזמנה אחת'
        : `נמחקו פרטי המשלוח ב-${summary.ordersPurged} הזמנות`,
    );
  }
  if (summary.dailyListsDeleted > 0) {
    parts.push(`נמחקו ${summary.dailyListsDeleted} רשימות יומיות ישנות`);
  }
  if (parts.length === 0) parts.push('לא היה מה למחוק היום');

  if (summary.residue.length > 0) {
    parts.push(
      `⚠️ נמצאו ${summary.residue.length} מסמכים שהחזיקו פרטי נמען במקום לא צפוי. הם נוקו, ורונן צריך להסתכל על זה`,
    );
  }
  return parts.join('. ') + '.';
}
