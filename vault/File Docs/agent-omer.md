# agent-omer

**קובץ:** `.claude/agents/omer.md`
**משויך ל:** עומר — המפתח. **מוגדר** (לא עוד שלד).

ה"דבק" של הצוות: מרכיב **דף נחיתה עצמאי** (**HTML/CSS/JS**, בלי build/תלויות/CDN)
משני קלטים — מסמך הקופי מ-`shira/Outputs/` ומפרט העיצוב + הנכסים מ-`itai/Outputs/`.
מתרגם design tokens ל-CSS variables, מטמיע קופי, מעתיק נכסים פנימה.

מובנה: מובייל-פירסט + RTL (`dir=rtl`/CSS לוגי), SEO טכני (title/meta/OG/favicon),
נגישות, ביצועים (lazy-load/critical CSS), ו-**hooks למעקב של טל** (`data-cta`,
`data-event`, placeholder אנליטיקס). מבצע QA עצמי (רינדור/קונסול/breakpoints/CTA).

פלט: `Output/<date>-<slug>/index.html` + `assets/`, מוכן לפריסה. דורית מעבירה
לטל אם נדרש פרסום.

**קבצים קשורים:** [[agent-dorit]], [[agent-shira]], [[shira-outputs]], [[agent-itai]], [[dir-output]], [[agent-tal]]
