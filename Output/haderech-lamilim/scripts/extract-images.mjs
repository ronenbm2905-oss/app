import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import fs from 'fs';
const url='C:/Users/RONEN/Desktop/cloud ai/app/Briefs/haderech/klafim_drawings_bizua_shtanz.pdf';
const outDir='C:/Users/RONEN/Desktop/cloud ai/app/Output/haderech-lamilim/public/cards';
fs.mkdirSync(outDir,{recursive:true});
const doc=await getDocument({url,useSystemFonts:true}).promise;
let n=0;
for(let p=1;p<=doc.numPages;p+=2){
  n++;
  const page=await doc.getPage(p);
  const ol=await page.getOperatorList();
  const idx=ol.fnArray.indexOf(OPS.paintImageXObject);
  if(idx<0){console.log('NO IMAGE on page',p);continue;}
  const name=ol.argsArray[idx][0];
  const img=await new Promise(res=>page.objs.get(name,res));
  const ch=img.kind===3?4:img.kind===2?3:1;
  const id=String(n).padStart(2,'0');
  await sharp(Buffer.from(img.data),{raw:{width:img.width,height:img.height,channels:ch}})
    .flatten({background:'#ffffff'}).jpeg({quality:82,mozjpeg:true})
    .toFile(`${outDir}/card-${id}.jpg`);
  process.stdout.write(`${id}(${img.width}x${img.height}) `);
}
console.log('\nextracted',n,'card images');
