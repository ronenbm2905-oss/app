import { useState } from "react";
import { CalendarCheck, BellOff, Bell, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import {
  computeStatus,
  statusHintKey,
  engineMessage,
  attributionFor,
  fixActionKey,
} from "../utils/reminders.js";
import { vehicleById, vehicleLabel } from "../utils/options.js";
import { formatDate } from "../utils/format.js";
import { StatusPill, ImportantMark } from "./ui/StatusPill.jsx";
import Button from "./ui/Button.jsx";
import { Card, Notice } from "./ui/Card.jsx";
import CompleteTaskSheet from "./CompleteTaskSheet.jsx";
import TaskForm from "./TaskForm.jsx";

// ============================================================================
// TaskScreen — צפייה ועריכה של משימה בודדת.
//
// הפעולה הראשית משתנה לפי הסטטוס: משימה פתוחה → "סימנתי שביצעתי"; משימה
// שבוצעה → "ביטול הסימון". **פעולה ראשית אחת למסך.**
// ============================================================================

export function TaskScreen({ taskId, data, actions, householdId, today, canEdit, navigate }) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState(null); // null | "complete" | "edit"

  const task = (data.tasks || []).find((x) => x.id === taskId);
  if (!task) {
    return (
      <Notice tone="warn" title={t("error.notFound.title")}>
        <p>{t("error.notFound.body")}</p>
        <Button variant="primary" size="md" className="mt-3" onClick={() => navigate("/")}>
          {t("error.notFound.cta")}
        </Button>
      </Notice>
    );
  }

  const vehicle = vehicleById(data, task.vehicleId);
  const label = vehicleLabel(vehicle);
  const status = computeStatus(task, today);
  const msg = engineMessage(task, label, today);
  const attribution = attributionFor(task, vehicle, today);

  const title = msg
    ? t(msg.titleKey, { ...msg.vars, coverage: t(msg.vars.coverageKey) })
    : task.title || t(`task.type.${task.type}`);

  const confirmComplete = ({ completedDate, completedKm, overrideDue }) => {
    actions.completeTask(task, { today, completedDate, completedKm, motDate: overrideDue || null });
    setMode(null);
  };

  if (mode === "edit") {
    return (
      <Card className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-ink-strong">{t("task.form.title.edit")}</h1>
        <TaskForm
          task={task}
          vehicles={data.vehicles || []}
          householdId={householdId}
          defaultLeadDays={data.settings?.leadDays}
          onSave={(next) => {
            actions.saveTask(next, today);
            setMode(null);
          }}
          onCancel={() => setMode(null)}
        />
      </Card>
    );
  }

  return (
    <>
      <section className="space-y-3">
        <h1 className="text-balance text-2xl font-bold text-ink-strong">{title}</h1>
        <p className="text-lg text-ink-muted">{label}</p>
        <p className="text-lg text-ink">
          {t("task.due", { date: "" })}
          <span className="num">{formatDate(task.dueDate, lang)}</span>
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={status} />
          {task.important && <ImportantMark />}
        </div>

        {/* המחרוזת שמסבירה למה "באיחור" גובר על "בטיפול". */}
        <p className="max-w-prose text-lg text-ink-soft">{t(statusHintKey(task, today))}</p>

        {attribution && (
          <p className="max-w-prose text-sm text-ink-soft">{t(attribution.key, attribution.vars)}</p>
        )}

        {msg && status !== "done" && (
          <p className="max-w-prose text-lg text-ink">
            {t(msg.subKey, { ...msg.vars, coverage: t(msg.vars.coverageKey) })}
          </p>
        )}
      </section>

      {mode === "complete" ? (
        <CompleteTaskSheet
          task={task}
          vehicle={vehicle}
          data={data}
          today={today}
          onConfirm={confirmComplete}
          onCancel={() => setMode(null)}
        />
      ) : (
        <section className="space-y-3">
          {status !== "done" ? (
            <Button variant="confirm" onClick={() => setMode("complete")} disabled={!canEdit}>
              {status === "overdue" ? t(fixActionKey(task)) : t("task.complete.cta")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => actions.undoCompleteTask(task, today)} disabled={!canEdit}>
              {t("task.completed.undo")}
            </Button>
          )}

          {status !== "done" && (
            <Button
              variant="secondary"
              size="md"
              onClick={() =>
                actions.saveTask(
                  { ...task, manualStatus: task.manualStatus === "inProgress" ? null : "inProgress" },
                  today
                )
              }
              disabled={!canEdit}
            >
              <CalendarCheck size={24} aria-hidden="true" />
              {task.manualStatus === "inProgress" ? t("task.unmarkInProgress") : t("task.markInProgress")}
            </Button>
          )}

          <Button
            variant="secondary"
            size="md"
            onClick={() => actions.muteTask(task, !task.schedule?.muted, today)}
            disabled={!canEdit}
          >
            {task.schedule?.muted ? (
              <Bell size={24} aria-hidden="true" />
            ) : (
              <BellOff size={24} aria-hidden="true" />
            )}
            {task.schedule?.muted ? t("task.unmute") : t("task.mute")}
          </Button>

          <Button variant="quiet" size="md" onClick={() => setMode("edit")} disabled={!canEdit}>
            <Pencil size={24} aria-hidden="true" />
            {t("common.edit")}
          </Button>

          <Button
            variant="quiet"
            size="md"
            onClick={() => {
              actions.deleteTask(task.id);
              navigate("/");
            }}
            disabled={!canEdit}
          >
            <Trash2 size={24} aria-hidden="true" />
            {t("common.delete")}
          </Button>
        </section>
      )}
    </>
  );
}

export default TaskScreen;
