import { useMemo, useState } from "react";
import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";
import { Field, Select, Textarea } from "./ui/Field.jsx";
import { IconPlus, IconDelete, IconAttach, IconWarning } from "./ui/icons.jsx";
import { fmtILS, fromGross, round2, withVat } from "../utils/money.js";
import { makeInvoice, makeDocument, makeVendor } from "../schema.js";
import { INVOICE_STATUS, INVOICE_STATUS_LABEL, CLAIM_STATUS, CLAIM_STATUS_LABEL } from "../constants.js";

/**
 * מעל הגודל הזה לא שומרים את הקובץ עצמו במצב מקומי — localStorage מוגבל
 * ל-~5MB לכל הדומיין, וכמה PDF יגמרו אותו ויפילו את השמירה של *כל* הנתונים.
 * במקרה כזה נשמרת המטא-דאטה בלבד; אחסון הקבצים האמיתי מגיע עם Firebase Storage.
 */
const LOCAL_FILE_LIMIT = 400 * 1024;

export default function InvoiceForm({ invoice, slice, store, onClose }) {
  const { project, costLines, vendors, boqItems, documents } = slice;
  const isNew = !invoice;

  const [form, setForm] = useState(() => invoice || makeInvoice({ projectId: project.id, vatRate: project.vatRate }));
  const [allocations, setAllocations] = useState(() => (invoice?.boqAllocations || []).slice());
  const [file, setFile] = useState(null);
  const [fileNote, setFileNote] = useState("");
  // טיוטת הברוטו נשמרת בזמן הקלדה כדי שהעיגול לא ידרוס את מה שהמשתמש מקליד.
  const [grossDraft, setGrossDraft] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // נטו/מע"מ/ברוטו נשארים עקביים תמיד — עורכים נטו, השאר נגזר.
  const money = useMemo(() => withVat(form.amountNet, form.vatRate), [form.amountNet, form.vatRate]);

  const allocated = round2(allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0));
  const overAllocated = allocated > money.amountGross + 0.01;

  const workItems = useMemo(
    () => boqItems.filter((b) => !b.isChapterTotal).sort((a, b) => a.code.localeCompare(b.code)),
    [boqItems],
  );

  const existingDoc = documents.find((d) => d.id === form.documentId) || null;

  const canSave = form.vendorName.trim() && money.amountGross > 0 && form.issueDate && !overAllocated;

  const onPickFile = async (f) => {
    if (!f) return;
    setFile(f);
    if (f.size > LOCAL_FILE_LIMIT) {
      setFileNote(
        `הקובץ (${Math.round(f.size / 1024)}KB) גדול מהמותר לשמירה מקומית — יישמרו שם הקובץ והגודל בלבד. הקובץ עצמו יעלה כשתחובר לענן.`,
      );
    } else {
      setFileNote("");
    }
  };

  const save = async () => {
    // המסמך נבנה לפני החשבונית כדי שיהיה לו id, אבל נכתב **אחריה** עם
    // `invoiceId` מלא — כדי שלא יישאר מסמך יתום אם השמירה נקטעת באמצע.
    let pendingDoc = null;
    if (file) {
      let localDataUrl = null;
      if (file.size <= LOCAL_FILE_LIMIT) {
        localDataUrl = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = () => resolve(null);
          r.readAsDataURL(file);
        });
      }
      pendingDoc = makeDocument({
        projectId: project.id,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        localDataUrl,
      });
    }

    // ספק חדש שהוקלד בשדה החופשי נשמר לרשימה, כדי שלא יוקלד שוב בפעם הבאה.
    let vendorId = form.vendorId;
    const typed = form.vendorName.trim();
    const known = vendors.find((v) => v.name === typed);
    if (!known && typed) {
      const v = makeVendor({ projectId: project.id, name: typed });
      store.upsert("vendors", v);
      vendorId = v.id;
    } else if (known) {
      vendorId = known.id;
    }

    const next = makeInvoice({
      ...form,
      vendorId,
      amountNet: money.amountNet,
      boqAllocations: allocations.filter((a) => a.boqItemId && Number(a.amount) > 0),
      documentId: pendingDoc ? pendingDoc.id : form.documentId,
    });
    store.upsert("invoices", next);
    if (pendingDoc) store.upsert("documents", { ...pendingDoc, invoiceId: next.id });
    onClose();
  };

  return (
    <Modal title={isNew ? "חשבונית חדשה" : "עריכת חשבונית"} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <VendorField
          value={form.vendorName}
          vendors={vendors}
          onChange={(vendorName) => set({ vendorName })}
        />
        <Field label="מספר חשבונית" value={form.invoiceNumber} onChange={(v) => set({ invoiceNumber: v })} />
        <Field label="תאריך חשבונית" type="date" value={form.issueDate || ""} onChange={(v) => set({ issueDate: v })} required />
        <Field label="תאריך לתשלום" type="date" value={form.dueDate || ""} onChange={(v) => set({ dueDate: v })} />

        {/*
          שני השדות עורכים את אותו סכום משני כיוונים. זה לא נוחות בלבד: יעדי
          המנות והתקציב הם **ברוטו**, וחשבונית מגיעה עם שני המספרים מודפסים.
          כפייה על הזנת נטו הייתה מכריחה חישוב ידני שגורר שגיאות עיגול.
        */}
        <Field
          label="סכום לפני מע״מ"
          type="number"
          value={form.amountNet}
          onChange={(v) => {
            setGrossDraft(null);
            set({ amountNet: Number(v) });
          }}
          required
        />
        <Field
          label="סכום כולל מע״מ"
          type="number"
          value={grossDraft ?? money.amountGross}
          onChange={(v) => {
            setGrossDraft(v);
            set({ amountNet: fromGross(Number(v), form.vatRate).amountNet });
          }}
          hint={`מע״מ ${Math.round(form.vatRate * 100)}% · ${fmtILS(money.vatAmount)}`}
        />

        <Select
          label="שורת תקציב"
          value={form.costLineId || ""}
          onChange={(v) => set({ costLineId: v || null })}
          options={[{ value: "", label: "— ללא שיוך —" }, ...costLines.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <Select
          label="סטטוס תשלום"
          value={form.status}
          onChange={(v) => set({ status: v })}
          options={INVOICE_STATUS.map((s) => ({ value: s, label: INVOICE_STATUS_LABEL[s] }))}
        />
        <Select
          label="מול מס רכוש"
          value={form.claimStatus}
          onChange={(v) => set({ claimStatus: v })}
          options={CLAIM_STATUS.map((s) => ({ value: s, label: CLAIM_STATUS_LABEL[s] }))}
          disabled={!!form.claimBatchId}
        />
        <Field
          label="סכום לדרישה מהרשות"
          type="number"
          value={form.claimedAmount ?? ""}
          onChange={(v) => set({ claimedAmount: v === "" ? null : Number(v) })}
          hint="ריק = הברוטו המלא"
        />
      </div>

      <Allocations
        items={workItems}
        allocations={allocations}
        setAllocations={setAllocations}
        gross={money.amountGross}
        allocated={allocated}
        over={overAllocated}
      />

      <div className="mt-4">
        <label className="text-[13px] font-semibold text-ink-body">מסמך מצורף</label>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-navy px-3 py-1.5 text-sm font-semibold text-navy transition hover:bg-navy hover:text-white">
            <IconAttach size={16} />
            {file ? file.name : existingDoc ? existingDoc.fileName : "בחירת קובץ"}
            <input type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => onPickFile(e.target.files?.[0])} />
          </label>
          {existingDoc && !file && <span className="text-xs text-ink-muted">מצורף כבר</span>}
        </div>
        {fileNote && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-text">
            <IconWarning size={14} className="mt-0.5 shrink-0" />
            {fileNote}
          </p>
        )}
      </div>

      <div className="mt-4">
        <Textarea label="הערות" value={form.notes} onChange={(v) => set({ notes: v })} rows={2} />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          ביטול
        </Button>
        <Button onClick={save} disabled={!canSave}>
          שמירה
        </Button>
      </div>
    </Modal>
  );
}

