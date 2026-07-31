import { useState } from "react";
import { IconCheck, IconTrash } from "./ui/icons";

function formatUpdated(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("he-IL", {
    day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function AnnouncementsView({ data, save, canEdit }) {
  const current = data.announcement?.text || "";
  const updatedAt = data.announcement?.updatedAt || null;
  const [text, setText] = useState(current);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = text !== current;

  const persist = (value) => {
    save({ ...data, announcement: { text: value.trim(), updatedAt: new Date().toISOString() } });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  // View-only (coaches): render the live text directly so onSnapshot updates show immediately.
  if (!canEdit) {
    return (
      <div className="space-y-3" dir="rtl">
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center gap-2">
            <span aria-hidden="true">📢</span>
            <h2 className="text-base font-semibold text-stone-800">הודעות למאמנים</h2>
          </div>
          <div className="p-4">
            {current ? (
              <>
                <p className="text-sm text-stone-800 whitespace-pre-wrap break-words">{current}</p>
                {updatedAt && <p className="text-xs text-stone-500 mt-3">עודכן: {formatUpdated(updatedAt)}</p>}
              </>
            ) : (
              <p className="text-sm text-stone-600">אין הודעות כרגע.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center gap-2 flex-wrap">
          <span aria-hidden="true">📢</span>
          <h2 className="text-base font-semibold text-stone-800">הודעות למאמנים</h2>
          <span className="text-xs text-stone-500">· מוצג לכל המאמנים בראש המסך</span>
        </div>
        <div className="p-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="כתוב כאן הודעה כללית למאמנים — לדוגמה: 'בשבוע הבא אין אימונים ביום שלישי בגלל חג.'"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
            dir="rtl"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-stone-500">
              {justSaved ? (
                <span className="text-emerald-600">✓ נשמר</span>
              ) : updatedAt ? (
                `עודכן לאחרונה: ${formatUpdated(updatedAt)}`
              ) : (
                "טרם פורסמה הודעה"
              )}
            </div>
            <div className="flex items-center gap-2">
              {current && (
                <button
                  onClick={() => { setText(""); persist(""); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50"
                >
                  <IconTrash size={15} /> מחק הודעה
                </button>
              )}
              <button
                onClick={() => persist(text)}
                disabled={!dirty}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:hover:bg-orange-600"
              >
                <IconCheck size={15} /> פרסם הודעה
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
