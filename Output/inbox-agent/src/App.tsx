// ============================================================================
// App.tsx — שלד המסך: כותרת, באנר מצב הדגמה, וארבע לשוניות.
//
// `canEdit` מועבר לכל view גם כשהוא תמיד `true` בפרוסה 0. זה לא קוד מת: ברגע
// שיש הרשאות אמיתיות, הרכיבים כבר יודעים להסתיר כפתורים ולהציג באנר "צפייה
// בלבד" — ואין צורך לעבור עליהם אחד-אחד ולזכור מה בדיוק צריך להיחסם.
//
// ---------------------------------------------------------------------------
// ★ סדר הלשוניות אינו מקרי
// ---------------------------------------------------------------------------
// "מה עומד לקרות" יושבת **לפני** לוח המשימות, כי בשלב הזה היא המסך החשוב
// ביותר: זה המקום שבו בעלת העסק בודקת מה הסוכן היה עושה בתיבה שלה, לפני
// שהוא מקבל הרשאה לעשות משהו. שמנו אותה אחרונה בגרסה הראשונה, וזה היה מסתיר
// בדיוק את מה שצריך להיבדק.
// ============================================================================

import { useState } from 'react';
import { MorningBriefView } from './components/MorningBriefView';
import { InvoicesView } from './components/InvoicesView';
import { PlannedActionsView } from './components/PlannedActionsView';
import { TasksView } from './components/TasksView';
import { Banner } from './components/ui/Badge';
import { FriendlyError } from './components/ui/FriendlyError';
import { useTasks } from './hooks/useTasks';
import { useTriage } from './hooks/useTriage';
import { useInvoices } from './hooks/useInvoices';
import { usePlannedActions } from './hooks/usePlannedActions';
import { t } from './i18n';
import type { ClassifiedItem } from '../shared/types';

type Tab = 'brief' | 'invoices' | 'planned' | 'tasks';

export function App() {
  const [tab, setTab] = useState<Tab>('brief');
  const triage = useTriage();
  const tasksState = useTasks();
  const invoicesState = useInvoices();
  const planned = usePlannedActions();

  const canEdit = triage.canEdit && tasksState.canEdit;

  /**
   * יצירת משימה מפריט. עוברת דרך `addTask` הרגיל, ולכן המשימה נושאת
   * `updatedBy: 'user'` — הסוכן הציע, המשתמשת יצרה. זו ההבחנה שכל השאר
   * נשען עליה, והיא נשמרת גם כשהמוק הוא זה שניסח את הכותרת.
   */
  const createTaskFromItem = (item: ClassifiedItem) => {
    const suggested = item.agent?.suggestedTaskTitle;
    const title = suggested || `לטפל: ${item.subject}`;
    tasksState.addTask({ title, sourceItemId: item.id, scheduledAt: null });
    setTab('tasks');
  };

  const needsInvoiceAttention = invoicesState.invoices.filter(
    (i) => i.needsHumanReview && !i.reviewed,
  ).length;

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-3 py-5 sm:px-5">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">{t('appTitle')}</h1>
        <p className="text-sm text-slate-500">{t('appSubtitle')}</p>
      </header>

      {/* הבאנר קבוע ולא ניתן לסגירה בפרוסה 0. משתמשת שתשכח שאלה נתוני דוגמה
          עלולה להסיק מהמסך מסקנות על התיבה האמיתית שלה. */}
      <div className="mb-4">
        <Banner tone="info" title={t('demoBannerTitle')}>
          {t('demoBannerBody')}
        </Banner>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label={t('appTitle')}>
        <TabButton active={tab === 'brief'} onClick={() => setTab('brief')}>
          {t('tabBrief')}
        </TabButton>

        <TabButton active={tab === 'invoices'} onClick={() => setTab('invoices')}>
          {t('tabInvoices')}
          {needsInvoiceAttention > 0 ? (
            <Count
              value={needsInvoiceAttention}
              active={tab === 'invoices'}
              srLabel="חשבוניות שצריך שתסתכלי עליהן"
            />
          ) : null}
        </TabButton>

        <TabButton active={tab === 'planned'} onClick={() => setTab('planned')}>
          {t('tabPlanned')}
        </TabButton>

        <TabButton active={tab === 'tasks'} onClick={() => setTab('tasks')}>
          {t('tabTasks')}
          {tasksState.tasks.length > 0 ? (
            <Count value={tasksState.tasks.length} active={tab === 'tasks'} srLabel="משימות" />
          ) : null}
        </TabButton>
      </nav>

      <main>
        {/* ★ מצב תקלה מנוסח כמו שאדם היה מסביר אותו. הוא לא אמור לקרות
            במצב ההדגמה, וזה בדיוק למה הוא כאן: מסך תקלה שנכתב אחרי
            שהתקלה קרתה נכתב תמיד בשפה של מי שמתקן. */}
        {triage.items.length === 0 && !triage.loading ? (
          <FriendlyError
            whatHappened="לא הצלחתי לטעון את נתוני הדוגמה."
            whatToDo={null}
          />
        ) : tab === 'brief' ? (
          <MorningBriefView
            items={triage.items}
            bodies={triage.bodies}
            stats={triage.stats}
            canEdit={canEdit}
            onCreateTask={createTaskFromItem}
            onToggleHandled={triage.toggleHandled}
          />
        ) : tab === 'invoices' ? (
          <InvoicesView
            result={invoicesState.result}
            invoices={invoicesState.invoices}
            canEdit={invoicesState.canEdit}
            onToggleReviewed={invoicesState.toggleReviewed}
          />
        ) : tab === 'planned' ? (
          <PlannedActionsView
            plan={planned.plan}
            pinned={planned.pinned}
            canEdit={planned.canEdit}
            onKeep={planned.keepInInbox}
            onRelease={planned.releaseItem}
          />
        ) : (
          <TasksView
            tasks={tasksState.tasks}
            canEdit={canEdit}
            onAdd={(title, scheduledAt) => tasksState.addTask({ title, scheduledAt })}
            onToggleDone={tasksState.toggleDone}
            onRemove={tasksState.removeTask}
            onReschedule={(id, scheduledAt) => tasksState.updateTask(id, { scheduledAt })}
          />
        )}
      </main>

      <footer className="mt-8 text-center text-xs text-slate-400">
        נתוני דוגמה בלבד · שום דבר לא מחובר לגוגל · שום מייל אמיתי לא נקרא
      </footer>
    </div>
  );
}

/**
 * מונה ליד שם הלשונית.
 * `srLabel` אינו קישוט: מספר עירום ליד טקסט נקרא בקורא מסך כ"חשבוניות 3",
 * ו-3 של מה זה לא ברור. הטקסט המוסתר הופך אותו למשפט.
 */
function Count({ value, active, srLabel }: { value: number; active: boolean; srLabel: string }) {
  return (
    <span
      className={`ms-1 rounded-full px-1.5 text-xs font-semibold ${
        active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-800'
      }`}
    >
      {value}
      <span className="sr-only"> {srLabel}</span>
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      // גובה מגע 44px, פוקוס נראה, וניגודיות מעל 4.5:1 בשני המצבים.
      className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
        active
          ? 'bg-slate-900 text-white'
          : 'border border-slate-400 bg-white text-slate-800 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}
