// ============================================================================
// TriageItemCard.tsx — פריט בודד בדוח הבוקר.
//
// שתי התנהגויות שאינן קישוט:
//  1. `needsHumanReview` → **תג אדום**. הוא מופיע לפני הסיכום, כי הסיכום עצמו
//     נכתב בידי מודל שקרא טקסט שנועד לתמרן אותו.
//  2. `mentionsPayment` / `requestsCredentials` → **כפתורי הפעולה המהירה
//     מושבתים**, עם הסבר. לא מוסתרים — מושבתים. כפתור שנעלם נראה כמו באג;
//     כפתור מושבת עם משפט הסבר מלמד את המשתמשת מתי לא לסמוך על הכלי.
// ============================================================================

import { useState } from 'react';
import type { ClassifiedItem, NoiseItem } from '../../shared/types';
import { quickActionsBlocked } from '../utils/pipeline';
import { CATEGORY_HE, t } from '../i18n';
import { Badge } from './ui/Badge';

const timeFmt = new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
});

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : timeFmt.format(d);
}

/**
 * ★ שורת רעש — מה שנשאר כשלא שומרים תוכן.
 *
 * אין כאן כותרת ואין כתובת שולח, כי הם **לא נשמרו**. זה לא צנזור בתצוגה:
 * `NoiseItem` פשוט לא נושא את השדות האלה, והטיפוס לא היה מרשה להציג אותם
 * גם אם מישהו היה רוצה.
 *
 * המשתמשת רואה כמה, מאיזה דומיין ולמה — מספיק כדי לוודא שהכלי לא בלע לה
 * משהו, ובלי שהמערכת תחזיק את הדואר של אף אחד.
 */
export function NoiseItemRow({ item }: { item: NoiseItem }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded border border-slate-200 bg-white px-3 py-2 text-xs">
      <span className="font-medium text-slate-700">{item.fromDomain}</span>
      <span className="text-slate-400">{formatWhen(item.receivedAt)}</span>
      <span className="text-slate-500">{item.reasonHe}</span>
    </li>
  );
}

export interface TriageItemCardProps {
  item: ClassifiedItem;
  body?: string;
  canEdit: boolean;
  onCreateTask: (item: ClassifiedItem) => void;
  onToggleHandled: (id: string) => void;
}

export function TriageItemCard({
  item,
  body,
  canEdit,
  onCreateTask,
  onToggleHandled,
}: TriageItemCardProps) {
  const [open, setOpen] = useState(false);
  const agent = item.agent;
  const blocked = quickActionsBlocked(item);

  return (
    <li
      className={`rounded-lg border bg-white p-3 shadow-sm transition ${
        item.handled ? 'opacity-55' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">{item.subject}</h3>
            {item.handled ? <Badge tone="quiet">{t('handled')}</Badge> : null}
          </div>

          <p className="mt-0.5 truncate text-xs text-slate-500">
            {t('fromLabel')}: {item.fromName || item.fromAddress}{' '}
            <span className="text-slate-400">·</span> {item.fromAddress}{' '}
            <span className="text-slate-400">·</span> {formatWhen(item.receivedAt)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          aria-expanded={open}
        >
          {open ? '−' : '+'}
        </button>
      </div>

      {/* דגלי בטיחות — לפני הסיכום, בכוונה. */}
      {agent ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {agent.needsHumanReview ? <Badge tone="danger">{t('badgeNeedsReview')}</Badge> : null}
          {agent.containsSensitive ? <Badge tone="warn">{t('badgeSensitive')}</Badge> : null}
          {agent.mentionsPayment ? <Badge tone="warn">{t('badgePayment')}</Badge> : null}
          {agent.requestsCredentials ? <Badge tone="warn">{t('badgeCredentials')}</Badge> : null}
          <Badge tone="info">{CATEGORY_HE[agent.category] ?? agent.category}</Badge>
        </div>
      ) : null}

      {agent ? <p className="mt-2 text-sm leading-relaxed text-slate-700">{agent.summaryHe}</p> : null}

      <p className="mt-2 text-xs text-slate-500">
        <span className="font-medium">{t('reasonLabel')}:</span> {item.reasonHe}
      </p>

      {open ? (
        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2">
          {/* הגוף המנוקה, לא ה-HTML המקורי. מה שהמודל ראה — זה מה שמוצג. */}
          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-700">
            {body ?? '— אין גוף שמור לפריט הזה (סונן לפני הניקוי) —'}
          </pre>
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={blocked}
            onClick={() => onCreateTask(item)}
            title={blocked ? t('quickActionsBlocked') : undefined}
            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            {t('actionCreateTask')}
          </button>

          <button
            type="button"
            onClick={() => onToggleHandled(item.id)}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            {item.handled ? t('actionMarkUnhandled') : t('actionMarkHandled')}
          </button>

          {blocked ? (
            <span className="text-xs text-red-700">{t('quickActionsBlocked')}</span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
