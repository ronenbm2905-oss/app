# מתכון מסננים לניקוי תיבת הדואר — 21.7.2026

הוכן ע"י מאיה. מטרה: לנקות בקליק אחד את כל שאר מיילי השיווק (מאות, חודשים אחורה)
ולמנוע הצטברות עתידית. פעולה זו מתבצעת על-ידך בהגדרות Gmail (יצירת מסנן = שינוי
הגדרות → רק אתה מבצע).

## מה כבר בוצע
מאיה ארכבה ידנית ~150 מיילי שיווק (מ-9.6.2026 והלאה). הם עברו ל-All Mail, לא נמחקו.

## שלב 1 — מסנן אחד שמכסה את כל השולחנים
1. ב-Gmail, בשורת החיפוש לחץ על אייקון המסננים (Show search options).
2. בשדה **From** הדבק את הרשימה הזו:
   ```
   mail.zillow.com OR zmail.zillow.com OR redfin.com OR em.angi.com OR pro.crexi.com OR fsvproperties.com OR velocitylendingsolutions.com OR easystreetcap.com OR clubrrrr.com OR email.openai.com OR offmarketonly.ccsend.com
   ```
3. לחץ **Create filter**.
4. סמן:
   - ☑ **Skip the Inbox (Archive it)** — לא ייכנס יותר לתיבה.
   - ☑ (אופציונלי) **Apply the label:** → צור תווית `נדל"ן/שיווק` כדי שיהיה מסודר ונגיש.
   - ☑ **Mark as read** (אופציונלי — מנקה את מונה ה-unread).
   - ☑ **Also apply filter to N matching conversations** ← **זה הקסם**: מנקה בבת-אחת את כל השארית הקיימת (המאות שנשארו).
5. **Create filter**.

## שלב 2 — בדיקה
אחרי היצירה, התיבה הראשית אמורה להישאר עם דואר אמיתי בלבד. המיילים לא נמחקו — הם
תחת התווית / ב-All Mail, וניתן לחפש אותם בכל רגע.

## הערה
אם בעתיד יופיע שולח שיווקי חדש שלא ברשימה — אפשר להוסיף אותו לאותו מסנן (Edit
filter) או לומר למאיה והיא תעדכן את המתכון.
```
