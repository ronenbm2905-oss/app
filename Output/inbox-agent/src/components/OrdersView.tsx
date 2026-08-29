// ============================================================================
// OrdersView.tsx — ★ "ההזמנות של היום". המסך שהיא פותחת ליד שולחן האריזה.
//
// ---------------------------------------------------------------------------
// ★ שלוש הכרעות עיצוב שהן למעשה הכרעות בטיחות
// ---------------------------------------------------------------------------
//  1. **הכמות היא הדבר הגדול ביותר על הכרטיס.** לא תא בטבלה, לא מספר קטן ליד
//     שם המוצר — ספרה גדולה בפני עצמה. הסיבה מדודה: אותו מוצר הוזמן פעם
//     בכמות 1 ופעם בכמות 4, ולשלוח 1 במקום 4 עולה משלוח נוסף, התנצלות,
//     ולקוחה שממתינה עוד שבוע. זו הטעות היקרה ביותר במסך הזה, ולכן היא
//     מקבלת את המקום הכי בולט בו.
//
//  2. **כפתור העתקה אחד לכתובת המלאה.** היא לא תקליד מחדש כתובת בזמן שהיא
//     אורזת — היא תעתיק, או תטעה. שדות נפרדים עם כפתור לכל אחד היו ארבע
//     הזדמנויות לפספס אחד.
//
//  3. **צ׳קבוקס "נשלח" עם ביטול.** ההפיכות היא מה שמאפשר לסמן בלי לחשוב
//     פעמיים, וסימון מהיר הוא כל ההבדל בין רשימה שמתוחזקת לרשימה שנזנחת.
//
// ---------------------------------------------------------------------------
// ★★ הזמנה שסומנה לבדיקה — **בלי כתובת להעתקה**
// ---------------------------------------------------------------------------
// זו לא החמרה לשם הזהירות. כרטיס עם כתובת וכפתור העתקה הוא הזמנה לפעולה
// בלחיצה אחת, ובדיוק בגלל זה הוא הפרס של מי שמזייף הודעת תשלום. כשמשהו לא
// מסתדר — חתימה, מבנה, או חישוב — הכרטיס מציג **הסבר וקישור למקור**, וכל
// פעולה עוברת דרך פתיחת המייל האמיתי.
//
// המחיר: לפעמים היא תפתח מייל בשביל כתובת תקינה לגמרי. זה מחיר שמשלמים
// בשמחה מול חבילה אחת שיוצאת לכתובת של זר.
// ============================================================================

import { useState } from 'react';
import {
  packableItems,
  totalUnitsToPack,
  formatAddressBlock,
  type Order,
} from '../../shared/types';
import { retentionNoteHe } from '../../shared/lib/orderRetention';
import type { OrderRunResult } from '../utils/orderPipeline';
import { t } from '../i18n';
import { Badge, Banner } from './ui/Badge';

const dateFmt = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : dateFmt.format(d);
}

function formatMoney(value: number | null, currency: string | null): string {
  if (value === null) return t('orderAmountUnreadable');
  const sign = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
  const n = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return sign ? `${n} ${sign}` : n;
}

export interface OrdersViewProps {
  result: OrderRunResult;
  canEdit: boolean;
  onToggleShipped: (messageId: string) => void;
  onPurgeRequest: (query: string) => string;
}

