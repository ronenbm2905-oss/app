import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const url = 'C:/Users/RONEN/Desktop/cloud ai/app/Briefs/haderech/ISHUR.pdf';
const doc = await getDocument({ url, useSystemFonts: true }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  if (!tc.items.length) { console.log(`\n########## PAGE ${p} (no text) ##########`); continue; }
  console.log(`\n########## PAGE ${p} ##########`);
  let line=''; let lastY=null;
  for (const it of tc.items){ const y=it.transform[5]; if(lastY!==null&&Math.abs(y-lastY)>4){console.log(line);line='';} line+=it.str; lastY=y; }
  if(line)console.log(line);
}
