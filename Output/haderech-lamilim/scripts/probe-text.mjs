import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const url = 'C:/Users/RONEN/Desktop/cloud ai/app/Briefs/haderech/klafim_text_bizua_shtanz.pdf';
const doc = await getDocument({ url, useSystemFonts: true }).promise;
console.log('numPages', doc.numPages);
for (let p = 1; p <= Math.min(3, doc.numPages); p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  console.log(`\n===== PAGE ${p} (${tc.items.length} items) =====`);
  let line = '';
  let lastY = null;
  for (const it of tc.items) {
    const y = it.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 3) { console.log(line); line=''; }
    line += it.str;
    lastY = y;
  }
  if (line) console.log(line);
}
