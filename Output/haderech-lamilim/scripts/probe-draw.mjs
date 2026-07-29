import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
const url = 'C:/Users/RONEN/Desktop/cloud ai/app/Briefs/haderech/klafim_drawings_bizua_shtanz.pdf';
const doc = await getDocument({ url, useSystemFonts: true }).promise;
console.log('drawings numPages', doc.numPages);
for (const p of [1,2,3,47,48]) {
  const page = await doc.getPage(p);
  const ol = await page.getOperatorList();
  const counts = {};
  for (const fn of ol.fnArray) counts[fn]=(counts[fn]||0)+1;
  const named = Object.entries(counts).map(([k,v])=>`${Object.keys(OPS).find(n=>OPS[n]==k)||k}:${v}`);
  const vp = page.getViewport({scale:1});
  console.log(`p${p} ${Math.round(vp.width)}x${Math.round(vp.height)}: ${named.join(', ')}`);
}
