import { useMemo, useState } from "react";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import Button from "../ui/Button.jsx";
import Pill from "../ui/Pill.jsx";
import Modal from "../ui/Modal.jsx";
import Field, { DateInput, Select, TextInput, TextArea } from "../ui/Field.jsx";
import FileInput from "../ui/FileInput.jsx";
import { createVehicleDocument } from "../../schema.js";
import { STORAGE_DOMAINS } from "../../constants.js";
import { documentTypeOptions } from "../../utils/options.js";
import { formatDate, formatFileSize } from "../../utils/format.js";
import { daysUntil, todayIso, cmpDay } from "../../utils/dates.js";
import { resolveFileUrl } from "../../utils/files.js";
import { storage, isFirebaseConfigured } from "../../firebase.js";

export function DocumentsTab({ vehicle, data, orgId, actions }) {
  const { t, lang } = useI18n();
  const [adding, setAdding] = useState(false);
  const today = todayIso();

  const list = useMemo(
    () =>
      (data.documents || [])
        .filter((d) => d.vehicleId === vehicle.id)
        .sort((a, b) => -cmpDay(a.validUntil || a.validFrom, b.validUntil || b.validFrom)),
    [data.documents, vehicle.id]
  );

  const openDoc = async (doc) => {
    const url = await resolveFileUrl(doc, isFirebaseConfigured ? storage : null);
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{t("doc.title")}</h3>
        <Button className="ms-auto" size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> {t("doc.add")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {list.length ? (
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2 text-start">{t("doc.type")}</th>
                <th className="px-3 py-2 text-start">{t("doc.docTitle")}</th>
                <th className="px-3 py-2 text-start">{t("doc.validFrom")}</th>
                <th className="px-3 py-2 text-start">{t("doc.validUntil")}</th>
                <th className="px-3 py-2 text-start">{t("doc.file")}</th>
                <th className="px-3 py-2 text-start">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((d) => {
                const left = d.validUntil ? daysUntil(d.validUntil, today) : null;
                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="table-cell">{t(`doc.type.${d.type}`)}</td>
                    <td className="table-cell">{d.title || "—"}</td>
                    <td className="table-cell num">{d.validFrom ? formatDate(d.validFrom, lang) : "—"}</td>
                    <td className="table-cell num">
                      {d.validUntil ? (
                        <span className="inline-flex items-center gap-1">
                          {formatDate(d.validUntil, lang)}
                          {left !== null && left < 0 && <Pill tone="red">{t("doc.expired")}</Pill>}
                          {left !== null && left >= 0 && left <= 30 && (
                            <Pill tone="amber">{t("doc.expiresIn", { n: left })}</Pill>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="table-cell">
                      {d.fileRef ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          {d.fileName}
                          <span className="num text-slate-400">{formatFileSize(d.fileSize)}</span>
                          {d.storageMode === "local" && <Pill tone="amber">{t("common.demoBadge")}</Pill>}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        {d.fileRef && (
                          <Button size="sm" variant="ghost" onClick={() => openDoc(d)} aria-label={t("file.view")}>
                            <ExternalLink size={13} />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t("common.delete")}
                          onClick={() => {
                            if (window.confirm(t("common.deleteConfirm"))) actions.deleteDocument(d.id);
                          }}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">{t("doc.empty")}</p>
        )}
      </div>

      {adding && (
        <DocumentForm
          vehicleId={vehicle.id}
          orgId={orgId}
          onClose={() => setAdding(false)}
          onSave={(doc) => actions.upsert("documents", doc)}
        />
      )}
    </div>
  );
}

function DocumentForm({ vehicleId, orgId, onClose, onSave }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => createVehicleDocument({ orgId, vehicleId, type: "insurance" }));
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={t("doc.add")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              onSave({
                ...draft,
                validFrom: draft.validFrom || null,
                validUntil: draft.validUntil || null,
              });
              onClose();
            }}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("doc.type")}>
          <Select value={draft.type} onChange={set("type")}>
            {documentTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("doc.docTitle")}>
          <TextInput value={draft.title} onChange={set("title")} />
        </Field>
        <Field label={t("doc.validFrom")}>
          <DateInput value={draft.validFrom || ""} onChange={set("validFrom")} />
        </Field>
        <Field label={t("doc.validUntil")}>
          <DateInput value={draft.validUntil || ""} onChange={set("validUntil")} />
        </Field>
        <Field label={t("doc.notes")} className="sm:col-span-2">
          <TextArea value={draft.notes} onChange={set("notes")} />
        </Field>
        <div className="sm:col-span-2">
          <FileInput
            label={t("doc.file")}
            value={draft}
            domain={STORAGE_DOMAINS.vehicleDoc}
            orgId={orgId}
            vehicleId={vehicleId}
            docId={draft.id}
            onChange={(meta) =>
              setDraft((d) => ({
                ...d,
                fileRef: meta?.fileRef || null,
                fileName: meta?.fileName || "",
                fileSize: meta?.fileSize ?? null,
                contentType: meta?.contentType || "",
                storageMode: meta?.storageMode || "none",
                metadataStripped: meta?.metadataStripped ?? false,
              }))
            }
          />
        </div>
      </div>
    </Modal>
  );
}

export default DocumentsTab;
