import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import Button from "../ui/Button.jsx";
import Pill from "../ui/Pill.jsx";
import Modal from "../ui/Modal.jsx";
import Field, { DateInput, Select, TextArea, Checkbox } from "../ui/Field.jsx";
import { createAssignment } from "../../schema.js";
import { assignmentsForVehicle, validateAssignment } from "../../utils/assignments.js";
import { driverName } from "../../utils/options.js";
import { formatDate } from "../../utils/format.js";
import { todayIso } from "../../utils/dates.js";

// טאב "מחזיקים" — היסטוריית ההחזקות המלאה. זו הישות שמחליפה את
// "שם נהג" כטקסט חופשי באקסל, ומאפשרת את הגזירה של שיוך הקנס.
export function AssignmentsTab({ vehicle, data, orgId, actions }) {
  const { t, lang } = useI18n();
  const [adding, setAdding] = useState(false);
  const list = useMemo(
    () => assignmentsForVehicle(data.assignments, vehicle.id),
    [data.assignments, vehicle.id]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{t("assign.title")}</h3>
        <Button className="ms-auto" size="sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> {t("assign.add")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        {list.length ? (
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="table-head">
                <th className="px-3 py-2 text-start">{t("assign.driver")}</th>
                <th className="px-3 py-2 text-start">{t("assign.from")}</th>
                <th className="px-3 py-2 text-start">{t("assign.to")}</th>
                <th className="px-3 py-2 text-start">{t("assign.notes")}</th>
                <th className="px-3 py-2 text-start">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="table-cell font-medium">
                    {driverName(data.drivers, a.driverId, "—", t)}
                    {a.needsReview && (
                      <Pill tone="amber" className="ms-1.5">
                        {t("assign.needsReview")}
                      </Pill>
                    )}
                  </td>
                  <td className="table-cell num">
                    {formatDate(a.fromDate, lang)}
                    {/* תאריך שהגיע מהייבוא ומקורו בהסכם הליסינג — משוער. */}
                    {a.fromDateInferred && (
                      <Pill tone="slate" className="ms-1.5" title={t("fine.inferredFromDate")}>
                        {t("importx.inferredBadge")}
                      </Pill>
                    )}
                  </td>
                  <td className="table-cell num">
                    {a.toDate ? formatDate(a.toDate, lang) : <Pill tone="green">{t("assign.active")}</Pill>}
                  </td>
                  <td className="table-cell">
                    {/* D-Import — הטקסט החופשי המיובא מוצג **מסומן ומופרד**
                        מ-notes התפעולי, ולעולם לא מתערבב בו. */}
                    {a.importRaw && (
                      <div className="mb-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-1 text-xs text-amber-900">
                        <span className="font-medium">{t("importx.needsReview.raw")}: </span>
                        {a.importRaw}
                      </div>
                    )}
                    {a.notes || (a.importRaw ? "" : "—")}
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      {!a.toDate && (
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() => actions.endAssignment(a.id, todayIso())}
                        >
                          {t("assign.end")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t("common.delete")}
                        onClick={() => {
                          if (window.confirm(t("common.deleteConfirm"))) actions.remove("assignments", a.id);
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
          <p className="py-6 text-center text-sm text-slate-500">{t("assign.empty")}</p>
        )}
      </div>

      {adding && (
        <AssignmentForm
          vehicleId={vehicle.id}
          data={data}
          orgId={orgId}
          onClose={() => setAdding(false)}
          onSave={(a, autoClose) => actions.addAssignment(a, { autoCloseOpen: autoClose })}
        />
      )}
    </div>
  );
}

function AssignmentForm({ vehicleId, data, orgId, onClose, onSave }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() =>
    createAssignment({ orgId, vehicleId, fromDate: todayIso() })
  );
  const [autoClose, setAutoClose] = useState(true);
  const [errors, setErrors] = useState([]);

  const submit = () => {
    const candidate = { ...draft, toDate: draft.toDate || null };
    // כשסוגרים אוטומטית את ההחזקה הקודמת, החפיפה מטופלת — לא נחשבת שגיאה.
    const errs = validateAssignment(data.assignments, candidate).filter(
      (e) => !(autoClose && e === "assign.err.overlap")
    );
    setErrors(errs);
    if (errs.length) return;
    onSave(candidate, autoClose);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("assign.add")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label={t("assign.driver")} required>
          <Select
            value={draft.driverId || ""}
            onChange={(e) => setDraft({ ...draft, driverId: e.target.value || null })}
          >
            <option value="">{t("common.select")}</option>
            {(data.drivers || [])
              .filter((d) => d.status === "active")
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                </option>
              ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("assign.from")} required>
            <DateInput value={draft.fromDate || ""} onChange={(e) => setDraft({ ...draft, fromDate: e.target.value })} />
          </Field>
          <Field label={t("assign.to")} hint={t("assign.toOpen")}>
            <DateInput value={draft.toDate || ""} onChange={(e) => setDraft({ ...draft, toDate: e.target.value })} />
          </Field>
        </div>
        <Field label={t("assign.notes")}>
          <TextArea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </Field>
        <Checkbox
          label={t("assign.autoClose")}
          checked={autoClose}
          onChange={(e) => setAutoClose(e.target.checked)}
        />
        {errors.length > 0 && (
          <ul className="space-y-1 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {errors.map((e) => (
              <li key={e}>{t(e)}</li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default AssignmentsTab;
