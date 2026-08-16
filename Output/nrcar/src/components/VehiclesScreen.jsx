import { useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { activeVehicles, archivedVehicles, liveTasks } from "../utils/options.js";
import { EmptyState } from "./ui/Card.jsx";
import Button, { LinkButton } from "./ui/Button.jsx";
import VehicleCard from "./VehicleCard.jsx";
import emptyIllustration from "../assets/empty-first-vehicle.png";

// ============================================================================
// VehiclesScreen — כרטיסים גדולים, אחד מתחת לשני. **הארכיון מקופל**:
// רכב שנמכר לא צריך להתחרות על תשומת הלב, אבל גם לא להיעלם — המסמכים
// וההיסטוריה שלו נשמרו בכוונה (PRD §7).
// ============================================================================

export function VehiclesScreen({ data, today }) {
  const { t } = useI18n();
  const [showArchive, setShowArchive] = useState(false);
  const active = activeVehicles(data);
  const archived = archivedVehicles(data);
  const tasks = liveTasks(data);
  const allTasks = data.tasks || [];

  if (!active.length && !archived.length) {
    return (
      <EmptyState
        illustration={emptyIllustration}
        title={t("empty.vehicles.title")}
        body={t("empty.vehicles.body")}
        action={
          <LinkButton href="#/vehicles/new" variant="primary">
            <Plus size={24} aria-hidden="true" />
            {t("empty.vehicles.cta")}
          </LinkButton>
        }
      />
    );
  }

  return (
    <>
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-ink-strong">{t("dashboard.vehicles.title")}</h1>
        {active.map((v, i) => (
          <VehicleCard key={v.id} vehicle={v} tasks={tasks} today={today} priority={i === 0} />
        ))}
        {!active.length && <p className="text-lg text-ink-muted">{t("empty.vehicles.body")}</p>}
      </section>

      <LinkButton href="#/vehicles/new" variant="secondary">
        <Plus size={24} aria-hidden="true" />
        {t("dashboard.addVehicle")}
      </LinkButton>

      {archived.length > 0 && (
        <section className="space-y-4 border-t border-line-soft pt-6">
          <h2 className="text-xl font-semibold text-ink">{t("vehicles.archived.title")}</h2>
          <Button variant="quiet" size="md" onClick={() => setShowArchive((s) => !s)}>
            {showArchive ? t("vehicles.archived.hide") : t("vehicles.archived.show")}
          </Button>
          {showArchive &&
            archived.map((v) => <VehicleCard key={v.id} vehicle={v} tasks={allTasks} today={today} />)}
        </section>
      )}
    </>
  );
}

export default VehiclesScreen;
