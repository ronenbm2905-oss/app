/* גיאומטריה של המגרש. כאן ורק כאן ממירים מטרים לפיקסלים. */
import { ST } from "./state.js";
import { CW, FULL, HALF, courtH } from "./model.js";

export function P(x,y,v){ v=v||ST.V; return v.rot ? {x:v.padX+y*v.S, y:v.padY+(CW-x)*v.S} : {x:v.padX+x*v.S, y:v.padY+y*v.S}; }

export function unP(px,py){
  if(ST.V.rot) return {x:CW-(py-ST.V.padY)/ST.V.S, y:(px-ST.V.padX)/ST.V.S};
  return {x:(px-ST.V.padX)/ST.V.S, y:(py-ST.V.padY)/ST.V.S};
}

export function A(th,v){ return (v||ST.V).rot ? th - Math.PI/2 : th; }

/* ---------- ציור המגרש ---------- */
export function drawCourt(c,v){
  const H = courtH();
  const a = P(0,0,v), b = P(CW,H,v);
  c.save();
  c.fillStyle = "#DDB07A";
  const x0=Math.min(a.x,b.x), y0=Math.min(a.y,b.y);
  c.fillRect(x0, y0, Math.abs(b.x-a.x), Math.abs(b.y-a.y));
  c.strokeStyle = "rgba(255,255,255,.92)";
  c.lineWidth = Math.max(1.5, v.S*0.045);
  c.lineJoin="round"; c.lineCap="round";
  c.strokeRect(x0, y0, Math.abs(b.x-a.x), Math.abs(b.y-a.y));
  marks(c,v,0,1);
  if(ST.D.court==="full"){
    marks(c,v,FULL,-1);
    line(c,v,0,FULL/2,CW,FULL/2);
    circle(c,v,CW/2,FULL/2,1.8);
  } else {
    circle(c,v,CW/2,HALF,1.8,Math.PI,0,false,1);
  }
  c.restore();
}

export function line(c,v,x1,y1,x2,y2){
  const p=P(x1,y1,v), q=P(x2,y2,v);
  c.beginPath(); c.moveTo(p.x,p.y); c.lineTo(q.x,q.y); c.stroke();
}

export function circle(c,v,x,y,r,a1,a2,ccw,s){
  const p=P(x,y,v); s = s||1;
  if(a1===undefined){ a1=0; a2=Math.PI*2; ccw=false; }
  let s1 = s>0? a1 : -a1, s2 = s>0? a2 : -a2, cc = s>0? !!ccw : !ccw;
  c.beginPath(); c.arc(p.x,p.y,r*v.S, A(s1,v), A(s2,v), cc); c.stroke();
}

export function marks(c,v,base,s){
  const fy = y => base + s*y;
  const bx = CW/2, byB = 1.575;
  // רחבה
  const px1 = CW/2-2.45, px2 = CW/2+2.45;
  line(c,v,px1,fy(0),px1,fy(5.8));
  line(c,v,px2,fy(0),px2,fy(5.8));
  line(c,v,px1,fy(5.8),px2,fy(5.8));
  // עיגול עונשין
  circle(c,v,bx,fy(5.8),1.8,0,Math.PI*2,false,s);
  // קווי 3
  line(c,v,0.9,fy(0),0.9,fy(2.99));
  line(c,v,CW-0.9,fy(0),CW-0.9,fy(2.99));
  const a1 = Math.atan2(1.415,-6.6), a2 = Math.atan2(1.415,6.6);
  circle(c,v,bx,fy(byB),6.75,a1,a2,true,s);
  // אזור חצי עיגול מתחת לסל
  circle(c,v,bx,fy(byB),1.25,Math.PI,0,true,s);
  // לוח וטבעת
  line(c,v,bx-0.9,fy(1.2),bx+0.9,fy(1.2));
  c.save(); c.lineWidth = Math.max(1.2,v.S*0.035);
  circle(c,v,bx,fy(byB),0.225,0,Math.PI*2,false,s);
  c.restore();
}
