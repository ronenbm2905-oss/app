/**
 * יומן הדיווחים של השבוע — כאן מתבצעות העריכה והמחיקה (TASKS שלב 4ד).
 *
 * **המחיקה היא רכה בלבד** (`deleted: true`): כלל 5 ב-CLAUDE.md, ו-
 * `allow delete: if false` ב-`firestore.rules` אוכף אותו גם אם מישהו ישכח.
 *
 * **כפתורי העריכה נעלמים אחרי 7 ימים מהרישום** (`canEditEntry`), והשורה מקבלת
 * במקומם משפט שמסביר למה. זה מראה של הכלל `withinEditWindow` ולא תחליף לו —
 * הסתרת כפתור היא נוחות, לא אבטחה (כלל 4). ההסבר קיים כי כפתור שנעלם בלי
 * מילה נראה כמו באג.
 */

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatIsraeliDate } from '../../lib/dates';
import { EDIT_WINDOW_DAYS, canEditEntry } from '../../lib/entries';
import { t } from '../../i18n/he';
import type { EntryDoc, PlanItem } from '../../types/types';

interface EntryLogListProps {
  /** דיווחי השבוע, כבר ממוינים מהחדש לישן ובלי מחוקים. */
  entries: EntryDoc[];
  /** פריטי המחזור — מהם נגזרים שם התרגיל והיחידה. */
  items: readonly PlanItem[];
  now: Date;
  busyEntryId: string | null;
  onEdit: (entry: EntryDoc) => void;
  onDelete: (entry: EntryDoc) => void;
}

export function EntryLogList({
  entries,
  items,
  now,
  busyEntryId,
  onEdit,
  onDelete,
}: EntryLogListProps) {
  const itemById = new Map(items.map((item) => [item.exerciseId, item]));

  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-slate-900">{t('player.log.title')}</h2>

      {entries.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          {t('player.log.empty')}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {entries.map((entry) => {
            const item = itemById.get(entry.exerciseId) ?? null;
            const editable = canEditEntry(entry, now);
            const busy = busyEntryId === entry.id;

            return (
              <li key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* בלי פריט אין יחידה להציג — התרגיל הוסר מהתוכנית באמצע השבוע. */}
                    <p className="text-sm font-semibold text-slate-900">
                      {item
                        ? t('player.log.amount', {
                            amount: entry.amount,
                            unit: t(`units.${item.unit}`),
                          })
                        : entry.amount}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-slate-600">
                      {item ? item.exerciseName : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatIsraeliDate(entry.date)}</p>
                  </div>

                  {item ? null : <Badge tone="muted">{t('player.log.offPlan')}</Badge>}
                </div>

                {entry.note ? (
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{entry.note}</p>
                ) : null}

                {editable ? (
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      disabled={busy}
                      onClick={() => onEdit(entry)}
                    >
                      {t('player.log.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      fullWidth={false}
                      busy={busy}
                      onClick={() => onDelete(entry)}
                    >
                      {t('player.log.delete')}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    {t('player.log.locked', { days: EDIT_WINDOW_DAYS })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
