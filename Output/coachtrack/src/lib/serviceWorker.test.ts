/**
 * טסטים ל-`public/sw.js`.
 *
 * ## למה זה קיים
 *
 * ה-service worker הוא הקוד המסוכן ביותר בשלב 6: הוא יושב לפני הרשת, הוא
 * שורד רענון, והוא ממשיך לחיות אחרי deploy. תקלה בו אינה "מסך שנראה לא
 * טוב" אלא **משתמש שתקוע על גרסה ישנה ואין לו דרך לצאת** — בדיוק התקלה
 * שכבר קרתה לרונן בפרויקט אחר, שם היא נפתרה בכותרות Cache.
 *
 * אין לי דפדפן, ולכן במקום להסתכל: ה-`sw.js` האמיתי נטען מהדיסק ומורץ
 * ב-`node:vm` בתוך sandbox שמחקה את הסביבה שלו (`caches`, `clients`,
 * `fetch`, `skipWaiting`). אחר כך מפעילים את ה-handlers ובודקים **מה בפועל
 * נכנס ל-cache ומה בפועל הוגש**.
 *
 * הטענה שנבדקת כאן, והיא הטענה היחידה שחשובה: **ניווט לעולם אינו מוגש
 * מ-cache כשיש רשת, ו-index.html לעולם אינו נשמר.**
 *
 * ⚠️ הבדל אחד מהמציאות: `Request` בסנדבוקס הוא אובייקט פשוט. `Request`
 * האמיתי של Node לא מקבל URL יחסי, ו-`mode: 'navigate'` אסור לבנייה לפי
 * התקן. מה שנבדק כאן הוא **מדיניות ה-cache**, שקוראת רק את `method`,
 * `url` ו-`mode` — ולא הקונסטרקטור של הדפדפן.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SW_SOURCE = readFileSync(
  fileURLToPath(new URL('../../public/sw.js', import.meta.url)),
  'utf8',
);

const ORIGIN = 'https://coachtrack.example';

interface FakeRequest {
  method: string;
  url: string;
  mode: string;
}

function request(url: string, overrides: Partial<FakeRequest> = {}): FakeRequest {
  return { method: 'GET', url, mode: 'navigate', ...overrides };
}

/* ------------------------------------------------------------------ */
/* הסנדבוקס                                                            */
/* ------------------------------------------------------------------ */

interface Harness {
  /** מה נשמר ב-cache, לפי שם ה-cache. */
  caches: Map<string, Map<string, unknown>>;
  /** כל URL שנשלח לרשת, לפי הסדר. */
  fetched: string[];
  skipWaitingCalled: boolean;
  claimCalled: boolean;
  install: () => Promise<void>;
  activate: () => Promise<void>;
  /** מריץ את handler ה-fetch. `undefined` = ה-SW לא נגע בבקשה. */
  fetchEvent: (req: FakeRequest) => Promise<{ body: string; status: number } | undefined>;
}

