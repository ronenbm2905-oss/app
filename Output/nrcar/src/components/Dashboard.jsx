import { Plus } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { heroTask } from "../utils/reminders.js";
import { activeVehicles, liveTasks, vehicleById } from "../utils/options.js";
import { EmptyState } from "./ui/Card.jsx";
import { LinkButton } from "./ui/Button.jsx";
import HeroCard from "./HeroCard.jsx";
import VehicleCard from "./VehicleCard.jsx";
import emptyIllustration from "../assets/empty-first-vehicle.png";

// ============================================================================
// Dashboard — המסך הראשון. נותן בשנייה אחת את "מה דורש את תשומת הלב שלי
// עכשיו" (PRD §4.2).
//
// סדר: כרטיס-גיבור אחד → כרטיס לכל רכב → כפתור הוספה.
// **בלי מונה משימות פתוחות** — ה-PRD מפורש בזה.
//
// כפתור ה-"+" הוא **כפתור מסומן ברוחב מלא בתחתית התוכן**, לא FAB עגול:
// §9.1 של ה-PRD ("אייקונים ברורים עם טקסט") גובר על הפירוט ב-§9.2.
// ============================================================================

export function Dashboard({ data, today, onFix }) {
  const { t } = useI18n();
  const vehicles = activeVehicles(data);
  const tasks = liveTasks(data);
  const hero = heroTask(tasks, today);
  const heroVehicle = hero ? vehicleById(data, hero.vehicleId) : null;

  if (!vehicles.length) {
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
      <HeroCard task={hero} vehicle={heroVehicle} today={today} onFix={onFix} />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">{t("dashboard.vehicles.title")}</h2>
        {vehicles.map((v, i) => (
          <VehicleCard key={v.id} vehicle={v} tasks={tasks} today={today} priority={i === 0} />
        ))}
      </section>

      <LinkButton href="#/vehicles/new" variant="secondary">
        <Plus size={24} aria-hidden="true" />
        {t("dashboard.addVehicle")}
      </LinkButton>
    </>
  );
}

export default Dashboard;
