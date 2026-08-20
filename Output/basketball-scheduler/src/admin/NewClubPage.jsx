// Creating a club, for the operator of the service.
//
// Replaces a hand-built Firebase console document that failed five times in a row.
// Every one of those failures came from typing structure by hand, so this screen types
// none: the shape comes from buildNewClubDoc, and the form only collects values.

import { useState } from "react";
import { doc, runTransaction } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db, isFirebaseConfigured } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { useSuperAdmin } from "../hooks/useSuperAdmin";
import { toClubSlug, clubPath } from "../utils/clubId";
import { validateNewClub, buildNewClubDoc } from "../utils/newClub";
import { IconCheck, IconAlert } from "../components/ui/icons";

const inputCls =
  "w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-stone-50 px-4 py-8" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-4">{children}</div>
    </div>
  );
}

function Notice({ title, children }) {
  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-2">
        <h1 className="text-lg font-bold text-stone-900">{title}</h1>
        <div className="text-sm text-stone-600 leading-relaxed">{children}</div>
      </div>
    </Shell>
  );
}

export default function NewClubPage() {
  const navigate = useNavigate();
  const { user, authLoading, authError, signIn } = useAuth();
  const { checking, isSuperAdmin, error: adminError } = useSuperAdmin(user);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminsText, setAdminsText] = useState("");
  const [membersText, setMembersText] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [addSelf, setAddSelf] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [created, setCreated] = useState(null);

  // The slug follows the name until the operator edits it, and is theirs from then on.
  const onName = (value) => {
    setName(value);
    if (!slugTouched) setSlug(toClubSlug(value));
  };

  const result = validateNewClub({ slug, name, adminsText, membersText, keywordsText });

  const submit = async () => {
    setFailure("");
    if (!result.ok) return;
    setBusy(true);
    try {
      const payload = buildNewClubDoc({
        name,
        admins: result.admins,
        members: result.members,
        homeKeywords: result.homeKeywords,
        creatorEmail: addSelf ? user?.email : "",
      });
      // A transaction, not setDoc: the rules allow an UPDATE by a club's own admin, so
      // an operator who is also an admin of an existing club could overwrite it — every
      // team, session and player replaced by an empty document. Refusing an id that is
      // already taken has to be atomic, not a check followed by a write.
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "clubs", slug);
        const snap = await tx.get(ref);
        if (snap.exists()) throw new Error("club-exists");
        tx.set(ref, payload);
      });
      setCreated({ slug, admins: payload.admins, members: payload.members });
    } catch (e) {
      if (e && e.message === "club-exists") {
        setFailure(`המזהה "${slug}" כבר תפוס. בחר מזהה אחר — המועדון הקיים לא נגע.`);
      } else if (e && (e.code === "permission-denied" || e.code === "firestore/permission-denied")) {
        setFailure("היצירה נדחתה על ידי כללי האבטחה. ודא שהחשבון עדיין מופיע ב-config/global.superAdmins.");
      } else {
        setFailure("היצירה נכשלה. בדוק את החיבור ונסה שוב — לא נוצר מועדון חלקי.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!isFirebaseConfigured)
    return (
      <Notice title="לא זמין במצב מקומי">
        הקמת מועדון כותבת ל-Firestore. במצב מקומי אין מסד נתונים משותף — הפעל את האפליקציה מול
        פרויקט Firebase.
      </Notice>
    );

  if (authLoading) return <Notice title="טוען…">רגע.</Notice>;

  if (!user)
    return (
      <Notice title="הקמת מועדון">
        <p className="mb-4">התחבר עם החשבון שמוגדר כמפעיל השירות.</p>
        <button onClick={signIn} className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white font-medium">
          התחברות עם Google
        </button>
        {authError && <p className="text-xs text-red-700 mt-2">{authError}</p>}
      </Notice>
    );

  if (checking) return <Notice title="בודק הרשאה…">רגע.</Notice>;

  if (adminError) return <Notice title="בעיה בהגדרת המפעילים">{adminError}</Notice>;

  if (!isSuperAdmin)
    return (
      <Notice title="אין הרשאה">
        המסך הזה מיועד למפעיל השירות. אם אתם מנהלים של מועדון קיים — היכנסו לכתובת של המועדון שלכם.
      </Notice>
    );

  if (created)
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-stone-200 p-8 space-y-4">
          <h1 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <IconCheck size={18} className="text-emerald-600" /> המועדון נוצר
          </h1>
          <p className="text-sm text-stone-600">הכתובת של המועדון:</p>
          <code dir="ltr" className="block text-sm bg-stone-100 border border-stone-200 rounded-lg px-3 py-2 break-all">
            {window.location.origin}
            {clubPath(created.slug)}
          </code>
          <div className="text-sm text-stone-600 space-y-1">
            <p><strong>מנהלים:</strong> {created.admins.join(", ")}</p>
            <p><strong>צופים:</strong> {created.members.length ? created.members.join(", ") : "—"}</p>
          </div>
          <div className="text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-3 leading-relaxed">
            נשאר להשלים בתוך המועדון, בטאב <strong>הגדרות</strong>: לוגו וצבעים, הפרטים המשפטיים
            (עד שימולאו, המסמכים מציגים ⟨… — למילוי⟩), ונקודת האיסוף להסעות. אם לא הוזנו שמות
            המועדון כפי שהם בקובץ האיגוד — ייבוא המשחקים ייחסם עד שיוזנו, בכוונה.
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate(clubPath(created.slug))}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white font-medium"
            >
              פתח את המועדון
            </button>
            <button
              onClick={() => {
                setCreated(null);
                setName("");
                setSlug("");
                setSlugTouched(false);
                setAdminsText("");
                setMembersText("");
                setKeywordsText("");
              }}
              className="px-4 py-2 text-sm rounded-lg border border-stone-300 bg-white text-stone-700"
            >
              הקמת מועדון נוסף
            </button>
          </div>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200">
          <h1 className="text-base font-semibold text-stone-800">הקמת מועדון חדש</h1>
          <p className="text-xs text-stone-500 mt-0.5">מחובר כ־{user.email}</p>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs text-stone-500 mb-1 block">שם המועדון</span>
            <input className={inputCls} value={name} onChange={(e) => onName(e.target.value)} placeholder="לדוגמה: הפועל חולון" />
            {result.errors.name && <span className="text-xs text-red-700 mt-1 block">{result.errors.name}</span>}
          </label>

          <label className="block">
            <span className="text-xs text-stone-500 mb-1 block">מזהה (הכתובת של המועדון)</span>
            <input
              className={inputCls}
              dir="ltr"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(toClubSlug(e.target.value));
              }}
              placeholder="hapoel-holon"
            />
            <span className="text-[11px] text-stone-500 mt-1 block">
              הכתובת תהיה <span dir="ltr" className="font-mono">/c/{slug || "…"}</span>. לא ניתן לשנות אותה אחר כך.
            </span>
            {result.errors.slug && <span className="text-xs text-red-700 mt-1 block">{result.errors.slug}</span>}
          </label>

          <label className="block">
            <span className="text-xs text-stone-500 mb-1 block">מנהלים — כתובת בכל שורה</span>
            <textarea rows={3} dir="ltr" className={`${inputCls} resize-y`} value={adminsText} onChange={(e) => setAdminsText(e.target.value)} placeholder="manager@example.com" />
            <span className="text-[11px] text-stone-500 mt-1 block">רשאים לקרוא ולערוך הכול. הכתובות נשמרות באותיות קטנות.</span>
            {result.errors.admins && <span className="text-xs text-red-700 mt-1 block">{result.errors.admins}</span>}
          </label>

          <label className="flex items-start gap-2 text-xs text-stone-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <input type="checkbox" checked={addSelf} onChange={(e) => setAddSelf(e.target.checked)} className="mt-0.5 rounded border-stone-300" />
            <span className="leading-relaxed">
              הוסיפו גם אותי ({user.email}) כמנהל — <strong>מומלץ</strong>. שגיאת כתיב בכתובת של המנהל
              יוצרת מועדון שאף אחד לא יכול לפתוח, וגם לא לתקן: עריכת מועדון קיים דורשת להיות מנהל
              <em> שלו</em>. אפשר להסיר את עצמכם מההגדרות אחרי שהמנהל נכנס בהצלחה.
            </span>
          </label>

          <label className="block">
            <span className="text-xs text-stone-500 mb-1 block">צופים (אופציונלי) — מאמנים</span>
            <textarea rows={2} dir="ltr" className={`${inputCls} resize-y`} value={membersText} onChange={(e) => setMembersText(e.target.value)} placeholder="coach@example.com" />
            <span className="text-[11px] text-stone-500 mt-1 block">קריאה בלבד. אפשר להשלים גם אחר כך מההגדרות.</span>
            {result.errors.members && <span className="text-xs text-red-700 mt-1 block">{result.errors.members}</span>}
          </label>

          <label className="block">
            <span className="text-xs text-stone-500 mb-1 block">שמות המועדון בקובץ האיגוד (אופציונלי) — שורה לכל וריאציה</span>
            <textarea rows={3} dir="rtl" className={`${inputCls} resize-y`} value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder={"הפועל חולון\nה. חולון"} />
            <span className="text-[11px] text-stone-500 mt-1 block">
              כך המערכת מזהה משחקי בית. אם יישאר ריק — ייבוא המשחקים ייחסם עד שימולא בהגדרות, כדי
              שלא ייסמנו כל המשחקים כמשחקי חוץ.
            </span>
          </label>

          {failure && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <IconAlert size={15} className="mt-0.5 shrink-0" /> <span>{failure}</span>
            </p>
          )}

          <button
            onClick={submit}
            disabled={busy || !result.ok}
            className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "יוצר…" : "צור מועדון"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
