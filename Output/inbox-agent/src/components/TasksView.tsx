// ============================================================================
// TasksView.tsx — לוח המשימות + ייצוא ליומן.
//
// הכפתור "ייצוא ליומן" מייצא **רק משימות עם מועד**, וההסבר כתוב על המסך.
// זו לא הגבלה טכנית אלא ההיקף שנקבע: משימה בלי זמן אינה אירוע, ואילו ייצאנו
// אותה היינו צריכים להמציא לה שעה — כלומר לכתוב ליומן של המשתמשת דבר שהיא לא
// אמרה. עדיף כפתור שמסביר את עצמו מאשר יומן שמתמלא בהמצאות.
// ============================================================================

import { useMemo, useState } from 'react';
import type { Task } from '../../shared/types';
import { downloadIcs } from '../utils/calendar';
import { t } from '../i18n';
import { Banner } from './ui/Badge';

export interface TasksViewProps {
  tasks: Task[];
  canEdit: boolean;
  onAdd: (title: string, scheduledAt: string | null) => void;
  onToggleDone: (id: string) => void;
  onRemove: (id: string) => void;
  onReschedule: (id: string, scheduledAt: string | null) => void;
}

export function TasksView({
  tasks,
  canEdit,
  onAdd,
  onToggleDone,
  onRemove,
  onReschedule,
}: TasksViewProps) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');

  const schedulable = useMemo(() => tasks.filter((x) => x.scheduledAt), [tasks]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title, when || null);
    setTitle('');
    setWhen('');
  };

  return (
    <div className="space-y-4">
      {!canEdit ? <Banner tone="warn">{t('readOnlyBanner')}</Banner> : null}

      {canEdit ? (
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-slate-800">{t('taskNew')}</h2>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="flex-1">
              <span className="sr-only">{t('taskTitlePlaceholder')}</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('taskTitlePlaceholder')}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </label>
            <label className="sm:w-56">
              <span className="sr-only">{t('taskWhen')}</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
            >
              {t('taskAdd')}
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800">
            {t('tabTasks')}{' '}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {tasks.length}
            </span>
          </h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={schedulable.length === 0}
              onClick={() => downloadIcs(schedulable)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {t('tasksExportIcs')} ({schedulable.length})
            </button>
          </div>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          {schedulable.length === 0 ? t('tasksExportEmpty') : t('tasksExportHint')}
        </p>

        {tasks.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t('tasksEmpty')}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className={`flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3 ${
                  task.status === 'done' ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={task.status === 'done'}
                  onChange={() => onToggleDone(task.id)}
                  disabled={!canEdit}
                  aria-label={`${t('taskDone')}: ${task.title}`}
                  className="h-4 w-4 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm text-slate-900 ${
                      task.status === 'done' ? 'line-through' : ''
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.sourceItemId ? (
                    <p className="text-xs text-slate-400">
                      {t('sourceMail')}: {task.sourceItemId}
                    </p>
                  ) : null}
                </div>

                <label className="shrink-0">
                  <span className="sr-only">{t('taskWhen')}</span>
                  <input
                    type="datetime-local"
                    value={task.scheduledAt ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => onReschedule(task.id, e.target.value || null)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onRemove(task.id)}
                    className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {t('taskDelete')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
