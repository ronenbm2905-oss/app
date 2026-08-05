import { useState } from "react";
import { useI18n } from "../../hooks/useI18n.jsx";
import { Button, Pill } from "../ui/Button.jsx";
import { Modal } from "../ui/Modal.jsx";
import { Field, Select } from "../ui/Field.jsx";
import { IconPlus, IconDelete, IconDoc } from "../ui/icons.jsx";
import { enumOptions } from "../../utils/options.js";
import { DOCUMENT_TYPES } from "../../constants.js";
import { createDocument } from "../../schema.js";
import { formatDate, formatCurrency } from "../../utils/format.js";
import { extractDocument } from "../../utils/aiExtract.js";

// ממפה docType שחולץ ב-AI לערך מתוך DOCUMENT_TYPES (unknown → other).
function mapAiDocType(aiType) {
  return DOCUMENT_TYPES.includes(aiType) ? aiType : "other";
}

// קורא קובץ ל-base64 (בלי קידומת data-URL) + media type.
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve({ base64: result.split(",")[1] || "", mediaType: file.type, fileName: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// טאב מסמכים. B3 (מזעור): בפרוסה 1 נרשמים פרטי מסמך בלבד (סוג/שם/תאריך).
// העלאת קבצים לאחסון + הצפנה ממתינות לשער עדי לפני deploy (פרוסה הבאה).
export function DocumentsTab({ property, data, ownerId, onSave, onDelete, canEdit }) {
  const { t, lang } = useI18n();
  const [modal, setModal] = useState(false);
  const docs = data.documents
    .filter((d) => d.propertyId === property.id)
    .sort((a, b) => (b.uploadDate || "").localeCompare(a.uploadDate || ""));

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{t("doc.title")}</h3>
        {canEdit && (
          <Button onClick={() => setModal(true)}>
            <IconPlus size={16} /> {t("doc.add")}
          </Button>
        )}
      </div>

      <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("doc.uploadNote")}</p>

      {docs.length === 0 ? (
        <p className="text-sm text-slate-500">{t("doc.none")}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <IconDoc size={16} className="text-slate-400" />
                <span className="font-medium">{t(`enum.docType.${d.type}`)}</span>
                {d.fileName && <span className="text-slate-500">· {d.fileName}</span>}
                <span className="text-slate-400">· {formatDate(d.uploadDate, lang)}</span>
              </span>
              {canEdit && (
                <button onClick={() => onDelete(d.id)} aria-label={t("common.delete")} className="text-slate-400 hover:text-red-600">
                  <IconDelete size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <DocModal
          initial={createDocument({ ownerId, propertyId: property.id })}
          onClose={() => setModal(false)}
          onSave={(d) => {
            onSave(d);
            setModal(false);
          }}
        />
      )}
    </div>
  );
}

function DocModal({ initial, onClose, onSave }) {
  const { t, lang } = useI18n();
  const [d, setD] = useState(() => JSON.parse(JSON.stringify(initial)));
  const [file, setFile] = useState(null); // { base64, mediaType, fileName }
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // תוצאת החילוץ
  const [scanError, setScanError] = useState(null);
  const set = (k, v) => setD({ ...d, [k]: v });

  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    setResult(null);
    setScanError(null);
    if (!f) return setFile(null);
    const read = await readFileAsBase64(f);
    setFile(read);
    if (!d.fileName) set("fileName", f.name);
  };

  // opt-in פר-מסמך: הסריקה רצה רק בלחיצה מפורשת של המשתמש.
  const onScan = async () => {
    if (!file) return;
    setScanning(true);
    setScanError(null);
    try {
      const res = await extractDocument(file);
      setResult(res);
    } catch (err) {
      setScanError(err?.code || "ai.error");
    } finally {
      setScanning(false);
    }
  };

  // מילוי הטופס מהתוצאה שחולצה.
  const applyResult = () => {
    if (!result) return;
    setD({
      ...d,
      type: mapAiDocType(result.docType),
      fileName: d.fileName || file?.fileName || "",
      uploadDate: result.date || d.uploadDate,
    });
  };

  return (
    <Modal
      title={t("doc.add")}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(d)}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select label={t("doc.type")} value={d.type} onChange={(v) => set("type", v)} options={enumOptions(DOCUMENT_TYPES, "docType", t)} />
        <Field label={t("doc.fileName")} value={d.fileName} onChange={(v) => set("fileName", v)} />
        <Field label={t("doc.uploadDate")} type="date" value={d.uploadDate} onChange={(v) => set("uploadDate", v)} />

        {/* --- סריקת AI (opt-in פר-מסמך) --- */}
        <fieldset className="rounded-xl border border-slate-200 p-3">
          <legend className="px-2 text-sm font-semibold text-slate-700">{t("ai.title")}</legend>
          <p className="mb-2 text-xs text-slate-500">{t("ai.optInNote")}</p>
          <p className="mb-3 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{t("ai.gateNote")}</p>

          <input
            type="file"
            accept=".pdf,image/*"
            onChange={onPickFile}
            aria-label={t("ai.scan")}
            className="block w-full text-xs text-slate-600 file:me-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />

          <div className="mt-2">
            <Button variant="secondary" onClick={onScan} disabled={!file || scanning}>
              {scanning ? t("ai.scanning") : t("ai.scan")}
            </Button>
          </div>

          {scanError && <p className="mt-2 text-xs text-red-600">{t(scanError)}</p>}

          {result && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">{t("ai.result")}</span>
                {result.mock && <Pill tone="amber">{t("ai.mockBadge")}</Pill>}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <Row label={t("ai.field.docType")} value={t(`enum.aiDocType.${result.docType}`)} />
                <Row label={t("ai.field.amount")} value={result.amount != null ? formatCurrency(result.amount, "ILS", lang) : "—"} />
                <Row label={t("ai.field.date")} value={result.date ? formatDate(result.date, lang) : "—"} />
                <Row label={t("ai.field.address")} value={result.address || "—"} />
                <Row label={t("ai.field.name")} value={result.name || "—"} />
              </dl>
              <div className="mt-2">
                <Button onClick={applyResult}>{t("ai.apply")}</Button>
              </div>
            </div>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
