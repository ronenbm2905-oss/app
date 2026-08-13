// ============================================================================
// SpecTable — 🔴 הקומפוננטה שבה **המפרט הטכני והגילוי המשפטי הם אותה
// טיפוגרפיה**. אין באנר, אין אייקון אזהרה, אין צבע.
//
// `<dl>` שמרונדר כשורות קו-שיער. לא טבלה עם מסגרת, לא זברה, לא כותרת עמודות.
//   • שורה: min-height 44px · padding 12px 0 · border-bottom line (האחרונה לא)
//   • מונח (inline-start): 15px ink80 400 · ערך (inline-end): 15px ink 500
//   • שורה עם `flag` → קו ink 2px ב-inline-start + משקל 600 (חומרה = קו
//     ומשקל, לא צבע → 1.4.1)
//
// ⚠️ **סדר השורות נעול משפטית ואינו נתון לעיצוב:**
//    origin → carat → shape → color → clarity → cut → treatments → certificate
//    המקור ראשון (FTC: הסיוג בתחילת התיאור); הטיפולים לפני התעודה
//    ובסמיכות למחיר. הבונה של השורות אחראי לסדר — הרכיב מרנדר כפי שקיבל.
// ============================================================================

export default function SpecTable({ rows, columns = 1, className = "" }) {
  const list = (rows || []).filter(Boolean);
  return (
    <dl
      className={`${
        columns === 2 ? "lg:grid lg:grid-cols-2 lg:gap-x-12" : ""
      } border-b border-b-line ${className}`}
    >
      {list.map((row, i) => (
        // ⚠️ `border-t-line` ולא `border-line`: האחרון היה צובע גם את קו
        // ה-`.flag` בגוון הקו הדקורטיבי ומוחק את סימון החומרה.
        <div
          key={row.key || i}
          className={`flex min-h-11 items-start justify-between gap-4 border-t border-t-line py-3 ${
            row.flag ? "flag" : ""
          } ${row.span ? "lg:col-span-2" : ""}`}
        >
          <dt className={`text-spec ${row.flag ? "font-semibold text-ink" : "text-ink-80"}`}>
            {row.term}
          </dt>
          <dd
            className={`text-spec text-ink ${
              row.flag ? "font-semibold" : "font-medium"
            } text-end`}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
