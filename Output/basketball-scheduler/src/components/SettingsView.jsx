import { useState, useEffect, useRef } from "react";
import { DEFAULT_SETTINGS, BASE_SESSION_TYPES, COLORS } from "../constants";
import { customSessionTypes } from "../utils/sessionTypes";
import { uid } from "../utils/dates";
import { buildClubExport, csvSheets, exportFileName } from "../utils/exportClub";
import { clubSettings } from "../utils/club";
import { clubLogoSrc } from "../utils/clubLogo";
import { applyTheme, brandContrast } from "../utils/theme";
import { legalDetailsComplete, LEGAL_FIELD_LABELS } from "../legal/fillTemplate";
import { fileToLogoDataUrl, dataUrlBytes, LOGO_MAX_BYTES } from "../utils/imageResize";
import { generateJoinCode, formatJoinCode } from "../utils/joinCode";
import { describeSubscription, WARN_DAYS, GRACE_DAYS } from "../utils/subscription";
import { IconTrash, IconCheck } from "./ui/icons";
import { AccessCard } from "./AccessCard";

const KB = (bytes) => `${Math.round(bytes / 1024)} KB`;

// Firestore refuses a document over 1 MiB. Everything for a club lives in one
// document, so surface the headroom before a paying customer hits the wall.
const DOC_LIMIT_BYTES = 1024 * 1024;

function Card({ title, hint, children, badge }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between gap-2">
        <div className="text-stone-700 font-semibold text-sm">{title}</div>
        {badge}
      </div>
      <div className="p-4 space-y-3">
        {hint && <p className="text-xs text-stone-500">{hint}</p>}
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs text-stone-500 mb-1 block">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-stone-500 mt-1 block">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

// The renewal date, and nothing else. This card stays editable even while the
// subscription has lapsed and the rest of the app is read-only — otherwise renewing
// would require the Firebase console, and a lapsed club could never let itself back in.
// It saves on its own rather than through the page's draft, so the narrow "only the
// subscription changed" path in useClubData recognises it.
function SubscriptionCard({ data, save, subscription, isAdmin }) {
  const current = clubSettings(data).subscription || {};
  const [plan, setPlan] = useState(current.plan || "");
  const [validUntil, setValidUntil] = useState(current.validUntil || "");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setPlan(current.plan || "");
    setValidUntil(current.validUntil || "");
  }, [current.plan, current.validUntil]);

  const dirty = plan !== (current.plan || "") || validUntil !== (current.validUntil || "");

  const tone = {
    lapsed: "bg-red-50 border-red-200 text-red-800",
    grace: "bg-amber-50 border-amber-200 text-amber-900",
    expiring: "bg-amber-50 border-amber-200 text-amber-900",
  }[subscription?.state];

  return (
    <Card
      title="מנוי"
      hint="מועד החידוש נרשם כאן ומשמש להתראות בלבד. אין גבייה בתוך המערכת — התשלום מול חשבונית."
      badge={
        subscription?.state === "lapsed" ? (
          <span className="text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">פג</span>
        ) : subscription?.state === "unmanaged" ? (
          <span className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">לא מוגדר</span>
        ) : null
      }
    >
      {tone && (
        <p className={`text-xs border rounded-lg p-2.5 ${tone}`}>{describeSubscription(subscription)}</p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="תוכנית" hint="שם חופשי, לתיעוד מול החשבונית.">
          <input className={inputCls} value={plan} disabled={!isAdmin} onChange={(e) => setPlan(e.target.value)} />
        </Field>
        <Field label="בתוקף עד" hint={`התראה מתחילה ${WARN_DAYS} ימים לפני. אחרי המועד יש ${GRACE_DAYS} ימי חסד לפני מעבר לצפייה בלבד.`}>
          <input
            type="date"
            dir="ltr"
            className={inputCls}
            value={validUntil}
            disabled={!isAdmin}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </Field>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            disabled={!dirty}
            onClick={() => {
              save({
                ...data,
                settings: { ...clubSettings(data), subscription: { plan, validUntil } },
              });
              setMsg("המנוי עודכן.");
            }}
            className="px-3 py-2 text-sm rounded-lg bg-brand-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            שמור מנוי
          </button>
          {validUntil && (
            <button
              onClick={() => setValidUntil("")}
              className="px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            >
              נקה תאריך
            </button>
          )}
          {msg && <span className="text-xs text-emerald-700 flex items-center gap-1"><IconCheck size={13} /> {msg}</span>}
        </div>
      )}
    </Card>
  );
}

