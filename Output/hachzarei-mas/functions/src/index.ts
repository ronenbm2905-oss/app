import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import { getConfig } from './shared/config';
import { site } from './shared/config/site';
import {
  assertComplete,
  calculateScore,
  IncompleteAnswersError,
} from './shared/lib/scoring';
import type { FormSlug } from './shared/types/questionnaire';

/**
 * submitLead — נקודת הכניסה היחידה לכתיבת ליד.
 *
 * הלקוח לא כותב ל-Firestore בכלל (ראה firestore.rules). כל מה שנשמר
 * עובר דרך כאן, כולל חישוב הציון מחדש מהתשובות הגולמיות.
 *
 * `me-west1` = תל אביב. המידע נשאר בישראל, וזה מייתר את גילוי ההעברה
 * לחו"ל שנדרש כשהלידים ישבו בגיליון Google (§9.1 באפיון).
 */
setGlobalOptions({ region: 'me-west1', maxInstances: 10 });

initializeApp();
const db = getFirestore();

const MAX_SUBMISSIONS_PER_HOUR = 5;
const SCHEMA_VERSION = 1;

// ─────────────────────────────────────────────
// סכמות
// ─────────────────────────────────────────────

const metaSchema = z.object({
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  utm_term: z.string().max(200).optional(),
  gclid: z.string().max(400).optional(),
  fbclid: z.string().max(400).optional(),
  referrer: z.string().max(500).optional(),
  landingPath: z.string().max(200),
  userAgent: z.string().max(500),
  timeOnPageMs: z.number().int().nonnegative().max(86_400_000),
});

const submitSchema = z.object({
  formSlug: z.enum(['mas-hachnasa', 'mas-shevach']),
  answers: z.record(z.string().max(60), z.string().max(60)),
  lead: z.object({
    fullName: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^0(5[0-9])-?[0-9]{7}$/),
    email: z.string().trim().email().max(200),
    // ההסכמה לדיוור אינה חובה — §9.3 באפיון
    consent: z.boolean().default(false),
  }),
  meta: metaSchema,
  website: z.string().max(200).optional(),
});

const secondarySchema = z.object({
  formSlug: z.enum(['mas-hachnasa', 'mas-shevach']),
  submissionId: z.string().min(8).max(64),
  secondary: z.object({
    birthDate: z.string().max(20).optional(),
    maritalStatus: z.string().max(40).optional(),
    childrenUnder18: z.coerce.number().int().min(0).max(30).optional(),
    address: z.string().max(200).optional(),
  }),
});

// ─────────────────────────────────────────────
// עזרים
// ─────────────────────────────────────────────

function clientIpHash(req: { headers: Record<string, unknown>; ip?: string }): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '');
  const raw = forwarded.split(',')[0].trim() || req.ip || 'unknown';
  // ⚠️ ה-IP נשמר **מגובב** בלבד. הוא מידע אישי, והשימוש היחיד בו כאן
  // הוא הגבלת קצב — שלא דורשת את הערך הגולמי.
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/**
 * הגבלת קצב בטרנזקציית Firestore.
 *
 * מונה בזיכרון התהליך לא עובד ב-serverless: כל instance מחזיק מונה משלו,
 * והם נוצרים ונהרסים כל הזמן. זה מה שהיה שבור בתכנון המקורי מול Netlify.
 */
