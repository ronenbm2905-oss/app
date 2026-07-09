# agent-itai

**קובץ:** `.claude/agents/itai.md`
**משויך ל:** איתי — המעצב. **מוגדר** (לא עוד שלד).

קובע את כיוון העיצוב ומפיק **שני תוצרים**: (1) **מפרט עיצוב מבוסס design tokens**
(צבעים+hex/תפקידים, טיפוגרפיה, ריווח, לייאאוט מובייל-פירסט, RTL, a11y) ב-
`itai/Outputs/<date>-<slug>-design.md`; (2) **נכסים ויזואליים אמיתיים** (hero/
אייקונים/איורים) שהוא מייצר דרך הסקיל [[skill-gpt-image-gen]] ל-`itai/Outputs/`.

עקרונות מובנים: CRO (היררכיה→CTA), מובייל-פירסט, RTL, נגישות WCAG AA, ועיצוב
שמשרת את הקופי. קלט: בריף מ-`Briefs/` + מסמך הקופי מ-`shira/Outputs/`. שפת עיצוב
**לכל דף מחדש** (אין design-system קבוע). דורית מעבירה מפרט+נכסים לעומר.

**קבצים קשורים:** [[agent-dorit]], [[agent-shira]], [[shira-outputs]], [[skill-gpt-image-gen]], [[dir-briefs]], [[agent-omer]]
