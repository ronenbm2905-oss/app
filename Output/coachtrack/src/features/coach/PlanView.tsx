/**
 * מסך בניית התוכנית — התצוגה בלבד. אין כאן Firestore ואין `Date.now()`:
 * הרגע הנוכחי מגיע כ-prop (`now`), וכל כתיבה היא callback. זה מה שמאפשר
 * לרנדר את המסך בטסט, וגם מה שמאפשר לבדוק "מה יקרה בשבוע הבא" בלי לגעת בשעון.
 *
 * ## המסך מציג שני מצבים שונים לגמרי מאותו טופס
 *
 * **אין תוכנית פעילה** → כפתור אחד: "פרסום התוכנית".
 * **יש תוכנית פעילה** → שני כפתורים, וזו כל הנקודה של PRD §7.4:
 * *מהשבוע הנוכחי* (מעדכן גם את `itemsSnapshot` של המחזור הרץ — האחוזים
 * מחושבים מחדש) מול *מהשבוע הבא* (השבוע הנוכחי נשאר שלם). המסך מסביר את
 * ההבדל בטקסט ליד כל כפתור, כי זו החלטה שאי אפשר לבטל בקליק אחד.
 *
 * הטיוטה מתאפסת מהתוכנית בכל פעם שהתוכנית משתנה במסד — כולל אחרי כתיבה של
 * המאמן עצמו. זה נראה כמו "השינויים שלי נדרסו", אבל זה ההפך: אחרי שמירה
 * מוצלחת הטופס מציג את מה שבאמת שמור, ולא גרסה מקומית שנפרדה ממנו.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Select';
import { formatIsraeliDate, getNextWeekBounds } from '../../lib/dates';
import { suggestedTarget } from '../../lib/exercises';
import {
  MAX_PLAN_ITEMS,
  draftFromExercise,
  draftFromItems,
  isPlanDraftValid,
  templateToDraft,
  toPlanItems,
  validatePlanDraft,
} from '../../lib/plans';
import type { PlanDraftErrors, PlanDraftItem } from '../../lib/plans';
import type { Feedback } from '../../lib/feedback';
import type { LoadStatus } from '../../hooks/loadStatus';
import { t } from '../../i18n/he';
import type {
  ExerciseDoc,
  PlanCycleDoc,
  PlanDoc,
  PlanItem,
  PlanTemplateDoc,
  TeamDoc,
} from '../../types/types';
import { PlanExercisePicker } from './PlanExercisePicker';
import { PlanItemEditor } from './PlanItemEditor';
import { PlanPreview } from './PlanPreview';
import { PlanStatusCard } from './PlanStatusCard';
import { PlanTemplatesPanel } from './PlanTemplatesPanel';

/** הפעולה שרצה כרגע. אחת בכל רגע — שתי כתיבות במקביל לאותה תוכנית זה מרוץ. */
export type PlanAction = 'publish' | 'currentWeek' | 'nextWeek' | 'stop' | 'template';