function VendorField({ value, vendors, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-semibold text-ink-body">
        ספק<span className="text-danger-text"> *</span>
      </label>
      <input
        list="vendor-list"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="שם הספק"
        className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-accent focus-visible:shadow-focus placeholder:text-ink-faint"
      />
      <datalist id="vendor-list">
        {vendors.map((v) => (
          <option key={v.id} value={v.name} />
        ))}
      </datalist>
      <span className="text-xs text-ink-muted">ספק חדש נשמר אוטומטית לרשימה</span>
    </div>
  );
}

function Allocations({ items, allocations, setAllocations, gross, allocated, over }) {
  const add = () => setAllocations((a) => [...a, { boqItemId: "", amount: 0 }]);
  const update = (i, patch) => setAllocations((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const drop = (i) => setAllocations((a) => a.filter((_, j) => j !== i));
  const rest = round2(gross - allocated);

  return (
    <section className="mt-5 rounded-lg border border-border bg-surface-alt p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-body">שיוך לסעיפי כתב כמויות</h3>
          <p className="text-xs text-ink-muted">
            אופציונלי. מה שלא משויך נשאר על שורת התקציב בלבד ולא ייספר בתקציב מול ביצוע ברמת פרק.
          </p>
        </div>
        <Button variant="secondary" onClick={add} type="button">
          <IconPlus size={14} /> סעיף
        </Button>
      </div>

      {allocations.length === 0 && <p className="text-xs text-ink-faint">אין שיוכים.</p>}

      <div className="space-y-2">
        {allocations.map((a, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <Select
                value={a.boqItemId}
                onChange={(v) => update(i, { boqItemId: v })}
                options={[
                  { value: "", label: "— בחירת סעיף —" },
                  ...items.map((b) => ({
                    value: b.id,
                    label: `${b.code} · ${b.description.slice(0, 60)}`,
                  })),
                ]}
              />
            </div>
            <div className="w-40">
              <input
                type="number"
                value={a.amount}
                onChange={(e) => update(i, { amount: Number(e.target.value) })}
                className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => drop(i)}
              className="rounded-sm p-2 text-ink-muted transition hover:bg-danger-fill hover:text-danger-text"
              title="הסרה"
            >
              <IconDelete size={16} />
            </button>
          </div>
        ))}
      </div>

      {allocations.length > 0 && (
        <p className={`num mt-3 text-sm ${over ? "text-danger-text" : "text-ink-muted"}`}>
          שויך {fmtILS(allocated)} מתוך {fmtILS(gross)}
          {over ? " — חריגה מסכום החשבונית" : rest > 0.01 ? ` · נותרו ${fmtILS(rest)}` : " · תואם"}
        </p>
      )}
    </section>
  );
}
