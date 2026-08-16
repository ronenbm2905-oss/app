import { useState } from "react";
import { Plus, Archive, RotateCcw, Car } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { sortTasks } from "../utils/reminders.js";
import { vehicleById, vehicleLabel, vehiclePlate, tasksForVehicle, documentsForVehicle } from "../utils/options.js";
import { formatDate, formatKm, formatPhone, telLink } from "../utils/format.js";
import { Tabs, TabPanel } from "./ui/Tabs.jsx";
import { Card, EmptyState, Notice } from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import TaskCard from "./TaskCard.jsx";
import TaskForm from "./TaskForm.jsx";
import DocumentUpload from "./DocumentUpload.jsx";
import DocViewer from "./DocViewer.jsx";
import VehicleForm from "./VehicleForm.jsx";
import { createVehicle } from "../schema.js";
import { seedTasksForVehicle } from "../utils/seed.js";

// ============================================================================
// VehicleScreen — דף רכב אחד, שלוש תתי-לשוניות: משימות / מסמכים / פרטים.
//
// כאן `role="tablist"` **נכון** (תוכן שמתחלף באותו עמוד), בניגוד לניווט
// התחתון שהוא `<nav>` + `aria-current`.
// ============================================================================

const DETAIL_FIELDS = [
  ["vehicle.field.manufacturer", "manufacturer", false],
  ["vehicle.field.model", "commercialName", false],
  ["vehicle.field.year", "year", true],
  ["vehicle.field.color", "color", false],
  ["vehicle.field.fuel", "fuelType", false],
];