// Taking the club's data out, in both formats it might be wanted in: JSON, which is the
// faithful copy, and CSV, which is the one that opens.
function ExportCard({ data, clubId, gameNotes, videos }) {
  const [msg, setMsg] = useState("");

  const download = (content, filename, mime) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked on the next tick rather than immediately: Safari has not always finished
    // reading the blob by the time click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const at = new Date().toISOString();

  const exportJson = () => {
    download(
      JSON.stringify(buildClubExport(data, { clubId, exportedAt: at, gameNotes, videos }), null, 2),
      exportFileName(clubId, at, "json"),
      "application/json"
    );
    setMsg("הקובץ הורד.");
  };

  const exportCsv = () => {
    const sheets = csvSheets(data, gameNotes, videos);
    Object.entries(sheets).forEach(([name, csv]) =>
      download(csv, exportFileName(`${clubId}-${name}`, at, "csv"), "text/csv;charset=utf-8")
    );
    setMsg(`${Object.keys(sheets).length} קבצים הורדו.`);
  };

  return (
    <Card
      title="ייצוא הנתונים"
      hint="כל נתוני המועדון, בכל רגע, בלי לפנות אלינו. הנתונים שלכם — גם אם תחליטו לעזוב."
    >
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={exportJson} className="px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50">
          ייצוא מלא (JSON)
        </button>
        <button onClick={exportCsv} className="px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50">
          ייצוא לאקסל (CSV)
        </button>
        {msg && <span className="text-xs text-emerald-700 flex items-center gap-1"><IconCheck size={13} /> {msg}</span>}
      </div>
      <p className="text-xs text-stone-500 leading-relaxed">
        <strong>JSON</strong> הוא העותק המלא והמדויק, כולל הגדרות והרשאות.{" "}
        <strong>CSV</strong> מייצר קובץ לכל סוג נתונים (קבוצות, מאמנים, אולמות, שחקנים, אימונים,
        משחקים) שנפתח באקסל. הלו״ז שפורסם להורים אינו נכלל — הוא נגזר מהנתונים האלה ונוצר מחדש
        בפרסום.
      </p>
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
        ⚠ הקובץ מכיל פרטים אישיים של שחקנים, וחלקם קטינים. שמרו אותו במקום מוגן ואל תעבירו אותו
        בדוא״ל או בוואטסאפ.
      </p>
    </Card>
  );
}

