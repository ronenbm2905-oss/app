import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
const SP=process.argv[2];
const url='C:/Users/RONEN/Desktop/cloud ai/app/Briefs/haderech/klafim_drawings_bizua_shtanz.pdf';
const doc=await getDocument({url,useSystemFonts:true}).promise;
const page=await doc.getPage(1);
const ol=await page.getOperatorList();
const idx=ol.fnArray.indexOf(OPS.paintImageXObject);
const name=ol.argsArray[idx][0];
const img=await new Promise((res)=>page.objs.get(name,res));
console.log('img',{w:img.width,h:img.height,kind:img.kind,dataLen:img.data?.length});
// kind: 1 GRAY,2 RGB,3 RGBA. build png via sharp
let channels, buf=Buffer.from(img.data);
if(img.kind===3){channels=4;} else if(img.kind===2){channels=3;} else {channels=1;}
// pdfjs RGB_24BPP sometimes returns data with rowbytes padding; assume tight
await sharp(buf,{raw:{width:img.width,height:img.height,channels}}).png().toFile(SP+'/img-p1.png');
console.log('saved img-p1.png channels',channels);