export function VehicleScreen({ vehicleId, data, actions, householdId, uid, today, canEdit, isLocal, navigate }) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState("tasks");
  const [adding, setAdding] = useState(null); // null | "task" | "doc"
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(null);

  const vehicle = vehicleById(data, vehicleId);
  if (!vehicle) {
    return (
      <Notice tone="warn" title={t("error.notFound.title")}>
        <p>{t("error.notFound.body")}</p>
        <Button variant="primary" size="md" className="mt-3" onClick={() => navigate("/")}>
          {t("error.notFound.cta")}
        </Button>
      </Notice>
    );
  }

  const label = vehicleLabel(vehicle);
  const tasks = sortTasks(tasksForVehicle(data, vehicleId), today);
  const docs = documentsForVehicle(data, vehicleId);

  const startEdit = () => {
    setForm({
      ...vehicle,
      garageName: vehicle.garage?.name || "",
      garagePhone: vehicle.garage?.phone || "",
      year: vehicle.year ?? "",
      currentKm: vehicle.currentKm ?? "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    const next = createVehicle({
      ...form,
      id: vehicle.id,
      createdAt: vehicle.createdAt,
      householdId,
      garage: { name: form.garageName, phone: form.garagePhone },
      motSource: vehicle.motSource,
    });
    // תאריך שנוסף בעריכה זורע משימה — אבל לעולם לא כפילות.
    const seeded = seedTasksForVehicle(next, data.tasks || [], {
      today,
      leadDays: data.settings?.leadDays,
      readings: data.odometerReadings || [],
    });
    // ★ כתיבה אחת, כמו במסך ההוספה. אותו באג בדיוק היה כאן.
    actions.saveVehicleWithTasks(next, seeded);
    setEditing(false);
  };

  const photo = vehicle.photoData || null;

  return (
    <>
      <section className="space-y-3">
        {photo ? (
          <img src={photo} alt={`${t("vehicle.field.photo")} — ${label}`} className="aspect-[16/9] w-full rounded-2xl object-cover" />
        ) : (
          <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-surface-sunken">
            <Car size={48} className="text-ink-muted" aria-hidden="true" />
            <span className="text-sm text-ink-muted">{t("vehicle.field.photo.hint")}</span>
          </div>
        )}
        <h1 className="text-2xl font-bold text-ink-strong">{label}</h1>
        <p className="text-lg text-ink-muted num">{vehiclePlate(vehicle)}</p>
        {vehicle.status === "archived" && (
          <p className="text-lg font-semibold text-ink-soft">{t("vehicle.status.archived")}</p>
        )}
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        idPrefix="veh"
        items={[
          { key: "tasks", label: t("vehicle.tab.tasks") },
          { key: "docs", label: t("vehicle.tab.docs") },
          { key: "details", label: t("vehicle.tab.details") },
        ]}
      />

      {/* -- משימות -------------------------------------------------------- */}
      <TabPanel tabKey="tasks" value={tab} idPrefix="veh">
        {!tasks.length && !adding && (
          <EmptyState
            title={t("empty.tasks.title")}
            body={t("empty.tasks.body")}
            action={
              <Button variant="primary" onClick={() => setAdding("task")} disabled={!canEdit}>
                <Plus size={24} aria-hidden="true" />
                {t("empty.tasks.cta")}
              </Button>
            }
          />
        )}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} vehicle={vehicle} today={today} />
        ))}
        {adding === "task" ? (
          <Card className="space-y-4 p-4">
            <h2 className="text-xl font-semibold text-ink">{t("task.form.title.new")}</h2>
            <TaskForm
              vehicles={data.vehicles || []}
              householdId={householdId}
              defaultVehicleId={vehicleId}
              defaultLeadDays={data.settings?.leadDays}
              onSave={(task) => {
                actions.saveTask(task, today);
                setAdding(null);
              }}
              onCancel={() => setAdding(null)}
            />
          </Card>
        ) : (
          tasks.length > 0 && (
            <Button variant="secondary" onClick={() => setAdding("task")} disabled={!canEdit}>
              <Plus size={24} aria-hidden="true" />
              {t("vehicle.addTask")}
            </Button>
          )
        )}
      </TabPanel>

      {/* -- מסמכים -------------------------------------------------------- */}
      <TabPanel tabKey="docs" value={tab} idPrefix="veh">
        {!docs.length && adding !== "doc" && (
          <EmptyState
            title={t("empty.docs.title")}
            body={t("empty.docs.body")}
            action={
              <Button variant="primary" onClick={() => setAdding("doc")} disabled={!canEdit}>
                <Plus size={24} aria-hidden="true" />
                {t("empty.docs.cta")}
              </Button>
            }
          />
        )}
        {docs.map((d) => (
          <Card key={d.id} className="space-y-3 p-4">
            <h3 className="text-xl font-semibold text-ink">{t(`doc.type.${d.type}`)}</h3>
            {d.validUntil && (
              <p className="text-lg text-ink-muted">
                {t("doc.validUntil", { date: "" })}
                <span className="num">{formatDate(d.validUntil, lang)}</span>
              </p>
            )}
            <p className="text-base text-ink-muted">{t(`doc.visibility.${d.visibility}`)}</p>
            <Button variant="secondary" size="md" onClick={() => setViewing(d)} className="w-auto">
              {t("emergency.doc.open")}
            </Button>
          </Card>
        ))}
        {adding === "doc" ? (
          <Card className="space-y-4 p-4">
            <DocumentUpload
              vehicles={[vehicle]}
              householdId={householdId}
              uid={uid}
              isLocal={isLocal}
              onSave={(entity) => {
                actions.upsert("documents", entity);
                setAdding(null);
              }}
            />
            <Button variant="quiet" size="md" onClick={() => setAdding(null)}>
              {t("common.cancel")}
            </Button>
          </Card>
        ) : (
          docs.length > 0 && (
            <Button variant="secondary" onClick={() => setAdding("doc")} disabled={!canEdit}>
              <Plus size={24} aria-hidden="true" />
              {t("vehicle.addDoc")}
            </Button>
          )
        )}
      </TabPanel>

      {/* -- פרטים --------------------------------------------------------- */}
      <TabPanel tabKey="details" value={tab} idPrefix="veh">
        {editing ? (
          <Card className="space-y-4 p-4">
            <VehicleForm values={form} set={(k, v) => setForm((p) => ({ ...p, [k]: v }))} local={isLocal} />
            <Button variant="primary" onClick={saveEdit}>
              {t("common.save")}
            </Button>
            <Button variant="quiet" size="md" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <dl className="divide-y divide-line-soft">
                {DETAIL_FIELDS.map(([key, field, numeric]) => (
                  <div key={field} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-base text-ink-muted">{t(key)}</dt>
                    <dd className={`text-lg text-ink ${numeric ? "num" : ""}`}>
                      {vehicle[field] || t("common.notSet")}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-base text-ink-muted">{t("vehicle.field.testValidUntil")}</dt>
                  <dd className="text-lg text-ink num">{formatDate(vehicle.testValidUntil, lang)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-base text-ink-muted">{t("vehicle.field.compulsoryUntil")}</dt>
                  <dd className="text-lg text-ink num">{formatDate(vehicle.compulsoryInsuranceUntil, lang)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-base text-ink-muted">{t("vehicle.field.insurer")}</dt>
                  <dd className="text-lg text-ink">{vehicle.insurerName || t("common.notSet")}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-base text-ink-muted">{t("vehicle.field.currentKm")}</dt>
                  <dd className="text-lg text-ink num">{formatKm(vehicle.currentKm, lang)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-base text-ink-muted">{t("vehicle.field.garageName")}</dt>
                  <dd className="text-lg text-ink">
                    {vehicle.garage?.phone ? (
                      <a href={telLink(vehicle.garage.phone)} className="text-brand-600 underline underline-offset-4">
                        <span className="num">{formatPhone(vehicle.garage.phone)}</span>
                      </a>
                    ) : (
                      vehicle.garage?.name || t("common.notSet")
                    )}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* מקור הפרטים — שקיפות על מה נמשך ומה הוקלד (עדי 1.4, תוספת 3). */}
            <p className="text-base text-ink-muted">
              {vehicle.motSource?.fetchedAt
                ? t("vehicle.details.mot.fetched", { date: formatDate(vehicle.motSource.fetchedAt, lang) })
                : t("vehicle.details.mot.manual")}
            </p>
            <p className="max-w-prose text-sm text-ink-soft">{t("legal.disclaimer.mot")}</p>

            <Button variant="secondary" onClick={startEdit} disabled={!canEdit}>
              {t("common.edit")}
            </Button>

            {/* ★ ארכוב ≠ מחיקה. הניסוח אומר את זה מפורשות. */}
            {vehicle.status !== "archived" ? (
              <Button variant="quiet" size="md" onClick={() => actions.archiveVehicle(vehicle.id)} disabled={!canEdit}>
                <Archive size={24} aria-hidden="true" />
                {t("vehicle.archive.cta")}
              </Button>
            ) : (
              <Button variant="secondary" size="md" onClick={() => actions.restoreVehicle(vehicle.id)} disabled={!canEdit}>
                <RotateCcw size={24} aria-hidden="true" />
                {t("vehicle.restore.cta")}
              </Button>
            )}
          </>
        )}
      </TabPanel>

      {viewing && (
        <DocViewer doc={viewing} title={t(`doc.type.${viewing.type}`)} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

export default VehicleScreen;
