import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const url = 'C:/Users/RONEN/Desktop/cloud ai/app/Briefs/haderech/ISHUR.pdf';
const doc = await getDocument({ url, useSystemFonts: true }).promise;
console.log('ISHUR numPages', doc.numPages);
let withText=0;
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  if (tc.items.length) { withText++; if(withText<=3){ console.log(`--page ${p}: ${tc.items.length} items`); console.log(tc.items.map(i=>i.str).join(' ').slice(0,300)); } }
}
console.log('pages with text layer:', withText, '/', doc.numPages);