async function withinRateLimit(ipHash: string): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 3_600_000);
  const ref = db.collection('rateLimits').doc(`${ipHash}_${bucket}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? Number(snap.data()?.count ?? 0) : 0;
    if (count >= MAX_SUBMISSIONS_PER_HOUR) return false;

    tx.set(
      ref,
      {
        count: count + 1,
        // מנוקה ע"י TTL policy על השדה הזה — ראה README
        expiresAt: Timestamp.fromMillis((bucket + 2) * 3_600_000),
      },
      { merge: true }
    );
    return true;
  });
}

function deviceFrom(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  if (/iPad|Tablet/i.test(userAgent)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

async function queueNotification(subject: string, text: string): Promise<void> {
  // תוסף Firebase "Trigger Email from Firestore" קורא מהאוסף הזה.
  //
  // ⚠️ המסמך הזה הוא **עותק שני מלא של הליד** — שם, טלפון, דוא"ל וכל
  // התשובות בטקסט חופשי, כולל תשובות בעלות רגישות מיוחדת לפי תיקון 13
  // (אחוזי נכות, נתוני שכר). התוסף לא מוחק אותו אחרי המסירה, ולכן בלי
  // `purgeAfter` הוא נשאר לנצח — גם אחרי שהליד עצמו נמחק.
  // `purgeExpiredData` מנקה אותו. ראה §9.1 באפיון.
  await db.collection('mail').add({
    to: [site.notificationEmail],
    message: { subject, text },
    purgeAfter: Timestamp.fromMillis(Date.now() + site.mailRetentionDays * 86_400_000),
  });
}

// ─────────────────────────────────────────────
// הפונקציה
// ─────────────────────────────────────────────

export const submitLead = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method not allowed' });
    return;
  }

  // ── מסלול השלמת פרטים: הליד כבר נשמר, זו עדכון בלבד ──
  if (req.body && typeof req.body === 'object' && 'submissionId' in req.body) {
    const parsed = secondarySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'invalid payload' });
      return;
    }
    const clean = Object.fromEntries(
      Object.entries(parsed.data.secondary).filter(([, v]) => v !== undefined && v !== '')
    );
    await db.collection('leads').doc(parsed.data.submissionId).set(clean, { merge: true });
    res.json({ ok: true, submissionId: parsed.data.submissionId });
    return;
  }

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid payload' });
    return;
  }
  const { formSlug, answers, lead, meta, website } = parsed.data;

  // ── Honeypot: בוטים ממלאים את השדה המוסתר, בני אדם לא רואים אותו ──
  if (website && website.trim() !== '') {
    res.json({ ok: true, tier: 'C', submissionId: randomUUID() });
    return;
  }

  const ipHash = clientIpHash(req as never);
  if (!(await withinRateLimit(ipHash))) {
    res.status(429).json({ ok: false, error: 'rate limited' });
    return;
  }

  const config = getConfig(formSlug as FormSlug);

  // ⚠️ **השער האמיתי מול מניפולציה.** בלי זה אפשר לקנות מדרג A בהשמטת
  // השאלות המחלישות: שלוש שאלות ה-Hero החיוביות בדף החזר מס נותנות 1.95,
  // והחישוב מחדש בשרת מגיע לאותה תוצאה בדיוק ולכן לא תופס.
  try {
    assertComplete(answers, config);
  } catch (err) {
    if (err instanceof IncompleteAnswersError) {
      res.status(400).json({ ok: false, error: 'incomplete questionnaire' });
      return;
    }
    throw err;
  }

  const result = calculateScore(answers, config);
  const submissionId = randomUUID();
  const now = Timestamp.now();
  const purgeAfter = Timestamp.fromMillis(
    now.toMillis() + site.leadRetentionDays * 86_400_000
  );

  const document = {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    formSlug,
    tier: result.tier.id,
    internalLabel: result.tier.internalLabel,
    score: result.score,
    disqualified: result.disqualified,
    breakdown: result.breakdown,
    answers,

    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,

    // §9.3 — ההסכמה נשמרת עם חותמת זמן, ורק אם ניתנה
    consent: lead.consent,
    consentAt: lead.consent ? now : null,
    policyVersion: site.policyVersion,

    // תיקון 13 — תקופת שמירה מוגדרת מראש על כל מסמך
    retentionClass: lead.consent ? 'consented' : 'inquiry-only',
    purgeAfter,

    status: 'new',
    contactAttempts: 0,
    lastContactAt: null,

    utmSource: meta.utm_source ?? null,
    utmMedium: meta.utm_medium ?? null,
    utmCampaign: meta.utm_campaign ?? null,
    utmContent: meta.utm_content ?? null,
    utmTerm: meta.utm_term ?? null,
    gclid: meta.gclid ?? null,
    fbclid: meta.fbclid ?? null,
    referrer: meta.referrer ?? null,
    landingPath: meta.landingPath,
    device: deviceFrom(meta.userAgent),
    timeOnPageSec: Math.round(meta.timeOnPageMs / 1000),
    ipHash,
  };

  let stored = false;
  try {
    await db.collection('leads').doc(submissionId).set(document);
    stored = true;
  } catch (err) {
    console.error('firestore write failed', err);
  }

  let mailed = false;
  try {
    const label = formSlug === 'mas-shevach' ? 'מס שבח' : 'החזר מס';
    await queueNotification(
      `[${result.tier.id}] ליד חדש — ${label} — ${lead.fullName} — ${lead.phone}`,
      [
        `מדרג: ${result.tier.id} (${result.tier.internalLabel})`,
        `פעולה נדרשת: ${result.tier.internalAction}`,
        `ציון: ${result.score}`,
        '',
        `שם: ${lead.fullName}`,
        `טלפון: ${lead.phone}`,
        `דוא"ל: ${lead.email}`,
        `הסכמה לדיוור: ${lead.consent ? 'כן' : 'לא'}`,
        '',
        'תשובות:',
        ...config.questions.map((q) => {
          const answerId = answers[q.id];
          const option = q.options.find((o) => o.id === answerId);
          return `  ${q.title} → ${option?.label ?? '—'}`;
        }),
        '',
        `מקור: ${meta.utm_source ?? 'ישיר'} / ${meta.utm_campaign ?? '—'}`,
        `זמן מילוי: ${Math.round(meta.timeOnPageMs / 1000)} שניות`,
        `מזהה: ${submissionId}`,
      ].join('\n')
    );
    mailed = true;
  } catch (err) {
    console.error('notification failed', err);
  }

  // הליד לא הולך לאיבוד כל עוד אחד מהשניים הצליח (§6.3)
  if (!stored && !mailed) {
    res.status(500).json({ ok: false, error: 'storage and notification both failed' });
    return;
  }

  res.json({ ok: true, tier: result.tier.id, submissionId });
});


