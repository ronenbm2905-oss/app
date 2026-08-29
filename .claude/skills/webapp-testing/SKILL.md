---
name: webapp-testing
description: Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.
license: Complete terms in LICENSE.txt
---

# Web Application Testing

To test local web applications, write native Python Playwright scripts.

**Helper Scripts Available**:
- `scripts/with_server.py` - Manages server lifecycle (supports multiple servers)

**Always run scripts with `--help` first** to see usage. DO NOT read the source until you try running the script first and find that a customized solution is abslutely necessary. These scripts can be very large and thus pollute your context window. They exist to be called directly as black-box scripts rather than ingested into your context window.

## Decision Tree: Choosing Your Approach

```
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         ├─ Success → Write Playwright script using selectors
    │         └─ Fails/Incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No → Run: python scripts/with_server.py --help
        │        Then use the helper + write simplified Playwright script
        │
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and wait for networkidle
            2. Take screenshot or inspect DOM
            3. Identify selectors from rendered state
            4. Execute actions with discovered selectors
```

## Example: Using with_server.py

To start a server, run `--help` first, then use the helper:

**Single server:**
```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py
```

**Multiple servers (e.g., backend + frontend):**
```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_automation.py
```

To create an automation script, include only Playwright logic (servers are managed automatically):
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True) # Always launch chromium in headless mode
    page = browser.new_page()
    page.goto('http://localhost:5173') # Server already running and ready
    page.wait_for_load_state('networkidle') # CRITICAL: Wait for JS to execute
    # ... your automation logic
    browser.close()
```

## Reconnaissance-Then-Action Pattern

1. **Inspect rendered DOM**:
   ```python
   page.screenshot(path='/tmp/inspect.png', full_page=True)
   content = page.content()
   page.locator('button').all()
   ```

2. **Identify selectors** from inspection results

3. **Execute actions** using discovered selectors

## Common Pitfall

❌ **Don't** inspect the DOM before waiting for `networkidle` on dynamic apps
✅ **Do** wait for `page.wait_for_load_state('networkidle')` before inspection

## Best Practices

- **Use bundled scripts as black boxes** - To accomplish a task, consider whether one of the scripts available in `scripts/` can help. These scripts handle common, complex workflows reliably without cluttering the context window. Use `--help` to see usage, then invoke directly. 
- Use `sync_playwright()` for synchronous scripts
- Always close the browser when done
- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs
- Add appropriate waits: `page.wait_for_selector()` or `page.wait_for_timeout()`

## Reference Files

- **examples/** - Examples showing common patterns:
  - `element_discovery.py` - Discovering buttons, links, and inputs on a page
  - `static_html_automation.py` - Using file:// URLs for local HTML
  - `console_logging.py` - Capturing console logs during automation
---

## התאמות לפרויקט הזה (נספח מקומי — נוסף על ידי הצוות)

### הרצה בסביבה שלנו — המתכון המדויק (נבדק ועובד)

שני דברים נדרשים, ושניהם לא ברורים מאליהם:

**1. חבילת ה-Python של Playwright אינה מותקנת מראש.** יש להתקין פעם אחת לסשן:

```bash
pip install playwright
```

**2. חובה להעביר `executable_path` במפורש.** הדפדפן כבר מותקן
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`),
אבל **גרסת ה-pip חדשה מהדפדפן המצורף** — היא מחפשת build שלא קיים ונופלת עם
"Executable doesn't exist" והצעה להריץ `playwright install`.

**אל תריץ `playwright install`.** זו הורדה של מאות MB שכבר יש. במקום זה:

```python
b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
```

(`/opt/pw-browsers/chromium` הוא symlink ל-build המצורף. ב-JS: `executablePath`.)
**כל סקריפט חייב את הפרמטר הזה** — בלעדיו הוא נופל, גם אם הכול אחר תקין.
הדוגמאות ב-`examples/` **אינן** כוללות אותו — יש להוסיף אותו בעת ההעתקה.

### מה בודקים באפליקציות שלנו

מעבר לבדיקות הפונקציונליות שהסקיל מתאר, לפני מסירה נדרש לוודא:

- **RTL.** האפליקציה נטענת עם `dir="rtl"`, ואין גלישה אופקית (`document.body.scrollWidth`
  לא גדול מ-`window.innerWidth`) — לא במובייל ולא בדסקטופ.
- **מובייל.** צילום מסך ב-viewport של 390×844 (iPhone) בנוסף לדסקטופ.
- **קונסולת שגיאות נקייה.** `examples/console_logging.py` — כל `console.error` נחשב כשל.
  שגיאת Firebase config בסביבה מקומית היא חריג צפוי (יש fallback ל-localStorage).
- **מסלול ההתחברות.** באפליקציות עם Auth — לוודא שמסך הכניסה נטען ושה-`onSnapshot`
  לא נרשם לפני login (זו התקלה החוזרת שמתועדת ב-vault).

### הרצה

```bash
python .claude/skills/webapp-testing/scripts/with_server.py --help
```

**מי משתמש בסקיל הזה:** נועם, כשלב QE לפני מסירת אפליקציה — לא במקום ה-QA העצמי
שבהגדרה שלו אלא בנוסף לו, כאימות חי בדפדפן.