// Club settings: everything that used to be hardcoded to one club. Admin-only.
// Per-team join codes for the parent portal, plus the link to hand out.
function PortalCard({ data, save, syncJoinCode, clubId, canEdit }) {
  const [msg, setMsg] = useState("");
  const teams = data.teams || [];
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const portalUrl = `${origin}/c/${clubId}/portal`;

  const setCode = async (team) => {
    const newCode = generateJoinCode();
    const oldCode = team.joinCode || "";
    save({
      ...data,
      teams: teams.map((t) => (t.id === team.id ? { ...t, joinCode: newCode } : t)),
    });
    await syncJoinCode({ oldCode, newCode, teamId: team.id, teamName: team.name });
    // Precisely worded on purpose. Replacing a code stops it being used to join, but it
    // does NOT sign out a parent who already joined — their access lives on their own
    // portalUsers document, which this does not touch. A manager rotating a leaked code
    // would otherwise believe they had revoked access, and would not.
    setMsg(
      oldCode
        ? `הקוד של "${team.name}" הוחלף. הקוד הישן לא יאפשר עוד הצטרפות — אבל הורים שכבר הצטרפו ממשיכים לראות את הלו״ז.`
        : `נוצר קוד עבור "${team.name}".`
    );
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`${label} הועתק.`);
    } catch {
      setMsg("ההעתקה נכשלה — סמן והעתק ידנית.");
    }
  };

  return (
    <Card
      title="פורטל הורים"
      hint="כל קבוצה מקבלת קוד. הורה נכנס לקישור, מזין את הקוד של הקבוצה, ורואה את לו״ז האימונים והמשחקים שלה בלבד."
    >
      <div className="flex items-center gap-2 flex-wrap">
        <code dir="ltr" className="text-xs bg-stone-100 border border-stone-200 rounded px-2 py-1.5 flex-1 min-w-0 truncate">{portalUrl}</code>
        <button onClick={() => copy(portalUrl, "הקישור")} className="px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700">
          העתק קישור
        </button>
      </div>

      <p className="text-xs text-stone-500">
        הפורטל מציג <strong>רק</strong> את הלו״ז שפורסם — לא שמות שחקנים, לא טלפונים ולא תאריכי לידה.
        הלו״ז מתפרסם בלחיצה על "פרסם לו״ז לשבוע" בלוח השבועי.
      </p>

      {teams.length === 0 ? (
        <p className="text-sm text-stone-500 py-2">אין עדיין קבוצות. הוסף קבוצות כדי לייצר קודים.</p>
      ) : (
        <ul className="divide-y divide-stone-100 border border-stone-200 rounded-lg">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 flex-wrap">
              <span className="text-sm text-stone-800">{t.name}</span>
              <div className="flex items-center gap-2">
                {t.joinCode ? (
                  <>
                    <code dir="ltr" className="text-sm font-mono tracking-widest bg-brand-50 text-brand-700 border border-brand-200 rounded px-2 py-1">
                      {formatJoinCode(t.joinCode)}
                    </code>
                    <button onClick={() => copy(t.joinCode, "הקוד")} className="text-xs text-stone-600 underline underline-offset-2">העתק</button>
                    {/* Issuing a code writes to the club document, so it follows canEdit.
                        Copying an existing one does not, and stays available. */}
                    <button
                      onClick={() => setCode(t)}
                      disabled={!canEdit}
                      className="text-xs text-stone-600 underline underline-offset-2 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      החלף
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setCode(t)}
                    disabled={!canEdit}
                    className="px-3 py-1.5 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    צור קוד
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="text-xs text-stone-600">{msg}</p>}
    </Card>
  );
}

export function SettingsView({ data, save, canEdit, syncJoinCode, clubId, subscription, isAdmin, currentEmail, gameNotes, videos }) {
  const saved = clubSettings(data);
  const [draft, setDraft] = useState(saved);
  const [logoMsg, setLogoMsg] = useState("");
  const [savedMsg, setSavedMsg] = useState(false);
  const fileRef = useRef(null);

  // Re-sync when another admin's change arrives over onSnapshot, but never clobber
  // an edit in progress.
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!dirtyRef.current) setDraft(saved);
  }, [saved]);

  // Live preview: paint the draft colors as they change, and put the saved ones back
  // if the admin leaves without saving.
  useEffect(() => {
    applyTheme(draft);
  }, [draft.primaryColor, draft.accentColor]);
  useEffect(() => {
    return () => applyTheme(clubSettings(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setLegal = (patch) => setDraft((d) => ({ ...d, legal: { ...d.legal, ...patch } }));

  const onSave = () => {
    save({ ...data, settings: draft });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  const onCancel = () => {
    setDraft(saved);
    applyTheme(saved);
    setLogoMsg("");
  };

  async function onLogoPick(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setLogoMsg("מעבד...");
    try {
      const res = await fileToLogoDataUrl(file);
      set({ logoUrl: res.dataUrl });
      setLogoMsg(
        res.bytes > LOGO_MAX_BYTES
          ? `הלוגו נשמר אך גדול יחסית (${KB(res.bytes)}). מומלץ קובץ פשוט יותר.`
          : `הלוגו עודכן (${res.width}×${res.height}, ${KB(res.bytes)}). לחץ "שמור" כדי להחיל.`
      );
    } catch (err) {
      setLogoMsg(
        err.message === "not-an-image"
          ? "יש לבחור קובץ תמונה (PNG או JPG)."
          : "לא הצלחתי לקרוא את התמונה. נסה קובץ אחר."
      );
    }
  }

  const legalOk = legalDetailsComplete(draft.legal);
  const docBytes = new Blob([JSON.stringify(data)]).size;
  const docPct = Math.min(100, Math.round((docBytes / DOC_LIMIT_BYTES) * 100));
  const keywordsText = (draft.homeKeywords || []).join("\n");

  // Custom session types, read through the same normaliser the rest of the app uses so
  // a hand-edited club document shows here exactly as it behaves everywhere else.
  const contrast = brandContrast(draft.primaryColor || DEFAULT_SETTINGS.primaryColor);
  const customTypes = customSessionTypes({ settings: draft });
  const writeCustomTypes = (list) => set({ sessionTypes: list });
  const setCustomType = (i, patch) =>
    writeCustomTypes(customTypes.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const removeCustomType = (i) => writeCustomTypes(customTypes.filter((_, j) => j !== i));
  const addCustomType = () => {
    // The id is what a session stores, so it is fixed at creation and never follows a
    // later rename — renaming a type must not orphan every session already using it.
    const id = uid();
    writeCustomTypes([
      ...customTypes,
      { id, name: "סוג חדש", color: COLORS[customTypes.length % COLORS.length] },
    ]);
  };

  // isAdmin, not canEdit. A lapsed subscription makes canEdit false, and turning this
  // screen away on that basis took away the only way back in: the renewal date lives on
  // this page, so a club whose subscription expired could not renew without the Firebase
  // console. Editing is withheld below — the screen itself is not.
  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-600 text-sm">
        רק מנהל יכול לצפות בהגדרות המועדון ולערוך אותן.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!canEdit && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5 leading-relaxed">
          <strong>המנוי פג, ולכן ההגדרות נעולות לעריכה.</strong> כרטיס המנוי בהמשך הדף נשאר פתוח —
          עדכון מועד החידוש שם יחזיר את העריכה בכל המערכת. שום נתון לא נמחק בינתיים.
        </p>
      )}

      {/* Everything a lapsed club may not change. The subscription card below stays
          outside, because it is the way out of exactly this state. */}
      <fieldset disabled={!canEdit} className="space-y-4 min-w-0 disabled:opacity-60">
      <Card
        title="זהות המועדון"
        hint="השם, הלוגו והצבעים שמופיעים בכל המסכים, בהדפסות ובתמונות שנשלחות בוואטסאפ."
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="שם המועדון" hint="מופיע בכותרת הדפדפן, בדוחות ובתמונות המשותפות.">
            <input className={inputCls} value={draft.name || ""} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="שם קצר" hint="לשימוש במקומות צרים. אם ריק — ישתמש בשם המלא.">
            <input className={inputCls} value={draft.shortName || ""} onChange={(e) => set({ shortName: e.target.value })} />
          </Field>
        </div>

        <div>
          <span className="text-xs text-stone-500 mb-1 block">לוגו</span>
          <div className="flex items-center gap-3 flex-wrap">
            {clubLogoSrc({ settings: draft }) ? (
              <img
                src={clubLogoSrc({ settings: draft })}
                alt=""
                className="w-16 h-16 object-contain border border-stone-200 rounded-lg bg-white p-1"
              />
            ) : (
              // Not an <img> with an empty src — that renders a broken-image icon.
              <div className="w-16 h-16 flex items-center justify-center border border-dashed border-stone-300 rounded-lg bg-stone-50 text-[10px] text-stone-400 text-center leading-tight px-1">
                אין לוגו
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onLogoPick} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700"
            >
              העלה לוגו
            </button>
            {draft.logoUrl && (
              <button
                onClick={() => { set({ logoUrl: "" }); setLogoMsg("חזרה ללוגו ברירת המחדל."); }}
                className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-600"
              >
                <IconTrash size={13} /> הסר
              </button>
            )}
          </div>
          {logoMsg && <p className="text-xs text-stone-600 mt-2">{logoMsg}</p>}
          <p className="text-[11px] text-stone-500 mt-1">
            התמונה מוקטנת אוטומטית ונשמרת בתוך נתוני המועדון, כך שהיא מופיעה גם בתמונות המיוצאות.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="צבע ראשי" hint="כפתורים, טאבים וכותרות — משתנה מיד לתצוגה מקדימה.">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.primaryColor || DEFAULT_SETTINGS.primaryColor}
                onChange={(e) => set({ primaryColor: e.target.value })}
                className="h-9 w-14 rounded border border-stone-300 bg-white p-1 cursor-pointer"
                aria-label="בחירת צבע ראשי"
              />
              <input
                className={inputCls}
                dir="ltr"
                value={draft.primaryColor || ""}
                onChange={(e) => set({ primaryColor: e.target.value })}
              />
            </div>
            {/* Measured, not guessed. This colour is the background of every primary
                button under white text, and the club's own accessibility statement
                promises a contrast ratio — so a light choice makes the club publish a
                claim about itself that is not true. */}
            {contrast && !contrast.passesLargeText && (
              <p className="text-xs text-red-800 bg-red-50 border border-red-300 rounded-lg p-2 mt-2 leading-relaxed">
                <strong>⚠ הצבע בהיר מדי לכפתורים.</strong> יחס הניגודיות מול טקסט לבן הוא{" "}
                <strong>{contrast.ratio.toFixed(1)}:1</strong>, והתקן דורש לפחות 3:1 לטקסט גדול.
                טקסט לבן על הצבע הזה יהיה קשה לקריאה, ו<strong>הצהרת הנגישות של המועדון שלכם
                מבטיחה אחרת</strong>. בחרו גוון כהה יותר.
              </p>
            )}
            {contrast && contrast.passesLargeText && !contrast.passesBodyText && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2 leading-relaxed">
                יחס הניגודיות הוא <strong>{contrast.ratio.toFixed(1)}:1</strong> — מספיק לכפתורים
                ולכותרות (3:1), אך מתחת ל-4.5:1 הנדרש לטקסט רגיל. תקין, אך גוון כהה יותר יהיה נוח יותר.
              </p>
            )}
          </Field>
          <Field label="צבע משני (אקסנט)" hint="נגיעת צבע בלבד — לא לכפתורים.">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={draft.accentColor || DEFAULT_SETTINGS.accentColor}
                onChange={(e) => set({ accentColor: e.target.value })}
                className="h-9 w-14 rounded border border-stone-300 bg-white p-1 cursor-pointer"
                aria-label="בחירת צבע משני"
              />
              <input
                className={inputCls}
                dir="ltr"
                value={draft.accentColor || ""}
                onChange={(e) => set({ accentColor: e.target.value })}
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card
        title="משחקים והסעות"
        hint="שדות שמשפיעים על ייבוא קובץ המשחקים מהאיגוד ועל ייצוא ההסעות."
      >
        <Field
          label="שמות המועדון בקובץ האיגוד — שורה לכל וריאציה"
          hint='כך המערכת יודעת אילו משחקים הם משחקי בית. חשוב: אם הרשימה לא מתאימה — כל המשחקים ייחשבו כמשחקי חוץ.'
        >
          <textarea
            rows={4}
            dir="rtl"
            className={`${inputCls} resize-y`}
            value={keywordsText}
            onChange={(e) =>
              set({ homeKeywords: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
            }
            placeholder={"שם המועדון\nקיצור נפוץ\nכתיב חלופי"}
          />
        </Field>
        {(draft.homeKeywords || []).length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            ⚠ הרשימה ריקה — <strong>ייבוא קובץ האיגוד ייחסם</strong> עד שתמלא אותה. בלי הווריאציות
            הנכונות כל משחק היה מסומן כמשחק חוץ, ואיתו נשברים שיבוץ האולמות וייצוא ההסעות.
          </p>
        )}
        <Field label="נקודת איסוף להסעות" hint="מופיעה בקובץ ההסעות שנשלח לחברת ההסעות.">
          <input className={inputCls} value={draft.pickupPoint || ""} onChange={(e) => set({ pickupPoint: e.target.value })} />
        </Field>
      </Card>

      <Card
        title="סוגי אימון"
        hint="שלושת הסוגים הראשונים קבועים ומשותפים לכל המועדונים — סנכרון המשחקים מסתמך עליהם. מתחתם אפשר להוסיף סוגים משלכם."
      >
        <ul className="flex flex-wrap gap-2">
          {BASE_SESSION_TYPES.map((t) => (
            <li key={t.id} className="flex items-center gap-1.5 text-xs text-stone-600 bg-stone-100 rounded-lg px-2.5 py-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
              {t.name}
              <span className="text-[10px] text-stone-400">קבוע</span>
            </li>
          ))}
        </ul>

        {customTypes.length > 0 && (
          <ul className="divide-y divide-stone-100 border border-stone-200 rounded-lg">
            {customTypes.map((t, i) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                <input
                  type="color"
                  aria-label={`צבע עבור ${t.name}`}
                  value={t.color}
                  disabled={!canEdit}
                  onChange={(e) => setCustomType(i, { color: e.target.value })}
                  className="w-8 h-8 rounded border border-stone-300 bg-white p-0.5 shrink-0"
                />
                <input
                  className={inputCls}
                  aria-label="שם הסוג"
                  value={t.name}
                  disabled={!canEdit}
                  onChange={(e) => setCustomType(i, { name: e.target.value })}
                />
                <label className="flex items-center gap-1.5 text-xs text-stone-600 shrink-0 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={t.excludeFromReport}
                    disabled={!canEdit}
                    onChange={(e) => setCustomType(i, { excludeFromReport: e.target.checked })}
                    className="rounded border-stone-300"
                  />
                  לא נספר בדו״ח שעות
                </label>
                {canEdit && (
                  <button
                    onClick={() => removeCustomType(i)}
                    aria-label={`מחק את ${t.name}`}
                    className="p-2 text-stone-400 hover:text-red-600 shrink-0"
                  >
                    <IconTrash size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <button
            onClick={addCustomType}
            className="px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
          >
            הוסף סוג
          </button>
        )}

        <p className="text-xs text-stone-500">
          מחיקת סוג לא משנה אימונים שכבר סומנו בו — הם ימשיכו להציג את השם, ובטופס האימון הוא יופיע
          כ״(סוג שהוסר)״ עד שתבחרו אחר.
        </p>
      </Card>

      {/* Inside the locked fieldset on purpose. Adding a coach is an edit, and a club
          whose subscription lapsed does not get to change who reaches its data. The
          renewal and export cards sit outside it; this one does not belong with them. */}
      <AccessCard data={data} save={save} currentEmail={currentEmail} />
      <Card
        title="פרטים משפטיים"
        hint="מוצגים בתוך מדיניות הפרטיות, תנאי השימוש והצהרת הנגישות של המועדון."
        badge={
          legalOk ? (
            <span className="text-xs text-emerald-700 flex items-center gap-1"><IconCheck size={13} /> הושלם</span>
          ) : (
            <span className="text-xs text-amber-700">חסרים פרטים</span>
          )
        }
      >
        {!legalOk && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            ⚠ שדה שנשאר ריק יופיע במסמכים כ״⟨... — למילוי⟩״. זה מכוון: מסמך משפטי לא יציג פרטים של גוף אחר.
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={LEGAL_FIELD_LABELS.operator} hint="הגוף המשפטי שמפעיל את השירות (עמותה / חברה).">
            <input className={inputCls} value={draft.legal?.operator || ""} onChange={(e) => setLegal({ operator: e.target.value })} />
          </Field>
          <Field
            label="צורת התאגדות (אופציונלי)"
            hint='מופיע בסוגריים אחרי שם הגוף במסמכים — למשל "עמותה" או "בע״מ". השאירו ריק אם אינכם בטוחים; שגוי גרוע מחסר.'
          >
            <input className={inputCls} value={draft.legal?.entityType || ""} onChange={(e) => setLegal({ entityType: e.target.value })} />
          </Field>
          <Field label={LEGAL_FIELD_LABELS.address}>
            <input className={inputCls} value={draft.legal?.address || ""} onChange={(e) => setLegal({ address: e.target.value })} />
          </Field>
          <Field label={LEGAL_FIELD_LABELS.email} hint="לפניות בענייני פרטיות ונגישות.">
            <input className={inputCls} dir="ltr" value={draft.legal?.email || ""} onChange={(e) => setLegal({ email: e.target.value })} />
          </Field>
          <Field label={LEGAL_FIELD_LABELS.a11yContact}>
            <input className={inputCls} value={draft.legal?.a11yContact || ""} onChange={(e) => setLegal({ a11yContact: e.target.value })} />
          </Field>
          <Field label={LEGAL_FIELD_LABELS.a11yPhone}>
            <input className={inputCls} dir="ltr" value={draft.legal?.a11yPhone || ""} onChange={(e) => setLegal({ a11yPhone: e.target.value })} />
          </Field>
        </div>
      </Card>
      </fieldset>

      <PortalCard data={data} save={save} syncJoinCode={syncJoinCode} clubId={clubId} canEdit={canEdit} />

      <SubscriptionCard data={data} save={save} subscription={subscription} isAdmin={isAdmin} />

      {/* Outside the locked fieldset, and deliberately so: a club whose subscription
          lapsed must still be able to take its own data with it. Withholding the export
          from a club in a billing dispute turns a payment reminder into leverage over
          their records — including minors' — which is the opposite of what a data
          return obligation is for. */}
      <ExportCard data={data} clubId={clubId} gameNotes={gameNotes} videos={videos} />

      <Card title="מידע טכני" hint="כל נתוני המועדון נשמרים במסמך אחד, שמוגבל ל-1 MB.">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden" role="img" aria-label={`נפח בשימוש: ${docPct} אחוז`}>
            <div
              className={`h-full ${docPct > 80 ? "bg-red-500" : docPct > 50 ? "bg-amber-500" : "bg-brand-600"}`}
              style={{ width: `${Math.max(1, docPct)}%` }}
            />
          </div>
          <span className="text-xs text-stone-600 shrink-0">{KB(docBytes)} מתוך 1 MB ({docPct}%)</span>
        </div>
        {docPct > 80 && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
            ⚠ המסמך מתקרב למגבלה. יש לארכב עונות קודמות לפני שהשמירה תיכשל.
          </p>
        )}
      </Card>

      <div className="flex items-center gap-2 flex-wrap sticky bottom-0 bg-stone-50/95 py-3">
        <button
          onClick={onSave}
          disabled={!dirty || !canEdit}
          className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40 disabled:hover:bg-brand-600"
        >
          שמור הגדרות
        </button>
        <button
          onClick={onCancel}
          disabled={!dirty}
          className="px-4 py-2 text-sm rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 disabled:opacity-40"
        >
          בטל שינויים
        </button>
        {savedMsg && <span className="text-xs text-emerald-700 flex items-center gap-1"><IconCheck size={13} /> ההגדרות נשמרו</span>}
        {dirty && !savedMsg && <span className="text-xs text-amber-700">יש שינויים שלא נשמרו</span>}
      </div>
    </div>
  );
}
