import { useCallback, useEffect, useState } from "react";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
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

// A failure here is invisible by nature — no notification looks exactly like no change.
// "Something went wrong" was true and useless: it took four rounds of guessing to find
// that the real answer was a denied Firestore write. The step and the code go ON SCREEN,
// because the person who hits this is holding the phone and I am not.
const failure = (label, err) => {
  const code = err?.code || err?.name || "";
  // The MESSAGE, not only the name. "TypeError" on its own sent us looking in the wrong
  // place; "Importing a module script failed" would have said it outright. Trimmed,
  // because this is a coach’s phone screen and not a console.
  const detail = String(err?.message || "").replace(/s+/g, " ").trim().slice(0, 120);
  const tail = [code, detail].filter(Boolean).join(": ");
  return tail ? label + " (" + tail + ")" : label;
};

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

  // What this device is ACTUALLY registered for.
  //
  // An earlier version asked the browser alone, reasoning that "is this device
  // subscribed" is a question only the device can answer. That reasoning was wrong: the
  // question is "will a notification arrive", and only the stored row answers it. On 16.9
  // the two disagreed — the token was valid, the write had been denied by rules, and the
  // screen said notifications were working while nothing would ever be sent. The local
  // test notification agreed, because it never touches the server either.
  //
  // So the row is the authority, and anything else counts as OFF.
  useEffect(() => {
    let cancelled = false;
    if (!isFirebaseConfigured || !support.ok || Notification.permission !== "granted") return;
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
        /* a device that cannot report its token is simply treated as off */
      }
      if (cancelled || !t) return;

      // A missing row reads as PERMISSION_DENIED for a coach, not as "not found" — the
      // ownership rule cannot match a document that is not there. Both mean the same
      // thing here, and both mean: not registered.
      let registered = false;
      try {
        registered = (await getDoc(doc(db, "clubs", CLUB_ID, "pushTokens", t))).exists();
      } catch {
        registered = false;
      }
      if (cancelled) return;
      if (registered) setToken(t);
      else setStatus("המכשיר הזה אינו רשום לקבלת התראות. לחץ/י על הכפתור כדי לרשום אותו.");
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

      // The app loads this part on demand, as a separate file. A deploy replaces those
      // files, and a missing one does NOT come back as a 404 here — the SPA rewrite answers
      // with index.html, the browser tries to parse HTML as a module, and all that reaches
      // us is a bare TypeError. Anyone whose app was open BEFORE a deploy and taps a button
      // after it lands here, which is an ordinary thing for a coach to do.
      let messaging;
      try {
        messaging = await import("firebase/messaging");
      } catch (err) {
        setStatus(
          failure(
            "המערכת עודכנה מאז שפתחת את האפליקציה. סגור/סגרי אותה לגמרי (באייפון — להחליק אותה החוצה ממסך האפליקציות הפתוחות), לפתוח שוב ולנסות.",
            err
          )
        );
        return;
      }
      const { getMessaging, getToken } = messaging;
      const q = new URLSearchParams({
        apiKey: firebaseConfig.apiKey || "",
        authDomain: firebaseConfig.authDomain || "",
        projectId: firebaseConfig.projectId || "",
        senderId: firebaseConfig.messagingSenderId || "",
        appId: firebaseConfig.appId || "",
      });
      let reg;
      try {
        reg = await navigator.serviceWorker.register(SW_URL + "?" + q);
      } catch (err) {
        setStatus(failure("לא הצלחנו להתקין את רכיב ההתראות בדפדפן.", err));
        return;
      }

      let t;
      try {
        t = await getToken(getMessaging(), {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: reg,
        });
      } catch (err) {
        setStatus(failure("הדפדפן לא הצליח לקבל מזהה להתראות.", err));
        return;
      }
      if (!t) {
        setStatus("לא הצלחנו לרשום את המכשיר. נסה/י שוב, או בדוק/בדקי את הרשאות הדפדפן.");
        return;
      }

      // The step that actually failed on 16.9, and the one the old single catch hid: the
      // token was fine, the write was denied. Naming it separately is the difference
      // between "try again" and knowing there is nothing to try.
      try {
        await setDoc(doc(db, "clubs", CLUB_ID, "pushTokens", t), tokenDoc({ token: t, coachId, email }));
      } catch (err) {
        setStatus(failure("קיבלנו מזהה, אך לא הצלחנו לשמור אותו — כנראה חסרה הרשאה.", err));
        return;
      }
      setToken(t);
      setStatus("ההתראות פועלות במכשיר הזה.");
    } catch (err) {
      setStatus(failure("משהו השתבש בהפעלת ההתראות.", err));
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

  // This checks ONE thing: that this device can draw a notification on screen. It is
  // created locally and never touches FCM or the Cloud Function, so it CANNOT tell you
  // that a real change would arrive. On 16.9 it said yes while the device was not
  // registered at all. The wording on the button and in the result says so plainly now,
  // because the earlier wording was read — reasonably — as proof of the whole chain.
  //
  // Adi called this the only control that actually answers the reliance problem, and she is
  // right: nothing else tells a coach on an iPhone whether the button did anything.
  const sendTest = useCallback(async () => {
    if (!token) return;
    setStatus("");
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_URL);
      // The name is the one on the home screen (manifest `name`) and nowhere else. An
      // earlier draft carried a competitor product name here, picked up while researching
      // them — the only user-visible string in the app that was not the club’s own.
      await reg?.showNotification("בדיקה — קרית אונו לו״ז אימונים", {
        body: "אם ההודעה הזו הגיעה, ההתראות פועלות במכשיר הזה.",
        icon: "/icon-192.png",
        dir: "rtl",
        lang: "he",
        tag: "push-test",
      });
      setStatus("זו בדיקת תצוגה בלבד — היא נוצרה כאן ולא הגיעה מהשרת. כדי לוודא שהכל עובד, שנה/י אימון בלו״ז וראה/י שההתראה מגיעה.");
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
