/**
 * "השבוע שלי" — התצוגה בלבד (PRD §7.2א).
 *
 * אין כאן Firestore ואין `Date.now()`: הסיכום השבועי מגיע מוכן כ-prop
 * (`WeekSummary`, שנבנה ב-`lib/entries.ts`), הרגע הנוכחי מוזרק, וכל כתיבה היא
 * callback. זה מה שמאפשר לרנדר את המסך בטסט עם נתונים אמיתיים.
 *
 * ## מה המסך מציג בכל מצב
 *
 * **אין מחזור לשבוע** → אין טבעת ואין כרטיסים, אלא הודעה "אין תוכנית לשבוע זה"
 * (PRD §8.4). זה **לא** 0%: 0% אומר "נכשלת", ואין תוכנית אומר "אין מה לעשות".
 * דיווחים שנרשמו בכל זאת מוצגים ביומן, כדי שלא ייעלמו.
 *
 * **יש מחזור** → טבעת כללית (חסומה ב-100 בתוך `overallPct`), כרטיס לכל תרגיל
 * עם האחוז המלא, ויומן דיווחים עם עריכה ומחיקה.
 *
 * החלון עצמו הוא state מקומי — הוא UI ולא נתון, ולכן לא מטופס למעלה.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { pctTone, roundPct } from '../../lib/calculations';
import { daysLeftInWeek, formatIsraeliDate } from '../../lib/dates';
import { draftFromEntry, newEntryDraft, type EntryDraft, type WeekSummary } from '../../lib/entries';
import type { Feedback } from '../../lib/feedback';
import type { LoadStatus } from '../../hooks/loadStatus';
import { ROUTES } from '../../lib/routing';
import { t } from '../../i18n/he';
import type { EntryDoc, Unit } from '../../types/types';
import { EntryLogList } from './EntryLogList';
import { ReportDialog } from './ReportDialog';
import { WeekExerciseCard } from './WeekExerciseCard';

/** מה החלון פתוח עליו. `null` = סגור. */
type DialogState =
  | { mode: 'create'; exerciseId: string }
  | { mode: 'edit'; entry: EntryDoc }
  | null;

export interface MyWeekViewProps {
  status: LoadStatus;
  /** שם הקבוצה לכותרת, או null כשעדיין לא נטענה. */
  teamName: string | null;
  hasTeam: boolean;
  now: Date;
  /** הסיכום של השבוע הנוכחי, או null כשאין מחזור. */
  summary: WeekSummary | null;
  /** דיווחי השבוע (לא מחוקים), מהחדש לישן. */
  weekEntries: EntryDoc[];
  /** פתיחת המחזור השבועי נכשלה — להבדיל מטעינה שנכשלה. */
  cycleError: boolean;
  reportBusy: boolean;
  reportError: string | null;
  busyEntryId: string | null;
  feedback: Feedback | null;
  onCreate: (exerciseId: string, draft: EntryDraft) => Promise<boolean>;
  onUpdate: (entry: EntryDoc, draft: EntryDraft) => Promise<boolean>;
  onDelete: (entry: EntryDoc) => void;
}

