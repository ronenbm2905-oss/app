/**
 * עזר לטסטים: "האם כל טקסט עברי שמופיע על המסך הגיע מ-`i18n/he.ts`?"
 *
 * זו הבדיקה שאוכפת את כלל 8 (אין מחרוזות עברית מפוזרות ב-JSX). היא עובדת על
 * ה-HTML שהוחזר מ-`renderToStaticMarkup`: כל תג הופך למפריד, כל צומת טקסט נבדק
 * בנפרד, וכל רצף עברי חייב להימצא באחת המחרוזות של המילון.
 *
 * הקובץ הזה אינו טסט בעצמו (אין לו סיומת `.test.ts`) ואינו מיובא מקוד האפליקציה.
 */

import { he } from '../i18n/he';

type Dictionary = { readonly [key: string]: string | Dictionary };

const HEBREW = /[\u0590-\u05FF]/;

/** כל המחרוזות שבמילון, בתוספת מחרוזות שנוצרות בזמן ריצה (פרמטרים, נתוני מסד). */
export function dictionaryStrings(extra: string[] = []): string[] {
  const collected: string[] = [];

  const collect = (node: unknown) => {
    if (typeof node === 'string') collected.push(node);
    else if (node && typeof node === 'object') Object.values(node).forEach(collect);
  };

  collect(he as Dictionary);
  return [...collected, ...extra];
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

/** כל צמתי הטקסט ב-HTML שיש בהם עברית. */
export function hebrewTextNodes(html: string): string[] {
  const separator = String.fromCharCode(0); // מפריד שלא מופיע בטקסט אמיתי

  return html
    .replace(/<[^>]*>/g, separator)
    .split(separator)
    .map((node) => decodeEntities(node).trim())
    .filter((text) => text.length > 0 && HEBREW.test(text));
}

/**
 * המחרוזות העבריות שמופיעות ב-HTML ואינן ידועות.
 * תוצאה ריקה = כל הטקסט על המסך מגיע מהמילון.
 */
export function unknownHebrewText(html: string, known: string[]): string[] {
  return hebrewTextNodes(html).filter((text) => !known.some((value) => value.includes(text)));
}