// ─────────────────────────────────────────────
// מחיקה אוטומטית
// ─────────────────────────────────────────────

/**
 * מוחקת מסמכים שעבר מועד ה-`purgeAfter` שלהם.
 *
 * ⚠️ **הפונקציה הזו היא מה שהופך את מדיניות הפרטיות לנכונה.**
 * עד 22.8.2026 `purgeAfter` רק **נכתב** על כל ליד ואף אחד לא קרא אותו:
 * אין TTL policy על `leads`, ולא הייתה שום משימה מתוזמנת. כלומר
 * `privacy.html` §4 הצהיר "המחיקה מתבצעת אוטומטית במועד זה" בזמן
 * שהמועד נרשם והמחיקה לא קרתה. זה נתפס בשער המשפטי של עדי (ח-1).
 *
 * מחיקה **קשה**, לא סימון: המדיניות מבטיחה מחיקה, לא דגל.
 *
 * למה לא TTL policy של Firestore על `leads`: TTL עובד, אבל הוא הגדרה
 * בקונסולה שלא נראית בקוד ולא נוסעת עם ה-repo — ומדיניות שמירה שאי אפשר
 * לקרוא ב-code review היא מדיניות שתישכח בפרויקט הבא. TTL כן מוגדר על
 * `rateLimits`, שם אין PII ואין הצהרה במדיניות.
 */
/**
 * הלוגיקה עצמה, מיוצאת בנפרד מהעטיפה המתוזמנת — כדי שאפשר יהיה
 * להריץ עליה בדיקה מול האמולטור. פונקציה מתוזמנת דורשת אמולטור pubsub
 * ואי אפשר לקרוא לה ישירות, וזו בדיוק הלוגיקה שאסור שתישאר לא-נבדקת:
 * היא מה שהופך את ההצהרה במדיניות הפרטיות לנכונה.
 */
export async function purgeExpired(
  now = Timestamp.now()
): Promise<Record<string, number>> {
  const summary: Record<string, number> = {};

  for (const name of ['leads', 'mail'] as const) {
    let deleted = 0;

    // בלולאה, כי `limit` על השאילתה ו-500 פעולות ל-batch הן תקרות של Firestore
    for (;;) {
      const expired = await db
        .collection(name)
        .where('purgeAfter', '<=', now)
        .limit(400)
        .get();

      if (expired.empty) break;

      const batch = db.batch();
      expired.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += expired.size;

      if (expired.size < 400) break;
    }

    summary[name] = deleted;
  }

  return summary;
}

export const purgeExpiredData = onSchedule(
  { schedule: 'every day 03:15', timeZone: 'Asia/Jerusalem', region: 'me-west1' },
  async () => {
    const summary = await purgeExpired();
    console.log('purgeExpiredData', JSON.stringify(summary));
  }
);
