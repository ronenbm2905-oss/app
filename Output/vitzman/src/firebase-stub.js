// ============================================================================
// firebase-stub.js — תחליף ל-SDK של Firebase **בבנייה העצמאית בלבד**.
//
// הקובץ העצמאי נפתח בלחיצה כפולה מהדיסק, בלי שרת ובלי `.env`. במצב הזה
// `isFirebaseConfigured` הוא תמיד `false`, ולכן אף פונקציה כאן לא נקראת —
// אבל ה-import עצמו קיים בקוד, ובלי alias הוא היה גורר את כל ה-SDK פנימה.
//
// ⚠ **המחיר היה 540KB** — הקובץ קפץ מ-631KB ל-1,173KB בשביל קוד שלא ירוץ שם
// לעולם. הקובץ הזה הוא מה שמחזיר אותו לגודלו.
//
// הפונקציות זורקות ולא מחזירות בשקט: אם מישהו יקרא להן, זו תקלת קונפיגורציה
// שעדיף לראות מיד מאשר לגלות דרך מסך ריק.
// ============================================================================

const nope = (name) => () => {
  throw new Error(`${name} אינו זמין בקובץ העצמאי — זו גרסה מקומית בלי ענן.`);
};

export const initializeApp = nope("initializeApp");
export const initializeFirestore = nope("initializeFirestore");
export const persistentLocalCache = nope("persistentLocalCache");
export const persistentMultipleTabManager = nope("persistentMultipleTabManager");
export const getAuth = nope("getAuth");
export const setPersistence = nope("setPersistence");
export const browserLocalPersistence = null;
export const signInWithPopup = nope("signInWithPopup");
export const signOut = nope("signOut");
export const onAuthStateChanged = nope("onAuthStateChanged");
export const doc = nope("doc");
export const collection = nope("collection");
export const onSnapshot = nope("onSnapshot");
export const writeBatch = nope("writeBatch");
export const updateDoc = nope("updateDoc");
export class GoogleAuthProvider {}
