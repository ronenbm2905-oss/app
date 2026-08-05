import { useState } from "react";
import { useI18n } from "../../hooks/useI18n.jsx";
import { Button, Pill } from "../ui/Button.jsx";
import { Modal } from "../ui/Modal.jsx";
import { Field, Select, Textarea } from "../ui/Field.jsx";
import { IconPlus, IconDelete } from "../ui/icons.jsx";
import { enumOptions } from "../../utils/options.js";
import { TRANSACTION_TYPES, TRANSACTION_CATEGORIES, TRANSACTION_SOURCES } from "../../constants.js";
import { createTransaction } from "../../schema.js";
import { formatCurrency, formatDate } from "../../utils/format.js";
import { annualIncome, annualExpenses, netAnnualCashflow } from "../../utils/finance.js";

// טאב כלכלה — תנועות הכנסה/הוצאה של הנכס + סיכום שנתי.
export function FinanceTab({ property, data, ownerId, onSave, onDelete, canEdit }) {
  const { t, lang } = useI18n();
  const [modal, setModal] = useState(false);
  const c = property.currency;
  const txns = data.transactions
    .filter((tx) => tx.propertyId === property.id)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const income = annualIncome(property, data.transactions, data.leases);
  const expense = annualExpenses(property, data.transactions);
  const net = netAnnualCashflow(property, data.transactions, data.leases);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label={t("txn.summary.income")} value={formatCurrency(income, c, lang)} tone="green" />
        <SummaryCard label={t("txn.summary.expense")} value={formatCurrency(expense, c, lang)} tone="red" />
        <SummaryCard label={t("txn.summary.net")} value={formatCurrency(net, c, lang)} tone={net >= 0 ? "green" : "red"} />
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t("txn.title")}</h3>
          {canEdit && (
            <Button onClick={() => setModal(true)}>
              <IconPlus size={16} /> {t("txn.add")}
            </Button>
          )}
        </div>
        {txns.length === 0 ? (
          <p className="text-sm text-slate-500">{t("txn.none")}</p>
        ) : (
          <div className="table-scroll">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="px-2 py-2 text-start">{t("txn.date")}</th>
                  <th className="px-2 py-2 text-start">{t("txn.type")}</th>
                  <th className="px-2 py-2 text-start">{t("txn.category")}</th>
                  <th className="px-2 py-2 text-start">{t("txn.amount")}</th>
                  <th className="px-2 py-2 text-start">{t("txn.source")}</th>
                  {canEdit && <th className="px-2 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {txns.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-slate-600">{formatDate(tx.date, lang)}</td>
                    <td className="px-2 py-2">
                      <Pill tone={tx.type === "income" ? "green" : "red"}>{t(`enum.txnType.${tx.type}`)}</Pill>
                    </td>
                    <td className="px-2 py-2 text-slate-600">{t(`enum.txnCategory.${tx.category}`)}</td>
                    <td className="px-2 py-2 font-medium text-slate-800">{formatCurrency(tx.amount, c, lang)}</td>
                    <td className="px-2 py-2 text-slate-500">{t(`enum.txnSource.${tx.source}`)}</td>
                    {canEdit && (
                      <td className="px-2 py-2 text-end">
                        <button onClick={() => onDelete(tx.id)} aria-label={t("common.delete")} className="text-slate-400 hover:text-red-600">
                          <IconDelete size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <TxnModal
          initial={createTransaction({ ownerId, propertyId: property.id })}
          onClose={() => setModal(false)}
          onSave={(tx) => {
            onSave(tx);
            setModal(false);
          }}
        />
      )}
    </div>
  );
}

function TxnModal({ initial, onClose, onSave }) {
  const { t } = useI18n();
  const [tx, setTx] = useState(() => JSON.parse(JSON.stringify(initial)));
  const set = (k, v) => setTx({ ...tx, [k]: v });
  return (
    <Modal
      title={t("txn.add")}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(tx)}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label={t("txn.type")} value={tx.type} onChange={(v) => set("type", v)} options={enumOptions(TRANSACTION_TYPES, "txnType", t)} />
          <Select label={t("txn.category")} value={tx.category} onChange={(v) => set("category", v)} options={enumOptions(TRANSACTION_CATEGORIES, "txnCategory", t)} />
          <Field label={t("txn.amount")} type="number" value={tx.amount ?? ""} onChange={(v) => set("amount", v === "" ? null : Number(v))} required />
          <Field label={t("txn.date")} type="date" value={tx.date} onChange={(v) => set("date", v)} required />
          <Select label={t("txn.source")} value={tx.source} onChange={(v) => set("source", v)} options={enumOptions(TRANSACTION_SOURCES, "txnSource", t)} />
        </div>
        <Textarea label={t("txn.note")} value={tx.note} onChange={(v) => set("note", v)} rows={2} />
      </div>
    </Modal>
  );
}

function SummaryCard({ label, value, tone }) {
  const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-600" : "text-slate-800";
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
