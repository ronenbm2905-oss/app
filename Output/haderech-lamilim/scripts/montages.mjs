import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import fs from 'fs';
const SP=process.argv[2];
const cardsDir='C:/Users/RONEN/Desktop/cloud ai/app/Output/haderech-lamilim/public/cards';

// 1) drawings montage: 4 cols x 6 rows, cell 230x300, labeled
{
  const cols=4,rows=6,cw=230,ch=300,pad=8,lbl=22;
  const W=cols*(cw+pad)+pad, H=rows*(ch+lbl+pad)+pad;
  const canvas=createCanvas(W,H);const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  const comps=[];
  for(let i=0;i<24;i++){
    const id=String(i+1).padStart(2,'0');
    const buf=await sharp(`${cardsDir}/card-${id}.jpg`).resize(cw,ch,{fit:'cover'}).png().toBuffer();
    const col=i%cols,row=(i/cols)|0;
    const x=pad+col*(cw+pad), y=pad+row*(ch+lbl+pad);
    comps.push({input:buf,left:x,top:y+lbl});
    ctx.fillStyle='#000';ctx.font='bold 18px sans-serif';ctx.fillText('#'+(i+1),x+4,y+16);
  }
  // draw labels onto base via canvas, then composite images with sharp
  const base=canvas.toBuffer('image/png');
  await sharp(base).composite(comps).png().toFile(SP+'/all-drawings.png');
  console.log('wrote all-drawings.png',W,'x',H);
}

// 2) text sentence montages from odd text-PDF pages, 6 per montage (2col x 3row)
{
  const url='C:/Users/RONEN/Desktop/cloud ai/app/Briefs/haderech/klafim_text_bizua_shtanz.pdf';
  const doc=await getDocument({url,useSystemFonts:true}).promise;
  const pageBufs=[];
  for(let p=1;p<=48;p+=2){
    const page=await doc.getPage(p);
    const vp=page.getViewport({scale:2});
    const c=createCanvas(vp.width,vp.height);const ctx=c.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,vp.width,vp.height);
    await page.render({canvasContext:ctx,viewport:vp}).promise;
    pageBufs.push(c.toBuffer('image/png'));
  }
  const cols=3,rows=2,cw=300,ch=430,pad=10,lbl=24;
  for(let m=0;m<4;m++){
    const W=cols*(cw+pad)+pad,H=rows*(ch+lbl+pad)+pad;
    const canvas=createCanvas(W,H);const ctx=canvas.getContext('2d');
    ctx.fillStyle='#eee';ctx.fillRect(0,0,W,H);
    const comps=[];
    for(let k=0;k<6;k++){
      const idx=m*6+k;const buf=await sharp(pageBufs[idx]).resize(cw,ch,{fit:'contain',background:'#fff'}).png().toBuffer();
      const col=k%cols,row=(k/cols)|0;const x=pad+col*(cw+pad),y=pad+row*(ch+lbl+pad);
      comps.push({input:buf,left:x,top:y+lbl});
      ctx.fillStyle='#c00';ctx.font='bold 20px sans-serif';ctx.fillText('#'+(idx+1),x+4,y+18);
    }
    await sharp(canvas.toBuffer('image/png')).composite(comps).png().toFile(`${SP}/text-montage-${m+1}.png`);
    console.log('wrote text-montage-'+(m+1)+'.png');
  }
}
