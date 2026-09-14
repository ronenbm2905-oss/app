/* ציור: קווי תנועה, שחקנים, רצועת ההערה, ומיקומים בזמן אנימציה. */
import { ST } from "./state.js";
import { BALL_OFF, attachOf, posOf, tok } from "./model.js";
import { P, drawCourt } from "./court.js";

/* ---------- ציור קווי תנועה ---------- */
export function movePts(step, id){
  const prev = ST.D.steps[step-1], nowS = ST.D.steps[step];
  if(!prev || !nowS) return null;
  const t = tok(id);
  if(t && t.type==="ball"){
    const h0 = attachOf(step-1, id), h1 = attachOf(step, id);
    if(h1 && h1===h0) return null;
  }
  const a = posOf(step-1, id), b = posOf(step, id);
  if(!a || !b) return null;
  const mv = nowS.moves[id];
  if(mv && mv.path && mv.path.length>1) return mv.path;
  if(Math.hypot(b.x-a.x, b.y-a.y) < 0.15) return null;
  return [a,b];
}

export function pathLen(pts){ let L=0; for(let i=1;i<pts.length;i++) L+=Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y); return L; }

export function pointAt(pts, f){
  const total = pathLen(pts); if(total===0) return pts[0];
  let d = f*total;
  for(let i=1;i<pts.length;i++){
    const seg = Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
    if(d<=seg || i===pts.length-1){
      const k = seg? d/seg : 1;
      return {x:pts[i-1].x+(pts[i].x-pts[i-1].x)*k, y:pts[i-1].y+(pts[i].y-pts[i-1].y)*k};
    }
    d-=seg;
  }
  return pts[pts.length-1];
}

export function drawMove(c,v,pts,style,color,upto){
  if(!pts||pts.length<2) return;
  let use = pts;
  if(upto!==undefined && upto<1){
    const total = pathLen(pts); let d = upto*total; use=[pts[0]];
    for(let i=1;i<pts.length;i++){
      const seg = Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
      if(d<=seg){ const k=seg?d/seg:0; use.push({x:pts[i-1].x+(pts[i].x-pts[i-1].x)*k, y:pts[i-1].y+(pts[i].y-pts[i-1].y)*k}); break; }
      use.push(pts[i]); d-=seg;
    }
  }
  if(use.length<2) return;
  c.save();
  c.strokeStyle = color; c.lineWidth = Math.max(2, v.S*0.075); c.lineCap="round"; c.lineJoin="round";
  if(style==="pass") c.setLineDash([v.S*0.35, v.S*0.3]);
  const draw = style==="dribble" ? wavy(use) : use;
  c.beginPath();
  draw.forEach((p,i)=>{ const q=P(p.x,p.y,v); i? c.lineTo(q.x,q.y) : c.moveTo(q.x,q.y); });
  c.stroke();
  c.setLineDash([]);
  const last = use[use.length-1], prev = use[use.length-2];
  const ang = Math.atan2(last.y-prev.y, last.x-prev.x);
  if(style==="screen") bar(c,v,last,ang,color);
  else if(style==="handoff"){ bar(c,v,last,ang,color); ballMark(c,v,last,ang); }
  else head(c,v,last,ang,color);
  c.restore();
}

export function wavy(pts){
  const out=[]; const amp=0.16, per=0.55; let acc=0;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1], b=pts[i];
    const seg=Math.hypot(b.x-a.x,b.y-a.y); if(seg===0) continue;
    const ux=(b.x-a.x)/seg, uy=(b.y-a.y)/seg, nx=-uy, ny=ux;
    const n=Math.max(2, Math.ceil(seg/0.08));
    for(let k=0;k<=n;k++){
      const d=seg*k/n, t=acc+d, o=Math.sin(t/per*Math.PI*2)*amp;
      out.push({x:a.x+ux*d+nx*o, y:a.y+uy*d+ny*o});
    }
    acc+=seg;
  }
  return out.length?out:pts;
}

export function head(c,v,p,ang,color){
  const L=0.42, W=0.26;
  const t=P(p.x,p.y,v);
  const b1=P(p.x-Math.cos(ang)*L-Math.sin(ang)*-W, p.y-Math.sin(ang)*L-Math.cos(ang)*W, v);
  const b2=P(p.x-Math.cos(ang)*L+Math.sin(ang)*-W, p.y-Math.sin(ang)*L+Math.cos(ang)*W, v);
  c.fillStyle=color; c.beginPath(); c.moveTo(t.x,t.y); c.lineTo(b1.x,b1.y); c.lineTo(b2.x,b2.y); c.closePath(); c.fill();
}

