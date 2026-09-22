import { useState, useMemo, useRef } from "react";
import { uid } from "../utils/dates";
import {
  gridFrom, buildSheet, filterRows, setCell, gridBytes, columnLetter, MAX_ROWS, MAX_COLS,
} from "../utils/sheetGrid";
import { readWorkbook, downloadSheet } from "../utils/sheetFile";
import { Select } from "./ui/Select";
import {
  IconUpload, IconDownload, IconTrash, IconSearch, IconArrowRight,
  IconFileSpreadsheet, IconX, IconCheck, IconRefresh,
} from "./ui/icons";

// The manager's own spreadsheets — the sheet of fixed hall slots he has always kept in
// Excel, and anything else of that shape — so it is on the phone instead of on the laptop.
//
// THE FILE IS NOT KEPT, THE ROWS ARE. The club has no file storage at all, and this screen
// does not add any: the workbook is opened in the browser, the grid is saved, and the file
// is discarded — the same arrangement the player import and the federation file have always
// used. What that costs is honest and worth saying out loud on screen: colours, merged
// cells and formulas do not survive. What it buys is a table that opens in the app, is
// searchable, and can be corrected with a thumb at the gym door.
//
// Managers only, and enforced in firestore.rules rather than by this screen being hidden.

const KB = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- bringing one in ----------

