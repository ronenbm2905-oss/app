// Compact notice shown at the top of every screen (except the הודעות tab itself)
// whenever an announcement is set. Read-only — editing happens in AnnouncementsView.
export function AnnouncementBanner({ data, onOpen }) {
  const text = (data.announcement?.text || "").trim();
  if (!text) return null;

  return (
    <div className="no-print mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2.5" dir="rtl">
      <span aria-hidden="true" className="text-lg leading-none mt-0.5">📢</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-800 mb-0.5">הודעה למאמנים</p>
        <p className="text-sm text-amber-900 whitespace-pre-wrap break-words">{text}</p>
      </div>
      {onOpen && (
        <button onClick={onOpen} className="text-xs text-amber-700 underline shrink-0 hover:text-amber-900">
          פתח
        </button>
      )}
    </div>
  );
}
