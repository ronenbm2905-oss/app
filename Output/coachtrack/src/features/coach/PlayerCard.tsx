/**
 * כרטיס שחקן בעיני המאמן (PRD §7.3ג) — התצוגה בלבד.
 *
 * ארבעת החלקים שה-TASKS מבקש, בסדר הזה: **גרף התקדמות · פילוח לפי תרגיל ·
 * יומן דיווחים · הערות מאמן**. מעליהם שורת מצב של השבוע הנוכחי, כי זו השאלה
 * הראשונה שמאמן שואל אחרי שהוא לוחץ על שם במטריצה.
 *
 * ## שלוש החלטות
 *
 * 1. **אותם מספרים בדיוק שהשחקן רואה.** הסיכומים נבנים ב-`buildWeekSummaries`
 *    מתוך `itemsSnapshot` של המחזורים, בדיוק כמו במסך ההיסטוריה של השחקן,
 *    והגרף הוא אותה קומפוננטה (`components/WeeklyBars`). מאמן שרואה 73% ליד
 *    ילד שרואה 71% הוא סוף האמון במערכת.
 *
 * 2. **אין כאן ניתוב.** הכרטיס נפתח כמצב בתוך הדשבורד ולא ככתובת משלו
 *    (`/coach/player/:uid`), כי רשימת הנתיבים נגזרת מ-`navItemsForRole`
 *    ב-`lib/routing.ts` — מקור אמת יחיד לתפריט ולראוטים. נתיב עם פרמטר היה
 *    דורש מסלול שני. המחיר: אי אפשר לשלוח קישור ישיר לכרטיס, ורענון חוזר
 *    לדשבורד. ל-MVP זה בסדר; אם יידרש קישור ישיר — זו הרחבה של `routing.ts`.
 *
 * 3. **פרטים אישיים: רק מה שכבר קיים.** שם, שם משתמש, קבוצה ותאריך יצירה.
 *    אין כאן גיל, טלפון או הורה — כלל 7, והמשתמשים קטינים.
 */

import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { WeeklyBars } from '../../components/WeeklyBars';
import { pctTone, roundPct } from '../../lib/calculations';
import { formatIsraeliDate } from '../../lib/dates';
import type { ExerciseTrend, WeekSummary } from '../../lib/entries';
import type { Feedback } from '../../lib/feedback';
import type { LoadStatus } from '../../hooks/loadStatus';
import { t } from '../../i18n/he';
import type { EntryDoc, PlanItem, UserDoc } from '../../types/types';
import { CoachNotePanel } from './CoachNotePanel';
import { PlayerEntryLog } from './PlayerEntryLog';

export interface PlayerCardProps {
  player: UserDoc;
  teamName: string | null;
  /** שבועות מהחדש לישן. */
  summaries: WeekSummary[];
  /** מפתח-היום של השבוע הנוכחי — לזיהוי השורה העליונה. */
  currentWeekKey: string;
  streak: number;
  threshold: number;
  trends: ExerciseTrend[];
  /** כל הדיווחים של השחקן, מהחדש לישן, כולל מחוקים-רכות. */
  entries: EntryDoc[];
  /** פריטי התוכנית מכל המחזורים — לפתרון שמות ביומן. */
  items: PlanItem[];
  busyEntryId: string | null;
  feedback: Feedback | null;
  noteStatus: LoadStatus;
  noteText: string;
  noteUpdatedAt: Date | null;
  noteBusy: boolean;
  noteError: string | null;
  noteSaved: boolean;
  onSaveNote: (text: string) => void;
  onBack: () => void;
  onEditEntry: (entry: EntryDoc) => void;
  onDeleteEntry: (entry: EntryDoc) => void;
}

