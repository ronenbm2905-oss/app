import { useState } from "react";
import { Plus, Trash2, Pencil, FileCheck2 } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import Modal from "./ui/Modal.jsx";
import Field, { TextInput, NumberInput, TextArea } from "./ui/Field.jsx";
import { createLeaseCompany } from "../schema.js";
import { isFirebaseConfigured } from "../firebase.js";
import { formatDate } from "../utils/format.js";

export function SettingsScreen({ data, orgId, actions, onResetLocal }) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(null);
  const s = data.settings || {};
  const ack = s.importAck || null;

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-slate-900">{t("settings.title")}</h1>

      <Card title={t("settings.title")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("settings.orgName")}>
            <TextInput value={data.org?.name || ""} onChange={(e) => actions.setOrg({ name: e.target.value })} />
          </Field>
          <Field label={t("settings.contractAlertDays")}>
            <NumberInput
              value={s.contractAlertDays ?? 90}
              onChange={(e) => actions.setSettings({ contractAlertDays: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label={t("settings.fineDueAlertDays")}>
            <NumberInput
              value={s.fineDueAlertDays ?? 14}
              onChange={(e) => actions.setSettings({ fineDueAlertDays: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label={t("settings.docExpiryAlertDays")}>
            <NumberInput
              value={s.docExpiryAlertDays ?? 30}
              onChange={(e) => actions.setSettings({ docExpiryAlertDays: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
      </Card>

      {/* M3 — הראיה שהשער נחצה. אישור שלא נרשם ולא נראה אינו ראיה. */}
      <Card title={t("settings.importAck.title")}>
        <div className="flex items-start gap-2">
          <FileCheck2 size={16} className={ack ? "mt-0.5 text-emerald-600" : "mt-0.5 text-slate-400"} />
          <div className="text-xs">
            {ack ? (
              <>
                <p className="num text-slate-700">
                  {t("settings.importAck.value", {
                    at: formatDate(ack.at, lang),
                    by: ack.by || t("settings.importAck.localUser"),
                    version: ack.policyVersion || "—",
                  })}
                </p>
                {(ack.file || ack.sheet) && (
                  <p className="num mt-0.5 text-slate-500">
                    {[ack.file, ack.sheet].filter(Boolean).join(" · ")}
                  </p>
                )}
              </>
            ) : (
              <p className="text-slate-600">{t("settings.importAck.none")}</p>
            )}
            <p className="mt-1.5 text-[11px] text-slate-500">{t("settings.importAck.hint")}</p>
          </div>
        </div>
      </Card>

      <Card
        title={t("settings.leaseCompanies")}
        action={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> {t("lease.add")}
          </Button>
        }
        padded={false}
      >
        {(data.leaseCompanies || []).length ? (
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2 text-start">{t("lease.name")}</th>
                <th className="px-3 py-2 text-start">{t("lease.contactName")}</th>
                <th className="px-3 py-2 text-start">{t("lease.phone")}</th>
                <th className="px-3 py-2 text-start">{t("lease.email")}</th>
                <th className="px-3 py-2 text-start">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.leaseCompanies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="table-cell font-medium">{c.name}</td>
                  <td className="table-cell">{c.contactName || "—"}</td>
                  <td className="table-cell num">{c.phone || "—"}</td>
                  <td className="table-cell num">{c.email || "—"}</td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(c)} aria-label={t("common.edit")}>
                        <Pencil size={13} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("common.delete")}
                        onClick={() => {
                          if (window.confirm(t("common.deleteConfirm"))) actions.deleteLeaseCompany(c.id);
                        }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-slate-500">{t("lease.empty")}</p>
        )}
      </Card>

      {!isFirebaseConfigured && (
        <Card title={t("settings.dangerZone")}>
          <p className="text-xs text-slate-600">{t("auth.localModeNote")}</p>
          <Button
            className="mt-3"
            variant="danger"
            onClick={() => {
              if (window.confirm(t("settings.resetLocalConfirm"))) onResetLocal();
            }}
          >
            {t("settings.resetLocal")}
          </Button>
        </Card>
      )}

      {editing && (
        <LeaseCompanyForm
          orgId={orgId}
          company={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(c) => actions.upsert("leaseCompanies", c)}
        />
      )}
    </div>
  );
}

function LeaseCompanyForm({ orgId, company, onClose, onSave }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => company || createLeaseCompany({ orgId }));
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  return (
    <Modal
      open
      onClose={onClose}
      title={company ? t("lease.edit") : t("lease.add")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              if (!String(draft.name).trim()) return;
              onSave(draft);
              onClose();
            }}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label={t("lease.name")} required>
          <TextInput value={draft.name} onChange={set("name")} autoFocus />
        </Field>
        <Field label={t("lease.contactName")}>
          <TextInput value={draft.contactName} onChange={set("contactName")} />
        </Field>
        <Field label={t("lease.phone")}>
          <TextInput dir="ltr" value={draft.phone} onChange={set("phone")} />
        </Field>
        <Field label={t("lease.email")}>
          <TextInput dir="ltr" type="email" value={draft.email} onChange={set("email")} />
        </Field>
        <Field label={t("lease.notes")}>
          <TextArea value={draft.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}

export default SettingsScreen;