export interface PlanViewProps {
  status: LoadStatus;
  teams: TeamDoc[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  exercises: ExerciseDoc[];
  activePlan: PlanDoc | null;
  currentCycle: PlanCycleDoc | null;
  cycleError: boolean;
  /** הרגע הנוכחי, מוזרק מהעמוד. */
  now: Date;
  templatesStatus: LoadStatus;
  templates: PlanTemplateDoc[];
  coachUid: string;
  busy: PlanAction | null;
  feedback: Feedback | null;
  onPublish: (items: PlanItem[]) => Promise<boolean>;
  onUpdateCurrentWeek: (items: PlanItem[]) => Promise<boolean>;
  onUpdateNextWeek: (items: PlanItem[]) => Promise<boolean>;
  onStop: () => Promise<boolean>;
  onSaveTemplate: (name: string, items: PlanItem[]) => Promise<boolean>;
  onLoadTemplate: (template: PlanTemplateDoc, droppedCount: number) => void;
  onDeleteTemplate: (template: PlanTemplateDoc) => Promise<boolean>;
}

const NO_ERRORS: PlanDraftErrors = { items: {} };

/** חתימה של המצב השמור — לפיה מחליטים מתי לאפס את הטיוטה. */
function baseSignature(teamId: string | null, plan: PlanDoc | null): string {
  return `${teamId ?? 'none'}|${plan ? plan.id : 'none'}|${JSON.stringify(plan?.items ?? [])}`;
}

export function PlanView({
  status,
  teams,
  selectedTeamId,
  onSelectTeam,
  exercises,
  activePlan,
  currentCycle,
  cycleError,
  now,
  templatesStatus,
  templates,
  coachUid,
  busy,
  feedback,
  onPublish,
  onUpdateCurrentWeek,
  onUpdateNextWeek,
  onStop,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
}: PlanViewProps) {
  const signature = baseSignature(selectedTeamId, activePlan);

  const [draft, setDraft] = useState<PlanDraftItem[]>(() =>
    activePlan ? draftFromItems(activePlan.items) : [],
  );
  const [errors, setErrors] = useState<PlanDraftErrors>(NO_ERRORS);
  const [showPicker, setShowPicker] = useState(false);
  const lastSignature = useRef(signature);

  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setDraft(activePlan ? draftFromItems(activePlan.items) : []);
    setErrors(NO_ERRORS);
  }, [signature, activePlan]);

  const savedDraft = useMemo(
    () => (activePlan ? draftFromItems(activePlan.items) : []),
    [activePlan],
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const suggestions = useMemo(() => {
    const byId = new Map<string, number | null>();
    for (const exercise of exercises) byId.set(exercise.id, suggestedTarget(exercise));
    return byId;
  }, [exercises]);

  const availableIds = useMemo(() => exercises.map((exercise) => exercise.id), [exercises]);
  const chosenIds = draft.map((item) => item.exerciseId);

  /** מאמת, ואם הכל תקין מריץ את הפעולה עם הפריטים המוכנים. */
  async function submit(action: (items: PlanItem[]) => Promise<boolean>) {
    const found = validatePlanDraft(draft);
    setErrors(found);
    if (!isPlanDraftValid(found)) return;
    await action(toPlanItems(draft));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  }

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">{t('coach.plan.loading')}</p>;
  }

  if (status === 'error') {
    return <Alert tone="error">{t('coach.plan.loadError')}</Alert>;
  }

  if (!selectedTeamId) {
    return <Alert tone="info">{t('coach.plan.noTeam')}</Alert>;
  }

  const nextWeekLabel = formatIsraeliDate(getNextWeekBounds(now).weekStart);
  const draftValid = isPlanDraftValid(validatePlanDraft(draft));

  return (
    <div className="space-y-4">
      {feedback ? <Alert tone={feedback.tone}>{feedback.text}</Alert> : null}

      {teams.length > 1 ? (
        <SelectField
          id="plan-team"
          label={t('coach.plan.teamSelectLabel')}
          value={selectedTeamId}
          onChange={(event) => onSelectTeam(event.target.value)}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <PlanStatusCard plan={activePlan} cycle={currentCycle} cycleError={cycleError} now={now} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{t('coach.plan.editor.title')}</h2>
          {dirty ? <p className="text-xs text-amber-800">{t('coach.plan.editor.dirty')}</p> : null}
        </div>

        {errors.form ? (
          <Alert tone="error">{t(errors.form, { max: MAX_PLAN_ITEMS })}</Alert>
        ) : null}

        {draft.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {t('coach.plan.editor.empty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {draft.map((item, index) => (
              <PlanItemEditor
                key={item.exerciseId}
                item={item}
                index={index}
                total={draft.length}
                suggestion={suggestions.get(item.exerciseId) ?? null}
                error={errors.items[item.exerciseId]}
                onChange={(next) =>
                  setDraft(draft.map((current, at) => (at === index ? next : current)))
                }
                onRemove={() => setDraft(draft.filter((_, at) => at !== index))}
                onMove={(direction) => move(index, direction)}
              />
            ))}
          </ul>
        )}

        {activePlan ? (
          <p className="text-xs text-slate-500">{t('coach.plan.editor.removalWarning')}</p>
        ) : null}

        {showPicker ? (
          <PlanExercisePicker
            exercises={exercises}
            chosenIds={chosenIds}
            onAdd={(exercise) => setDraft([...draft, draftFromExercise(exercise)])}
            onClose={() => setShowPicker(false)}
          />
        ) : (
          <Button variant="secondary" onClick={() => setShowPicker(true)}>
            {t('coach.plan.editor.addToggle')}
          </Button>
        )}

        {dirty ? (
          <Button variant="ghost" onClick={() => setDraft(savedDraft)}>
            {t('coach.plan.editor.reset')}
          </Button>
        ) : null}
      </section>

      <PlanPreview items={draft} />

      {activePlan ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">{t('coach.plan.update.title')}</h2>
          <p className="text-sm text-slate-600">{t('coach.plan.update.hint')}</p>

          <div className="space-y-1.5">
            <Button
              busy={busy === 'currentWeek'}
              disabled={busy !== null || !dirty}
              onClick={() => {
                // אזהרה לפני חישוב מחדש של שבוע שכבר דווח בו (PRD §8.4).
                if (!window.confirm(t('coach.plan.update.currentWeekConfirm'))) return;
                void submit(onUpdateCurrentWeek);
              }}
            >
              {busy === 'currentWeek' ? t('coach.plan.update.busy') : t('coach.plan.update.currentWeek')}
            </Button>
            <p className="text-xs text-slate-500">{t('coach.plan.update.currentWeekHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Button
              variant="secondary"
              busy={busy === 'nextWeek'}
              disabled={busy !== null || !dirty}
              onClick={() => void submit(onUpdateNextWeek)}
            >
              {busy === 'nextWeek' ? t('coach.plan.update.busy') : t('coach.plan.update.nextWeek')}
            </Button>
            <p className="text-xs text-slate-500">
              {t('coach.plan.update.nextWeekHint', { date: nextWeekLabel })}
            </p>
          </div>

          {dirty ? null : <p className="text-xs text-slate-500">{t('coach.plan.update.noChanges')}</p>}

          <div className="space-y-1.5 border-t border-slate-200 pt-3">
            <Button
              variant="ghost"
              busy={busy === 'stop'}
              disabled={busy !== null}
              onClick={() => {
                if (!window.confirm(t('coach.plan.stop.confirm'))) return;
                void onStop();
              }}
            >
              {busy === 'stop' ? t('coach.plan.stop.busy') : t('coach.plan.stop.button')}
            </Button>
            <p className="text-xs text-slate-500">{t('coach.plan.stop.hint')}</p>
          </div>
        </section>
      ) : (
        <section className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <Button
            busy={busy === 'publish'}
            disabled={busy !== null || draft.length === 0}
            onClick={() => void submit(onPublish)}
          >
            {busy === 'publish' ? t('coach.plan.publish.busy') : t('coach.plan.publish.button')}
          </Button>
          <p className="text-xs text-slate-500">{t('coach.plan.publish.hint')}</p>
        </section>
      )}

      <PlanTemplatesPanel
        status={templatesStatus}
        templates={templates}
        coachUid={coachUid}
        canSave={draft.length > 0 && draftValid && busy === null}
        busy={busy === 'template'}
        onSave={(name) => onSaveTemplate(name, toPlanItems(draft))}
        onLoad={(template) => {
          const { draft: loaded, droppedCount } = templateToDraft(template, availableIds);
          setDraft(loaded);
          setErrors(NO_ERRORS);
          onLoadTemplate(template, droppedCount);
        }}
        onDelete={onDeleteTemplate}
      />
    </div>
  );
}
