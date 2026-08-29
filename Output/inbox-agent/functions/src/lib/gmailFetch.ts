// ============================================================================
// gmailFetch.ts — ★★ שכבת השליפה. **דקה בכוונה.**
//
// ---------------------------------------------------------------------------
// למה הקובץ הזה כמעט ריק, ולמה זו ההחלטה
// ---------------------------------------------------------------------------
// כל מה שאפשר לבדוק בלי רשת יושב ב-`shared/lib/gmailContract.ts`, שרץ ב-
// `npm test` של השורש. מה שנשאר כאן הוא **רק** מה שמחייב HTTP: בניית ה-URL,
// הכותרת `Authorization`, וטיפול בקודי תגובה.
//
// הסיבה מעשית: בקרה שאפשר להריץ רק אחרי deploy היא בקרה שלא רצה. הפער בין
// "הפונקציה מריצה `format=raw`" לבין "מישהו הריץ אותה ובדק" הוא בדיוק הפער
// שסעיף 3ב ב-README מזהיר מפניו — ולכן ההיגיון עבר לצד הנבדק, וכאן נשאר
// צינור שאין בו החלטות.
//
// ---------------------------------------------------------------------------
// ★ למה `fetch` ולא `googleapis`
// ---------------------------------------------------------------------------
// שלוש סיבות, וכולן על אותה שאלה — מה בדיוק נשלח:
//
//  1. **הפרמטר `format=raw` גלוי ב-URL.** ב-SDK הוא ארגומנט לפונקציה
//     שנקראת דרך שכבות, ו-`scripts/check-gmail-fetch.mjs` היה צריך לנחש
//     איפה הוא. כאן הוא מחרוזת בקובץ אחד.
//  2. **אין ברירות מחדל נסתרות.** `googleapis` מביא איתו auth client שיודע
//     לחדש טוקנים בעצמו ולנהל scopes — כלומר מסלול שני להשגת גישה, שאינו
//     עובר ב-`tokenStore`. מודול גישה יחיד (B3′) לא שורד ספרייה כזאת בלי
//     משמעת נוספת.
//  3. **`check-no-model.mjs` אוסר `googleapis` ב-`package.json` של השורש.**
//     האיסור נכתב לפני שהייתה שכבת ענן, והוא נכון להישאר: הקליינט אינו
//     מדבר עם Gmail, אף פעם. שמירת התלות בצד השרת בלבד היא לא עקיפה —
//     היא מה שהאיסור אומר.
//
// המחיר: חידוש הטוקן נכתב ידנית (`tokenStore.getAccessToken`). זה 20 שורות,
// והן ממילא היו צריכות להיכתב כדי לתפוס `invalid_grant` נכון.
// ============================================================================

import {
  GMAIL_MESSAGE_FORMAT,
  gmailMessageToCandidate,
  type GmailRawMessage,
} from '../shared/lib/gmailContract';
import { ORDER_SOURCE_QUERY } from '../shared/lib/orderSource';
import type { OrderSourceCandidate } from '../shared/lib/orderSource';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** תקרה לריצה. ראה ההערה ב-`listOrderMessageIds`. */
export const MAX_MESSAGES_PER_RUN = 200;

export class GmailApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`gmail_http_${status}`);
    this.name = 'GmailApiError';
    this.status = status;
  }
}

export interface GmailClientDeps {
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export class GmailClient {
  private readonly accessToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(deps: GmailClientDeps) {
    this.accessToken = deps.accessToken;
    this.fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  }

  private async get(path: string): Promise<unknown> {
    const res = await this.fetchImpl(`${GMAIL_BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) throw new GmailApiError(res.status);
    return res.json();
  }

  /**
   * ★★ השאילתה נשלחת **כמות שהיא** מ-`ORDER_SOURCE_QUERY`.
   *
   * לא מורכבת כאן, לא מקבלת פרמטר, ולא נקראת מקונפיג. זו דרישת B12 מילה
   * במילה — *"שאילתת שרת קבועה, קבועה בקוד ולא ניתנת לעריכה מהממשק ולא
   * מהקונפיג"* — ו-`scripts/check-order-source.mjs` מפיל build על
   * `import.meta.env` / `process.env` בכל קובץ בגרף, כולל זה.
   *
   * ★ התקרה של 200: ריצה שמושכת אלפי הודעות אינה מצב תקין, היא באג. עצירה
   * בתקרה עדיפה על "עד שנגמר" — אותו היגיון כמו מפסק הזרם בתוכנית הארכוב.
   */
  async listOrderMessageIds(): Promise<string[]> {
    const params = new URLSearchParams({
      q: ORDER_SOURCE_QUERY,
      maxResults: String(MAX_MESSAGES_PER_RUN),
    });
    const body = (await this.get(`/messages?${params}`)) as {
      messages?: Array<{ id?: unknown }>;
    };
    return (body.messages ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  }

  /**
   * ★★★ **הקריאה. `format=raw`, ואין פורמט אחר בקובץ הזה.**
   *
   * ---------------------------------------------------------------------------
   * מה יקרה אם מישהו ישנה את השורה הזאת ל-`full`
   * ---------------------------------------------------------------------------
   * הקוד ימשיך לעבוד. גוגל תחזיר `payload` עם חלקים מפוענחים ועם `headers`,
   * ומי שיתאים את הקוד לקרוא משם יקבל הזמנות שנראות תקינות לגמרי.
   *
   * מה שיישבר בשקט: `l=` נמדד על **הבתים הגולמיים**, וגוף מפוענח הוא בתים
   * אחרים לגמרי. `limitToSignedBody` היה חותך במקום הלא נכון — או, אם אין
   * `bodyRaw` בכלל, לא חותך כלל. תוקף שהדביק טבלת הזמנה שנייה בסוף הודעה
   * חתומה היה מקבל כרטיס עם כפתור "העתקת הכתובת".
   *
   * שלוש שכבות מונעות את זה, ולא אחת:
   *  1. `GMAIL_MESSAGE_FORMAT` — קבוע מיובא, לא מחרוזת מקומית.
   *  2. `gmailMessageToCandidate` — **זורק** על תשובה שאינה `raw`.
   *  3. `scripts/check-gmail-fetch.mjs` — מפיל build על `format=full` /
   *     `metadata` / `minimal` בכל מקום בקוד ה-Functions.
   *
   * שכבה 2 היא היחידה שגם תופסת את המקרה שגוגל תחזיר משהו אחר ממה שביקשנו.
   */
  async getOrderMessage(messageId: string): Promise<OrderSourceCandidate> {
    const params = new URLSearchParams({ format: GMAIL_MESSAGE_FORMAT });
    const raw = (await this.get(`/messages/${encodeURIComponent(messageId)}?${params}`)) as
      | GmailRawMessage
      | null;

    // ★★ השער. הוא זורק — ולכן אין כאן `if` שאפשר לשכוח.
    return gmailMessageToCandidate({ ...(raw ?? {}), id: raw?.id ?? messageId });
  }
}
