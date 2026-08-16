import { Car } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { computeStatus, engineMessage, nextTaskForVehicle } from "../utils/reminders.js";
import { vehicleLabel, vehiclePlate } from "../utils/options.js";
import { formatDate } from "../utils/format.js";
import { StatusPill } from "./ui/StatusPill.jsx";

// ============================================================================
// VehicleCard — כרטיס רכב בדשבורד וברשימת הרכבים.
//
// **התמונה האמיתית היא עוגן הזיהוי של המבוגר** (PRD §4.2) — "זה האוטו שלי".
// לכן היא לא דקורטיבית: יש לה alt תיאורי, וכשהיא חסרה מוצג placeholder
// שמזמין להוסיף אותה במקום לשתוק.
//
// ⚠️ **בלי מונה משימות פתוחות.** ה-PRD מפורש בזה: מונה מעמיס בלי לעזור.
// מוצג פריט אחד — הקרוב ביותר.
// ============================================================================

export function VehicleCard({ vehicle, tasks, today, priority = false }) {
  const { t, lang } = useI18n();
  const label = vehicleLabel(vehicle);
  const next = nextTaskForVehicle(tasks, vehicle.id, today);
  const status = next ? computeStatus(next, today) : null;
  const msg = next ? engineMessage(next, label, today) : null;
  const photo = vehicle.photoData || null; // מצב מקומי; בענן נטען על פי דרישה

  return (
    <a
      href={`#/vehicle/${vehicle.id}`}
      className="block overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:bg-brand-50 active:bg-brand-100"
    >
      {photo ? (
        <img
          src={photo}
          alt={t("vehicle.field.photo") + " — " + label}
          className="aspect-[16/9] w-full object-cover"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 bg-canvas">
          <Car size={48} className="text-ink-muted" aria-hidden="true" />
          <span className="text-sm text-ink-muted">{t("vehicle.field.photo.hint")}</span>
        </div>
      )}

      <div className="space-y-2 p-4">
        <h3 className="text-xl font-semibold text-ink">{label || t("nav.vehicles")}</h3>
        <p className="text-lg text-ink-muted num">{vehiclePlate(vehicle)}</p>

        <div className="border-t border-line-soft pt-3">
          {next ? (
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={status} />
              <span className="text-lg text-ink">
                {msg ? t(`task.type.${next.type}`) : next.title || t(`task.type.${next.type}`)} ·{" "}
                <span className="num">{formatDate(next.dueDate, lang)}</span>
              </span>
            </div>
          ) : (
            <p className="text-lg text-ink-muted">{t("dashboard.vehicleCard.nothing")}</p>
          )}
        </div>

        {vehicle.status === "archived" && (
          <p className="text-base font-semibold text-ink-soft">{t("dashboard.vehicleCard.archived")}</p>
        )}
      </div>
    </a>
  );
}

export default VehicleCard;
