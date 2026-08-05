import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Button, Pill } from "./ui/Button.jsx";
import { Modal } from "./ui/Modal.jsx";
import { Field, Select } from "./ui/Field.jsx";
import { IconPlus, IconLang, IconMapPin } from "./ui/icons.jsx";
import { enumOptions } from "../utils/options.js";
import { TICKET_STATUSES } from "../constants.js";
import { maintenanceView } from "../utils/access.js";
import { addressLine } from "../utils/display.js";
import { formatDate } from "../utils/format.js";
import { newId } from "../utils/id.js";

const STATUS_TONE = { open: "amber", inProgress: "blue", closed: "green" };

// מסך 7 — אפליקציית צוות תחזוקה (מובייל-פירסט). רואה רק קריאות משויכות אליו.
// עדכון סטטוס + העלאת תמונה/קבלה. אין נתונים כלכליים ואין PII של דיירים.
export function MaintenanceApp({ state, assigneeKey, onUpdateTicket, onToggleLang }) {
  const { t, lang } = useI18n();
  const [active, setActive] = useState(null); // ticket שנפתח לעריכה
  const { tickets } = maintenanceView(state, assigneeKey);

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-800">{t("mapp.title")}</h1>
          <button onClick={onToggleLang} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={t("nav.language")}>
            <IconLang size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-3 px-4 py-4">
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("mapp.privacyNote")}</p>

        {tickets.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">{t("mapp.none")}</div>
        ) : (
          tickets.map((tk) => (
            <button
              key={tk.id}
              onClick={() => setActive(tk)}
              className="w-full rounded-2xl bg-white p-4 text-start shadow-sm transition hover:shadow"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{t(`enum.ticketType.${tk.type}`)}</span>
                <Pill tone={STATUS_TONE[tk.status]}>{t(`enum.ticketStatus.${tk.status}`)}</Pill>
              </div>
              {tk.property && (
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <IconMapPin size={13} /> {addressLine(tk.property)}
                </div>
              )}
              {tk.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{tk.description}</p>}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span>{formatDate(tk.openedDate, lang)}</span>
                {tk.reportedByTenantId && <Pill tone="slate">{t("mapp.reportedByTenant")}</Pill>}
              </div>
            </button>
          ))
        )}
      </main>

      {active && (
        <TicketDetailModal
          ticket={active}
          onClose={() => setActive(null)}
          onSave={(updated) => {
            onUpdateTicket(updated);
            setActive(null);
          }}
        />
      )}
    </div>
  );
}

// מודאל פרטי קריאה — עדכון סטטוס + הוספת תמונות/קבלות (מטא-דאטה בפרוסה זו).
function TicketDetailModal({ ticket, onClose, onSave }) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState(ticket.status);
  const [photos, setPhotos] = useState(ticket.fieldPhotos || []);
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");

  const addPhoto = () => {
    if (!newName.trim()) return;
    setPhotos([...photos, { id: newId("photo"), name: newName.trim(), note: newNote.trim(), at: new Date().toISOString() }]);
    setNewName("");
    setNewNote("");
  };

  return (
    <Modal
      title={t(`enum.ticketType.${ticket.type}`)}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          {/* שומרים אך ורק status + fieldPhotos — מקביל לבדיקת ה-diff ב-rules */}
          <Button onClick={() => onSave({ id: ticket.id, status, fieldPhotos: photos })}>{t("mapp.save")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {ticket.property && (
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <IconMapPin size={14} /> {addressLine(ticket.property)}
          </div>
        )}
        {ticket.description && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{ticket.description}</p>}

        <Select label={t("mapp.updateStatus")} value={status} onChange={setStatus} options={enumOptions(TICKET_STATUSES, "ticketStatus", t)} />

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{t("mapp.photos")}</h3>
          {photos.length === 0 ? (
            <p className="text-sm text-slate-500">{t("mapp.noPhotos")}</p>
          ) : (
            <ul className="mb-3 divide-y divide-slate-100">
              {photos.map((p) => (
                <li key={p.id} className="py-1.5 text-sm text-slate-700">
                  <span className="font-medium">{p.name}</span>
                  {p.note && <span className="text-slate-500"> — {p.note}</span>}
                  <span className="text-slate-400"> · {formatDate(p.at, lang)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <Field label={t("mapp.photoName")} value={newName} onChange={setNewName} />
            <Field label={t("mapp.photoNote")} value={newNote} onChange={setNewNote} />
            <Button variant="secondary" onClick={addPhoto} disabled={!newName.trim()}>
              <IconPlus size={16} /> {t("mapp.addPhoto")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
