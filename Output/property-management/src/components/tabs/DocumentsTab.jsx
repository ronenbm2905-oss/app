import { useState } from "react";
import { useI18n } from "../../hooks/useI18n.jsx";
import { Button, Pill } from "../ui/Button.jsx";
import { Modal } from "../ui/Modal.jsx";
import { Field, Select } from "../ui/Field.jsx";
import { IconPlus, IconDelete, IconDoc } from "../ui/icons.jsx";
import { enumOptions } from "../../utils/options.js";
import { DOCUMENT_TYPES, AI_SCANNABLE_TYPES, DOC_TYPE_TO_EXPENSE_CATEGORY } from "../../constants.js";
import { createDocument, createTransaction } from "../../schema.js";
import { formatDate, formatCurrency } from "../../utils/format.js";
import { extractDocument, BILL_DOC_TYPES } from "../../utils/aiExtract.js";

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
export function DocumentsTab({ property, data, ownerId, onSave, onDelete, onCreateExpense, onApplyToProperty, canEdit }) {
  const { t, lang } = useI18n();
  const [modal, setModal] = useState(false);
  const docs = data.documents
    .filter((d) => d.propertyId === property.id)
    .sort((a, b) => (b.uploadDate || "").localeCompare(a.uploadDate || ""));

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-body">{t("doc.title")}</h3>
        {canEdit && (
          <Button onClick={() => setModal(true)}>
            <IconPlus size={16} /> {t("doc.add")}
          </Button>
        )}
      </div>

      <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("doc.uploadNote")}</p>

      {docs.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("doc.none")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2 text-ink-body">
                <IconDoc size={16} className="text-ink-faint" />
                <span className="font-medium">{t(`enum.docType.${d.type}`)}</span>
                {d.fileName && <span className="text-ink-muted">· {d.fileName}</span>}
                {d.extracted?.amount != null && (
                  <span className="text-ink-muted">· {formatCurrency(d.extracted.amount, property.currency, lang)}</span>
                )}
                <span className="text-ink-faint">· {formatDate(d.uploadDate, lang)}</span>
              </span>
              {canEdit && (
                <button onClick={() => onDelete(d.id)} aria-label={t("common.delete")} className="text-ink-faint hover:text-red-600">
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
          property={property}
          ownerId={ownerId}
          onCreateExpense={onCreateExpense}
          onApplyToProperty={onApplyToProperty}
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

function DocModal({ initial, property, ownerId, onCreateExpense, onApplyToProperty, onClose, onSave }) {
  const { t, lang } = useI18n();
  const [d, setD] = useState(() => JSON.parse(JSON.stringify(initial)));
  const [file, setFile] = useState(null); // { base64, mediaType, fileName }
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // תוצאת החילוץ
  const [scanError, setScanError] = useState(null);
  const [expenseDone, setExpenseDone] = useState(false);
  const [propApplied, setPropApplied] = useState(false);
  const set = (k, v) => setD({ ...d, [k]: v });
  // B-AI-2: סריקת AI מותרת רק לסוגי מסמך סטרוקטורים (allowlist). ת.ז. וכו' חסומים.
  const canScan = AI_SCANNABLE_TYPES.includes(d.type);
  const isBillResult = result && BILL_DOC_TYPES.includes(result.docType);
  const isRegistryResult = result && result.docType === "landRegistry";

  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    setResult(null);
    setScanError(null);
    setExpenseDone(false);
    setPropApplied(false);
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

  // מילוי הטופס מהתוצאה + שמירת המטא-דאטה שחולצה על המסמך.
  const applyResult = () => {
    if (!result) return;
    setD({
      ...d,
      type: mapAiDocType(result.docType),
      fileName: d.fileName || file?.fileName || "",
      uploadDate: result.date || d.uploadDate,
      extracted: {
        amount: result.amount,
        dueDate: result.dueDate,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        supplier: result.supplier,
        accountNumber: result.accountNumber,
        propertyNumber: result.propertyNumber,
        meterNumber: result.meterNumber,
      },
    });
  };

  // חשבון → הוצאה אוטומטית בדשבורד הכלכלי.
  const createExpense = () => {
    if (!onCreateExpense || result?.amount == null) return;
    const category = DOC_TYPE_TO_EXPENSE_CATEGORY[result.docType] || "utilities";
    onCreateExpense(
      createTransaction({
        ownerId,
        propertyId: property?.id || d.propertyId,
        type: "expense",
        category,
        amount: result.amount,
        date: result.dueDate || result.date || new Date().toISOString().slice(0, 10),
        note: [result.supplier, t(`enum.aiDocType.${result.docType}`)].filter(Boolean).join(" · "),
      })
    );
    setExpenseDone(true);
  };

  // נסח טאבו → החלת גוש/חלקה/שטח על פרטי הנכס.
  const applyToProperty = () => {
    if (!onApplyToProperty || !property) return;
    onApplyToProperty({
      ...property,
      block: result.block || property.block,
      parcel: result.parcel || property.parcel,
      area: result.area ?? property.area,
    });
    setPropApplied(true);
  };

  const c = property?.currency || "ILS";

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
        <fieldset className="rounded-xl border border-border p-3">
          <legend className="px-2 text-sm font-semibold text-ink-body">{t("ai.title")}</legend>
          <p className="mb-2 text-xs text-ink-muted">{t("ai.optInNote")}</p>
          <p className="mb-3 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">{t("ai.gateNote")}</p>

          {/* B-AI-2: סוג מסמך רגיש (ת.ז. וכו') — סריקת AI חסומה, חילוץ ידני בלבד. */}
          {!canScan ? (
            <p className="rounded-lg bg-surface-alt px-2 py-1.5 text-xs text-ink-body">{t("ai.blockedType")}</p>
          ) : (
            <>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={onPickFile}
                aria-label={t("ai.scan")}
                className="block w-full text-xs text-ink-body file:me-3 file:rounded-lg file:border-0 file:bg-surface-sunk file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />

              <div className="mt-2">
                <Button variant="secondary" onClick={onScan} disabled={!file || scanning}>
                  {scanning ? t("ai.scanning") : t("ai.scan")}
                </Button>
              </div>

              {scanError && <p className="mt-2 text-xs text-red-600">{t(scanError)}</p>}

              {result && (
                <div className="mt-3 rounded-lg bg-surface-alt p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-body">{t("ai.result")}</span>
                    {result.mock && <Pill tone="amber">{t("ai.mockBadge")}</Pill>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <Row label={t("ai.field.docType")} value={t(`enum.aiDocType.${result.docType}`)} />
                    {result.amount != null && <Row label={t("ai.field.amount")} value={formatCurrency(result.amount, c, lang)} />}
                    {result.periodStart && (
                      <Row label={t("ai.field.period")} value={`${formatDate(result.periodStart, lang)}–${formatDate(result.periodEnd, lang)}`} />
                    )}
                    {result.dueDate && <Row label={t("ai.field.dueDate")} value={formatDate(result.dueDate, lang)} />}
                    {result.date && <Row label={t("ai.field.date")} value={formatDate(result.date, lang)} />}
                    {result.supplier && <Row label={t("ai.field.supplier")} value={result.supplier} />}
                    {result.address && <Row label={t("ai.field.address")} value={result.address} />}
                    {result.name && <Row label={t("ai.field.name")} value={result.name} />}
                    {result.propertyNumber && <Row label={t("ai.field.propertyNumber")} value={result.propertyNumber} />}
                    {result.accountNumber && <Row label={t("ai.field.accountNumber")} value={result.accountNumber} />}
                    {result.meterNumber && <Row label={t("ai.field.meterNumber")} value={result.meterNumber} />}
                    {result.block && <Row label={t("ai.field.block")} value={result.block} />}
                    {result.parcel && <Row label={t("ai.field.parcel")} value={result.parcel} />}
                    {result.area != null && <Row label={t("ai.field.area")} value={result.area} />}
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={applyResult}>{t("ai.apply")}</Button>
                    {isBillResult && result.amount != null && onCreateExpense && (
                      <Button variant="secondary" onClick={createExpense} disabled={expenseDone}>
                        {t("ai.createExpense")}
                      </Button>
                    )}
                    {isRegistryResult && onApplyToProperty && (result.block || result.parcel || result.area != null) && (
                      <Button variant="secondary" onClick={applyToProperty} disabled={propApplied}>
                        {t("ai.applyToProperty")}
                      </Button>
                    )}
                  </div>
                  {expenseDone && <p className="mt-2 text-xs text-success-text">{t("ai.expenseCreated")}</p>}
                  {propApplied && <p className="mt-2 text-xs text-success-text">{t("ai.propertyUpdated")}</p>}
                </div>
              )}
            </>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium text-navy">{value}</dd>
    </div>
  );
}
