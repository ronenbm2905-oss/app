# הדרך למילים — הערכת הבאה לחנויות (PWA מול Capacitor)

> הערכה בלבד (נועם, 2026-08-08). לא שונה אף קובץ באפליקציה ולא נבנה כלום — קריאת קוד + הערכה.

## מה נמצא בקוד (עובדות, לא הנחות)

| נושא | מצב בפועל | משמעות להמשך |
|---|---|---|
| סטאק | Vite 5, React 18 (JS), Tailwind 3, `lucide-react`. אין router — ניווט דרך state ב-`App.jsx` | יתרון גדול לשני המסלולים: אין נתיבי URL, אין deep-links לתחזק |
| `base` | `"./"` כבר מוגדר | מושלם — Capacitor דורש נתיבים יחסיים; כבר עומד בזה |
| נכסי קלפים | 24 קבצי `public/cards/card-NN.jpg`, ~2.5MB, נתיב יחסי `"./cards/card-01.jpg"` | קל ל-precache; נתיב יחסי עובד גם ב-WebView |
| TTS | `hooks/useSpeech.js` — Web Speech API, בוחר קול `he-IL`, לא קורס אם אין קול | מלכודת עיקרית — שונה בין PWA ל-Capacitor |
| צלילים | `hooks/useSound.js` — Web Audio מסונתז, בלי קבצי אודיו, lazy + resume | עובד בכל WebView/PWA. אפס נכסי אודיו ל-cache |
| איקון | favicon = `./cards/card-01.jpg`. אין icon אמיתי / apple-touch-icon / manifest | צריך לייצר icons (192/512 + maskable) לשני המסלולים |
| פונט | Varela Round מ-Google Fonts CDN | מלכודת אופליין: טעינה ראשונה בלי רשת → fallback. צריך self-host או runtime-cache |
| איסוף מידע | אין localStorage/analytics/cookies (אומת ע"י עדי) | מפשט מאוד ציות לקטגוריית ילדים בחנויות |

## מסלול א' — PWA על האפליקציה הקיימת

**מה צריך:** `vite-plugin-pwa` (`registerType:'autoUpdate'`, Workbox globPatterns ל-js/css/html/jpg/woff2); manifest (name/short_name "הדרך למילים", dir:rtl, lang:he, theme_color #8ECFDD, display:standalone); 3 icons (192/512/512-maskable); service worker אוטומטי (Workbox precache כולל 24 קלפים ~2.5MB); self-host Varela Round ל-`public/fonts/` או runtimeCaching; meta ל-iOS (apple-mobile-web-app-capable, apple-touch-icon).

**מאמץ נועם: 3–5 שעות.** הכול קוד/קונפיג, אפס תלות במשתמש.

**מלכודות:** TTS אופליין תלוי בקול מותקן במכשיר (אנדרואיד/iOS בד"כ יש עברית מקומית → יעבוד; הקוד לא קורס בהיעדר קול). Web Audio מסונתז → עובד אופליין מיידית. `base:'./'` → אין בעיות scope כי אין router.

**מקבל:** הוסף למסך הבית, מסך מלא, אופליין מלא אחרי ביקור ראשון, אייקון. **מגבלות iOS:** אין באנר התקנה אוטומטי (ידני דרך שיתוף), cache עלול להימחק, אין נוכחות בחנות.

## מסלול ב' — Capacitor → Google Play (ו-App Store)

**צעדים:** `npm i @capacitor/core @capacitor/app` + cli → `npx cap init` → `@capacitor/android` + `npx cap add android` → `npm run build` + `npx cap sync` → Android Studio → Signed `.aab`. ל-iOS: `@capacitor/ios` + **Mac + Xcode חובה**.

**תלוי-משתמש (חוסם, לא נועם):** חשבון Google Play ($25 חד"פ); חשבון Apple ($99/שנה + Mac); keystore לחתימה (אובדן = אי-אפשר לעדכן לנצח); ביקורת חנות; נכסי חנות (תיאור, צילומי מסך, feature graphic, מדיניות פרטיות ב-URL ציבורי).

**שינויי קוד:** `base:'./'` כבר נכון → אפס שינוי נתיבים. Web Audio עובד ב-WebView. **⚠️ Web Speech TTS — הסיכון האמיתי:** `speechSynthesis` לא נתמך אמין ב-Android System WebView; TTS הוא לב החוויה (הקראה לילדים שלא קוראים). פתרון: `@capacitor-community/text-to-speech` + עטיפת `useSpeech.js` שבוחרת פלאגין כשרצים ב-Capacitor (`Capacitor.isNativePlatform()`) ו-Web Speech בדפדפן. זו עבודת האינטגרציה המשמעותית. + viewport-fit=cover/safe-area + מאזין hardware-back.

**מאמץ נועם: 1.5–3 ימי עבודה** (אנדרואיד; הרוב על TTS ו-QA), +0.5–1 יום iOS רק אם יש Mac.

**קטגוריית ילדים:** Google Families Policy / Apple Kids — אין פרסומות/SDK צד-ג'/איסוף מידע → עומדים בקלות. מדיניות פרטיות ב-URL ציבורי חובה (יש טקסט מעדי). לא לבקש הרשאות מיותרות ב-AndroidManifest.

## סיכום השוואתי

| | PWA | Capacitor |
|---|---|---|
| מאמץ נועם | 3–5 שעות | 1.5–3 ימים (אנדרואיד); +0.5–1 iOS |
| עלות למשתמש | 0 | Play $25; Apple $99/שנה + Mac |
| תלות במשתמש | אין | חשבונות, keystore, ביקורת, כרטיס חנות |
| נוכחות בחנות | לא | כן |
| אופליין | מלא אחרי ביקור ראשון | מלא (מובנה) |
| סיכון TTS | נמוך | בינוני-גבוה (צריך פלאגין אנדרואיד) |
| תחזוקה | פרוס פעם אחת, מתעדכן לבד | כל עדכון = build+חתימה+ביקורת |
| מתי כדאי | הפצה מיידית, אימות שוק, לינק בוואטסאפ/אתר | נוכחות רשמית בחנות ואמון הורים |

**המלצה:** להתחיל ב-PWA עכשיו (3–5 שעות, אפס עלות/תלות, מנצל ש-`base:'./'` ו-Web Audio מוכנים). Capacitor כשלב ב' רק אם נוכחות ב-Google Play שווה את המחיר — ואז הבלוק היחיד שדורש עבודה אמיתית הוא עטיפת ה-TTS. App Store לא כדאי כעת (Mac + $99/שנה + ביקורת קפדנית) אלא אם יש דרישה מפורשת.