export function OrdersView({
  result,
  canEdit,
  onToggleShipped,
  onPurgeRequest,
}: OrdersViewProps) {
  const [shippedOpen, setShippedOpen] = useState(false);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-base font-bold text-slate-900">{t('ordersTitle')}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {result.toShip.length === 0
            ? t('ordersNothingToShip')
            : `${t('ordersSummaryPrefix')} ${result.toShip.length} ${t('ordersSummaryMiddle')} ${result.stats.unitsToPack} ${t('ordersSummarySuffix')}`}
        </p>
      </header>

      {/* ★ עומדות להימחק — לפני הכול, כי זו הרשימה שיש עליה חלון זמן. */}
      {result.expiringSoon.length > 0 ? (
        <Banner tone="warn" title={t('ordersExpiringTitle')}>
          {t('ordersExpiringBody')}
          <ul className="mt-2 space-y-1">
            {result.expiringSoon.map((o) => (
              <li key={o.id} className="text-xs">
                {formatWhen(o.receivedAt)} · {o.recipient.city ?? ''} ·{' '}
                {retentionNoteHe(o)}
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}

      {/* ★★ צריך שתסתכלי. */}
      {result.needsAttention.length > 0 ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-3">
          <h3 className="text-sm font-bold text-red-900">
            {t('ordersNeedYouTitle')}{' '}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs">
              {result.needsAttention.length}
            </span>
          </h3>
          <p className="mt-1 text-xs text-red-900">{t('ordersNeedYouBody')}</p>
          <ul className="mt-3 space-y-2">
            {result.needsAttention.map((order) => (
              <BlockedOrderCard key={order.id} order={order} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* ★ לארוז ולשלוח. */}
      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-800">
          {t('ordersToShipTitle')}{' '}
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
            {result.toShip.length}
          </span>
        </h3>
        {result.toShip.length === 0 ? (
          <p className="text-sm text-slate-500">{t('ordersToShipEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {result.toShip.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canEdit={canEdit}
                onToggleShipped={onToggleShipped}
              />
            ))}
          </ul>
        )}
      </section>

      {/* כבר יצא — מקופל, כי זה ארכיון ולא רשימת עבודה. */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800">
            {t('ordersShippedTitle')}{' '}
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
              {result.shipped.length}
            </span>
          </h3>
          {result.shipped.length > 0 ? (
            <button
              type="button"
              onClick={() => setShippedOpen((v) => !v)}
              aria-expanded={shippedOpen}
              className="min-h-[44px] rounded border border-slate-400 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              {shippedOpen ? t('ordersShippedHide') : t('ordersShippedShow')}
            </button>
          ) : null}
        </div>
        {result.shipped.length > 0 ? (
          // ★ ההבטחה שההפיכות קיימת נאמרת **גם כשהרשימה סגורה**. כפתור
          // ביטול שמסתתר מאחורי "להראות" הוא כפתור שקיים אבל אי אפשר
          // לסמוך עליו, כי אי אפשר לדעת שהוא שם.
          <p className="mt-1 text-xs text-slate-500">{t('ordersShippedNote')}</p>
        ) : null}

        {shippedOpen && result.shipped.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {result.shipped.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                canEdit={canEdit}
                onToggleShipped={onToggleShipped}
              />
            ))}
          </ul>
        ) : null}
      </section>

      {result.openQuestions.length > 0 ? (
        <section className="rounded-xl border border-slate-300 bg-white p-3">
          <h3 className="text-sm font-bold text-slate-800">{t('ordersQuestionsTitle')}</h3>
          <ul className="mt-2 space-y-1">
            {result.openQuestions.map((q) => (
              <li key={q.messageId} className="text-xs text-slate-600">
                <span className="font-medium">{q.fromDomain}</span> · {formatWhen(q.receivedAt)} ·{' '}
                {q.reasonHe}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ★ מונה הקריאה (M18). ראה `orderSource.ts`. */}
      <ReadCounter stats={result.stats} />

      <PurgeRequestBox canEdit={canEdit} onPurgeRequest={onPurgeRequest} />
    </div>
  );
}

/**
 * ★★ מונה הקריאה — ההבטחה שאפשר להסתכל עליה.
 *
 * מסך ההסבר אומר לה "הכלי מסתכל רק על ההודעות של חברת התשלומים", **ובאותה
 * נשימה** אומר שההרשאה שהיא נותנת היא לכל התיבה ושהתוכנה יכולה להשתנות. שני
 * המשפטים האלה יחד מחייבים מקום אחד שבו אפשר לראות מה קרה בפועל — אחרת
 * ההבטחה נשענת על אמון בלבד, וזה בדיוק מה שהיא לא אמורה לעשות.
 *
 * ★ המשפט "כולן מחברת התשלומים" **נגזר ולא נכתב**: הוא מוצג רק כשרשימת
 * המקורות בפועל היא אחת. אם אי פעם ייקרא גוף ממקום אחר, המסך יראה את
 * הרשימה האמיתית — היא תגלה את זה לפנינו, וזו הכוונה.
 */
function ReadCounter({ stats }: { stats: OrderRunResult['stats'] }) {
  const singleSource = stats.readSources.length <= 1;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-700">
        {t('readCounterPrefix')} <strong className="font-bold">{stats.messagesRead}</strong>{' '}
        {singleSource ? (
          t('readCounterSuffix')
        ) : (
          <>
            {t('readCounterOtherSuffix')} {stats.readSources.join(', ')}
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {t('readCounterSource')} <span className="font-mono">{stats.sourceQuery}</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">{t('readCounterDemo')}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ★ הכרטיס
// ---------------------------------------------------------------------------

function OrderCard({
  order,
  canEdit,
  onToggleShipped,
}: {
  order: Order;
  canEdit: boolean;
  onToggleShipped: (messageId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const items = packableItems(order);
  const units = totalUnitsToPack(order);
  const address = formatAddressBlock(order.recipient);
  const isShipped = order.status === 'shipped';
  const warnings = order.issues.filter((i) => i.severity === 'warn');

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // דפדפן שחסם את הלוח. הכתובת ממילא מוצגת על המסך, ולכן אין כאן מצב
      // תקוע — רק פעולה שלא קרתה, ועדיף להשאיר את הכפתור שקט מלהקפיץ שגיאה.
      setCopied(false);
    }
  };

  return (
    <li
      className={`rounded-xl border bg-white p-3 shadow-sm ${
        isShipped ? 'border-slate-200 opacity-60' : 'border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* ★★ הכמות. הדבר הגדול ביותר על הכרטיס, ובכוונה. */}
        <div
          className={`flex min-w-[72px] flex-col items-center rounded-lg px-3 py-2 ${
            isShipped ? 'bg-slate-100' : 'bg-slate-900'
          }`}
        >
          <span
            className={`text-4xl font-black leading-none ${
              isShipped ? 'text-slate-500' : 'text-white'
            }`}
          >
            {units}
          </span>
          <span className={`mt-1 text-xs ${isShipped ? 'text-slate-500' : 'text-slate-200'}`}>
            {units === 1 ? t('orderUnitOne') : t('orderUnitMany')}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <ul className="space-y-0.5">
            {items.map((item, i) => (
              <li key={`${item.productName}-${i}`} className="text-sm text-slate-900">
                <span className="font-bold">{item.quantity}×</span> {item.productName}
              </li>
            ))}
          </ul>

          {/* ★ שורות במחיר 0 מוצגות **בנפרד ומתחת**, ומסומנות במפורש
              כ"לא לארוז". הן חלק ממה שהלקוחה קנתה, ולכן הן לא נעלמות —
              אבל הן לא ברשימת האריזה, שם הן היו גורמות לפריט מיותר. */}
          {order.items.length > items.length ? (
            <p className="mt-1 text-xs text-slate-500">
              {t('orderZeroPriceNote')}{' '}
              {order.items
                .filter((i) => !i.isPackable)
                .map((i) => i.productName)
                .join(', ')}
            </p>
          ) : null}

          <p className="mt-1 text-xs text-slate-500">
            {formatWhen(order.receivedAt)} · {formatMoney(order.paidTotal, order.currency)}
            {order.installments && order.installments > 1
              ? ` · ${order.installments} ${t('orderInstallments')}`
              : ''}
          </p>
        </div>
      </div>

      {/* הכתובת. בלוק אחד, בדיוק כמו שהוא נכנס ללוח ההעתקה. */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
        {order.recipientPurged ? (
          <p className="text-sm text-slate-600">{t('orderPurgedNote')}</p>
        ) : (
          <>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-900">
              {address}
            </pre>
            {order.recipient.email ? (
              <p className="mt-1 text-xs text-slate-500">{order.recipient.email}</p>
            ) : null}
          </>
        )}
      </div>

      {warnings.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {warnings.map((w, i) => (
            <li key={`${w.code}-${i}`} className="text-xs text-amber-800">
              {w.messageHe}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!order.recipientPurged ? (
          <button
            type="button"
            onClick={copyAddress}
            className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {copied ? t('orderAddressCopied') : t('orderCopyAddress')}
          </button>
        ) : null}

        {canEdit ? (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-slate-400 px-3 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={isShipped}
              onChange={() => onToggleShipped(order.sourceMessageId)}
              className="h-5 w-5 accent-slate-900"
            />
            <span>{isShipped ? t('orderMarkedShipped') : t('orderMarkShipped')}</span>
          </label>
        ) : null}

        {isShipped ? <Badge tone="quiet">{retentionNoteHe(order)}</Badge> : null}
      </div>
    </li>
  );
}

/**
 * ★★ כרטיס חסום. **אין בו כתובת ואין בו כפתור העתקה** — יש בו הסבר וקישור
 * למקור. הכמות מוצגת אם נקראה, כי היא עוזרת לה להבין על מה מדובר, אבל שום
 * דבר בכרטיס הזה לא מאפשר לפעול בלחיצה אחת.
 */
function BlockedOrderCard({ order }: { order: Order }) {
  const blocking = order.issues.filter((i) => i.severity === 'block');

  return (
    <li className="rounded-lg border border-red-300 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{formatWhen(order.receivedAt)}</span>
        <Badge tone="danger">{t('orderBlockedBadge')}</Badge>
      </div>

      <ul className="mt-2 space-y-1">
        {blocking.map((issue, i) => (
          <li key={`${issue.code}-${i}`} className="text-sm text-slate-800">
            {issue.messageHe}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-slate-600">
        {t('orderBlockedWhereToLook')}{' '}
        <span className="font-mono text-slate-500">{order.sourceMessageId}</span>
      </p>
    </li>
  );
}

/**
 * ★ מחיקה לבקשת לקוחה.
 *
 * התיבה הזאת מציגה **תוצאה בלבד** — "מחקתי ב-2 הזמנות" — ולעולם לא רשימה
 * של מה שנמצא. מסך שמראה "מצאתי את ההזמנות של X" הוא מסך שמאפשר לחפש אנשים
 * במאגר, וזו בדיוק היכולת שהמודול הזה מנסה לצמצם.
 */
function PurgeRequestBox({
  canEdit,
  onPurgeRequest,
}: {
  canEdit: boolean;
  onPurgeRequest: (query: string) => string;
}) {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (!canEdit) return null;

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-3">
      <h3 className="text-sm font-bold text-slate-800">{t('orderPurgeTitle')}</h3>
      <p className="mt-1 text-xs text-slate-600">{t('orderPurgeBody')}</p>

      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(onPurgeRequest(query));
          setQuery('');
        }}
      >
        <label className="sr-only" htmlFor="purge-query">
          {t('orderPurgePlaceholder')}
        </label>
        <input
          id="purge-query"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('orderPurgePlaceholder')}
          className="min-h-[44px] flex-1 rounded-lg border border-slate-400 px-3 text-sm"
        />
        <button
          type="submit"
          className="min-h-[44px] rounded-lg border border-slate-900 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          {t('orderPurgeAction')}
        </button>
      </form>

      {message ? (
        <p className="mt-2 text-sm text-slate-800" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