/* הכדור הקטן שמסמן מסירה מיד ליד — צורה ולא רק צבע, כדי שההבחנה לא תלויה בראיית צבע */
export function ballMark(c,v,p,ang){
  const back = 0.34, q = P(p.x - Math.cos(ang)*back, p.y - Math.sin(ang)*back, v);
  const r = Math.max(3, v.S*0.19);
  c.save();
  c.fillStyle = "#F08A24"; c.strokeStyle = "rgba(18,22,27,.8)"; c.lineWidth = Math.max(1, v.S*0.035);
  c.beginPath(); c.arc(q.x, q.y, r, 0, Math.PI*2); c.fill(); c.stroke();
  c.restore();
}
export function bar(c,v,p,ang,color){
  const W=0.5, nx=-Math.sin(ang), ny=Math.cos(ang);
  const a=P(p.x+nx*W,p.y+ny*W,v), b=P(p.x-nx*W,p.y-ny*W,v);
  c.strokeStyle=color; c.lineWidth=Math.max(3, v.S*0.13); c.lineCap="round";
  c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(b.x,b.y); c.stroke();
}

/* ---------- ציור הערת השלב ---------- */
export function noteText(o){
  if(o && o.playing){
    const i = o.t<=0 ? o.seg : Math.min(o.seg+1, ST.D.steps.length-1);
    return (ST.D.steps[i]||{}).note || "";
  }
  return (ST.D.steps[ST.cur]||{}).note || "";
}

export function roundRect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y);
  c.closePath();
}

export function drawNote(c,v,text){
  if(!v.band) return;
  const y0 = v.h - v.band, pad = 8;
  c.save();
  c.fillStyle="#1B2129"; c.strokeStyle="#333E4B"; c.lineWidth=1;
  roundRect(c, 2, y0+2, v.w-4, v.band-6, Math.min(10, v.band*0.28));
  c.fill(); c.stroke();
  if(text){
    c.direction="rtl"; c.textAlign="center"; c.textBaseline="middle";
    c.fillStyle="#F2EFE6";
    const maxW = v.w - pad*2;
    let size = Math.max(11, Math.round(v.band*0.42));
    const setF = ()=> c.font = "500 "+size+"px Rubik, sans-serif";
    setF();
    while(size>9 && c.measureText(text).width > maxW){ size--; setF(); }
    let t = text;
    if(c.measureText(t).width > maxW){
      while(t.length>1 && c.measureText(t+"…").width > maxW) t = t.slice(0,-1);
      t += "…";
    }
    c.fillText(t, v.w/2, y0 + (v.band-4)/2);
  }
  c.restore();
}

/* ---------- ציור שחקנים ---------- */
export const R = 0.66;

export function tokColor(t){ return t.type==="off"?"#2166D8" : t.type==="def"?"#D93A2B" : t.type==="ball"?"#F08A24" : "#F2EFE6"; }

export function drawToken(c,v,t,p,isSel){
  const q=P(p.x,p.y,v);
  const r = (t.type==="ball"? R*0.5 : t.type==="cone"? R*0.5 :
             (t.type==="screen" || t.type==="handoff") ? R*1.1 : R)*v.S;
  c.save();
  if(t.type==="cone"){
    c.fillStyle="#F0D08A";
    c.beginPath(); c.moveTo(q.x,q.y-r); c.lineTo(q.x+r,q.y+r*0.8); c.lineTo(q.x-r,q.y+r*0.8); c.closePath(); c.fill();
  } else if(t.type==="handoff"){
    const a = t.angle||0, L=0.78;
    const p1=P(p.x+Math.cos(a)*L, p.y+Math.sin(a)*L, v);
    const p2=P(p.x-Math.cos(a)*L, p.y-Math.sin(a)*L, v);
    c.lineCap="round";
    c.strokeStyle="rgba(18,22,27,.5)"; c.lineWidth=Math.max(5,v.S*0.24);
    c.beginPath(); c.moveTo(p1.x,p1.y); c.lineTo(p2.x,p2.y); c.stroke();
    c.strokeStyle="#F08A24"; c.lineWidth=Math.max(3,v.S*0.15);   // צבע הכדור: כאן הוא מחליף ידיים
    c.beginPath(); c.moveTo(p1.x,p1.y); c.lineTo(p2.x,p2.y); c.stroke();
    const br = Math.max(3, v.S*0.2);                              // והכדור עצמו במרכז
    c.fillStyle="#F08A24"; c.strokeStyle="#F2EFE6"; c.lineWidth=Math.max(1.5, v.S*0.05);
    c.beginPath(); c.arc(q.x,q.y,br,0,Math.PI*2); c.fill(); c.stroke();
  } else if(t.type==="screen"){
    const a = t.angle||0, L=0.78;
    const p1=P(p.x+Math.cos(a)*L, p.y+Math.sin(a)*L, v);
    const p2=P(p.x-Math.cos(a)*L, p.y-Math.sin(a)*L, v);
    const s2=P(p.x-Math.sin(a)*0.5, p.y+Math.cos(a)*0.5, v);
    c.lineCap="round";
    c.strokeStyle="rgba(18,22,27,.5)"; c.lineWidth=Math.max(5,v.S*0.24);
    c.beginPath(); c.moveTo(p1.x,p1.y); c.lineTo(p2.x,p2.y); c.stroke();
    c.strokeStyle="#F2EFE6"; c.lineWidth=Math.max(3,v.S*0.15);
    c.beginPath(); c.moveTo(p1.x,p1.y); c.lineTo(p2.x,p2.y); c.stroke();
    c.beginPath(); c.moveTo(q.x,q.y); c.lineTo(s2.x,s2.y); c.stroke();
  } else {
    c.beginPath(); c.arc(q.x,q.y,r,0,Math.PI*2);
    c.fillStyle = tokColor(t); c.fill();
    c.lineWidth = Math.max(1.5, v.S*0.05); c.strokeStyle = "rgba(255,255,255,.9)"; c.stroke();
    if(t.type==="ball"){
      c.strokeStyle="rgba(30,15,0,.7)"; c.lineWidth=Math.max(1,v.S*0.03);
      c.beginPath(); c.moveTo(q.x-r,q.y); c.lineTo(q.x+r,q.y); c.stroke();
      c.beginPath(); c.arc(q.x,q.y-r*0.9,r*1.25,0.5,Math.PI-0.5); c.stroke();
    } else {
      c.fillStyle="#fff"; c.textAlign="center"; c.textBaseline="middle";
      c.font = "700 "+Math.round(r*1.05)+"px Rubik, sans-serif";
      c.fillText((t.type==="def"?"X":"")+t.label, q.x, q.y+r*0.06);
    }
  }
  if(isSel){
    c.strokeStyle="#F08A24"; c.lineWidth=Math.max(2,v.S*0.06); c.setLineDash([v.S*0.18,v.S*0.14]);
    c.beginPath(); c.arc(q.x,q.y,r*1.6,0,Math.PI*2); c.stroke(); c.setLineDash([]);
  }
  c.restore();
}

