/* שכבת התצוגה: פריסה, ניגון, שורת השלבים, הודעות ודיאלוגים. */
import { ST } from "./state.js";
import { BAND, CW, STYLES, STYLE_ORDER, addToken, courtH, editablePath, hasNotes, readLib, tok } from "./model.js";
import { defStyle, render } from "./render.js";

export function snapshot(){
  ST.undoStack.push(JSON.stringify({d:ST.D, c:ST.cur}));
  if(ST.undoStack.length>40) ST.undoStack.shift();
  syncUndo();
}

export function undo(){
  const s = ST.undoStack.pop(); if(!s) return;
  const o = JSON.parse(s);
  ST.D = o.d; ST.cur = Math.min(o.c, ST.D.steps.length-1); ST.sel = null; ST.mode = "move";
  document.getElementById("name").value = ST.D.name;
  setCourt(ST.D.court||"half");
  renderSteps(); syncSel(); syncUndo(); layout();
}

export function syncUndo(){
  const b = document.getElementById("undoBtn");
  if(b) b.disabled = ST.undoStack.length===0;
}

/* ---------- תצוגה וטרנספורם ---------- */
export const cv = document.getElementById("cv");

export const ctx = cv.getContext("2d");

export function layout(){
  const box = document.getElementById("board");
  const availW = Math.max(200, box.clientWidth - 16);
  const availH = Math.max(200, box.clientHeight - 16);
  const H = courtH();
  const band = hasNotes() ? BAND : 0;
  const rot = (availW/availH) > (H/CW) && (H/CW) > 1.2;   // מגרש שלם לרוחב במסך רחב
  const cw = rot ? H : CW, ch = rot ? CW : H;
  const S = Math.min(availW/(cw+1.2), availH/(ch+1.2+band));
  const w = Math.round((cw+1.2)*S), h = Math.round((ch+1.2+band)*S);
  const dpr = Math.min(window.devicePixelRatio||1, 2.5);
  cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
  cv.style.width = w+"px"; cv.style.height = h+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ST.V = {S, padX:0.6*S, padY:0.6*S, rot, w, h, band:band*S};
  draw();
}

export function draw(){ render(ctx,ST.V, ST.play.on ? {playing:true, seg:ST.play.seg, t:ST.play.t} : null); }

/* ---------- ניגון ---------- */
export function startPlay(){
  if(ST.D.steps.length<2){ toast("צריך לפחות שני שלבים"); return; }
  ST.play = {on:true, seg:0, t:0, last:performance.now()};
  document.getElementById("playBtn").textContent = "עצור";
  requestAnimationFrame(tick);
}

export function stopPlay(){
  ST.play.on=false; document.getElementById("playBtn").textContent="נגן"; draw();
}

export function tick(now){
  if(!ST.play.on) return;
  const sp = parseFloat(document.getElementById("speed").value);
  const dt = Math.min(0.05,(now-ST.play.last)/1000); ST.play.last=now;
  ST.play.t += dt*sp/1.6;
  if(ST.play.t>=1.25){
    ST.play.t=0; ST.play.seg++;
    if(ST.play.seg >= ST.D.steps.length-1){ ST.play.seg=0; }
  }
  render(ctx,ST.V,{playing:true, seg:ST.play.seg, t:Math.min(1,ST.play.t)});
  requestAnimationFrame(tick);
}

/* ---------- ממשק ---------- */
export function renderSteps(){
  const row = document.getElementById("stepsRow");
  row.innerHTML = "";
  const lbl = document.createElement("span"); lbl.className="lbl"; lbl.textContent="שלבים"; row.appendChild(lbl);
  const strip = document.createElement("div"); strip.className="chips"; row.appendChild(strip);
  let active = null;
  ST.D.steps.forEach((s,i)=>{
    const b = document.createElement("button");
    b.className="chip"; b.textContent = i===0 ? "פתיחה" : String(i+1);
    b.setAttribute("aria-pressed", i===ST.cur ? "true":"false");
    b.onclick = ()=>{ stopPlay(); ST.cur=i; ST.sel=null; ST.mode="move"; syncSel(); renderSteps(); draw(); };
    strip.appendChild(b);
    if(i===ST.cur) active = b;
  });
  if(active) active.scrollIntoView({block:"nearest", inline:"nearest"});
  const add = document.createElement("button");
  add.className="btn"; add.textContent="+ שלב";
  add.onclick = ()=>{
    stopPlay(); snapshot();
    const last = ST.D.steps[ST.D.steps.length-1];
    ST.D.steps.push({pos:JSON.parse(JSON.stringify(last.pos)), moves:{}, attach:JSON.parse(JSON.stringify(last.attach||{}))});
    ST.cur = ST.D.steps.length-1; renderSteps(); draw();
    toast("הזז שחקנים כדי להגדיר את השלב");
  };
  row.appendChild(add);
  if(ST.D.steps.length>1){
    const del = document.createElement("button");
    del.className="btn danger"; del.textContent="מחק שלב";
    del.onclick = ()=>{ stopPlay(); snapshot(); ST.D.steps.splice(ST.cur,1); ST.cur=Math.max(0,ST.cur-1); renderSteps(); layout(); };
    row.appendChild(del);
  }
  syncNote();
}

