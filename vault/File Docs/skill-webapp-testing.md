# skill-webapp-testing

**קובץ:** `.claude/skills/webapp-testing/SKILL.md`
**משויך ל:** נועם (מפתח האפליקציות).
**מקור:** [anthropics/skills](https://github.com/anthropics/skills), Apache 2.0.

בדיקת אפליקציות ווב מקומיות דרך Playwright: לחיצות, אימות פונקציונליות, צילומי
מסך וקריאת קונסול. `scripts/with_server.py` מנהל את מחזור החיים של השרת;
`examples/` מכיל דפוסי console-logging, גילוי אלמנטים ואוטומציה של HTML סטטי.
זה כלי ה-QA האמיתי של נועם — `npm run build` לבדו אינו QA.

**נספח מקומי:** Chromium **כבר מותקן** (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)
ואין להריץ `playwright install`. רשימת בדיקות החובה שלנו: RTL בלי גלישה אופקית,
viewport מובייל 390×844, קונסול נקי, ו-`onSnapshot` שלא נרשם לפני login.

**החליף** את ההפניה לסקיל `verify` ב-`noam.md`, שלא היה קיים בפרויקט.

**קבצים קשורים:** [[agent-noam]], [[skill-firebase-app]]
