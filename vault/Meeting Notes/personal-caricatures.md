# Personal Caricatures (Itai)

## Overview
קריקטורות/איורים אישיים שאיתי מייצר לבקשת המשתמש (מתנות לחברים וכד') — מחוץ לזרימת דפי הנחיתה הרגילה. סגנון: קארטון תוסס, פרופורציית קריקטורה (ראש מוגדל), הבעות מוגזמות, שמירה על תווים מזהים מתוך תמונת רפרנס. **שיטה מועדפת לשמירת דמיון פנים:** endpoint של OpenAI **image edits** (`/v1/images/edits`, מודל gpt-image-2) עם הצילום האמיתי כקלט — משמר זהות הרבה יותר טוב מ-generations (טקסט→תמונה) שממציא פרצוף. רפרנסים נשמרים ב-`itai/reference/`, תוצרים ב-`itai/Outputs/`.

## Open Questions
- none

## Technical Notes
- **שם קובץ עברי + curl ב-Git Bash:** קריאת `image edits` נכשלת (curl error 26) על קלט עם שם עברי (`צמח.jpeg`). פתרון: העתק לשם ASCII זמני לפני ההעלאה, ומחק אחרי.
- לשמירת פנים: `generations` ממציא פרצוף → תמיד `edits` עם הצילום האמיתי כקלט.

## Session Log

### 2026-07-15 — Running + driving-instructor caricature ("צמח") [shipped]
- **What was done:** קריקטורה מצחיקה של חבר של המשתמש (רפרנס `itai/reference/צמח.jpeg` — גבר קירח, זקן אפור, רץ). קונספט "הרץ שאי אפשר להדביק": הוא רץ בראש ומאחוריו רכב לימוד-נהיגה עם שלט "L" והמורה נשען מהחלון בתסכול. קונוסים + תמרור. בלי טקסט (לבקשת המשתמש). תוצר: `itai/Outputs/2026-07-15-running-driving-instructor-caricature.png` (1024×1024) + `.txt`.
- **Decisions:** המשתמש נתן לאיתי חופש יצירתי לשילוב ("תן לאיתי להמציא") ובחר בלי טקסט. נבחר נרטיב מרדף רכב-נהיגה-אחרי-רץ כי הוא קורא הכי מהר במבט ראשון. נוצר ב-gpt-image-gen (איור, לא הרכבת קובץ אמיתי).
- **Notes / Caveats:** הרכב יצא מיני-קופר כללי (לא רכב לימוד ישראלי ספציפי) — שלט "L" מבהיר את הנרטיב. שמירת דמיון: קרחת/זקן אפור/חולצה כהה/שעון נשמרו.
- **Related:** [[golden-tri-sticker-design]]

### 2026-07-15 — v2: face preservation via image-edit [shipped]
- **What was done:** המשתמש ציין ש-v1 "לא נראה כמו החבר". הופק **v2** דרך endpoint של image edits (gpt-image-2) עם `צמח.jpeg` כקלט אמיתי. תוצר: `itai/Outputs/2026-07-15-running-driving-instructor-caricature-v2.png`. אותו קונספט (מרדף מורה-נהיגה, בלי טקסט), אבל הפנים נשמרו נאמנה — קרחת, זקן אפור, הבעה, ובונוס: לוגו New Balance/כתם זיעה/שעון/נעליים מהצילום. v1 נשמרה ולא נדרסה.
- **Decisions:** מעבר מ-generations ל-edits הוא הדרך לשמר פנים אמיתיים. הדמיון ב-v2 הוערך כחזק — לא נדרש גיבוי של הדבקת פנים (נשאר כאופציה אם יתבקש דיוק 1:1).
- **Notes / Caveats:** curl ב-Git Bash נכשל על שם קובץ עברי (error 26) — נדרש שם ASCII זמני (ראו Technical Notes).
- **Related:** [[golden-tri-sticker-design]]
