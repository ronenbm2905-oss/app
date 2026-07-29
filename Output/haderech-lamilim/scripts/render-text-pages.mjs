import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import fs from 'fs';
const url = 'C:/Users/RONEN/Desktop/cloud ai/app/Briefs/haderech/klafim_text_bizua_shtanz.pdf';
const outDir = 'C:/Users/RONEN/AppData/Local/Temp/claude/C--Users-RONEN-Desktop-cloud-ai-app/0afb6088-e4f8-477d-8291-134eecc1dfb1/scratchpad/textpages';
fs.mkdirSync(outDir, { recursive: true });
const doc = await getDocument({ url, useSystemFonts: true }).promise;
const scale = 3;
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(vp.width, vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,vp.width,vp.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(`${outDir}/text-${String(p).padStart(2,'0')}.png`, buf);
}
console.log('rendered', doc.numPages, 'pages to', outDir);
