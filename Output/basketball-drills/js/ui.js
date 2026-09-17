/* שכבת התצוגה: פריסה, ניגון, שורת השלבים, הודעות ודיאלוגים. */
import { ST } from "./state.js";
import { BAND, CW, STYLES, STYLE_ORDER, TAGS, addToken, courtH, editablePath, hasNotes, nextUid, readLib, tok, tokLabel } from "./model.js";
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
  renderSteps(); syncSel(); syncTags(); syncUndo(); syncSaveBtn(); layout();
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
  const label = tokLabel(t);
  document.getElementById("selName").textContent = label;
  document.getElementById("delTok").textContent = "מחק " + label;
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

/* ---------- ספריית התרגילים ---------- */
/* השם fillLoad נשאר כי הוא נקרא מכל מקום שמשנה את האחסון. הוא כבר לא ממלא select
   אלא מעדכן את כפתור הספרייה, ומרענן את הרשימה אם היא פתוחה באותו רגע. */
export function syncSaveBtn(){
  const b = document.getElementById("saveBtn");
  if(!b) return;
  b.textContent = readLib().drills[ST.D.id] ? "שמור שינויים" : "שמור תרגיל";
}

export function fillLoad(){
  syncSaveBtn();
  const b = document.getElementById("libBtn");
  if(!b) return;
  const n = Object.keys(readLib().drills).length;
  b.textContent = n ? "תרגילים שמורים (" + n + ")" : "תרגילים שמורים";
  const lib = document.getElementById("lib");
  if(lib && lib.open) renderLibrary();
}

/* תצוגה מקדימה: אותו render בדיוק, על תרגיל אחר. ST.D מוחלף ומוחזר באותה פעימה
   סינכרונית, ולכן אף אחד לא יכול לראות את המצב המוחלף. זו גם הסיבה שהתצוגה
   המקדימה לא יכולה לשקר — היא לא ציור נפרד, היא הציור. */
function thumbView(px){
  const H = courtH(), rot = ST.D.court === "full";
  const cw = rot ? H : CW, ch = rot ? CW : H;
  const S = px/(cw+1.2);
  return {S, padX:0.6*S, padY:0.6*S, rot,
          w:Math.round((cw+1.2)*S), h:Math.round((ch+1.2)*S), band:0};
}
export function thumb(drill, px){
  const d0=ST.D, c0=ST.cur, s0=ST.sel, w0=ST.drawing;
  ST.D = drill; ST.cur = 0; ST.sel = null; ST.drawing = null;
  let canvas;
  try{
    const v = thumbView(px);
    canvas = document.createElement("canvas");
    canvas.width = v.w; canvas.height = v.h;
    render(canvas.getContext("2d"), v, {clean:true});
  } finally {
    ST.D = d0; ST.cur = c0; ST.sel = s0; ST.drawing = w0;
  }
  return canvas;
}

export function openDrill(id){
  const rec = readLib().drills[id];
  if(!rec) return false;
  stopPlay();
  ST.D = JSON.parse(JSON.stringify(rec));     // עותק — עריכה לא נוגעת בשמור
  ST.D.steps.forEach(st=>{ st.pos = st.pos||{}; st.moves = st.moves||{}; st.attach = st.attach||{}; });
  if(!Array.isArray(ST.D.tags)) ST.D.tags = [];
  ST.cur=0; ST.sel=null; ST.mode="move"; ST.uid = nextUid(ST.D); ST.undoStack=[]; syncUndo();
  document.getElementById("name").value = ST.D.name;
  setCourt(ST.D.court||"half"); renderSteps(); syncSel(); syncTags(); syncSaveBtn(); layout();
  status("נטען: "+ST.D.name); toast("נטען: "+ST.D.name);
  return true;
}

/* תגיות התרגיל הפתוח */
export function syncTags(){
  const box = document.getElementById("tagChips");
  if(!box) return;
  if(!Array.isArray(ST.D.tags)) ST.D.tags = [];
  const cur = ST.D.tags;
  box.innerHTML = "";
  TAGS.forEach(t=>{
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = t;
    b.setAttribute("aria-pressed", cur.includes(t) ? "true" : "false");
    b.onclick = ()=>{
      snapshot();
      const i = cur.indexOf(t);
      if(i < 0) cur.push(t); else cur.splice(i, 1);
      syncTags();
    };
    box.appendChild(b);
  });
}

const libFilter = new Set();
function haystack(d){
  return [d.name, ...(d.tags||[]), ...(d.steps||[]).map(s=>s.note||"")].join(" ").toLowerCase();
}
function dateHe(iso){
  const d = new Date(iso||"");
  return isNaN(d) ? "" : d.getDate()+"."+(d.getMonth()+1)+"."+String(d.getFullYear()).slice(2);
}
function card(d){
  const b = document.createElement("button");
  b.className = "card"; b.type = "button";
  const pv = document.createElement("div"); pv.className = "pv";
  pv.appendChild(thumb(d, 220));
  const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = d.name;
  const meta = document.createElement("div"); meta.className = "meta";
  const n = (d.steps||[]).length;
  meta.textContent = (n === 1 ? "שלב אחד" : n + " שלבים") + " · " +
                     (d.court==="full" ? "מגרש שלם" : "חצי מגרש") + " · " + dateHe(d.updatedAt);
  b.append(pv, nm, meta);
  if((d.tags||[]).length){
    const tg = document.createElement("div"); tg.className = "tg";
    d.tags.forEach(t=>{ const s = document.createElement("span"); s.textContent = t; tg.appendChild(s); });
    b.appendChild(tg);
  }
  b.onclick = ()=>{ if(openDrill(d.id)) document.getElementById("lib").close(); };
  return b;
}
export function renderLibrary(){
  const list = document.getElementById("libList");
  const q = (document.getElementById("libSearch").value || "").trim().toLowerCase();
  const all = Object.values(readLib().drills)
    .sort((a,b)=> String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  let shown = all;
  if(libFilter.size) shown = shown.filter(d => (d.tags||[]).some(t => libFilter.has(t)));
  if(q) shown = shown.filter(d => haystack(d).includes(q));
  list.innerHTML = "";
  if(!shown.length){
    const e = document.createElement("div"); e.id = "libEmpty";
    e.textContent = all.length ? "אין תרגיל שמתאים לחיפוש" : "עוד לא שמרת תרגילים";
    list.appendChild(e);
    return;
  }
  shown.forEach(d => list.appendChild(card(d)));
}
export function openLibrary(){
  const tags = document.getElementById("libTags");
  tags.innerHTML = "";
  TAGS.forEach(t=>{
    const b = document.createElement("button");
    b.className = "chip"; b.textContent = t;
    b.setAttribute("aria-pressed", libFilter.has(t) ? "true" : "false");
    b.onclick = ()=>{
      if(libFilter.has(t)) libFilter.delete(t); else libFilter.add(t);
      b.setAttribute("aria-pressed", libFilter.has(t) ? "true" : "false");
      renderLibrary();
    };
    tags.appendChild(b);
  });
  renderLibrary();
  /* בלי focus על שדה החיפוש: בטלפון זה מקפיץ מקלדת שמכסה חצי מהרשימה */
  document.getElementById("lib").showModal();
}

export function dialog(text){
  document.getElementById("dlgText").textContent=text;
  document.getElementById("dlg").showModal();
}
