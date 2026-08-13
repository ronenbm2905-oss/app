import { useState, useEffect, useCallback, useMemo } from "react";
import { isFirebaseConfigured, db } from "../firebase.js";
import {
  COL_MODELS,
  COL_DIAMONDS,
  COL_LEADS,
  COL_SETTINGS,
  SETTINGS_PUBLIC_ID,
  SETTINGS_PRIVATE_ID,
} from "../constants.js";
import { loadLocal, saveLocal, resetLocal } from "../utils/store.js";
import { EMPTY_DATA } from "../utils/seed.js";
import { DEFAULT_SETTINGS_PUBLIC, DEFAULT_SETTINGS_PRIVATE, POLICY_VERSION, LEAD_FORM_VERSION, CONSENT_TEXT } from "../utils/defaults.js";
import { makeId, nowIso } from "../utils/id.js";
import { canPublish } from "../utils/validate.js";

// ============================================================================
// useShop — שכבת הנתונים היחידה.
//
// שני מצבים (firebase-app): אין config → localStorage עם דמו; יש → Firestore.
//
// 🔴 שני תזמונים שונים, וזו הנקודה שהכי קל לטעות בה:
//   1. `models` / `diamonds` / `settings/public` = **קריאה פומבית**. נרשמים
//      ב-mount עם deps `[]`, בלי להמתין ל-login — הקטלוג חייב להיטען למבקר
//      אנונימי. (ההפך מהתבנית הרגילה שלנו, ובכוונה.)
//   2. `leads` + `settings/private` = **אדמין בלבד**. ההרשמה תלויה ב-
//      `user?.uid` ונרשמת רק אחרי שההתחברות הושלמה. הרשמה ב-mount מחזירה
//      permission-denied ו"טעינה נכשלה" — הבאג מה-Basketball Scheduler.
// ============================================================================

