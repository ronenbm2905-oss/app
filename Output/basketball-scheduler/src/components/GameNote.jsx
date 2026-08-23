import { useState, useEffect } from "react";
import { gameKey, noteFor, isUnread, buildNote, markRead } from "../utils/gameNotes";
import { IconCheck, IconPencil } from "./ui/icons";

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
};

// One game's report: the coach writes after the whistle, the professional manager reads.
//
// Open by default when there is something unread, closed otherwise — a manager scanning
// the list should see what is waiting without opening a dozen panels, and a coach adding
// a note should not have to hunt for the box.
export function GameNote({ game, notes, saveNote, canEdit, authorName, authorEmail }) {
  const key = gameKey(game);
  const note = noteFor(notes, game);
  const unread = isUnread(note);

  const [open, setOpen] = useState(unread);
  const [text, setText] = useState(note?.text || "");
  const [saved, setSaved] = useState(false);

  // A note can arrive from another device while this is on screen. Follow it, unless the
  // person is mid-sentence — overwriting what someone is typing is unforgivable.
  useEffect(() => {
    setText((current) => (current === "" || current === note?.text ? note?.text || "" : current));
  }, [note?.text]);

  if (!key) return null;

  const dirty = text.trim() !== (note?.text || "").trim();

  const persist = () => {
    // A refused write rejects and does nothing else — which on screen is indistinguishable
    // from a save. Say so rather than closing the panel over the coach's text.
    Promise.resolve(
      saveNote(key, buildNote(note, { text, author: authorName, authorEmail, now: new Date().toISOString() }))
    ).catch(() => alert("לא ניתן לשמור: הרשומה הזו שייכת למישהו אחר. פנה למנהל המקצועי."));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border ${
            unread
              ? "border-amber-300 bg-amber-50 text-amber-900 font-semibold"
              : note?.text
              ? "border-stone-200 bg-stone-50 text-stone-600"
              : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"
          }`}
        >
          <IconPencil size={13} />
          {unread ? "הערה חדשה מהמאמן" : note?.text ? "הערת מאמן" : "הוסף הערה למשחק"}
        </button>
      ) : (
        <div className={`rounded-lg border p-3 space-y-2 ${unread ? "border-amber-300 bg-amber-50/60" : "border-stone-200 bg-stone-50"}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span id={`note-label-${key}`} className="text-xs font-semibold text-stone-700">הערות מהמשחק</span>
            <button onClick={() => setOpen(false)} className="text-xs text-stone-500 underline">סגור</button>
          </div>

          {/* The placeholder used to end in "פציעות…", which asked coaches to record health
              details about minors. It steers away from that now: a field that invites
              sensitive data is the reason it ends up there. */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            dir="rtl"
            aria-labelledby={`note-label-${key}`}
            placeholder="איך שיחקנו, מה עבד, מה לשפר. בלי פרטים רפואיים או אבחנות — רק מה שנדרש לאימון הבא."
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] text-stone-500">
              {note?.updatedAt ? `${note.author || "מאמן"} · ${when(note.updatedAt)}` : "טרם נכתבה הערה"}
              {note?.readAt && <span className="text-emerald-700"> · נקרא</span>}
            </span>
            <div className="flex items-center gap-2">
              {/* Only a manager marks a note read, and only one that is actually waiting. */}
              {canEdit && unread && (
                <button
                  onClick={() =>
                    Promise.resolve(saveNote(key, markRead(note, new Date().toISOString()))).catch(() =>
                      alert("לא ניתן לסמן כנקרא. נסה שוב.")
                    )
                  }
                  className="px-3 min-h-11 text-xs rounded-lg border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
                >
                  סמן כנקרא
                </button>
              )}
              <button
                onClick={persist}
                disabled={!dirty}
                className="px-4 min-h-11 text-xs rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-40"
              >
                {saved ? "נשמר ✓" : "שמור"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
