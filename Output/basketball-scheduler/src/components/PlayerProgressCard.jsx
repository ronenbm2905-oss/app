import { useState, useEffect } from "react";
import { buildProgress, hasContent, isUnread, MAX_LEN, playerLabel } from "../utils/playerProgress";
import { IconCheck, IconPencil } from "./ui/icons";

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
};

// One player's half-season note.
//
// Two different cards in one component, because they are two halves of the same object:
// the coach writes, the manager reads. What the manager does NOT get is a text box — see
// the note on `onSave` below, it is a real bug and not a preference.
export function PlayerProgressCard({
  player, roster, entry, period, canEdit, readOnly, onSave, onMarkRead, authorName, authorEmail,
}) {
  const written = hasContent(entry);
  const unread = isUnread(entry);
  // The manager's card is always expanded — they are here to read. The coach's opens on a
  // click, so a squad of fourteen is a list and not fourteen text boxes.
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(entry?.text || "");
  const [saved, setSaved] = useState(false);

  // The note can arrive from another device while this is on screen. Follow it — unless
  // the coach is mid-sentence, because overwriting what someone is typing is unforgivable.
  useEffect(() => {
    setText((current) => (current === "" || current === entry?.text ? entry?.text || "" : current));
  }, [entry?.text]);

  const label = playerLabel(player, roster);
  const dirty = text.trim() !== (entry?.text || "").trim();

  const persist = () => {
    // A refused write rejects and does nothing else — on screen that is indistinguishable
    // from a save. Say so rather than closing the panel over the coach's paragraph.
    Promise.resolve(
      onSave(buildProgress(entry, {
        text,
        playerId: player.id,
        teamId: player.teamId,
        period,
        author: authorName,
        authorEmail,
        now: new Date().toISOString(),
      }))
    ).catch(() => alert("לא ניתן לשמור: ההערכה הזו נכתבה על ידי מאמן אחר."));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ---- the manager's card: read, and mark read. No writing. ----
  //
  // `canEdit` is the MANAGER, not the writer — the one place in this file where the name
  // reads backwards from what this screen does, since here it is the coach who writes.
  //
  // Deliberately no text box. `canCreate` would happily let a manager save — and the save
  // would stamp THEIR address onto `authorEmail`, which drops the document out of the
  // coach's own filtered listen. The coach would simply stop seeing what they wrote, with
  // no error anywhere. `markRead` spreads the existing entry and so keeps ownership intact.
  if (canEdit) {
    return (
      <div className={`border rounded-lg p-3 ${unread ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-stone-800">{label}</span>
          {unread && <span className="text-[11px] font-semibold text-amber-800">חדש</span>}
          {!written && <span className="text-xs text-stone-500">טרם נכתב</span>}
        </div>
        {written && (
          <>
            <p className="text-sm text-stone-700 mt-1.5 whitespace-pre-wrap leading-relaxed">{entry.text}</p>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="text-xs text-stone-500">
                {entry.author || "—"}{entry.updatedAt ? ` · ${when(entry.updatedAt)}` : ""}
              </span>
              {unread && (
                <button
                  onClick={() => onMarkRead(entry)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 flex items-center gap-1"
                >
                  <IconCheck size={13} /> סמן כנקרא
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- the coach's card ----
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={readOnly && !written}
        className={`w-full text-right border rounded-lg px-3 py-2.5 flex items-center justify-between gap-2 disabled:opacity-60 ${
          written ? "border-stone-200 bg-stone-50 hover:bg-stone-100" : "border-stone-200 bg-white hover:bg-brand-50/60"
        }`}
      >
        <span className="text-sm font-medium text-stone-800">{label}</span>
        <span className={`text-xs flex items-center gap-1 shrink-0 ${written ? "text-emerald-700" : "text-stone-500"}`}>
          {written ? <><IconCheck size={13} /> נכתב</> : <><IconPencil size={13} /> טרם נכתב</>}
        </span>
      </button>
    );
  }

  return (
    <div className="border-2 border-brand-300 rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-stone-800">{label}</span>
        <button onClick={() => setOpen(false)} className="text-xs text-stone-500 hover:text-stone-800">סגור</button>
      </div>

      {readOnly ? (
        <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{entry?.text || "—"}</p>
      ) : (
        <>
          {/* A defined question, not an empty box. An empty box collects whatever comes to
              mind; a question collects an answer. This is the control that keeps a field
              about a child professional — the same problem that blocked an earlier review
              over a placeholder that mentioned injuries. */}
          <label className="block text-xs font-medium text-stone-600">
            מה התקדם אצל השחקן/ית בחציון הזה, ומה היעד המקצועי לחציון הבא?
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            rows={4}
            dir="rtl"
            placeholder="התקדמות מקצועית בלבד — מיומנויות, מוטיבציה, עבודת צוות. בלי מידע רפואי, אבחנות או פציעות, ובלי נושאים אישיים או משפחתיים."
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Three facts in one line, and each of them is true: who reads it, how long it
                is kept, how often it is written. */}
            <p className="text-xs text-stone-600">
              נקרא על ידי המנהל המקצועי ועל ידך בלבד · נמחק בתום העונה
            </p>
            <span className="text-xs text-stone-500 tabular-nums">{text.length}/{MAX_LEN}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={persist}
              disabled={!dirty}
              className="px-3.5 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600 flex items-center gap-1.5"
            >
              <IconCheck size={15} /> שמור
            </button>
            {saved && <span className="text-xs text-emerald-700">נשמר</span>}
            {entry?.updatedAt && !dirty && (
              <span className="text-xs text-stone-500">עודכן {when(entry.updatedAt)}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
