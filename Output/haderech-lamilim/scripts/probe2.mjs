import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const url = 'C:/Users/RONEN/Desktop/cloud ai/app/Briefs/haderech/klafim_text_bizua_shtanz.pdf';
const doc = await getDocument({ url, useSystemFonts: true }).promise;
console.log('numPages', doc.numPages);
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  if (tc.items.length) console.log(`page ${p}: ${tc.items.length} items | ${tc.items.slice(0,8).map(i=>i.str).join('|')}`);
}
