/**
 * רנדרר Markdown → JSX, מינימלי ובטוח.
 *
 * ## למה הוא קיים, ומה הוא לא
 *
 * המסמכים המשפטיים נכתבים בידי עדי כקבצי `.md` ונטענים כאן דרך `?raw` של Vite.
 * תפקידו היחיד של הקובץ הזה הוא **להציג את הניסוח שלה נאמנה** — לא לפרש אותו,
 * לא לנקות אותו ולא "לשפר" אותו. בפרט:
 *
 * • `[[placeholders]]` ו-⚖️ עוברים כטקסט רגיל ונשארים גלויים על המסך. זו תכונה:
 *   מסמך שלא מולא עד הסוף חייב להיראות ככזה, ולא להיראות מוגמר.
 * • אין `dangerouslySetInnerHTML` ואין ספריית Markdown חיצונית (CLAUDE.md:
 *   "אין להוסיף ספריות חדשות בלי לשאול"). כל פלט הוא צמתי React, ולכן HTML
 *   שיודבק לתוך מסמך יוצג כטקסט ולא ירוץ.
 *
 * נתמכת בכוונה רק תת-הקבוצה שמופיעה במסמכים האלה: כותרות (`#`, `##`), הדגשה
 * (`**`), נטוי (`*`), קוד (`` ` ``), קישורים, רשימות (`- `), ציטוט (`> `) וקו (`---`).
 * תחביר שאינו נתמך פשוט יוצג כפי שהוא — נאמנות לטקסט עדיפה על יופי.
 *
 * ⚠️ **חריגה מודעת מכלל 8** (אין עברית מחוץ ל-`i18n/he.ts`): תוכן המסמכים
 * המשפטיים אינו ממשק אלא מסמך, הוא חייב להישאר בדיוק כפי שנוסח, והוא מתעדכן
 * בקובץ `.md` בלי לגעת בקוד. אותה הכרעה כמו ב-basketball-scheduler.
 */

import type { ReactNode } from 'react';

let keySeq = 0;
const nextKey = () => `md-${(keySeq += 1)}`;

/* ------------------------------------------------------------------ */
/* עיצוב בתוך שורה                                                     */
/* ------------------------------------------------------------------ */

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*]+\*)/g;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];

    if (token.startsWith('`')) {
      out.push(
        <code
          key={nextKey()}
          dir="ltr"
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-700"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      out.push(
        <strong key={nextKey()} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith('[')) {
      // קישור פנימי בין מסמכים מוצג כטקסט מודגש: הניווט הוא דרך הקישורים
      // באפליקציה, לא דרך נתיבי קבצים. קישור חיצוני יופיע בטקסט המלא בשורה הבאה.
      const parsed = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      out.push(
        <span key={nextKey()} className="text-slate-900 underline underline-offset-2">
          {parsed ? parsed[1] : token}
        </span>,
      );
    } else {
      out.push(<em key={nextKey()}>{token.slice(1, -1)}</em>);
    }

    last = match.index + token.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ------------------------------------------------------------------ */
/* בלוקים                                                              */
/* ------------------------------------------------------------------ */

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (line.trim() === '---') {
      blocks.push(<hr key={nextKey()} className="my-4 border-slate-200" />);
      i += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={nextKey()} className="mt-5 mb-1.5 text-base font-bold text-slate-900">
          {renderInline(line.slice(3))}
        </h3>,
      );
      i += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push(
        <h2 key={nextKey()} className="mb-2 text-lg font-bold text-slate-900">
          {renderInline(line.slice(2))}
        </h2>,
      );
      i += 1;
      continue;
    }

    // ציטוט: שורות '>' רצופות מתאחדות להערה אחת.
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={nextKey()}
          className="my-3 rounded-lg border-e-4 border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-slate-700"
        >
          {renderInline(quote.join(' '))}
        </blockquote>,
      );
      continue;
    }

    // רשימה: שורות '- ' רצופות.
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={nextKey()} className="my-2 list-disc space-y-1 pe-5 text-sm leading-relaxed text-slate-700">
          {items.map((item) => (
            <li key={nextKey()}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // פסקה: שורות רגילות רצופות.
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      lines[i].trim() !== '---' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('- ')
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={nextKey()} className="my-2 text-sm leading-relaxed text-slate-700">
        {renderInline(paragraph.join(' '))}
      </p>,
    );
  }

  return <div>{blocks}</div>;
}
