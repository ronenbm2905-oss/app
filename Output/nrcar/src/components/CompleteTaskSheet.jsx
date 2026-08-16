import { useState, useMemo } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { completeTask as computeRenewal } from "../utils/renewal.js";
import { nextServiceDue } from "../utils/service.js";
import { vehicleLabel } from "../utils/options.js";
import { formatDate, formatNumber } from "../utils/format.js";
import { Field, DateInput, NumberInput } from "./ui/Field.jsx";
import Button from "./ui/Button.jsx";
import { Card, Notice } from "./ui/Card.jsx";

// ============================================================================
// CompleteTaskSheet — סימון "בוצע" + החידוש האוטומטי.
//
// 🔴 **החוק: אף פעם לא שומרים משימה חדשה בלי להראות אותה קודם.**
// זה היישום הישיר של "מציע, לא מבצע" (PRD פרק 5) — והוא חל **גם בלי AI**.
// המשתמש רואה בדיוק איזו תזכורת נפתחת ולאיזה תאריך, יכול לשנות אותו, ורק
// אז שומר. משתמש מבוגר שמגלה בדיעבד שנפתחה לו משימה שלא ביקש מפסיק לסמוך
// על האפליקציה — וזה כל מה שיש לנו.
// ============================================================================

export function CompleteTaskSheet({ task, vehicle, data, today, onConfirm, onCancel }) {
  const { t, lang } = useI18n();
  const [completedDate, setCompletedDate] = useState(today);
  const [km, setKm] = useState("");
  const [overrideDue, setOverrideDue] = useState(null);

  // החישוב הוא **תצוגה מקדימה**. שום דבר לא נשמר עד שלוחצים "אישור ושמירה".
  const preview = useMemo(
    () =>
      computeRenewal(task, {
        today,
        completedDate,
        completedKm: km === "" ? null : Number(km),
        readings: data.odometerReadings || [],
        vehicle,
      }),
    [task, today, completedDate, km, data.odometerReadings, vehicle]
  );

  const next = preview.next;
  const nextDue = overrideDue || next?.dueDate || null;
  const label = vehicleLabel(vehicle);

  const serviceEstimate = useMemo(() => {
    if (task.type !== "service") return null;
    return nextServiceDue(
      vehicle || { id: task.vehicleId },
      data.odometerReadings || [],
      { lastServiceDate: completedDate, lastServiceKm: km === "" ? null : Number(km) },
      today
    );
  }, [task, vehicle, data.odometerReadings, completedDate, km, today]);

  const noticeKey = !next
    ? `task.next.${task.type === "repair" ? "repair" : "other"}`
    : task.type === "service"
      ? serviceEstimate?.estimatedKmDate
        ? "task.next.service"
        : "task.next.service.noKm"
      : `task.next.${task.type}`;

  return (
    <Card className="space-y-4 p-4">
      <h2 className="text-xl font-semibold text-ink">{t("task.complete.title")}</h2>

      <Field label={t("task.complete.date.label")}>
        {({ id, ...aria }) => (
          <DateInput id={id} {...aria} value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} />
        )}
      </Field>

      <Field label={t("task.complete.km.label")} hint={t("task.complete.km.hint")}>
        {({ id, ...aria }) => <NumberInput id={id} {...aria} value={km} onChange={(e) => setKm(e.target.value)} />}
      </Field>

      {/* ★ "מה יקרה עכשיו" — המשימה הבאה, **לפני** השמירה. */}
      <section className="space-y-3 rounded-2xl bg-brand-50 p-4">
        <h3 className="text-xl font-semibold text-ink">{t("task.next.heading")}</h3>
        <p className="max-w-prose text-lg text-ink">
          {t(noticeKey, {
            vehicle: label,
            date: formatDate(nextDue, lang),
            km: serviceEstimate?.kmDue ? formatNumber(serviceEstimate.kmDue, lang) : "",
            coverage: t(`insurance.coverage.${task.coverage || "generic"}`),
          })}
        </p>
        {next && (
          <>
            <p className="text-base text-ink-muted">{t("task.next.remindLead")}</p>
            <Field label={t("task.next.edit")} hint={t("task.next.editHint")}>
              {({ id, ...aria }) => (
                <DateInput
                  id={id}
                  {...aria}
                  value={nextDue || ""}
                  onChange={(e) => setOverrideDue(e.target.value)}
                />
              )}
            </Field>
          </>
        )}
      </section>

      {task.type === "test" && (
        <Notice tone="info" title={t("task.complete.test.motMissing")} />
      )}

      <Button
        variant="confirm"
        onClick={() =>
          onConfirm({
            completedDate,
            completedKm: km === "" ? null : Number(km),
            overrideDue: overrideDue || null,
          })
        }
      >
        {t("task.complete.confirm")}
      </Button>
      <Button variant="quiet" size="md" onClick={onCancel}>
        {t("task.complete.cancel")}
      </Button>
    </Card>
  );
}

export default CompleteTaskSheet;