export function syncNote(){
  const el = document.getElementById("note");
  if(el) el.value = (ST.D.steps[ST.cur]||{}).note || "";
}

export function syncSel(){
  const row=document.getElementById("selRow");
  if(!ST.sel){ row.hidden=true; return; }
  const t=tok(ST.sel); if(!t){ row.hidden=true; return; }
  row.hidden=false;
  document.getElementById("selName").textContent =
    t.type==="off" ? "שחקן "+t.label : t.type==="def" ? "מגן "+t.label :
    t.type==="ball" ? "כדור" : t.type==="screen" ? "חסימה" :
    t.type==="handoff" ? "יד ליד" : "חרוט";
  const still = (t.type==="cone" || t.type==="screen" || t.type==="handoff");
  const canRotate = (t.type==="screen" || t.type==="handoff");
  const rot = document.getElementById("rotBtn");
  rot.hidden = !canRotate;
  /* הזווית על הכפתור: בלעדיה אי אפשר לדעת שזה פקד סיבוב ומה מצבו */
  if(canRotate) rot.textContent = "סובב " + Math.round((t.angle||0)*180/Math.PI) + "° ↻";
  document.getElementById("pathBtn").hidden = still;
  document.getElementById("delPathBtn").hidden = still || !editablePath();
  document.getElementById("pathBtn").classList.toggle("on", ST.mode==="path");
  const box = document.getElementById("styleChips");
  box.innerHTML = "";
  if(still) return;
  const now = (ST.D.steps[ST.cur].moves[ST.sel]||{}).style || defStyle(t);
  STYLE_ORDER.forEach(k=>{
    const b=document.createElement("button");
    b.className="chip"; b.textContent=STYLES[k].label;
    b.setAttribute("aria-pressed", k===now ? "true":"false");
    b.onclick = ()=>{
      snapshot();
      ST.D.steps[ST.cur].moves[ST.sel] = ST.D.steps[ST.cur].moves[ST.sel] || {};
      ST.D.steps[ST.cur].moves[ST.sel].style = k;
      syncSel(); draw();
    };
    box.appendChild(b);
  });
}

export let hintT;

export function toast(msg){
  const h=document.getElementById("hint"); h.textContent=msg; h.classList.add("show");
  clearTimeout(hintT); hintT=setTimeout(()=>h.classList.remove("show"), 2200);
}

export function status(msg){ document.getElementById("status").textContent = msg||""; }

export function setCourt(m){
  ST.D.court=m;
  document.getElementById("halfBtn").setAttribute("aria-pressed", m==="half");
  document.getElementById("fullBtn").setAttribute("aria-pressed", m==="full");
  layout();
}

export function place(type){
  stopPlay(); snapshot();
  const y = Math.min(courtH()-2, 8) + (ST.D.tokens.length%3)*0.9;
  const id = addToken(type, 2 + (ST.D.tokens.length%6)*2, y);
  ST.sel=id; syncSel(); draw();
  /* הכפתור היה קיים מהיום הראשון ורונן לא ידע עליו. אומרים לו ברגע שהוא רלוונטי. */
  if(type==="screen" || type==="handoff") toast("גרור למקם · הכפתור סובב מכוון את הזווית");
}

export function fillLoad(){
  const el = document.getElementById("loadSel");
  const list = Object.values(readLib().drills)
    .sort((a,b)=> String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  el.innerHTML = '<option value="">תרגילים שמורים…</option>';
  list.forEach(d=>{
    const o = document.createElement("option");
    o.value = d.id; o.textContent = d.name;
    el.appendChild(o);
  });
  el.value = "";
}

export function dialog(text){
  document.getElementById("dlgText").textContent=text;
  document.getElementById("dlg").showModal();
}
