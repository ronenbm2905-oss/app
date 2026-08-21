import { useMemo, useState } from "react";
import { Plus, Search, ShieldCheck } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import Pill from "./ui/Pill.jsx";
import Modal from "./ui/Modal.jsx";
import { EmptyState } from "./ui/Card.jsx";
import Field, { TextInput, Select, TextArea } from "./ui/Field.jsx";
import NoticeDeliveryModal from "./NoticeDeliveryModal.jsx";
import { createDriver } from "../schema.js";
import { validateDriverLinkEmail } from "../utils/driverLink.js";
import { normalizeEmail } from "../utils/admins.js";
import { driverStatusOptions, vehicleLabel, driverName, DRIVER_STATUS_TONE } from "../utils/options.js";
import { currentVehicleIdForDriver } from "../utils/assignments.js";
import { finesForDriver, isFineOpen } from "../utils/fines.js";
import { noticeCandidates } from "../utils/notice.js";
import { todayIso } from "../utils/dates.js";

// מסך 4 — רשימת נהגים.
export function DriversScreen({ data, orgId, actions, onOpenDriver }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  // 4.3א — רישום מסירה קבוצתי. הכפתור מופיע רק כשיש למי לרשום.
  const [recordingNotice, setRecordingNotice] = useState(false);
  const today = todayIso();

  const noticePending = useMemo(() => noticeCandidates(data), [data.drivers]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data.drivers || [])
      .filter((d) =>
        !needle
          ? true
          : [d.fullName, d.department, d.employeeNumber, d.email, d.phone]
              .join(" ")
              .toLowerCase()
              .includes(needle)
      )
      .map((d) => ({
        d,
        vehicleId: currentVehicleIdForDriver(data.assignments, d.id, today),
        openFines: finesForDriver(data.fines, d.id).filter(isFineOpen).length,
      }));
  }, [data, q, today]);

  if (!(data.drivers || []).length) {
    return (
      <>
        <EmptyState
          title={t("driver.empty")}
          action={
            <Button className="mt-2" onClick={() => setEditing("new")}>
              <Plus size={15} /> {t("driver.add")}
            </Button>
          }
        />
        {editing && (
          <DriverForm
            orgId={orgId}
            drivers={data.drivers}
            driver={null}
            onClose={() => setEditing(null)}
            onSave={(d) => actions.upsert("drivers", d)}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold text-slate-900">{t("driver.title")}</h1>
        <span className="num text-xs text-slate-500">{t("common.results", { n: rows.length })}</span>
        {noticePending.length > 0 && (
          <Button className="ms-auto" variant="secondary" onClick={() => setRecordingNotice(true)}>
            <ShieldCheck size={15} /> {t("notice.bulkActionCount", { n: noticePending.length })}
          </Button>
        )}
        <Button className={noticePending.length ? "" : "ms-auto"} onClick={() => setEditing("new")}>
          <Plus size={15} /> {t("driver.add")}
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute top-2.5 start-2.5 text-slate-400" />
          <TextInput
            className="ps-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("driver.searchPh")}
            aria-label={t("common.search")}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="table-head">
              <th className="px-3 py-2 text-start">{t("driver.fullName")}</th>
              <th className="px-3 py-2 text-start">{t("driver.department")}</th>
              <th className="px-3 py-2 text-start">{t("driver.employeeNumber")}</th>
              <th className="px-3 py-2 text-start">{t("driver.phone")}</th>
              <th className="px-3 py-2 text-start">{t("driver.currentVehicle")}</th>
              <th className="px-3 py-2 text-start">{t("driver.fines")}</th>
              <th className="px-3 py-2 text-start">{t("driver.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ d, vehicleId, openFines }) => (
              <tr
                key={d.id}
                className="row-link"
                tabIndex={0}
                onClick={() => onOpenDriver(d.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpenDriver(d.id);
                }}
              >
                <td className="table-cell font-medium text-slate-900">
                  {driverName(data.drivers, d.id, "—", t)}
                </td>
                <td className="table-cell">{d.department || "—"}</td>
                <td className="table-cell num">{d.employeeNumber || "—"}</td>
                <td className="table-cell num">{d.phone || "—"}</td>
                <td className="table-cell num">
                  {vehicleId ? vehicleLabel(data.vehicles, vehicleId) : <span className="text-slate-400">—</span>}
                </td>
                <td className="table-cell num">
                  {openFines ? <Pill tone="amber">{openFines}</Pill> : "—"}
                </td>
                <td className="table-cell">
                  <Pill tone={DRIVER_STATUS_TONE[d.status]}>{t(`driver.status.${d.status}`)}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <DriverForm
          orgId={orgId}
          drivers={data.drivers}
          driver={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(d) => actions.upsert("drivers", d)}
        />
      )}

      {recordingNotice && (
        <NoticeDeliveryModal
          data={data}
          candidates={noticePending}
          actions={actions}
          onClose={() => setRecordingNotice(false)}
        />
      )}
    </div>
  );
}

export function DriverForm({ orgId, driver, drivers = [], onClose, onSave }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => driver || createDriver({ orgId }));
  const [err, setErr] = useState(false);
  const [mailErr, setMailErr] = useState(null);
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={driver ? t("driver.edit") : t("driver.add")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              const nameMissing = !String(draft.fullName).trim();
              // ⚠️ הכתובת היא מפתח הקישור לפורטל, ולכן היא נשמרת **מנורמלת**
              // ונבדקת מול נהגים אחרים. שתי רשומות עם אותה כתובת = שני עובדים
              // שנלחמים על אותה תביעה, והראשון שנכנס זוכה. השוואה קנונית,
              // כי אצל גימייל נקודות ו-+alias אינן מבדילות בין תיבות.
              const mail = validateDriverLinkEmail(drivers, draft.id, draft.email);
              setErr(nameMissing);
              setMailErr(mail[0] || null);
              if (nameMissing || mail.length) return;
              onSave({
                ...draft,
                fullName: draft.fullName.trim(),
                email: normalizeEmail(draft.email),
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
        <Field label={t("driver.fullName")} required error={err ? t("common.required") : null}>
          <TextInput value={draft.fullName} onChange={set("fullName")} autoFocus />
        </Field>
        <Field label={t("driver.department")}>
          <TextInput value={draft.department} onChange={set("department")} />
        </Field>
        <Field label={t("driver.phone")}>
          <TextInput dir="ltr" value={draft.phone} onChange={set("phone")} />
        </Field>
        {/* ⚠️ זו הכתובת שהעובד יתחבר איתה לפורטל. שינוי שלה כשהחשבון כבר
            מקושר **אינו** מעביר את הקישור — הקישור לפי uid (F1), והחלפת
            בעלים דורשת ניתוק מפורש בכרטיס הנהג. */}
        <Field
          label={t("driver.email")}
          hint={t("driverLink.emailHint")}
          error={mailErr ? t(mailErr) : null}
        >
          <TextInput
            dir="ltr"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={draft.email}
            onChange={set("email")}
          />
        </Field>
        <Field label={t("driver.employeeNumber")}>
          <TextInput dir="ltr" value={draft.employeeNumber} onChange={set("employeeNumber")} />
        </Field>
        <Field label={t("driver.status")}>
          <Select value={draft.status} onChange={set("status")}>
            {driverStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.key)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("driver.notes")} className="sm:col-span-2">
          <TextArea value={draft.notes} onChange={set("notes")} />
        </Field>
        <p className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 sm:col-span-2">
          {t("driver.portalHint")}
        </p>
      </div>
    </Modal>
  );
}

export default DriversScreen;