function load(options: { networkFails?: boolean; seedCaches?: string[] } = {}): Harness {
  const cacheStore = new Map<string, Map<string, unknown>>();
  for (const name of options.seedCaches ?? []) cacheStore.set(name, new Map());

  const fetched: string[] = [];
  const listeners = new Map<string, (event: unknown) => void>();

  const harness: Partial<Harness> = {
    caches: cacheStore,
    fetched,
    skipWaitingCalled: false,
    claimCalled: false,
  };

  const fakeFetch = (input: FakeRequest | string) => {
    const url = typeof input === 'string' ? input : input.url;
    fetched.push(url);
    if (options.networkFails) return Promise.reject(new Error('offline'));
    return Promise.resolve(new Response(`network:${url}`, { status: 200 }));
  };

  const cacheFor = (name: string) => {
    const entries = cacheStore.get(name) ?? new Map<string, unknown>();
    cacheStore.set(name, entries);

    return {
      // `add` מביא מהרשת ושומר — בדיוק כמו במפרט. כך `fetched` מספר גם מה
      // ההתקנה משכה, וזה מה שמאפשר לבדוק שהיא לא משכה את index.html.
      add: async (req: FakeRequest | string) => {
        const url = typeof req === 'string' ? req : req.url;
        const response = await fakeFetch(req);
        entries.set(url, response);
      },
      put: async (req: FakeRequest | string, response: unknown) => {
        entries.set(typeof req === 'string' ? req : req.url, response);
      },
      match: async (req: FakeRequest | string) => {
        const url = typeof req === 'string' ? req : req.url;
        const hit = entries.get(url);
        return hit === undefined ? undefined : new Response(`cache:${url}`, { status: 200 });
      },
    };
  };

  const sandbox: Record<string, unknown> = {
    console,
    URL,
    Response,
    Request: class {
      url: string;
      method = 'GET';
      mode = 'navigate';
      cache?: string;
      constructor(url: string, init: { cache?: string } = {}) {
        this.url = url;
        this.cache = init.cache;
      }
    },
    fetch: fakeFetch,
    caches: {
      open: async (name: string) => cacheFor(name),
      keys: async () => [...cacheStore.keys()],
      delete: async (name: string) => cacheStore.delete(name),
    },
  };

  sandbox.self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler);
    },
    skipWaiting: () => {
      harness.skipWaitingCalled = true;
      return Promise.resolve();
    },
    clients: {
      claim: () => {
        harness.claimCalled = true;
        return Promise.resolve();
      },
    },
    location: { origin: ORIGIN },
    registration: {},
  };

  vm.runInNewContext(SW_SOURCE, sandbox);

  const runLifecycle = async (type: 'install' | 'activate') => {
    const handler = listeners.get(type);
    if (!handler) throw new Error(`אין handler ל-${type}`);
    let pending: Promise<unknown> = Promise.resolve();
    handler({ waitUntil: (promise: Promise<unknown>) => (pending = promise) });
    await pending;
  };

  harness.install = () => runLifecycle('install');
  harness.activate = () => runLifecycle('activate');

  harness.fetchEvent = async (req: FakeRequest) => {
    const handler = listeners.get('fetch');
    if (!handler) throw new Error('אין handler ל-fetch');

    let answered: Promise<Response> | null = null;
    handler({
      request: req,
      respondWith: (promise: Promise<Response>) => {
        answered = promise;
      },
    });

    if (answered === null) return undefined;
    const response = await (answered as Promise<Response>);
    return { body: await response.text(), status: response.status };
  };

  return harness as Harness;
}

/* ------------------------------------------------------------------ */

describe('התקנה', () => {
  let sw: Harness;

  beforeEach(async () => {
    sw = load();
    await sw.install();
  });

  it('שומר ב-cache קובץ אחד בדיוק — מסך ה-offline', () => {
    const entries = [...sw.caches.values()].flatMap((cache) => [...cache.keys()]);
    expect(entries).toEqual(['/offline.html']);
  });

  it('index.html לא נשמר ואפילו לא נמשך', () => {
    // זו הטענה שמונעת "תקוע על גרסה ישנה". אם היא נופלת, כל השאר לא משנה.
    const entries = [...sw.caches.values()].flatMap((cache) => [...cache.keys()]);
    expect(entries.some((key) => key.includes('index.html'))).toBe(false);
    expect(sw.fetched.some((url) => url.includes('index.html'))).toBe(false);
  });

  it('לא נשמרים נכסים, סקריפטים או פונטים', () => {
    expect(sw.fetched).toEqual(['/offline.html']);
  });

  it('קורא ל-skipWaiting — גרסה חדשה נכנסת לתוקף בלי להמתין', () => {
    expect(sw.skipWaitingCalled).toBe(true);
  });
});

describe('הפעלה', () => {
  it('מוחק caches ישנים ומשאיר רק את הנוכחי', async () => {
    const sw = load({ seedCaches: ['coachtrack-offline-v0', 'workbox-precache-v2'] });
    await sw.install();
    await sw.activate();

    expect([...sw.caches.keys()]).toEqual(['coachtrack-offline-v1']);
  });

  it('קורא ל-clients.claim', async () => {
    const sw = load();
    await sw.install();
    await sw.activate();

    expect(sw.claimCalled).toBe(true);
  });
});

