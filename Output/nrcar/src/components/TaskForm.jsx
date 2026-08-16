import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { createTask, DEFAULT_TAG_BY_TYPE } from "../schema.js";
import { TASK_TYPE, TASK_TAG, INSURANCE_COVERAGE, DEFAULTS } from "../constants.js";
import { Field, Select, DateInput, TextInput, Switch } from "./ui/Field.jsx";
import Button from "./ui/Button.jsx";

// ============================================================================
// TaskForm — יצירה ועריכה של משימה.
//
// **רשימות סגורות בלבד** (סוג, תגית, כיסוי) — בלי הקלדה חופשית. זה מונע
// עומס קוגניטיבי מהמשתמש המבוגר, וגם מה שמאפשר למנוע להכיר את המשימה
// ולדעת מה המשפט הנכון להגיד עליה.
//
// "כמה זמן מראש להזכיר לי" הוא **השדה היחיד** שהמשתמש מכוון בו את המנוע —
// ברירות מחדל חכמות, עם אפשרות לשנות. שאר הסולם נגזר.
// ============================================================================

const LEAD_OPTIONS = [
  { days: 30, key: "settings.reminders.lead.month" },
  { days: 14, key: "settings.reminders.lead.twoWeeks" },
  { days: 7, key: "settings.reminders.lead.week" },
];

export function TaskForm({ task, vehicles, householdId, defaultVehicleId, defaultLeadDays, onSave, onCancel }) {
  const { t } = useI18n();
  const [type, setType] = useState(task?.type || "test");
  const [vehicleId, setVehicleId] = useState(task?.vehicleId || defaultVehicleId || vehicles?.[0]?.id || "");
  const [title, setTitle] = useState(task?.title || "");
  const [dueDate, setDueDate] = useState(task?.dueDate || "");
  const [tag, setTag] = useState(task?.tag || DEFAULT_TAG_BY_TYPE.test);
  const [coverage, setCoverage] = useState(task?.coverage || "compulsory");
  const [important, setImportant] = useState(Boolean(task?.important));
  const [leadDays, setLeadDays] = useState(
    task?.schedule?.leadDays ?? defaultLeadDays ?? DEFAULTS.leadDays
  );

  const needsTitle = type === "repair" || type === "other";

  const submit = () => {
    if (!dueDate || !vehicleId) return;
    onSave(
      createTask({
        id: task?.id,
        householdId,
        createdAt: task?.createdAt,
        vehicleId,
        type,
        title: needsTitle ? title : "",
        dueDate,
        tag,
        important,
        coverage: type === "insurance" ? coverage : null,
        leadDays,
        // עריכה של משימה קיימת שומרת את היסטוריית השליחה שלה.
        schedule: task ? { ...task.schedule, leadDays } : undefined,
      })
    );
  };

  return (
    <div className="space-y-4">
      <Field label={t("task.type.select")}>
        {({ id, ...aria }) => (
          <Select
            id={id}
            {...aria}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setTag(DEFAULT_TAG_BY_TYPE[e.target.value] || "other");
            }}
          >
            {TASK_TYPE.map((x) => (
              <option key={x} value={x}>
                {t(`task.type.${x}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {type === "insurance" && (
        <Field label={t("task.field.coverage")}>
          {({ id, ...aria }) => (
            <Select id={id} {...aria} value={coverage} onChange={(e) => setCoverage(e.target.value)}>
              {INSURANCE_COVERAGE.map((c) => (
                <option key={c} value={c}>
                  {t(`insurance.coverage.${c}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      {needsTitle && (
        <Field label={t("task.title.label")} hint={t("task.title.hint")}>
          {({ id, ...aria }) => (
            <TextInput id={id} {...aria} value={title} onChange={(e) => setTitle(e.target.value)} />
          )}
        </Field>
      )}

      <Field label={t("task.field.vehicle")}>
        {({ id, ...aria }) => (
          <Select id={id} {...aria} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {(vehicles || []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.nickname || [v.manufacturer, v.commercialName].filter(Boolean).join(" ") || v.plate}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={t("task.field.dueDate")}>
        {({ id, ...aria }) => (
          <DateInput id={id} {...aria} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        )}
      </Field>

      <Field label={t("tag.select")}>
        {({ id, ...aria }) => (
          <Select id={id} {...aria} value={tag} onChange={(e) => setTag(e.target.value)}>
            {TASK_TAG.map((x) => (
              <option key={x} value={x}>
                {t(`tag.${x}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={t("task.field.leadDays")} hint={t("settings.reminders.lead.hint")}>
        {({ id, ...aria }) => (
          <Select id={id} {...aria} value={leadDays} onChange={(e) => setLeadDays(Number(e.target.value))}>
            {LEAD_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Switch checked={important} onChange={setImportant} label={t("task.important.toggle")} />

      <Button variant="primary" onClick={submit} disabled={!dueDate || !vehicleId}>
        {t("common.save")}
      </Button>
      {onCancel && (
        <Button variant="quiet" size="md" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      )}
    </div>
  );
}

export default TaskForm;