export function MyWeekView({
  status,
  teamName,
  hasTeam,
  now,
  summary,
  weekEntries,
  cycleError,
  reportBusy,
  reportError,
  busyEntryId,
  feedback,
  onCreate,
  onUpdate,
  onDelete,
}: MyWeekViewProps) {
  const [dialog, setDialog] = useState<DialogState>(null);

  if (!hasTeam) {
    return <Alert tone="info">{t('player.myWeek.noTeam')}</Alert>;
  }

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">{t('player.myWeek.loading')}</p>;
  }

  if (status === 'error') {
    return <Alert tone="error">{t('player.myWeek.loadError')}</Alert>;
  }

  const daysLeft = daysLeftInWeek(now);
  const items = summary?.items ?? [];
  const overall = roundPct(summary?.overall ?? 0);

  /** פרטי התרגיל שהחלון נפתח עליו. תרגיל שהוסר מהתוכנית מגיע בלי יעד. */
  const dialogExercise = (): { name: string; unit: Unit; target: number | null } => {
    const exerciseId =
      dialog?.mode === 'create' ? dialog.exerciseId : (dialog?.entry.exerciseId ?? '');
    const stat = items.find((item) => item.exerciseId === exerciseId);

    if (stat) return { name: stat.exerciseName, unit: stat.unit, target: stat.target };
    return { name: t('player.log.offPlan'), unit: 'count', target: null };
  };

  const exercise = dialogExercise();

  return (
    <div>
      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        {teamName ? <p className="text-sm font-medium text-slate-700">{teamName}</p> : null}

        {summary ? (
          <p className="mt-0.5 text-sm text-slate-500">
            {t('player.myWeek.weekRange', {
              start: formatIsraeliDate(summary.weekStart),
              end: formatIsraeliDate(summary.weekEnd),
            })}
          </p>
        ) : null}

        <p className="mt-0.5 text-sm text-slate-500">
          {daysLeft > 1
            ? t('player.myWeek.daysLeft', { count: daysLeft })
            : t('player.myWeek.lastDay')}
        </p>
      </header>

      {feedback ? (
        <div className="mt-3">
          <Alert tone={feedback.tone === 'error' ? 'error' : 'success'}>{feedback.text}</Alert>
        </div>
      ) : null}

      {cycleError ? (
        <div className="mt-3">
          <Alert tone="error">{t('player.myWeek.cycleFailed')}</Alert>
        </div>
      ) : null}

      {summary && summary.hasPlan ? (
        <>
          <div className="mt-5 flex flex-col items-center">
            <ProgressRing
              pct={summary.overall}
              tone={pctTone(summary.overall)}
              caption={t('player.myWeek.overallLabel')}
              label={`${t('player.myWeek.overallLabel')} ${overall}%`}
            />
            <p className="mt-2 max-w-sm text-center text-xs text-slate-400">
              {t('player.myWeek.overallHint')}
            </p>
          </div>

          <section className="mt-6">
            <h2 className="text-lg font-bold text-slate-900">{t('player.myWeek.exercisesTitle')}</h2>
            <ul className="mt-2 space-y-3">
              {items.map((stat) => (
                <WeekExerciseCard
                  key={stat.exerciseId}
                  stat={stat}
                  disabled={reportBusy}
                  onReport={() => setDialog({ mode: 'create', exerciseId: stat.exerciseId })}
                />
              ))}
            </ul>
          </section>
        </>
      ) : (
        <div className="mt-4 space-y-2">
          <Alert tone="info">{t('player.myWeek.noPlan')}</Alert>
          {weekEntries.length > 0 ? (
            <Alert tone="info">{t('player.myWeek.noPlanEntries')}</Alert>
          ) : null}
        </div>
      )}

      <EntryLogList
        entries={weekEntries}
        items={items}
        now={now}
        busyEntryId={busyEntryId}
        onEdit={(entry) => setDialog({ mode: 'edit', entry })}
        onDelete={onDelete}
      />

      <p className="mt-6 text-center">
        <Link
          to={ROUTES.playerHistory}
          className="text-sm font-medium text-slate-700 underline underline-offset-4"
        >
          {t('player.myWeek.historyLink')}
        </Link>
      </p>

      {dialog ? (
        <ReportDialog
          mode={dialog.mode}
          exerciseName={exercise.name}
          unit={exercise.unit}
          target={exercise.target}
          initialDraft={
            dialog.mode === 'edit' ? draftFromEntry(dialog.entry) : newEntryDraft(now)
          }
          now={now}
          busy={reportBusy}
          error={reportError}
          onSubmit={(draft) =>
            dialog.mode === 'edit'
              ? onUpdate(dialog.entry, draft)
              : onCreate(dialog.exerciseId, draft)
          }
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