describe('ניווט — network-first', () => {
  it('כשיש רשת, הניווט מוגש מהרשת ולא מה-cache', async () => {
    const sw = load();
    await sw.install();

    const result = await sw.fetchEvent(request(`${ORIGIN}/coach`));

    // `network:` ולא `cache:` — זו כל הנקודה של הקובץ הזה.
    expect(result?.body).toBe(`network:${ORIGIN}/coach`);
  });

  it('ניווט מוצלח אינו נשמר ב-cache — גם לא אחרי כמה טעינות', async () => {
    const sw = load();
    await sw.install();

    await sw.fetchEvent(request(`${ORIGIN}/`));
    await sw.fetchEvent(request(`${ORIGIN}/coach`));
    await sw.fetchEvent(request(`${ORIGIN}/player/history`));

    const entries = [...sw.caches.values()].flatMap((cache) => [...cache.keys()]);
    expect(entries).toEqual(['/offline.html']);
  });

  it('בלי רשת מוגש מסך ה-offline — ולא עותק ישן של האפליקציה', async () => {
    const sw = load();
    await sw.install();

    // הרשת נופלת רק אחרי ההתקנה, כמו במציאות.
    const offline = load({ networkFails: true });
    // מדמים SW שכבר הותקן: מזריקים את מסך ה-offline ל-cache.
    offline.caches.set('coachtrack-offline-v1', new Map([['/offline.html', true]]));

    const result = await offline.fetchEvent(request(`${ORIGIN}/coach`));
    expect(result?.body).toBe('cache:/offline.html');
  });

  it('בלי רשת ובלי cache — 503 בעברית, לא קריסה ולא מסך לבן', async () => {
    const sw = load({ networkFails: true });
    const result = await sw.fetchEvent(request(`${ORIGIN}/coach`));

    expect(result?.status).toBe(503);
    expect(result?.body).toContain('אין חיבור');
  });
});

describe('מה שה-service worker לא נוגע בו', () => {
  let sw: Harness;

  beforeEach(async () => {
    sw = load();
    await sw.install();
  });

  it('נכסים ו-JS עוברים ישר לרשת בלי לעבור דרכו', async () => {
    // `undefined` = לא נקרא respondWith, כלומר הדפדפן מטפל בבקשה לבד
    // ומשתמש בכותרת `immutable` של Firebase Hosting.
    expect(
      await sw.fetchEvent(request(`${ORIGIN}/assets/index-abc123.js`, { mode: 'cors' })),
    ).toBeUndefined();
    expect(
      await sw.fetchEvent(request(`${ORIGIN}/assets/index-abc123.css`, { mode: 'no-cors' })),
    ).toBeUndefined();
  });

  it('תשובות של Firestore ושל Auth אינן עוברות דרכו כלל', async () => {
    const external = [
      'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
      'https://securetoken.googleapis.com/v1/token',
      'https://fonts.gstatic.com/s/rubik/v28/font.woff2',
    ];

    for (const url of external) {
      expect(await sw.fetchEvent(request(url, { mode: 'cors' })), url).toBeUndefined();
    }

    const entries = [...sw.caches.values()].flatMap((cache) => [...cache.keys()]);
    expect(entries).toEqual(['/offline.html']);
  });

  it('בקשת POST אינה נוגעת בו — גם כשהיא ניווט', async () => {
    expect(
      await sw.fetchEvent(request(`${ORIGIN}/coach`, { method: 'POST' })),
    ).toBeUndefined();
  });
});

describe('הקוד עצמו', () => {
  it('אינו מזכיר index.html בשום מקום', () => {
    // בדיקה סטטית בנוסף להתנהגותית: היא תיתפס גם אם מישהו יוסיף מסלול
    // חדש שלא נבדק, ולא רק אם הוא ישבור מסלול קיים.
    expect(SW_SOURCE.includes("'/index.html'")).toBe(false);
    expect(SW_SOURCE.includes('"/index.html"')).toBe(false);
  });

  it('אינו משתמש ב-addAll או ב-cache.put — אין precaching', () => {
    expect(SW_SOURCE).not.toMatch(/\.addAll\(/);
    expect(SW_SOURCE).not.toMatch(/cache\.put\(/);
  });

  it('אין תלות חיצונית — לא Workbox ולא שום דבר אחר', () => {
    // ההערה בראש הקובץ מזכירה את Workbox בשלילה, ולכן לא בודקים את המילה
    // אלא את שתי הדרכים היחידות להכניס קוד זר ל-service worker.
    expect(SW_SOURCE).not.toMatch(/\bimportScripts\s*\(/);
    expect(SW_SOURCE).not.toMatch(/^\s*import\s/m);
    expect(SW_SOURCE).not.toMatch(/\bworkbox\w*\s*\./i);
  });
});
