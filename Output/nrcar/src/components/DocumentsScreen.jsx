import { useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { activeVehicles, vehicleById, vehicleLabel } from "../utils/options.js";
import { formatDate } from "../utils/format.js";
import { daysUntil } from "../utils/dates.js";
import { EmptyState, Card, Notice } from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import DocumentUpload from "./DocumentUpload.jsx";
import DocViewer from "./DocViewer.jsx";

// ============================================================================
// DocumentsScreen — PRD §4.9: **כפתורי סינון גדולים** כברירת מחדל. חיפוש
// חופשי נדחה לשלב 4 ב-PRD, ובצדק: למבוגר קל יותר ללחוץ על "ביטוח" מאשר
// להקליד.
//
// המסננים הם כפתורים עם `aria-pressed` — 4.1.2, אחד משלושת המקומות שבהם
// אפליקציית React נופלת בנגישות.
// ============================================================================

const FILTERS = [
  { key: "all", types: null },
  { key: "licences", types: ["vehicleLicence", "drivingLicence"] },
  { key: "insurance", types: ["compulsory", "comprehensive"] },
  { key: "service", types: ["serviceReport", "testCertificate"] },
  { key: "receipts", types: ["receipt"] },
];

function DocumentCard({ doc, vehicle, personal, today, onOpen, onDelete, t, lang }) {
  const expired = doc.validUntil && daysUntil(doc.validUntil, today) < 0;
  const expiring = doc.validUntil && !expired && daysUntil(doc.validUntil, today) <= 30;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <FileText size={24} className="mt-1 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-ink">{t(`doc.type.${doc.type}`)}</h3>
          {vehicle && <p className="text-lg text-ink-muted">{vehicleLabel(vehicle)}</p>}
          {doc.validUntil && (
            <p className="text-lg text-ink-muted">
              {t("doc.validUntil", { date: "" })}
              <span className="num">{formatDate(doc.validUntil, lang)}</span>
            </p>
          )}
          {/* צבע לעולם לא הסימן היחיד — יש מילה. */}
          {expired && <p className="text-base font-semibold text-danger-700">{t("doc.badge.expired")}</p>}
          {expiring && <p className="text-base font-semibold text-warn-700">{t("doc.badge.expiring")}</p>}
          <p className="text-base text-ink-muted">
            {t(personal ? "doc.visibility.personal" : `doc.visibility.${doc.visibility}`)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" size="md" onClick={() => onOpen(doc)} className="w-auto">
          {t("emergency.doc.open")}
        </Button>
        <Button variant="quiet" size="md" onClick={() => onDelete(doc, personal)} className="w-auto">
          <Trash2 size={24} aria-hidden="true" />
          {t("common.delete")}
        </Button>
      </div>
    </Card>
  );
}

export function DocumentsScreen({ data, actions, householdId, uid, isLocal, today, canEdit }) {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState("all");
  const [adding, setAdding] = useState(null); // null | "vehicle" | "personal"
  const [viewing, setViewing] = useState(null);

  const vehicles = activeVehicles(data);
  const conf = FILTERS.find((f) => f.key === filter);

  const docs = (data.documents || []).filter((d) => !conf.types || conf.types.includes(d.type));
  const personalDocs = (data.personalDocs || []).filter(
    (d) => d.driverUid === uid && (!conf.types || conf.types.includes(d.type))
  );

  const total = docs.length + personalDocs.length;
  const anyDocs = (data.documents || []).length + (data.personalDocs || []).length;

  const remove = (doc, personal) => {
    if (personal) actions.deletePersonalDoc(doc.id, data);
    else actions.deleteDocument(doc.id, data);
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-ink-strong">{t("nav.docs")}</h1>

      <div className="flex flex-wrap gap-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-12 rounded-xl border-2 px-4 text-lg font-semibold transition
              ${filter === f.key ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-soft"}`}
          >
            {t(`doc.filter.${f.key}`)}
          </button>
        ))}
      </div>

      {anyDocs === 0 && !adding && (
        <EmptyState
          title={t("empty.docs.title")}
          body={t("empty.docs.body")}
          action={
            <Button variant="primary" onClick={() => setAdding("vehicle")} disabled={!canEdit}>
              <Plus size={24} aria-hidden="true" />
              {t("empty.docs.cta")}
            </Button>
          }
        />
      )}

      {anyDocs > 0 && total === 0 && (
        <div className="space-y-3">
          <p className="text-lg text-ink-muted">{t("empty.docsFilter")}</p>
          <Button variant="secondary" size="md" onClick={() => setFilter("all")} className="w-auto">
            {t("empty.docsFilter.cta")}
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {docs.map((d) => (
          <DocumentCard
            key={d.id}
            doc={d}
            vehicle={vehicleById(data, d.vehicleId)}
            today={today}
            onOpen={setViewing}
            onDelete={remove}
            t={t}
            lang={lang}
          />
        ))}
        {personalDocs.map((d) => (
          <DocumentCard
            key={d.id}
            doc={d}
            personal
            today={today}
            onOpen={setViewing}
            onDelete={remove}
            t={t}
            lang={lang}
          />
        ))}
      </div>

      {/* -- מסמכים אישיים: אזור נפרד, עם ההסבר של שירה ------------------- */}
      <section className="space-y-3 border-t border-line-soft pt-6">
        <h2 className="text-xl font-semibold text-ink">{t("doc.personal.title")}</h2>
        <p className="max-w-prose text-base text-ink-muted">{t("legal.disclaimer.personalDocs")}</p>
        {!personalDocs.length && adding !== "personal" && (
          <Button variant="secondary" onClick={() => setAdding("personal")}>
            <Plus size={24} aria-hidden="true" />
            {t("empty.personalDocs.cta")}
          </Button>
        )}
      </section>

      {adding && (
        <Card className="space-y-4 p-4">
          <h2 className="text-xl font-semibold text-ink">
            {adding === "personal" ? t("empty.personalDocs.cta") : t("doc.upload.cta")}
          </h2>
          <DocumentUpload
            mode={adding}
            vehicles={vehicles}
            householdId={householdId}
            uid={uid}
            driverId={uid}
            isLocal={isLocal}
            onSave={(entity) => {
              actions.upsert(adding === "personal" ? "personalDocs" : "documents", entity);
              setAdding(null);
            }}
          />
          <Button variant="quiet" size="md" onClick={() => setAdding(null)}>
            {t("common.cancel")}
          </Button>
        </Card>
      )}

      {!adding && anyDocs > 0 && (
        <Button variant="secondary" onClick={() => setAdding("vehicle")} disabled={!canEdit}>
          <Plus size={24} aria-hidden="true" />
          {t("doc.upload.cta")}
        </Button>
      )}

      {!vehicles.length && <Notice tone="info" title={t("emergency.empty.noVehicle.title")} />}

      {viewing && (
        <DocViewer
          doc={viewing}
          title={t(`doc.type.${viewing.type}`)}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

export default DocumentsScreen;
