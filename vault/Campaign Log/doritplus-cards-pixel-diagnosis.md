# Doritplus Cards Page — Meta Pixel Diagnosis

## Overview
אבחון Meta Pixel בעמוד ערכת הקלפים "דרך המילים" ב-`doritplus.co.il` (WordPress + Elementor, GTM `GTM-MJ85X6PG`, אירוח SiteGround). הרקע: קמפיין חדש, 53 קליקים, ובמנהל המודעות אפס צפיות בדף נחיתה, אפס מעברים לתשלום ואפס רכישות. פיקסל היעד היחיד הוא `1655326862290518`. הממצא המרכזי: האתר עדיין יורה את הפיקסל **הישן `1155607796337708`**, שמוטמע כקוד קשיח ב-`<head>` של כל האתר ולא דרך GTM. לכן אף אירוע לא מגיע ל-1655. סטטוס: אבחון בלבד, ממתין לאישור של דורית לפני כל שינוי.

## Open Questions
- איפה בדיוק ב-WP מוזרק בלוק ה-`<!-- Meta Pixel Code -->` (Elementor Pro → Custom Code / קוד כותרת בתמה / תוסף header-code)? צריך גישת ניהול.
- זה בלוק משותף לכל האתר: שינוי ה-ID ישפיע על כל עמודי doritplus.co.il (לא על דפי ה-netlify). צריך הכרעה של דורית אם זה מקובל, או להגביל לעמוד הקלפים (page-id 1092).
- ה-`dl` נשלח כדומיין בלבד (בלי נתיב העמוד). אולי זו הגבלת "Core Setup" של Meta לקטגוריית בריאות/טיפול. לבדוק ב-Events Manager.
- גיטינג הסכמה (תיקון 13): הפיקסל יורה לפני הסכמה, ו-simple-cookie-notice הוא הודעה בלבד. דורש שער עדי לפני הקמפיין.

## Session Log

### 2026-09-30 — אבחון פיקסל בעמוד הקלפים (בלי שינויים) [debug]
- **What was done:** בדיקת קריאה-בלבד ב-Chromium (Playwright). בקשות `facebook.com/tr` ומעבר לטרנזילה נחסמו/נרשמו, כך שלא נשלחו אירועי בדיקה לפיקסל החי. נבדקו ה-HTML המרונדר, תוכן `gtm.js`, `fbq.getState()`, עוגיות, ולחיצה על כפתור הרכישה.
- **ממצאים:** (1) נטען רק `1155607796337708`. **`1655` לא קיים באתר.** (2) `PageView` נשלח פעם אחת בטעינה ל-1155. **`ViewContent` לא נשלח**, ו-**`InitiateCheckout` לא נשלח** בלחיצה (אין קוד לזה בכלל). (3) הפיקסל קשיח ב-`<head>` מיד אחרי snippet ה-GTM ולפני `cdn.enable.co.il`. אותו בלוק מופיע גם בדף הבית, כלומר זה בלוק גלובלי. ב-GTM יש 0 תגיות Meta (רק Google Ads `AW-16828261797`). (4) אין כפילות ואין Pixel ID שלישי. (5) אין CSP. ה-`simple-cookie-notice` לא חוסם. `_fbc` נוצר מ-fbclid. (6) לפני העמוד יש challenge של SiteGround ("One moment, please…", ‏reload אחרי 5 שניות). השגיאות 415 ו-`Unexpected token '<'` נראות כארטיפקט של הבוט מול ה-challenge, ולא ברור שהן קיימות אצל גולשים אמיתיים.
- **Decisions:** לא בוצע שום שינוי. השינוי המינימלי שהוצע: להחליף את ה-ID בבלוק הקיים (2 מופעים: `init` + `noscript`) ולהוסיף `ViewContent` בעמוד 1092 ו-`InitiateCheckout` בלחיצה על קישורי `pay.tranzila.com/doritplus`, רק בעמוד 1092. ממתין לאישור.
- **Notes / Caveats:** לא הייתה גישה ל-Pixel Helper, ל-Test Events או ל-WP admin מהסביבה. קישור הרכישה הוא דף מסוף כללי בלי סכום. זו סתירה ל-[[madbekot-laderech-landing]] מ-11.8, שם הומלץ להחליף ב-GTM: הפיקסל בכלל לא נמצא ב-GTM.
- **Related:** [[madbekot-laderech-landing]], [[madbekot-laderech-b2s-2026]], [[team-expansion-adi-legal]]
