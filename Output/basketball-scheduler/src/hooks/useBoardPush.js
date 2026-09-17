import { useCallback, useEffect, useState } from "react";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured, firebaseConfig } from "../firebase";
import { deviceSupport } from "./usePushNotifications";

// A parent's phone, following one team board.
//
// The subscription is to a BOARD, not to a person. What is stored is a push token, the board
// it follows, and the time — no name, no email, no account. The club learns that some device
// wants to hear about נוער מחוזית, and never learns whose it is.
//
// That is the whole reason this exists instead of child accounts: it delivers the thing that
// was actually wanted — a parent who does not have to check — without collecting a single
// new fact about anybody.
//
// `enabled` is read from the STORED row rather than from the browser's token, which is the
// lesson from 16.9: a device can hold a perfectly good token while nothing was ever saved,
// and a screen that reads the token says "on" to someone who will never be told anything.

const SW_URL = "/firebase-messaging-sw.js";

export function useBoardPush(boardToken) {
  const [support] = useState(deviceSupport);
  const [fcmToken, setFcmToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const ref = (t) => doc(db, "clubs", CLUB_ID, "boardSubs", t);

  useEffect(() => {
    let cancelled = false;
    if (!isFirebaseConfigured || !support.ok || !boardToken) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    (async () => {
      let t = "";
      try {
        const { getMessaging, getToken } = await import("firebase/messaging");
        const reg = await navigator.serviceWorker.getRegistration(SW_URL);
        if (!reg) return;
        t = await getToken(getMessaging(), {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: reg,
        });
      } catch {
        /* a device that cannot report its token is simply off */
      }
      if (cancelled || !t) return;
      try {
        const row = await getDoc(ref(t));
        if (!cancelled && row.exists() && row.data()?.boardToken === boardToken) setFcmToken(t);
      } catch {
        /* unreadable means not subscribed */
      }
    })();
    return () => { cancelled = true; };
  }, [support.ok, boardToken]);

  const enable = useCallback(async () => {
    if (busy || !boardToken) return;
    setBusy(true);
    setStatus("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(
          perm === "denied"
            ? "ההרשאה נדחתה. אפשר לשנות אותה בהגדרות הדפדפן ואז לנסות שוב."
            : "ההרשאה לא ניתנה, ולכן לא נשמר דבר."
        );
        return;
      }
      const { getMessaging, getToken } = await import("firebase/messaging");
      const q = new URLSearchParams({
        apiKey: firebaseConfig.apiKey || "",
        authDomain: firebaseConfig.authDomain || "",
        projectId: firebaseConfig.projectId || "",
        senderId: firebaseConfig.messagingSenderId || "",
        appId: firebaseConfig.appId || "",
      });
      const reg = await navigator.serviceWorker.register(SW_URL + "?" + q);
      const t = await getToken(getMessaging(), {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: reg,
      });
      if (!t) {
        setStatus("לא הצלחנו לרשום את המכשיר. נסו שוב.");
        return;
      }
      await setDoc(ref(t), {
        fcmToken: t,
        boardToken,
        createdAt: new Date().toISOString(),
      });
      setFcmToken(t);
      setStatus("נעדכן אתכם כשהלו״ז של הקבוצה משתנה.");
    } catch (err) {
      const code = err?.code || err?.name || "";
      setStatus("לא הצלחנו להפעיל את ההתראות." + (code ? ` (${code})` : ""));
    } finally {
      setBusy(false);
    }
  }, [busy, boardToken]);

  // Off means the row is GONE, not a flag set to false.
  const disable = useCallback(async () => {
    if (busy || !fcmToken) return;
    setBusy(true);
    setStatus("");
    try {
      await deleteDoc(ref(fcmToken));
      setFcmToken("");
      setStatus("ההתראות כבויות במכשיר הזה.");
    } catch {
      setStatus("לא הצלחנו לכבות. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }, [busy, fcmToken]);

  return { support, enabled: Boolean(fcmToken), busy, status, enable, disable, available: isFirebaseConfigured };
}
