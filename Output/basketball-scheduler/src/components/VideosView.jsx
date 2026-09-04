import { useState, useMemo } from "react";
import { VIDEO_CATEGORIES } from "../constants";
import { uid } from "../utils/dates";
import { buildVideo, matchesSearch, sortVideos, providerLabel, normalizeVideoUrl } from "../utils/videoLinks";
import { Select } from "./ui/Select";
import { IconPlus, IconTrash, IconCheck, IconPencil, IconPlay, IconSearch } from "./ui/icons";

// The club's shared bank of drill and play videos.
//
// Links, never an embedded player. The app has no third-party script, font or iframe in it
// — the privacy policy says in as many words that we set no advertising or tracking
// cookies, and a YouTube player would make that sentence false the moment it rendered. So
// a card here is text and an outbound link; the video opens in YouTube's own app, which on
// a phone is the better experience anyway.
//
// For the same reason there are no thumbnails: `img.youtube.com/vi/…` is a request to
// Google from our page, which is exactly what this design avoids.

function VideoForm({ initial, author, authorEmail, isManager, onSave, onCancel }) {
  const [url, setUrl] = useState(initial?.url || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [note, setNote] = useState(initial?.note || "");
  const [error, setError] = useState("");
  // Releasing the entry to the club. Offered only to a manager editing an entry somebody
  // else added, and it exists because the privacy policy promises that a departing coach's
  // name and address come off the links they contributed while the links themselves stay.
  // Without it that promise has no mechanism here: the form writes the original author
  // back on every save, and a club — unlike the service operator — has no Firebase console
  // to do it by hand. A promise with no mechanism is the failure this project keeps
  // finding in its own documents.
  const [release, setRelease] = useState(false);
  const otherAuthor = Boolean(
    isManager && initial?.authorEmail &&
    String(initial.authorEmail).toLowerCase() !== String(authorEmail || "").toLowerCase()
  );

  const submit = () => {
    const built = buildVideo({
      id: initial?.id || uid(),
      url, title, category, note,
      // On an edit the original author keeps the entry — the rules compare `authorEmail`
      // on the way in and on the way out, and rewriting it would make the save fail for a
      // coach. A manager is allowed past that check by the rules, which is what makes the
      // release below possible at all; it blanks the owner, and from then on only a
      // manager can touch the entry.
      author: release ? "" : (initial?.author || author),
      authorEmail: release ? "" : (initial?.authorEmail || authorEmail),
      now: initial?.createdAt || new Date().toISOString(),
    });
    if (!built.ok) { setError(built.reason); return; }
    setError("");
    onSave(built.video);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-300 p-4 space-y-3" dir="rtl">
      <h3 className="text-sm font-semibold text-stone-700">{initial ? "עריכת סרטון" : "הוספת סרטון"}</h3>

      <div>
        <label className="text-xs text-stone-500 mb-1 block" htmlFor="video-url">קישור לסרטון</label>
        <input
          id="video-url"
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          placeholder="https://youtu.be/..."
          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          dir="ltr"
          autoFocus
        />
        <p className="text-xs text-stone-600 mt-1">
          יוטיוב או פייסבוק. <span className="font-medium">שים לב:</span> סרטון בקבוצת פייסבוק סגורה
          לא ייפתח למאמנים שאינם חברים בה.
        </p>
      </div>

      <div>
        <label className="text-xs text-stone-500 mb-1 block" htmlFor="video-title">שם התרגיל / המהלך</label>
        <input
          id="video-title"
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(""); }}
          placeholder="לדוגמה: מסירת חזה — יסודות"
          className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          dir="rtl"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-stone-500 mb-1 block">קטגוריה</label>
          <Select
            value={category}
            onChange={setCategory}
            options={VIDEO_CATEGORIES.map((c) => ({ id: c, name: c }))}
            placeholder="בחר קטגוריה"
          />
        </div>
        <div>
          <label className="text-xs text-stone-500 mb-1 block" htmlFor="video-note">הערה (אופציונלי)</label>
          <input
            id="video-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="לדוגמה: מתאים לילדים ב'"
            className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            dir="rtl"
          />
        </div>
      </div>

      {otherAuthor && (
        <label className="flex items-start gap-2 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={release}
            onChange={(e) => setRelease(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            הסר את שם המוסיף ואת כתובתו והשאר את הקישור לספרייה — לשימוש כשמאמן/ת מסיים/ת
            את תפקידו/ה. מרגע זה רק מנהל יוכל לערוך את הרשומה.
          </span>
        </label>
      )}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      <p className="text-xs text-stone-600">
        רק תוכן כדורסל מקצועי מקישור פומבי.{" "}
        <span className="font-medium text-stone-700">אין לקשר לסרטון שמופיעים בו שחקני המועדון
        או פעילות שלנו</span> — גם אם צילמת והעלית אותו בעצמך — <span className="font-medium text-stone-700">ואין
        לקשר לסרטון שבו מזוהה קטין שאינו חלק מתוכן מקצועי שפורסם לציבור</span>.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50">
          ביטול
        </button>
        <button
          onClick={submit}
          className="px-3 py-1.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-1.5"
        >
          <IconCheck size={15} /> שמור
        </button>
      </div>
    </div>
  );
}

export function VideosView({ data, user, canEdit, videos, saveVideo, removeVideo, videosReady }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const myEmail = String(user?.email || "").toLowerCase();
  const authorName = user?.displayName || user?.email || "";

  // A coach may change or remove what they added; a manager may remove anything. This
  // mirrors the Firestore rule exactly, so the button that is offered is the button that
  // will succeed.
  const mine = (v) => canEdit || (myEmail && String(v.authorEmail || "").toLowerCase() === myEmail);

  const shown = useMemo(() => {
    const list = (videos || []).filter(
      (v) => (!category || v.category === category) && matchesSearch(v, search)
    );
    return sortVideos(list);
  }, [videos, search, category]);

  const total = (videos || []).length;

  const handleSave = (video) => {
    saveVideo(video);
    setAdding(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-stone-600 max-w-xl">
          בנק משותף של סרטוני תרגילים ומהלכים. כל מאמן יכול להוסיף, וכולם רואים את כולם.
          הסרטון נפתח ביוטיוב או בפייסבוק — הוא לא מתנגן כאן.
        </p>
        <button
          onClick={() => { setAdding(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 shrink-0"
        >
          <IconPlus size={15} /> הוסף סרטון
        </button>
      </div>

      {adding && (
        <VideoForm isManager={canEdit}
          author={authorName}
          authorEmail={myEmail}
          onSave={handleSave}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Filters — only worth the room once there is something to sift through. */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[12rem]">
            <span className="sr-only">חיפוש בספרייה</span>
            <IconSearch size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם, הערה או מי הוסיף"
              className="w-full bg-white border border-stone-300 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              dir="rtl"
            />
          </label>
          <Select
            value={category}
            onChange={setCategory}
            options={VIDEO_CATEGORIES.map((c) => ({ id: c, name: c }))}
            placeholder="כל הקטגוריות"
            className="w-44"
          />
          {(search || category) && (
            <button
              onClick={() => { setSearch(""); setCategory(""); }}
              className="px-2.5 py-2 text-xs rounded-lg border border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
            >
              נקה סינון
            </button>
          )}
        </div>
      )}

      {!videosReady ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-sm text-stone-600">טוען…</div>
      ) : total === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center space-y-2">
          <IconPlay size={28} className="mx-auto text-stone-500" />
          <p className="text-sm text-stone-600">הספרייה עדיין ריקה.</p>
          <p className="text-xs text-stone-600">הוסף את הסרטון הראשון — הוא יופיע אצל כל המאמנים.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-sm text-stone-600">
          אין סרטון שמתאים לחיפוש.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {shown.map((v) =>
            editingId === v.id ? (
              <div key={v.id} className="sm:col-span-2">
                <VideoForm isManager={canEdit}
                  initial={v}
                  author={authorName}
                  authorEmail={myEmail}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <VideoCard key={v.id} video={v} canManage={mine(v)} onEdit={() => { setEditingId(v.id); setAdding(false); }} onDelete={() => removeVideo(v.id)} />
            )
          )}
        </div>
      )}

      {total > 0 && (
        <p className="text-xs text-stone-600">
          {shown.length === total ? `${total} סרטונים` : `${shown.length} מתוך ${total} סרטונים`}
        </p>
      )}

      {total > 0 && (
        <p className="text-xs text-stone-600">
          קישור שאינו מתאים? פנו למנהל המועדון להסרתו.
        </p>
      )}
    </div>
  );
}

function VideoCard({ video: v, canManage, onEdit, onDelete }) {
  // Re-parsed HERE, at render, and not trusted from the document.
  //
  // `videoLinks` runs on the way in — but only in the browser, and the Firestore rules check
  // `authorEmail` and nothing else. A club member writing through the SDK, or a coach whose
  // Google account is taken over, could store `https://phishing…/login` with
  // `provider: "youtube"` — and the card would vouch for it in our own words. So the target
  // and the "יוטיוב" label are both derived from the same parse, and a link that does not
  // pass is not a link at all.
  const link = normalizeVideoUrl(v.url);

  const body = (
    <>
      <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100 flex items-center justify-center shrink-0">
        <IconPlay size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-stone-800 leading-tight">{v.title}</span>
        <span className="block text-xs text-stone-600 mt-0.5">
          {link.ok ? `${providerLabel(link.provider)} · נפתח בחלון חדש` : "קישור לא תקין — פנו למנהל"}
        </span>
      </span>
    </>
  );

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        {link.ok ? (
          /* The app's first outbound link. `noopener noreferrer` is not optional:
             without it the opened page gets a handle on this window. */
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 flex items-start gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded hover:text-brand-700"
            title={`פתח ב${providerLabel(link.provider)} — ${v.title}`}
          >
            {body}
          </a>
        ) : (
          <div className="flex-1 min-w-0 flex items-start gap-2 opacity-70">{body}</div>
        )}
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600"
              aria-label={`ערוך ${v.title}`}
            >
              <IconPencil size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-red-50 text-stone-600 hover:text-red-600"
              aria-label={`מחק ${v.title}`}
            >
              <IconTrash size={14} />
            </button>
          </div>
        )}
      </div>
      {v.note && <p className="text-xs text-stone-600">{v.note}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-600 mt-auto pt-1">
        {v.category && (
          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">{v.category}</span>
        )}
        {v.author && <span>הוסיף: {v.author}</span>}
      </div>
    </div>
  );
}
