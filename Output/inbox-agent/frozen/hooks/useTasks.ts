// ============================================================================
// useTasks.ts — לוח המשימות. localStorage בלבד.
//
// זהו צד ה"מקומי" של תבנית ה-hook מ-`vite-react-scaffold`: אין `firebase.js`
// ואין `isFirebaseConfigured` בפרוסה 0, אבל **החתימה היא זו שתישאר**. בפרוסה 2
// נוסף הענף השני (`onSnapshot` + `onCall`), והרכיבים שקוראים ל-hook הזה לא
// משתנים — הם כבר מקבלים `canEdit` ולא מניחים שהכתיבה מיידית.
//
// כל כתיבה מכאן היא `updatedBy: 'user'` ומקדמת `rev`. זה נכתב עכשיו ולא
// "כשיהיה יומן", כי מניעת הלולאה בפרוסה 3 נשענת על כך שהשדה **תמיד** נכון;
// משימות שנוצרו לפני שהשדה קיים הופכות כל בדיקה עליו לניחוש.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { Task } from '../types';
import {
  DEFAULT_TASK_DURATION_MINUTES,
  EMPTY_TASKS,
  LOCAL_USER_ID,
  STORAGE_KEYS,
} from '../constants';

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tasks);
    if (!raw) return EMPTY_TASKS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Task[]) : EMPTY_TASKS;
  } catch {
    // JSON פגום לא מוחק את הלוח ולא מפיל את האפליקציה — הוא חוזר לריק.
    // אם נזרוק כאן, המשתמשת תראה מסך לבן ולא תדע למה.
    return EMPTY_TASKS;
  }
}

function persist(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  } catch {
    // מכסת אחסון מלאה. מוטב לוח שממשיך לעבוד בזיכרון מאשר קריסה.
  }
}

let seq = 0;
function newId(): string {
  seq += 1;
  return `t-${Date.now().toString(36)}-${seq.toString(36)}`;
}

export interface NewTaskInput {
  title: string;
  notes?: string;
  scheduledAt?: string | null;
  durationMinutes?: number;
  sourceItemId?: string | null;
}

export interface UseTasks {
  tasks: Task[];
  loading: boolean;
  canEdit: boolean;
  addTask: (input: NewTaskInput) => Task | null;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id' | 'userId'>>) => void;
  toggleDone: (id: string) => void;
  removeTask: (id: string) => void;
}

export function useTasks(): UseTasks {
  const [tasks, setTasks] = useState<Task[]>(EMPTY_TASKS);
  const [loading, setLoading] = useState(true);

  /**
   * במצב מקומי המשתמשת היא היחידה, ולכן היא מנהלת. הערך מוחזק כמשתנה ולא
   * נכתב `true` בכל מקום, כי בפרוסה 2 הוא מגיע מהרשאות אמיתיות והרכיבים כבר
   * מכבדים אותו.
   */
  const canEdit = true;

  useEffect(() => {
    setTasks(loadTasks());
    setLoading(false);
  }, []);

  const commit = useCallback((next: Task[]) => {
    setTasks(next);
    persist(next);
  }, []);

  const addTask = useCallback(
    (input: NewTaskInput): Task | null => {
      if (!canEdit) return null;
      const title = String(input.title ?? '').trim();
      if (!title) return null;

      const ts = new Date().toISOString();
      const task: Task = {
        userId: LOCAL_USER_ID,
        id: newId(),
        title,
        notes: input.notes ?? '',
        status: 'open',
        scheduledAt: input.scheduledAt ?? null,
        durationMinutes: input.durationMinutes ?? DEFAULT_TASK_DURATION_MINUTES,
        sourceItemId: input.sourceItemId ?? null,
        rev: 1,
        // ★ המשימה נוצרה בלחיצה של המשתמשת, ולכן `'user'`. הסוכן לעולם לא
        // כותב לכאן ישירות — הצעות שלו נוחתות ב-`proposals`.
        updatedBy: 'user',
        calendarEventId: null,
        calendarEtag: null,
        lastPushedRev: null,
        lastPulledUpdated: null,
        createdAt: ts,
        updatedAt: ts,
      };
      commit([task, ...tasks]);
      return task;
    },
    [canEdit, commit, tasks],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Omit<Task, 'id' | 'userId'>>) => {
      if (!canEdit) return;
      commit(
        tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                // `rev` עולה בכל שינוי תוכן. ההשוואה `rev === lastPushedRev`
                // היא שקובעת בפרוסה 3 אם יש מה לדחוף ליומן.
                rev: t.rev + 1,
                updatedBy: 'user',
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      );
    },
    [canEdit, commit, tasks],
  );

  const toggleDone = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      updateTask(id, { status: task.status === 'done' ? 'open' : 'done' });
    },
    [tasks, updateTask],
  );

  const removeTask = useCallback(
    (id: string) => {
      if (!canEdit) return;
      commit(tasks.filter((t) => t.id !== id));
    },
    [canEdit, commit, tasks],
  );

  return { tasks, loading, canEdit, addTask, updateTask, toggleDone, removeTask };
}
