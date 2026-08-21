/**
 * יומן הדיווחים של שחקן, בעיניים של המאמן (PRD §7.3ג, TASKS שלב 5ג).
 *
 * שלושה הבדלים מהיומן של השחקן (`features/player/EntryLogList.tsx`), וכל אחד
 * מהם נובע מהרשאה או מתפקיד:
 *
 * 1. **אין חלון עריכה.** לשחקן יש 7 ימים מרגע הרישום; למאמן אין חלון בכלל
 *    (`entries.update` → `isTeamCoach(resource.data.teamId)`). לכן אין כאן
 *    `canEditEntry` ואין הודעה על כפתור שנעלם.
 *
 * 2. **מוצגים גם דיווחים שנמחקו-רכות**, מסומנים ומעומעמים. זה בדיוק המידע
 *    שהמאמן צריך כשמספר לא מסתדר: ההבדל בין "לא דיווח" לבין "דיווח ונמחק".
 *    השחקן לא רואה את שלו, כי אצלו זה רק רעש.
 *
 * 3. **הרשימה היא של כל העונה**, ולכן היא נחתכת ל-`PAGE_SIZE` עם כפתור
 *    "הצגת דיווחים נוספים". חיתוך בצד הלקוח ולא ב-`limit()` של השאילתה —
 *    השאילתה היא שוויון בודד בלי מיון, ו-`limit` בלי `orderBy` היה חותך
 *    שרירותית (ראה `hooks/useTeamEntries.ts`).
 *
 * **אין כפתור שחזור** לדיווח שנמחק, בדיוק כמו במסך השחקן. אם יתברר שצריך —
 * הכלל כבר מתיר את זה (`deleted: false` הוא עדכון רגיל), וזו תוספת של שורה.
 */

import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatIsraeliDate } from '../../lib/dates';
import { t } from '../../i18n/he';
import type { EntryDoc, PlanItem } from '../../types/types';

/** כמה דיווחים מוצגים לפני "הצגת דיווחים נוספים". */
export const PAGE_SIZE = 15;

interface PlayerEntryLogProps {
  /** כל הדיווחים של השחקן, מהחדש לישן, כולל מחוקים-רכות. */
  entries: EntryDoc[];
  /** פריטי התוכנית מכל המחזורים — מהם נגזרים שם התרגיל והיחידה. */
  items: readonly PlanItem[];
  busyEntryId: string | null;
  onEdit: (entry: EntryDoc) => void;
  onDelete: (entry: EntryDoc) => void;
}

export function PlayerEntryLog({
  entries,
  items,
  busyEntryId,
  onEdit,
  onDelete,
}: PlayerEntryLogProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const itemById = new Map(items.map((item) => [item.exerciseId, item]));
  const visible = entries.slice(0, shown);

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900">{t('coach.player.log.title')}</h2>

      {entries.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          {t('coach.player.log.empty')}
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-2">
            {visible.map((entry) => {
              const item = itemById.get(entry.exerciseId) ?? null;
              const busy = busyEntryId === entry.id;
              const deleted = entry.deleted === true;

              return (
                <li
                  key={entry.id}
                  className={`rounded-2xl border p-3 ${
                    deleted ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          deleted ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        {item
                          ? t('coach.player.log.amount', {
                              amount: entry.amount,
                              unit: t(`units.${item.unit}`),
                            })
                          : entry.amount}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-slate-600">
                        {item ? item.exerciseName : null}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatIsraeliDate(entry.date)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {deleted ? <Badge tone="muted">{t('coach.player.log.deletedBadge')}</Badge> : null}
                      {item ? null : <Badge tone="muted">{t('coach.player.log.offPlan')}</Badge>}
                      {/* createdBy שונה מ-playerUid = מאמן הזין במקום השחקן. */}
                      {entry.createdBy && entry.createdBy !== entry.playerUid ? (
                        <Badge tone="accent">{t('coach.player.log.coachBadge')}</Badge>
                      ) : null}
                    </div>
                  </div>

                  {entry.note ? (
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                      {t('coach.player.log.playerNote', { note: entry.note })}
                    </p>
                  ) : null}

                  {deleted ? null : (
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="secondary"
                        fullWidth={false}
                        disabled={busy}
                        onClick={() => onEdit(entry)}
                      >
                        {t('coach.player.log.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        fullWidth={false}
                        busy={busy}
                        onClick={() => onDelete(entry)}
                      >
                        {t('coach.player.log.delete')}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {entries.length > visible.length ? (
            <div className="mt-3 space-y-1">
              <Button variant="secondary" onClick={() => setShown((value) => value + PAGE_SIZE)}>
                {t('coach.player.log.showMore')}
              </Button>
              <p className="text-center text-xs text-slate-400">
                {t('coach.player.log.shown', {
                  shown: visible.length,
                  total: entries.length,
                })}
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