export function PlayerCard({
  player,
  teamName,
  summaries,
  currentWeekKey,
  streak,
  threshold,
  trends,
  entries,
  items,
  busyEntryId,
  feedback,
  noteStatus,
  noteText,
  noteUpdatedAt,
  noteBusy,
  noteError,
  noteSaved,
  onSaveNote,
  onBack,
  onEditEntry,
  onDeleteEntry,
}: PlayerCardProps) {
  const currentWeek = summaries.find((summary) => summary.weekKey === currentWeekKey) ?? null;
  const hasCurrentPlan = Boolean(currentWeek?.hasPlan);

  return (
    <div className="space-y-6">
      <Button variant="secondary" fullWidth={false} onClick={onBack}>
        {t('coach.player.back')}
      </Button>

      {feedback ? <Alert tone={feedback.tone}>{feedback.text}</Alert> : null}

      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-slate-900">{player.displayName}</h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {t('coach.team.usernameLine', { username: player.username })}
            </p>
            {teamName ? <p className="mt-0.5 text-sm text-slate-500">{teamName}</p> : null}
            {player.createdAt ? (
              <p className="mt-0.5 text-xs text-slate-400">
                {t('coach.player.joined', { date: formatIsraeliDate(player.createdAt) })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-1">
            {player.active ? null : <Badge tone="muted">{t('coach.team.inactiveBadge')}</Badge>}
            {player.mustChangePassword ? (
              <Badge tone="warning">{t('coach.team.pendingPasswordBadge')}</Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500">{t('coach.player.weekTitle')}</p>

          {hasCurrentPlan && currentWeek ? (
            <>
              <p className="mt-0.5 text-lg font-bold text-slate-900">
                {t('coach.player.weekOverall', { pct: roundPct(currentWeek.overall) })}
              </p>
              <div className="mt-2">
                <ProgressBar
                  pct={currentWeek.overall}
                  tone={pctTone(currentWeek.overall)}
                  label={t('coach.player.weekOverall', { pct: roundPct(currentWeek.overall) })}
                />
              </div>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-slate-500">{t('coach.player.weekNoPlan')}</p>
          )}

          <p className="mt-2 text-xs text-slate-500">
            {streak === 0
              ? t('coach.player.streakNone')
              : streak === 1
                ? t('coach.player.streakOne', { threshold })
                : t('coach.player.streak', { count: streak, threshold })}
          </p>
        </div>
      </header>

      {summaries.length === 0 ? (
        <Alert tone="info">{t('coach.player.empty')}</Alert>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-bold text-slate-900">{t('coach.player.chartTitle')}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{t('coach.player.chartHint')}</p>
            <div className="mt-3">
              <WeeklyBars summaries={summaries} />
            </div>
          </section>

          {trends.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-slate-900">
                {t('coach.player.breakdownTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{t('coach.player.breakdownHint')}</p>

              <ul className="mt-2 space-y-3">
                {trends.map((trend) => (
                  <li
                    key={trend.exerciseId}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          {trend.exerciseName}
                        </h3>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {t('player.history.breakdownTotals', {
                            total: trend.total,
                            target: trend.target,
                            unit: t(`units.${trend.unit}`),
                          })}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {t('player.history.breakdownWeeks', { count: trend.weeks })}
                        </p>
                      </div>

                      <span className="shrink-0 text-lg font-bold text-slate-900">
                        {roundPct(trend.pct)}%
                      </span>
                    </div>

                    <div className="mt-3">
                      <ProgressBar
                        pct={trend.pct}
                        tone={pctTone(trend.pct)}
                        label={`${trend.exerciseName} — ${roundPct(trend.pct)}%`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {/* key לפי השחקן: מעבר בין כרטיסים מאפס את מצב "הצג עוד" ואת טיוטת
          ההערה. בלי זה, טקסט שהמאמן הקליד על שחקן אחד היה מופיע בשדה של
          השחקן הבא — באג פרטיות, לא רק באג תצוגה. */}
      <PlayerEntryLog
        key={player.uid}
        entries={entries}
        items={items}
        busyEntryId={busyEntryId}
        onEdit={onEditEntry}
        onDelete={onDeleteEntry}
      />

      <CoachNotePanel
        key={player.uid}
        status={noteStatus}
        savedText={noteText}
        updatedAt={noteUpdatedAt}
        busy={noteBusy}
        error={noteError}
        saved={noteSaved}
        onSave={onSaveNote}
      />
    </div>
  );
}
