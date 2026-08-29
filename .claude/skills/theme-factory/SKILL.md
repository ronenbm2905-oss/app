---
name: theme-factory
description: Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact that has been creating, or can generate a new theme on-the-fly.
license: Complete terms in LICENSE.txt
---


# Theme Factory Skill

This skill provides a curated collection of professional font and color themes themes, each with carefully selected color palettes and font pairings. Once a theme is chosen, it can be applied to any artifact.

## Purpose

To apply consistent, professional styling to presentation slide decks, use this skill. Each theme includes:
- A cohesive color palette with hex codes
- Complementary font pairings for headers and body text
- A distinct visual identity suitable for different contexts and audiences

## Usage Instructions

To apply styling to a slide deck or other artifact:

1. **Show the theme showcase**: Display the `theme-showcase.pdf` file to allow users to see all available themes visually. Do not make any modifications to it; simply show the file for viewing.
2. **Ask for their choice**: Ask which theme to apply to the deck
3. **Wait for selection**: Get explicit confirmation about the chosen theme
4. **Apply the theme**: Once a theme has been chosen, apply the selected theme's colors and fonts to the deck/artifact

## Themes Available

The following 10 themes are available, each showcased in `theme-showcase.pdf`:

1. **Ocean Depths** - Professional and calming maritime theme
2. **Sunset Boulevard** - Warm and vibrant sunset colors
3. **Forest Canopy** - Natural and grounded earth tones
4. **Modern Minimalist** - Clean and contemporary grayscale
5. **Golden Hour** - Rich and warm autumnal palette
6. **Arctic Frost** - Cool and crisp winter-inspired theme
7. **Desert Rose** - Soft and sophisticated dusty tones
8. **Tech Innovation** - Bold and modern tech aesthetic
9. **Botanical Garden** - Fresh and organic garden colors
10. **Midnight Galaxy** - Dramatic and cosmic deep tones

## Theme Details

Each theme is defined in the `themes/` directory with complete specifications including:
- Cohesive color palette with hex codes
- Complementary font pairings for headers and body text
- Distinct visual identity suitable for different contexts and audiences

## Application Process

After a preferred theme is selected:
1. Read the corresponding theme file from the `themes/` directory
2. Apply the specified colors and fonts consistently throughout the deck
3. Ensure proper contrast and readability
4. Maintain the theme's visual identity across all slides

## Create your Own Theme
To handle cases where none of the existing themes work for an artifact, create a custom theme. Based on provided inputs, generate a new theme similar to the ones above. Give the theme a similar name describing what the font/color combinations represent. Use any basic description provided to choose appropriate colors/fonts. After generating the theme, show it for review and verification. Following that, apply the theme as described above.

---

## התאמות לפרויקט הזה (נספח מקומי — נוסף על ידי הצוות)

### הפונטים בערכות המקוריות אינם מיועדים לעברית

כל 10 הערכות ב-`themes/` משתמשות ב-DejaVu Sans/Serif או FreeSans/FreeSerif.
לשני אלה **יש** גליפים עבריים, ולכן טקסט עברי לא יישבר לריבועים — אבל הם
נראים גנריים וחלשים בעברית. **לפני שימוש בערכה, יש להחליף את הפונט:**

| שימוש | פונט מקורי | תחליף עברי |
|---|---|---|
| כותרות sans | DejaVu Sans Bold / FreeSans Bold | **Heebo** Bold, **Rubik** Bold, **Secular One** |
| גוף sans | DejaVu Sans / FreeSans | **Assistant**, **Heebo**, **Noto Sans Hebrew** |
| כותרות serif | DejaVu Serif Bold / FreeSerif Bold | **Frank Ruhl Libre** Bold, **David Libre** |

**פלטת הצבעים של הערכה נשארת כמו שהיא** — היא לא תלוית שפה. רק הטיפוגרפיה מוחלפת.

### בדיקת ניגודיות לפני החלה

הערכות לא נבדקו מול ת"י 5568 / WCAG AA. לפני החלה על תוצר שיוצא החוצה,
יש לוודא 4.5:1 לטקסט רגיל ו-3:1 לטקסט גדול. שים לב במיוחד ל-`Light Gray` על לבן
ולזוגות "אקסנט על רקע כהה" — הם נופלים בבדיקה לא פעם.

### תצוגת ה-showcase

`theme-showcase.pdf` מציג את הערכות ויזואלית. יש להציג אותו למשתמש לבחירה
לפני החלטה, כפי שהסקיל מנחה — אבל להסביר שהפונטים בו לטיניים ויוחלפו.

**מי משתמש בסקיל הזה:** ליאור (בחירת ערכה לפני בניית ה-pptx) ואיתי
(כשמבקשים כיוון ויזואלי מהיר מערכה מוכנה, במקום לבנות מפרט מאפס).
