# Meeting Notes — Index

תיעוד החלטות, פיתוח וארכיטקטורה של פרויקט צוות דפי הנחיתה. כל פתק כאן הוא נושא
אחד עם Overview + Session Log מתוארך.

## Topics

- [[basketball-scheduler-cloud-migration]] — המרת scheduler.html לאפליקציית ענן (Vite+React+Firebase) עם fallback מקומי
- [[ab-atelier-spec-review]] — AB Atelier (תכשיטים): ביקורת אפיון חנות Shopify → פיבוט לדף נחיתה כשלב בדיקה (בריף תויק)
- [[personal-caricatures]] — קריקטורות/איורים אישיים של איתי (מתנות לחברים) דרך gpt-image-gen
- [[team-expansion-noam-fullstack]] — לוג הרחבת הצוות: נועם (אפליקציות Full-Stack), מאיה (משרד/תפעול), ליאור (מצגות)
- [[team-expansion-adi-legal]] — לוג הרחבת הצוות: עדי (יועצת משפטית / Legal & Compliance), שער חוסם לפני פרסום/deploy
- [[derech-hamilim-lecture-deck]] — עיצוב שקפים 12–31 במצגת "הדרך למילים" לפי שפת שקפים 1–11 (רקע קרם, Segoe UI, לוגו)
- [[basketball-scheduler-legal-gate]] — שער משפטי (עדי) לפני deploy: חסום עד תיקון — כלל קריאה פרוץ ב-firestore + אין מדיניות פרטיות/נגישות
- [[haderech-lamilim-app]] — אפליקציית משחק חינוכית לילדים 2–8 (24 קלפים, 8 מצבי משחק, Vite+React client-side) — בנייה ע"י נועם
- [[madbekot-laderech-landing]] — דף נחיתה "מדבקות לדרך" (מוצר דורית בן מאיר) + קמפיין; חי ב-`doritplus-madbekot.netlify.app`. **סבב עדכון גדול 2026-07-29** לפי הערות דורית: היפוך פלטה לכחול/תכלת, ארגון תוכן מחדש, כותרת מנוקדת + לוגו, 2 קרוסלות "תמונות רצות" (באג RTL תוקן), 5 טסטימוניאלס אמיתיים, שער עדי #4 ✅ אושר לעלייה אורגנית; ממתין ל-re-deploy ידני. פרסום ממומן/פיקסל = תת-שער עדי + עו"ד [shipped]
- [[property-management-app]] — אפליקציית ניהול נכסים (בעלים פרטיים, נכס בודד עד 100 דירות): בנייה בפרוסות ע"י נועם (Vite+React+Firebase, fallback מקומי, i18n he/en + RTL/LTR, מדינה+מטבע פר-נכס, תשואה מחושבת). **פרוסה 1 shipped** — מודל נתונים מלא (9 ישויות) + 6 מסכים (Onboarding/לובי/דף נכס/דשבורד כלכלי/דשבורד תקלות/טופס תקלה), צד הבעלים; ownerId+deny-by-default הוטמעו. פרוסות הבאות: פורטל דייר, אפליקציית תחזוקה, סריקת מסמכים AI, Open Banking. שער עדי חוסם לפני deploy
- [[property-management-privacy-by-design]] — אפליקציית ניהול נכסים: סבב privacy-by-design מוקדם של עדי על מודל הנתונים (PII דיירים כולל ת.ז. + מסמכים סרוקים + חובות, רב-מדינה ישראל/GDPR/US/גאורגיה). 4 חוסמי-תכנון: בידוד ownerId רב-בעלים, בסיס חוקי+יידוע דייר, מסמכים סרוקים/מידע פיננסי (הצפנה+Storage rules), חוקיות העברה חוצה-גבולות. **הכוונה מוקדמת — לא שער סופי**; שער חוסם ייעודי לפני deploy