function Importer({ replacing, author, onSave, onCancel }) {
  const fileRef = useRef(null);
  const [book, setBook] = useState(null);      // { names, rows }
  const [pick, setPick] = useState("");        // which worksheet
  const [header, setHeader] = useState(true);
  const [title, setTitle] = useState(replacing?.name || "");
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    let parsed;
    try {
      parsed = await readWorkbook(file);
    } catch {
      setError("שגיאה בקריאת הקובץ. ודא שמדובר בקובץ xlsx או xls תקין.");
      return;
    }
    if (!parsed.names.length) {
      setError("לא נמצא אף גיליון בקובץ.");
      return;
    }
    setBook(parsed);
    setPick(parsed.names[0]);
    // The worksheet's own tab name is almost always the better title — "ברזלים" rather
    // than "ברזלים-סופי-2 (1).xlsx".
    if (!title) setTitle(parsed.names[0] === "Sheet1" ? file.name.replace(/\.[^.]+$/, "") : parsed.names[0]);
  };

  const grid = useMemo(
    () => (book && pick ? gridFrom(book.rows[pick], { header }) : null),
    [book, pick, header]
  );
  const bytes = grid ? gridBytes(grid) : 0;

  const submit = () => {
    const built = buildSheet({
      id: replacing?.id || uid(),
      name: title,
      grid,
      now: new Date().toISOString(),
      by: author,
    });
    if (!built.ok) { setError(built.reason); return; }
    onSave(built.sheet);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-300 p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-700">
          {replacing ? `החלפת התוכן של "${replacing.name}"` : "העלאת גיליון חדש"}
        </h3>
        <button onClick={onCancel} className="text-stone-500 hover:text-stone-700 p-1" aria-label="ביטול">
          <IconX size={18} />
        </button>
      </div>

      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="hidden"
          id="sheet-file"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 bg-brand-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-brand-700"
        >
          <IconUpload size={16} />
          {book ? "בחירת קובץ אחר" : "בחירת קובץ אקסל"}
        </button>
        {!book && (
          <>
            <p className="text-xs text-stone-600 mt-2">
              עד {MAX_ROWS} שורות ו-{MAX_COLS} עמודות. <span className="font-medium">נשמרים התוכן והעמודות בלבד</span> —
              צבעים, תאים ממוזגים ונוסחאות לא נשמרים.
            </p>
            <p className="text-xs text-stone-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              שעות, אולמות, קבוצות ורשימות עבודה. <span className="font-semibold">לא רשימות שחקנים
              ולא פרטים אישיים של ילדים.</span>
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {book && grid && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 mb-1 block" htmlFor="sheet-title">שם הגיליון באפליקציה</label>
              <input
                id="sheet-title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            {book.names.length > 1 && (
              <div>
                <label className="text-xs text-stone-500 mb-1 block">איזה גיליון בקובץ</label>
                <Select
                  value={pick}
                  onChange={setPick}
                  options={book.names.map((n) => ({ id: n, name: n }))}
                  placeholder="בחר גיליון"
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} className="rounded" />
            השורה הראשונה היא שורת כותרת
          </label>

          <div className="text-xs text-stone-600">
            {grid.rows.length} שורות · {grid.columns.length} עמודות · {KB(bytes)}
          </div>

          {/* The warning that actually works is the one standing over the content. The
              preview is already here; a column headed "טלפון" is visible from across the
              room, and this is the moment before it becomes a saved record. */}
          <p className="text-xs text-stone-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="note">
            <span className="font-semibold">עצור וקרא את השורות שלמטה לפני השמירה.</span> יש בעמודות
            שם של שחקן/ית, טלפון או תאריך לידה? <span className="font-semibold">אל תשמור</span> —
            מחק את העמודות בקובץ המקורי והעלה שוב.
          </p>

          <div className="overflow-x-auto border border-stone-200 rounded-lg">
            <table className="text-xs min-w-full">
              <thead className="bg-stone-100">
                <tr>
                  {grid.columns.map((c, i) => (
                    <th key={i} className="px-2 py-1.5 text-right font-semibold text-stone-700 whitespace-nowrap border-l border-stone-200 last:border-l-0">
                      {c || " "}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.slice(0, 5).map((row, r) => (
                  <tr key={r} className="border-t border-stone-200">
                    {row.map((cell, c) => (
                      <td key={c} className="px-2 py-1.5 text-stone-700 whitespace-nowrap border-l border-stone-200 last:border-l-0">
                        {cell || " "}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {grid.rows.length > 5 && (
            <p className="text-xs text-stone-500">מוצגות 5 השורות הראשונות מתוך {grid.rows.length}.</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={submit}
              className="inline-flex items-center gap-2 bg-brand-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-brand-700"
            >
              <IconCheck size={16} />
              {replacing ? "החלף את התוכן" : "שמור גיליון"}
            </button>
            <button onClick={onCancel} className="text-sm text-stone-600 px-3 py-2 hover:text-stone-800">ביטול</button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- reading and correcting one ----------

function SheetTable({ sheet, canEdit, onChange }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // { r, c }
  const [draft, setDraft] = useState("");

  const visible = useMemo(() => filterRows(sheet, query), [sheet, query]);

  const open = (r, c, value) => {
    if (!canEdit) return;
    setEditing({ r, c });
    setDraft(value);
  };

  const commit = () => {
    if (!editing) return;
    const next = setCell(sheet, editing.r, editing.c, draft);
    setEditing(null);
    if (next !== sheet) onChange(next);
  };

  const width = Math.max(sheet.columns.length, ...sheet.rows.map((r) => r.length), 1);
  const columns = Array.from({ length: width }, (_, i) => sheet.columns[i] || "");

  return (
    <div className="space-y-3" dir="rtl">
      <div className="relative">
        <IconSearch size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש בכל הטבלה — אפשר כמה מילים"
          className="w-full bg-white border border-stone-300 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="חיפוש בגיליון"
        />
      </div>

      <p className="text-xs text-stone-500" role="status">
        {query
          ? `${visible.length} מתוך ${sheet.rows.length} שורות`
          : `${sheet.rows.length} שורות`}
        {canEdit ? " · לחיצה על תא פותחת אותו לעריכה" : ""}
      </p>

      {/* Horizontal scroll rather than wrapping: a slot sheet is read by its columns, and a
          wrapped cell on a phone turns four short columns into a wall. The row number and
          the header stay put so a cell in the middle still says what it is. */}
      <div className="overflow-auto max-h-[70vh] rounded-xl border border-stone-300 bg-white">
        {/* `min-w-full` so a narrow sheet fills the card instead of huddling against the
            right edge, while a wide one still scrolls rather than squeezing its columns. */}
        <table className="min-w-full text-sm border-collapse">
          {/* A screen reader announces the caption before the cells, which in a table of
              sixty columns is the difference between "a table" and "this table". */}
          <caption className="sr-only">
            {sheet.name} — {sheet.rows.length} שורות, {columns.length} עמודות
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 right-0 z-30 bg-stone-200 px-2 py-2 text-[11px] font-normal text-stone-500 border-l border-b border-stone-300">
                <span aria-hidden="true">#</span>
                <span className="sr-only">שורה</span>
              </th>
              {columns.map((c, i) => (
                <th
                  key={i}
                  scope="col"
                  className="sticky top-0 z-20 bg-stone-100 px-3 py-2 text-right text-xs font-semibold text-stone-700 whitespace-nowrap border-l border-b border-stone-300 last:border-l-0"
                >
                  {/* A column the sheet never named still has to be announced as something,
                      and the letter is the name Excel itself gives it. */}
                  {c || <span className="sr-only">{`עמודה ${columnLetter(i)}`}</span>}
                  {c ? null : " "}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(({ cells, index }, i) => {
              // The stripe is a variable rather than an `even:` class because the pinned
              // column needs the SAME colour, and it needs it opaque: `bg-inherit` on a
              // sticky cell inside a transparent row inherits nothing, and the scrolled
              // columns were showing through the row numbers.
              const stripe = i % 2 === 1 ? "bg-stone-50" : "bg-white";
              return (
              <tr key={index} className={stripe}>
                <th scope="row" className={`sticky right-0 z-10 ${stripe} px-2 py-1.5 text-[11px] font-normal text-stone-500 border-l border-b border-stone-200 text-center`}>
                  {index + 1}
                </th>
                {columns.map((_, c) => {
                  const value = cells[c] || "";
                  const isEditing = editing && editing.r === index && editing.c === c;
                  return (
                    <td
                      key={c}
                      className="px-0 py-0 border-l border-b border-stone-200 last:border-l-0 align-top"
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          // Selected on open, the way a spreadsheet behaves: the cell is
                          // being replaced far more often than appended to, and typing
                          // into an unselected cell quietly produces "18:3019:00".
                          onFocus={(e) => e.target.select()}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commit();
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="w-full min-w-[7rem] px-3 py-1.5 text-sm bg-amber-50 outline-none ring-2 ring-brand-500 rounded"
                        />
                      ) : !canEdit ? (
                        <div className="px-3 py-1.5 whitespace-nowrap text-stone-700">{value || " "}</div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => open(index, c, value)}
                          // An empty cell used to render a button whose entire accessible
                          // name was a non-breaking space — a control with no name, and
                          // there can be tens of thousands of them in one sheet. The label
                          // says which cell it is, which is what a person would want anyway.
                          aria-label={`${columns[c] || columnLetter(c)}, שורה ${index + 1}${value ? ": " + value : " — ריק"}`}
                          className={`w-full text-right px-3 py-1.5 whitespace-nowrap text-stone-700 hover:bg-brand-50 cursor-text`}
                        >
                          {value || " "}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-stone-600 bg-stone-100 rounded-lg px-3 py-2">
          אין שורה שמתאימה ל"{query}".
        </p>
      )}
    </div>
  );
}

// ---------- the screen ----------

export function SheetsView({ sheets, saveSheet, removeSheet, sheetsReady, sheetsFailed, canEdit, author }) {
  const [openId, setOpenId] = useState(null);
  const [importing, setImporting] = useState(null); // null | { replacing }
  const [msg, setMsg] = useState(null);

  const sorted = useMemo(
    () => (sheets || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "he")),
    [sheets]
  );
  const openSheet = sorted.find((s) => s.id === openId) || null;

  const save = (sheet) => {
    saveSheet(sheet);
    setImporting(null);
    setOpenId(sheet.id);
    setMsg({ type: "success", text: `"${sheet.name}" נשמר — ${sheet.rows.length} שורות.` });
  };

  const edited = (next) => {
    saveSheet({ ...next, updatedAt: new Date().toISOString(), updatedBy: author });
  };

  const remove = (sheet) => {
    if (!window.confirm(`למחוק את הגיליון "${sheet.name}"? ${sheet.rows.length} שורות יימחקו, ואי אפשר לבטל.`)) return;
    removeSheet(sheet.id);
    setOpenId(null);
    setMsg({ type: "success", text: `"${sheet.name}" נמחק.` });
  };

  if (!sheetsReady) {
    return <div className="text-sm text-stone-600" dir="rtl">טוען גיליונות…</div>;
  }

  return (
    <div className="space-y-4" dir="rtl">
      {msg && (
        <p
          className={`text-sm rounded-lg px-3 py-2 border ${
            msg.type === "error"
              ? "text-rose-700 bg-rose-50 border-rose-200"
              : "text-emerald-800 bg-emerald-50 border-emerald-200"
          }`}
          role="status"
        >
          {msg.text}
        </p>
      )}

      {openSheet ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setOpenId(null); setMsg(null); }}
              className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-800"
            >
              <IconArrowRight size={16} />
              כל הגיליונות
            </button>
            <h2 className="text-base font-bold text-stone-800 mr-2">{openSheet.name}</h2>
            <span className="text-xs text-stone-500">
              עודכן {when(openSheet.updatedAt)}{openSheet.updatedBy ? ` · ${openSheet.updatedBy}` : ""}
            </span>
            <div className="flex gap-2 mr-auto">
              <button
                onClick={() => downloadSheet(openSheet)}
                className="inline-flex items-center gap-1 text-sm border border-stone-300 bg-white rounded-lg px-3 py-1.5 hover:bg-stone-50"
              >
                <IconDownload size={15} />
                אקסל
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={() => setImporting({ replacing: openSheet })}
                    className="inline-flex items-center gap-1 text-sm border border-stone-300 bg-white rounded-lg px-3 py-1.5 hover:bg-stone-50"
                  >
                    <IconRefresh size={15} />
                    החלפה מקובץ
                  </button>
                  <button
                    onClick={() => remove(openSheet)}
                    className="inline-flex items-center gap-1 text-sm border border-rose-200 text-rose-700 bg-white rounded-lg px-3 py-1.5 hover:bg-rose-50"
                  >
                    <IconTrash size={15} />
                    מחיקה
                  </button>
                </>
              )}
            </div>
          </div>

          {importing ? (
            <Importer
              replacing={importing.replacing}
              author={author}
              onSave={save}
              onCancel={() => setImporting(null)}
            />
          ) : (
            <SheetTable sheet={openSheet} canEdit={canEdit} onChange={edited} />
          )}
        </>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-stone-300 p-4">
            <h2 className="text-base font-bold text-stone-800 mb-1">הגיליונות שלי</h2>
            {/* "כל דבר בצורת טבלה" stood here, and it was an invitation in the interface to
                upload exactly the thing the rule forbids. The instruction a person reads at
                the moment they act beats the rule in a document they read once. */}
            <p className="text-sm text-stone-600">
              טבלאות אקסל תפעוליות של המועדון — הברזלים, שיבוצי אולמות, רשימות עבודה — כדי שיהיו
              זמינות מהטלפון.
              {" "}
              <span className="font-medium">רק מנהלי המועדון רואים את המסך הזה,</span> והכלל נאכף בשרת ולא בהסתרת הטאב.
            </p>
            <p className="text-sm text-stone-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              <span className="font-semibold">מידע תפעולי בלבד.</span> אין להעלות לכאן רשימת שחקנים,
              ואין להעלות שם, טלפון או תאריך לידה של שחקן/ית — לרשימות השחקנים יש מסך משלהן, עם
              הרשאות ונוהל מחיקה משלהן.
            </p>
          </div>

          {importing ? (
            <Importer author={author} onSave={save} onCancel={() => setImporting(null)} />
          ) : (
            canEdit && (
              <button
                onClick={() => setImporting({ replacing: null })}
                className="inline-flex items-center gap-2 bg-brand-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-brand-700"
              >
                <IconUpload size={16} />
                העלאת גיליון
              </button>
            )
          )}

          {/* "Failed to load" and "you have none" must not look the same. They did once, and
              the reasonable next move on seeing the empty state is to upload again — over a
              sheet that is still there. */}
          {sheetsFailed && !importing && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800" role="alert">
              <span className="font-semibold">לא הצלחנו לטעון את הגיליונות.</span> זו תקלת רשת או
              הרשאה — <span className="font-semibold">לא סימן שהגיליונות נמחקו.</span> רענן את הדף
              לפני שתעלה משהו מחדש.
            </div>
          )}

          {sorted.length === 0 && !sheetsFailed && !importing && (
            <div className="bg-stone-100 rounded-xl p-6 text-center text-sm text-stone-600">
              <IconFileSpreadsheet size={28} className="mx-auto mb-2 text-stone-500" aria-hidden="true" />
              עדיין אין גיליונות. העלה קובץ אקסל והוא ייפתח כאן כטבלה.
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sorted.map((s) => (
              <button
                key={s.id}
                onClick={() => { setOpenId(s.id); setMsg(null); }}
                className="text-right bg-white rounded-xl border border-stone-300 p-4 hover:border-brand-300 hover:shadow-sm transition"
              >
                <span className="flex items-center gap-2 mb-1">
                  <IconFileSpreadsheet size={18} className="text-brand-600" />
                  <span className="font-semibold text-stone-800">{s.name}</span>
                </span>
                <span className="block text-xs text-stone-500">
                  {s.rows.length} שורות · {s.columns.length} עמודות
                </span>
                <span className="block text-xs text-stone-500 mt-0.5">עודכן {when(s.updatedAt)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
