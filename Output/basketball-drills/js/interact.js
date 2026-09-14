/* מגע ועכבר על הקנבס: גרירה, ציור מסלול, בחירה. */
import { ST } from "./state.js";
import { CW, attachOf, courtH, editablePath, nearestHolder, posOf, setAttach, tok } from "./model.js";
import { unP } from "./court.js";
import { HANDLE_HIT, R, defStyle } from "./render.js";
import { cv, draw, renderSteps, snapshot, stopPlay, syncSel, toast } from "./ui.js";

cv.addEventListener("pointerdown", e=>{
  if(ST.play.on) stopPlay();
  cv.setPointerCapture(e.pointerId);
  const r = cv.getBoundingClientRect();
  const p = unP(e.clientX-r.left, e.clientY-r.top);
  if(ST.mode==="path" && ST.sel){
    const s = posOf(ST.cur, ST.sel);
    if(!s) return;
    ST.drawing = {pts:[{x:s.x,y:s.y},p], style:(ST.D.steps[ST.cur].moves[ST.sel]||{}).style || defStyle(tok(ST.sel))};
    draw(); return;
  }
  const hi = hitHandle(p, editablePath());      // ידית קודמת לשחקן — היא מצוירת מעליו
  if(hi > 0){ ST.drag = {handle:hi}; draw(); return; }
  const hit = hitTest(p);
  if(hit){ ST.sel = hit; ST.drag = {id:hit}; syncSel(); draw(); }
  else { ST.sel=null; syncSel(); draw(); }
});

cv.addEventListener("pointermove", e=>{
  if(!ST.drag && !ST.drawing) return;
  const r = cv.getBoundingClientRect();
  const p = unP(e.clientX-r.left, e.clientY-r.top);
  const H = courtH();
  p.x = Math.max(-0.4, Math.min(CW+0.4, p.x)); p.y = Math.max(-0.4, Math.min(H+0.4, p.y));
  if(ST.drawing){ ST.drawing.pts.push(p); draw(); return; }
  if(!ST.drag.moved){ ST.drag.moved=true; snapshot(); }
  if(ST.drag.handle != null){                   // גרירת נקודת ביניים במסלול
    const path = editablePath();
    if(path) path[ST.drag.handle] = p;
    draw(); return;
  }
  if(tok(ST.drag.id).type==="ball") setAttach(ST.cur, ST.drag.id, null);
  ST.D.steps[ST.cur].pos[ST.drag.id] = p;
  const mv = ST.D.steps[ST.cur].moves[ST.drag.id];
  /* פעם המסלול נמחק כאן. עכשיו הזנב נגרר עם השחקן — למחיקה יש כפתור משלה. */
  if(mv && mv.path && mv.path.length > 1) mv.path[mv.path.length-1] = {x:p.x, y:p.y};
  draw();
});

cv.addEventListener("pointerup", ()=>{
  if(ST.drawing){
    if(ST.drawing.pts.length>2 && ST.cur>0){
      snapshot();                       // רק כאן המודל באמת משתנה
      const end = ST.drawing.pts[ST.drawing.pts.length-1];
      ST.D.steps[ST.cur].moves[ST.sel] = ST.D.steps[ST.cur].moves[ST.sel] || {};
      ST.D.steps[ST.cur].moves[ST.sel].path = simplify(ST.drawing.pts);
      ST.D.steps[ST.cur].moves[ST.sel].style = ST.drawing.style;
      ST.D.steps[ST.cur].pos[ST.sel] = end;
      toast("המסלול נשמר בשלב "+(ST.cur+1));   // שלב 0 מוצג כ"פתיחה", ולכן התווית היא ST.cur+1
    } else if(ST.cur===0){
      toast("מסלול מציירים משלב 2 והלאה");
    }
    ST.drawing=null; ST.mode="move"; syncSel(); draw(); return;
  }
  if(ST.drag && ST.drag.moved && tok(ST.drag.id) && tok(ST.drag.id).type==="ball"){
    const h = nearestHolder(ST.D.steps[ST.cur].pos[ST.drag.id], ST.drag.id);
    if(h){
      setAttach(ST.cur, ST.drag.id, h);
      const t = tok(h);
      toast("הכדור אצל " + (t.type==="def" ? "מגן X"+t.label : "שחקן "+t.label));
      if(ST.cur>0 && attachOf(ST.cur-1, ST.drag.id)!==h){
        ST.D.steps[ST.cur].moves[ST.drag.id] = ST.D.steps[ST.cur].moves[ST.drag.id] || {};
        ST.D.steps[ST.cur].moves[ST.drag.id].style = "pass";
        delete ST.D.steps[ST.cur].moves[ST.drag.id].path;
      }
    }
  }
  ST.drag=null; renderSteps(); syncSel(); draw();
});

export function simplify(pts){
  const out=[pts[0]]; const min=0.25;
  for(const p of pts){ const l=out[out.length-1]; if(Math.hypot(p.x-l.x,p.y-l.y)>min) out.push(p); }
  const last=pts[pts.length-1];
  if(Math.hypot(last.x-out[out.length-1].x,last.y-out[out.length-1].y)>0.02) out.push(last);
  return out;
}

/* רק נקודות הביניים. 0 הוא העוגן והאחרונה היא השחקן. */
export function hitHandle(p, pts){
  if(!pts || pts.length < 3) return -1;
  let best = -1, bd = HANDLE_HIT;
  for(let i=1; i<pts.length-1; i++){
    const d = Math.hypot(pts[i].x-p.x, pts[i].y-p.y);
    if(d < bd){ bd = d; best = i; }
  }
  return best;
}

export function hitTest(p){
  let best=null, bd=1e9;
  for(let i=ST.D.tokens.length-1;i>=0;i--){
    const t=ST.D.tokens[i], q=posOf(ST.cur, t.id); if(!q) continue;
    const d=Math.hypot(q.x-p.x,q.y-p.y);
    if(d < R*1.5 && d<bd){ bd=d; best=t.id; }
  }
  return best;
}
