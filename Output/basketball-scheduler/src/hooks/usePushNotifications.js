import { useCallback, useEffect, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db, CLUB_ID, isFirebaseConfigured, firebaseConfig } from "../firebase";
import { tokenDoc } from "../utils/pushTargets";

// Turning phone notifications on for THIS device.
//
// Everything here is per-device, never per-person. A coach with a phone and a tablet holds
// two rows; switching off on the old phone must not silence the new one. The row is keyed
// by the token because that is the thing FCM invalidates.
//
// The shape of the failure this guards against: a coach taps the button on an iPhone in
// Safari, nothing visible happens, they assume it worked, and a week later they read
// silence as "nothing changed". So `support` is computed BEFORE anything is requested, and
// the button says what is actually true about the device it is running on.

const SW_URL = "/firebase-messaging-sw.js";

// iOS grants Push API only to a home-screen installed PWA (16.4+). In plain Safari the API
// is absent entirely — which is why this asks about capability, not about the browser name.
function deviceSupport() {
  if (typeof window === "undefined") return { ok: false, reason: "unsupported" };
  const hasApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isApple = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

  if (hasApi) return { ok: true, reason: "" };
  // The distinction matters: "add it to your home screen" is an instruction someone can
  // follow. "Your browser does not support notifications" is a dead end.
  if (isApple && !standalone) return { ok: false, reason: "ios-needs-install" };
  return { ok: false, reason: "unsupported" };
}

export function usePushNotifications({ coachId, email }) {
  const [support] = useState(deviceSupport);
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  // What this device already had, before anything is asked. Read from the browser's own
  // registration rather than from Firestore: the question is "is this device subscribed",
  // and only the device can answer it.
  useEffect(() => {
    let cancelled = false;
    if (!isFirebaseConfigured || !support.ok || Notification.permission !== "granted") return;
    (async () => {
      try {
        const { getMessaging, getToken } = await import("firebase/messaging");
        const reg = await navigator.serviceWorker.getRegistration(SW_URL);
        if (!reg) return;
        const t = await getToken(getMessaging(), {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: reg,
        });
        if (!cancelled && t) setToken(t);
      } catch {
        /* a device that cannot report its token is simply treated as off */
      }
    })();
    return () => { cancelled = true; };
  }, [support.ok]);

  const enable = useCallback(async () => {
    if (busy || !coachId) return;
    setBusy(true);
    setStatus("");
    try {
      // The permission prompt is asked LAST, after the on-screen explanation the coach has
      // already read. A browser dialog is not notice — see privacy policy §2ז.
      const perm = await Notification.requestPermission();
      setPermission(perm);
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
      const reg = await navigator.serviceWorker.register(`${SW_URL}?${q}`);
      const t = await getToken(getMessaging(), {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: reg,
      });
      if (!t) {
        setStatus("לא הצלחנו לרשום את המכשיר. נסה/י שוב, או בדוק/בדקי את הרשאות הדפדפן.");
        return;
      }

      await setDoc(doc(db, "clubs", CLUB_ID, "pushTokens", t), tokenDoc({ token: t, coachId, email }));
      setToken(t);
      setStatus("ההתראות פועלות במכשיר הזה.");
    } catch {
      setStatus("משהו השתבש בהפעלת ההתראות. נסה/י שוב.");
    } finally {
      setBusy(false);
    }
  }, [busy, coachId, email]);

  // Off means GONE, not a flag set to false — privacy policy §2ז promises the device row is
  // deleted, and a promise the code does not keep is the failure this project keeps
  // catching. The browser permission is left alone on purpose: revoking it is the coach's
  // to do, and silently dropping it would surprise them on the next site that asks.
  const disable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      if (token) await deleteDoc(doc(db, "clubs", CLUB_ID, "pushTokens", token));
      try {
        const { getMessaging, deleteToken } = await import("firebase/messaging");
        await deleteToken(getMessaging());
      } catch {
        /* the row is already gone; a stale browser token will be cleaned on first send */
      }
      setToken("");
      setStatus("ההתראות כבויות במכשיר הזה, והמזהה נמחק.");
    } catch {
      setStatus("לא הצלחנו לכבות. נסה/י שוב.");
    } finally {
      setBusy(false);
    }
  }, [busy, token]);

  // "I hope it works" → "I saw it work".
  //
  // Adi called this the only control that actually answers the reliance problem, and she is
  // right: nothing else tells a coach on an iPhone whether the button did anything.
  const sendTest = useCallback(async () => {
    if (!token) return;
    setStatus("");
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      await reg?.showNotification("בדיקה — ClubCal קרית אונו", {
        body: "אם ההודעה הזו הגיעה, ההתראות פועלות במכשיר הזה.",
        icon: "/icon-192.png",
        dir: "rtl",
        lang: "he",
        tag: "push-test",
      });
      setStatus("נשלחה התראת בדיקה. אם היא לא הופיעה — ההתראות חסומות ברמת המכשיר.");
    } catch {
      setStatus("לא הצלחנו להציג התראת בדיקה במכשיר הזה.");
    }
  }, [token]);

  return {
    support,
    permission,
    enabled: Boolean(token),
    busy,
    status,
    enable,
    disable,
    sendTest,
    available: isFirebaseConfigured,
  };
}
