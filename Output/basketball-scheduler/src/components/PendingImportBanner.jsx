import { useState } from "react";
import { ImportReview } from "./ImportReview";
import { IconDownload, IconAlert } from "./ui/icons";

const when = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
};

// One line saying what a new federation file would do, and a way in.
//
// It names the numbers rather than saying "there is an update", because the decision the
// manager is being asked for is whether those numbers look right. "3 changed" invites a
// look; "an update is available" invites a reflexive yes.
export function PendingImportBanner({ pending, data, save, resolvePending }) {
  const [open, setOpen] = useState(false);
  if (!pending) return null;

  const s = pending.summary || {};
  const parts = [
    s.added ? `${s.added} משחקים חדשים` : "",
    s.updated ? `${s.updated} שינויים` : "",
    s.cancelled ? `${s.cancelled} בוטלו` : "",
    s.restored ? `${s.restored} חזרו` : "",
  ].filter(Boolean);

  return (
    <>
      <div
        className={`rounded-xl border px-4 py-3 flex items-center gap-3 flex-wrap ${
          s.suspicious ? "bg-amber-50 border-amber-300" : "bg-brand-50 border-brand-200"
        }`}
      >
        <span className={s.suspicious ? "text-amber-700" : "text-brand-700"}>
          {s.suspicious ? <IconAlert size={18} /> : <IconDownload size={18} />}
        </span>
        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm font-semibold text-stone-800">
            קובץ חדש מהאיגוד{pending.fetchedAt ? ` (${when(pending.fetchedAt)})` : ""}
          </p>
          <p className="text-xs text-stone-600">
            {parts.length ? parts.join(" · ") : "בלי שינויים"}
            {/* The warning is spelled out, not just coloured: the one thing a manager must
                not do is approve a broken file out of habit. */}
            {s.suspicious && (
              <span className="block text-amber-800 font-medium mt-0.5">
                שים לב — {s.ratio}% מהמשחקים בטווח היו מסומנים כמבוטלים. ייתכן שהקובץ חלקי. בדוק לפני אישור.
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md"
        >
          סקור ואשר
        </button>
      </div>

      {open && (
        <ImportReview
          pending={pending}
          data={data}
          save={save}
          resolvePending={resolvePending}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
