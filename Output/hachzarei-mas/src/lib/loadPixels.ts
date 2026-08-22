/**
 * טעינת GA4 ו-Meta Pixel.
 *
 * שני עקרונות:
 *
 * 1. **התור נפתח מיד, הסקריפט נטען מאוחר.** שני הספקים מגדירים תור
 *    (`dataLayer` / `fbq.queue`) שנצבר לפני שהסקריפט יורד ומתרוקן אליו
 *    כשהוא מגיע. לכן אפשר לדחות את הטעינה בלי לאבד אירועים — וגם
 *    `quiz_start`, שקורה בשנייה הראשונה, נספר.
 *
 * 2. **בלי מזהה ב-.env הסקריפט לא נטען בכלל.** בפיתוח ובבדיקות אין
 *    בקשות רשת החוצה, ו-Lighthouse נמדד על מה שבאמת ירד בפרודקשן.
 */

const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

function injectScript(src: string): void {
  const el = document.createElement('script');
  el.async = true;
  el.src = src;
  document.head.appendChild(el);
}

function setupGa4(id: string): void {
  window.dataLayer = window.dataLayer || [];
  // חייב להיות function רגילה — gtag נשען על `arguments`
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  } as typeof window.gtag;

  window.gtag!('js', new Date());
  window.gtag!('config', id, { send_page_view: true });
}

function setupMetaPixel(id: string): void {
  const fbq = function fbq(...args: unknown[]) {
    const f = window.fbq as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
    if (f.callMethod) f.callMethod(...args);
    else f.queue.push(args);
  } as unknown as typeof window.fbq & { queue: unknown[]; loaded: boolean; version: string };

  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  window.fbq = fbq;

  window.fbq!('init', id);
  window.fbq!('track', 'PageView');
}

/**
 * מפעיל את התורים מיד, ומוריד את הסקריפטים בפעולה הראשונה של הגולש
 * (או אחרי 6 שניות, למי שקורא ולא נוגע).
 */
export function loadPixels(): void {
  if (!GA4_ID && !META_PIXEL_ID) return;

  if (GA4_ID) setupGa4(GA4_ID);
  if (META_PIXEL_ID) setupMetaPixel(META_PIXEL_ID);

  let done = false;
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

  const fire = () => {
    if (done) return;
    done = true;
    events.forEach((e) => window.removeEventListener(e, fire));

    if (GA4_ID) injectScript(`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`);
    if (META_PIXEL_ID) injectScript('https://connect.facebook.net/en_US/fbevents.js');
  };

  events.forEach((e) => window.addEventListener(e, fire, { once: true, passive: true }));
  window.setTimeout(fire, 6000);
}
