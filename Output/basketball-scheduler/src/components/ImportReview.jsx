import { useState, useEffect } from "react";
import { applyProposal } from "../utils/pendingImport";
import { IconX, IconCheck, IconAlert } from "./ui/icons";

// The list of everything a federation file would change, and the decision.
//
// Shown before anything is written, because this is the only screen where a partial or
// broken file can still be caught. Approving applies the proposal to whatever the club
// holds *now*, not to the snapshot the nightly job read at three in the morning.

function Section({ title, tone = "stone", items, children }) {
  if (!items?.length) return null;
  const ring = { stone: "border-stone-200", green: "border-green-300", red: "border-red-300", amber: "border-amber-300" }[tone];
  return (
    <div className={`border rounded-lg overflow-hidden ${ring}`}>
      <p className="text-xs font-semibold text-stone-700 bg-stone-50 px-3 py-1.5 border-b border-stone-200">
        {title} ({items.length})
      </p>
      <div className="divide-y divide-stone-100 max-h-56 overflow-y-auto">{children}</div>
    </div>
  );
}

export function ImportReview({ pending, data, save, resolvePending, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // A file the checks flagged has to be acknowledged on its own before the approve button
  // will do anything. It is the one case where a habitual click is the actual danger.
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const s = pending.summary || {};
  const blocked = Boolean(s.suspicious) && !acknowledged;

  async function approve() {
    if (busy || blocked) return;
    setBusy(true);
    setError("");
    try {
      await save(applyProposal(data, pending, new Date().toISOString()));
      await resolvePending(pending.id, "approved");
      onClose();
    } catch {
      setError("השמירה נכשלה. ההצעה נשארה פתוחה — נסה שוב.");
      setBusy(false);
    }
  }

  async function reject() {
    if (busy) return;
    setBusy(true);
    try {
      await resolvePending(pending.id, "rejected");
      onClose();
    } catch {
      setError("לא הצלחנו לסמן את ההצעה כנדחתה.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-900/50 p-2 overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-label="סקירת ייבוא מהאיגוד" className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-6">
        <div className="flex items-start gap-2 px-4 py-3 border-b border-stone-200">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-stone-800">מה ישתנה אם תאשר</h3>
            <p className="text-xs text-stone-500">
              מקור: {pending.sourceFile || "קובץ האיגוד"}
              {pending.truncated ? " · הרשימה קוצרה כדי להיכנס למגבלת המסמך" : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="p-1 text-stone-500 hover:text-stone-800" aria-label="סגור">
            <IconX size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {s.suspicious && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900">
              <p className="font-semibold flex items-center gap-1.5">
                <IconAlert size={14} /> הקובץ נראה חלקי
              </p>
              <p className="mt-1">
                {s.ratio}% מהמשחקים בטווח שהקובץ מכסה היו מסומנים כמבוטלים. כך נראה קובץ של ליגה אחת
                בלבד, או הורדה שנקטעה — ולא סבב ביטולים אמיתי.
              </p>
              <label className="flex items-start gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="accent-brand-600 mt-0.5" />
                <span>בדקתי את הרשימה למטה והיא נכונה</span>
              </label>
            </div>
          )}

          <Section title="משחקים חדשים" tone="green" items={pending.added}>
            {(pending.added || []).map((a) => (
              <p key={a.code} className="text-xs text-stone-700 px-3 py-1.5">{a.label}</p>
            ))}
          </Section>

          <Section title="שינויים" tone="amber" items={pending.updated}>
            {(pending.updated || []).map((u) => (
              <div key={u.code} className="px-3 py-1.5">
                <p className="text-xs text-stone-700">{u.label}</p>
                {u.fields.map((f) => (
                  <p key={f.key} className="text-[11px] text-stone-500 mt-0.5">
                    {f.label}: <span className="line-through">{f.before}</span> ← <span className="font-semibold text-stone-800">{f.after}</span>
                  </p>
                ))}
              </div>
            ))}
          </Section>

          <Section title="בוטלו" tone="red" items={pending.cancelled}>
            {(pending.cancelled || []).map((c) => (
              <p key={c.code} className="text-xs text-stone-700 px-3 py-1.5">{c.label}</p>
            ))}
          </Section>

          <Section title="חזרו ללוח" tone="green" items={pending.restored}>
            {(pending.restored || []).map((c) => (
              <p key={c.code} className="text-xs text-stone-700 px-3 py-1.5">{c.label}</p>
            ))}
          </Section>

          <p className="text-[11px] text-stone-500">
            משחק שבוטל נשאר בלוח עם סימון, ולא נמחק — מאמן שכבר ראה אותו צריך לדעת שהוא ירד.
            שעות ששינית ידנית וכתובות שהזנת נשמרות.
          </p>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-2 pt-2 border-t border-stone-200">
            <button type="button" onClick={reject} disabled={busy} className="text-xs font-medium text-stone-600 px-3 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 disabled:opacity-40">
              דחה
            </button>
            <span className="flex-1" />
            <button type="button" onClick={onClose} disabled={busy} className="text-xs font-medium text-stone-600 px-3 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 disabled:opacity-40">
              אחר כך
            </button>
            <button
              type="button"
              onClick={approve}
              disabled={busy || blocked}
              title={blocked ? "אשר את ההערה למעלה קודם" : ""}
              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md disabled:opacity-40"
            >
              <IconCheck size={13} /> {busy ? "מעדכן…" : "אשר ועדכן"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