/* ---------- רינדור ---------- */
export function animPos(seg, f, e, id){
  const from = posOf(seg, id), to = posOf(seg+1, id);
  if(!from) return to;
  if(!to || f<=0) return from;
  const pts = movePts(seg+1, id);
  return pts ? pointAt(pts, e) : {x:from.x+(to.x-from.x)*e, y:from.y+(to.y-from.y)*e};
}

export function positionsAt(seg, f){
  const res = {}, e = ease(f);
  ST.D.tokens.forEach(t=>{ if(t.type!=="ball"){ const p=animPos(seg,f,e,t.id); if(p) res[t.id]=p; } });
  ST.D.tokens.forEach(t=>{
    if(t.type!=="ball") return;
    const h0 = attachOf(seg, t.id), h1 = attachOf(seg+1, t.id);
    if(h1 && res[h1]){
      const to = {x:res[h1].x+BALL_OFF.x, y:res[h1].y+BALL_OFF.y};
      if(h1===h0){ res[t.id]=to; return; }
      const from = posOf(seg, t.id);
      res[t.id] = from ? {x:from.x+(to.x-from.x)*e, y:from.y+(to.y-from.y)*e} : to;
      return;
    }
    const p = animPos(seg,f,e,t.id); if(p) res[t.id]=p;
  });
  return res;
}

export function ease(t){ return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }

export function render(c,v,opts){
  c.clearRect(0,0,v.w,v.h);
  c.fillStyle="#12161B"; c.fillRect(0,0,v.w,v.h);   // בלי זה הייצוא יוצא עם רקע שקוף
  drawCourt(c,v);
  const o = opts||{};
  if(o.playing){
    const pos = positionsAt(o.seg, o.t);
    ST.D.tokens.forEach(t=>{
      const pts = movePts(o.seg+1, t.id);
      if(pts) drawMove(c,v,pts, (ST.D.steps[o.seg+1].moves[t.id]||{}).style||defStyle(t), tokColor(t), o.t);
    });
    ST.D.tokens.forEach(t=>{ if(pos[t.id]) drawToken(c,v,t,pos[t.id],false); });
  } else {
    ST.D.tokens.forEach(t=>{
      const pts = movePts(ST.cur, t.id);
      if(pts) drawMove(c,v,pts, (ST.D.steps[ST.cur].moves[t.id]||{}).style||defStyle(t), tokColor(t), 1);
    });
    if(ST.drawing && ST.drawing.pts.length>1){
      drawMove(c,v,ST.drawing.pts, ST.drawing.style, "#F08A24", 1);
    }
    ST.D.tokens.forEach(t=>{
      const p = posOf(ST.cur, t.id);
      if(p) drawToken(c,v,t,p, !o.clean && ST.sel===t.id);
    });
  }
  drawNote(c,v,noteText(o));
}

export function defStyle(t){ return t.type==="ball" ? "pass" : "cut"; }