export function useShop(user) {
  const [data, setData] = useState(() => (isFirebaseConfigured ? EMPTY_DATA : loadLocal()));
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quotaError, setQuotaError] = useState(false);

  const persist = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const res = saveLocal(next);
      if (!res.ok) setQuotaError(Boolean(res.quota));
      return next;
    });
  }, []);

  // ------------------------------------------------------------- ענן: פומבי
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    let cancelled = false;
    const unsubs = [];

    (async () => {
      try {
        const { collection, doc, onSnapshot, query, where } = await import("firebase/firestore");
        if (cancelled) return;

        const onErr = (label) => (err) => {
          console.error(`[useShop] ${label} snapshot failed`, err);
          setError("catalog.loadError");
          setLoading(false);
        };

        // ⚠️ ה-where תואם ל-rules. הוא **אינו** בקרת אבטחה — בלעדיו הכללים
        // פשוט דוחים את השאילתה כולה.
        unsubs.push(
          onSnapshot(
            query(collection(db, COL_MODELS), where("status", "==", "available")),
            (snap) => {
              setData((p) => ({ ...p, models: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
              setLoading(false);
            },
            onErr("models")
          )
        );

        unsubs.push(
          onSnapshot(
            query(collection(db, COL_DIAMONDS), where("status", "==", "available")),
            (snap) =>
              setData((p) => ({ ...p, diamonds: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })),
            onErr("diamonds")
          )
        );

        unsubs.push(
          onSnapshot(
            doc(db, COL_SETTINGS, SETTINGS_PUBLIC_ID),
            (snap) =>
              setData((p) => ({
                ...p,
                settingsPublic: snap.exists()
                  ? { ...DEFAULT_SETTINGS_PUBLIC, ...snap.data() }
                  : DEFAULT_SETTINGS_PUBLIC,
              })),
            onErr("settings")
          )
        );
      } catch (err) {
        console.error("[useShop] firestore import failed", err);
        setError("catalog.loadError");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, []);

  // -------------------------------------------------- ענן: אדמין (deps=uid!)
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    if (!user?.uid) {
      setData((p) => ({ ...p, leads: [], adminModels: [], adminDiamonds: [] }));
      return;
    }
    let cancelled = false;
    const unsubs = [];
    setLeadsLoading(true);

    (async () => {
      try {
        const { collection, doc, onSnapshot, query, orderBy } = await import("firebase/firestore");
        if (cancelled) return;

        unsubs.push(
          onSnapshot(
            query(collection(db, COL_LEADS), orderBy("createdAt", "desc")),
            (snap) => {
              setData((p) => ({ ...p, leads: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
              setLeadsLoading(false);
            },
            (err) => {
              // permission-denied כאן = החשבון אינו אדמין. תקין ומצופה —
              // לא הופכים את זה לשגיאה של כל האתר.
              console.warn("[useShop] leads denied/failed", err?.code || err);
              setLeadsLoading(false);
            }
          )
        );

        // אדמין רואה גם פריטים מוסתרים ונמכרים — לכן שאילתה נפרדת בלי where.
        unsubs.push(
          onSnapshot(
            collection(db, COL_MODELS),
            (snap) => setData((p) => ({ ...p, adminModels: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })),
            (err) => console.warn("[useShop] admin models denied", err?.code || err)
          )
        );
        unsubs.push(
          onSnapshot(
            collection(db, COL_DIAMONDS),
            (snap) => setData((p) => ({ ...p, adminDiamonds: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })),
            (err) => console.warn("[useShop] admin diamonds denied", err?.code || err)
          )
        );
        unsubs.push(
          onSnapshot(
            doc(db, COL_SETTINGS, SETTINGS_PRIVATE_ID),
            (snap) =>
              setData((p) => ({
                ...p,
                settingsPrivate: snap.exists()
                  ? { ...DEFAULT_SETTINGS_PRIVATE, ...snap.data() }
                  : DEFAULT_SETTINGS_PRIVATE,
              })),
            (err) => console.warn("[useShop] settings/private denied", err?.code || err)
          )
        );
      } catch (err) {
        console.error("[useShop] admin subscriptions failed", err);
        setLeadsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [user?.uid]);

  // ----------------------------------------------------------------- כתיבות
  const writeDoc = useCallback(async (col, id, payload) => {
    const { doc, setDoc } = await import("firebase/firestore");
    await setDoc(doc(db, col, id), payload, { merge: false });
  }, []);

  // 🔴 A1ב — הפרסום נחסם כאן, לא רק ב-UI. פריט שאינו עובר `validateListing`
  // נשמר כ-`hidden` גם אם האדמין ביקש "available". זו הנקודה שבה הכלל
  // המשפטי הופך לקוד: אי אפשר "לשכוח" אותו בטופס.
  const enforcePublishGate = (item) => {
    if (item.status === "available" && !canPublish(item)) {
      return { ...item, status: "hidden" };
    }
    return item;
  };

  const saveModel = useCallback(
    async (model) => {
      const id = model.id || makeId("m");
      const payload = enforcePublishGate({
        ...model,
        id,
        listingType: "made_to_order",
        updatedAt: nowIso(),
        createdAt: model.createdAt || nowIso(),
      });
      if (!isFirebaseConfigured) {
        persist((p) => {
          const exists = p.models.some((m) => m.id === id);
          return {
            ...p,
            models: exists ? p.models.map((m) => (m.id === id ? payload : m)) : [...p.models, payload],
          };
        });
        return payload;
      }
      await writeDoc(COL_MODELS, id, payload);
      return payload;
    },
    [persist, writeDoc]
  );

  const deleteModel = useCallback(
    async (id) => {
      if (!isFirebaseConfigured) {
        persist((p) => ({ ...p, models: p.models.filter((m) => m.id !== id) }));
        return;
      }
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, COL_MODELS, id));
    },
    [persist]
  );

  const saveDiamond = useCallback(
    async (diamond) => {
      const id = diamond.id || makeId("d");
      const payload = enforcePublishGate({
        ...diamond,
        id,
        listingType: "specific_stone",
        updatedAt: nowIso(),
        createdAt: diamond.createdAt || nowIso(),
      });
      if (!isFirebaseConfigured) {
        persist((p) => {
          const exists = p.diamonds.some((d) => d.id === id);
          return {
            ...p,
            diamonds: exists ? p.diamonds.map((d) => (d.id === id ? payload : d)) : [...p.diamonds, payload],
          };
        });
        return payload;
      }
      await writeDoc(COL_DIAMONDS, id, payload);
      return payload;
    },
    [persist, writeDoc]
  );

  const deleteDiamond = useCallback(
    async (id) => {
      if (!isFirebaseConfigured) {
        persist((p) => ({ ...p, diamonds: p.diamonds.filter((d) => d.id !== id) }));
        return;
      }
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, COL_DIAMONDS, id));
    },
    [persist]
  );

  const saveSettingsPublic = useCallback(
    async (settings) => {
      const payload = { ...settings, updatedAt: nowIso() };
      if (!isFirebaseConfigured) {
        persist((p) => ({ ...p, settingsPublic: payload }));
        return payload;
      }
      await writeDoc(COL_SETTINGS, SETTINGS_PUBLIC_ID, payload);
      return payload;
    },
    [persist, writeDoc]
  );

  // ------------------------------------------------------------------ לידים
  // 🔴 היחיד שהציבור כותב. A7.1 — שתי הסכמות נפרדות, כל אחת עם **הטקסט
  // שהוצג בפועל** ועם גרסת המדיניות. בלי זה אי אפשר להוכיח על מה הוסכם.
  const submitLead = useCallback(
    async (lead, lang = "he") => {
      const now = nowIso();
      const texts = CONSENT_TEXT[lang] || CONSENT_TEXT.he;

      const consent = {
        contact: {
          granted: true, // ולידציה חוסמת שליחה בלעדיה; ה-rules חוסמים בשרת
          at: now,
          policyVersion: POLICY_VERSION,
          formVersion: LEAD_FORM_VERSION,
          text: texts.contact,
        },
        marketing: lead.consentMarketing
          ? {
              granted: true,
              at: now,
              policyVersion: POLICY_VERSION,
              formVersion: LEAD_FORM_VERSION,
              text: texts.marketing,
            }
          : null,
      };

      const clean = {
        name: String(lead.name || "").trim().slice(0, 80),
        phone: String(lead.phone || "").trim().slice(0, 20),
        source: lead.source || "contactForm",
        lang,
        consent,
      };
      if (lead.email) clean.email = String(lead.email).trim().slice(0, 120);
      if (lead.message) clean.message = String(lead.message).trim().slice(0, 1000);
      // A7.6 — תצלום מצב, ערכים משוכפלים ולא הפניה לפריט.
      if (lead.listingSnapshot) clean.listingSnapshot = lead.listingSnapshot;

      if (!isFirebaseConfigured) {
        const local = { ...clean, id: makeId("lead"), createdAt: now, status: "new" };
        persist((p) => ({ ...p, leads: [local, ...(p.leads || [])] }));
        return local;
      }

      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
      // createdAt חייב להיות בדיוק request.time — כך דורשות ה-rules.
      await addDoc(collection(db, COL_LEADS), { ...clean, createdAt: serverTimestamp() });
      return clean;
    },
    [persist]
  );

  const updateLead = useCallback(
    async (id, patch) => {
      if (!isFirebaseConfigured) {
        persist((p) => ({ ...p, leads: p.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
        return;
      }
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc(db, COL_LEADS, id), patch);
    },
    [persist]
  );

  // 🔴 A7.7 — **מחיקה אמיתית, לא `hidden: true`.** למבקר אין חשבון ולכן אין
  // לו דרך עצמאית למחוק; בלי הפונקציה הזאת אי אפשר לכבד בקשת מחיקה, וזו
  // הבטחה במדיניות שאינה מתקיימת בקוד.
  const deleteLead = useCallback(
    async (id) => {
      if (!isFirebaseConfigured) {
        persist((p) => ({ ...p, leads: p.leads.filter((l) => l.id !== id) }));
        return;
      }
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, COL_LEADS, id));
    },
    [persist]
  );

  // 🔴 A7.7 — מימוש בקשת עיון/מחיקה מתחיל מזיהוי לפי טלפון.
  const findLeadsByPhone = useCallback(
    (phone) => {
      const digits = String(phone || "").replace(/\D/g, "");
      if (digits.length < 6) return [];
      return (data.leads || []).filter(
        (l) => String(l.phone || "").replace(/\D/g, "").includes(digits)
      );
    },
    [data.leads]
  );

  const resetDemoData = useCallback(() => {
    if (isFirebaseConfigured) return;
    setData(resetLocal());
  }, []);

  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS_PUBLIC, ...(data.settingsPublic || {}) }),
    [data.settingsPublic]
  );

  // הקטלוג הציבורי: במצב מקומי מסננים כאן; בענן ה-rules כבר סיננו.
  const publicModels = useMemo(
    () => (data.models || []).filter((m) => m.status === "available"),
    [data.models]
  );
  const publicDiamonds = useMemo(
    () => (data.diamonds || []).filter((d) => d.status === "available"),
    [data.diamonds]
  );

  return {
    // ציבורי
    models: publicModels,
    diamonds: publicDiamonds,
    settings,
    // ניהול — כולל hidden/sold
    allModels: isFirebaseConfigured ? data.adminModels || [] : data.models || [],
    allDiamonds: isFirebaseConfigured ? data.adminDiamonds || [] : data.diamonds || [],
    settingsPrivate: { ...DEFAULT_SETTINGS_PRIVATE, ...(data.settingsPrivate || {}) },
    leads: data.leads || [],
    loading,
    leadsLoading,
    error,
    quotaError,
    isLocal: !isFirebaseConfigured,
    saveModel,
    deleteModel,
    saveDiamond,
    deleteDiamond,
    saveSettingsPublic,
    submitLead,
    updateLead,
    deleteLead,
    findLeadsByPhone,
    resetDemoData,
  };
}
