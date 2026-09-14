/* מודל התרגיל ושכבת האחסון: אובייקטים, כדור צמוד, מזהים, מיגרציה ו-sanitize. */
import { ST } from "./state.js";

/* ---------- מודל ---------- */
export const CW = 15, HALF = 14, FULL = 28;          // מידות מגרש במטרים

export const STYLES = {
  cut:{label:"ריצה"}, dribble:{label:"כדרור"}, pass:{label:"מסירה"},
  screen:{label:"חסימה"}, handoff:{label:"יד ליד"}
};

export const STYLE_ORDER = ["cut","dribble","pass","screen","handoff"];

/* אוצר מילים סגור ולא טקסט חופשי: על טלפון מקישים על צ'יפ ולא מקלידים,
   ורשימה סגורה שומרת על התגיות עקביות בין תרגילים. להרחבה — כאן. */
export const TAGS = ["התקפה","הגנה","חימום","מעבר מהיר","הוצאה","1-3-1"];

export function newDrill(){
  return {id:newId(), name:"תרגיל חדש", court:"half", tokens:[], tags:[],
          steps:[{pos:{}, moves:{}, attach:{}, note:""}]};
}

/* הערת שלב: steps[i].note. הרצועה מצוירת רק אם יש לפחות הערה אחת בתרגיל. */
export const BAND = 1.15;                                   // גובה רצועת ההערה במטרים

export function hasNotes(){ return ST.D.steps.some(s=>s.note && s.note.trim()); }

export function addToken(type, x, y, label){
  const id = "t"+(ST.uid++);
  const auto = label || nextLabel(type);
  ST.D.tokens.push({id, type, label:auto, angle:0});
  ST.D.steps.forEach(s=>{ s.pos[id] = {x, y}; });
  return id;
}

export function nextLabel(type){
  if(type==="ball") return "";
  if(type==="cone" || type==="screen" || type==="handoff") return "";
  const n = ST.D.tokens.filter(t=>t.type===type).length + 1;
  return String(n);
}

export function removeToken(id){
  ST.D.tokens = ST.D.tokens.filter(t=>t.id!==id);
  ST.D.steps.forEach(s=>{ delete s.pos[id]; delete s.moves[id]; });
  if(ST.sel===id) ST.sel=null;
}

export function tok(id){ return ST.D.tokens.find(t=>t.id===id); }

export function courtH(){ return ST.D.court==="full" ? FULL : HALF; }

/* כדור צמוד לשחקן */
export const BALL_OFF = {x:0.62, y:-0.44};

export function attachOf(stepIdx, ballId){
  const s = ST.D.steps[stepIdx];
  if(!s || !s.attach) return null;
  const h = s.attach[ballId];
  return (h && s.pos[h]) ? h : null;
}

export function setAttach(stepIdx, ballId, holder){
  const s = ST.D.steps[stepIdx];
  s.attach = s.attach || {};
  if(holder) s.attach[ballId] = holder; else delete s.attach[ballId];
}

export function posOf(stepIdx, id){
  const s = ST.D.steps[stepIdx];
  if(!s) return null;
  const t = tok(id);
  if(t && t.type==="ball"){
    const h = attachOf(stepIdx, id);
    if(h) return {x:s.pos[h].x+BALL_OFF.x, y:s.pos[h].y+BALL_OFF.y};
  }
  return s.pos[id];
}

/* המסלול המצויר של השחקן המסומן בשלב הנוכחי, אם יש כזה. מקור אמת אחד
   לציור הידיות, לפגיעה בהן ולכפתור המחיקה — כדי שהשלושה לא יוכלו לא להסכים. */
export function editablePath(){
  if(!ST.sel) return null;
  const st = ST.D.steps[ST.cur];
  const mv = st && st.moves ? st.moves[ST.sel] : null;
  return (mv && mv.path && mv.path.length > 1) ? mv.path : null;
}

export function nearestHolder(p, ballId){
  let best=null, bd=1.35;
  ST.D.tokens.forEach(t=>{
    if(t.type!=="off" && t.type!=="def") return;
    const q = ST.D.steps[ST.cur].pos[t.id]; if(!q) return;
    const d = Math.hypot(q.x-p.x, q.y-p.y);
    if(d<bd){ bd=d; best=t.id; }
  });
  return best;
}

/* ---------- שמירה ---------- */
export const mem = {};

export function store(k,v){ try{ localStorage.setItem(k,v); }catch(e){ mem[k]=v; } }

export function fetchK(k){ try{ const v=localStorage.getItem(k); return v!==null?v:(mem[k]||null); }catch(e){ return mem[k]||null; } }

export const LS_V2 = "bb_drills_v2", LS_V1 = "bb_drills";

export function newId(){ return "d"+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

export function nowISO(){ return new Date().toISOString(); }

export function readLib(){
  try{ const raw = fetchK(LS_V2); if(raw){ const o = JSON.parse(raw); if(o && o.drills) return o; } }catch(e){}
  return {version:2, drills:{}};
}

export function writeLib(lib){ store(LS_V2, JSON.stringify(lib)); }

/* כל תרגיל שנכנס מבחוץ עובר כאן. קובץ פגום לא מפיל את האפליקציה בטעינה הבאה. */
export function sanitizeDrill(raw){
  if(!raw || typeof raw!=="object" || !Array.isArray(raw.steps) || !raw.steps.length) return null;
  return {
    id: (typeof raw.id==="string" && raw.id) ? raw.id : null,
    name: (typeof raw.name==="string" && raw.name.trim()) ? raw.name.trim().slice(0,60) : "תרגיל",
    court: raw.court==="full" ? "full" : "half",
    tags: Array.isArray(raw.tags) ? raw.tags.filter(t=>typeof t==="string" && t).slice(0,8) : [],
    tokens: Array.isArray(raw.tokens) ? raw.tokens.filter(t=>t && typeof t.id==="string") : [],
    steps: raw.steps.map(st=>({
      pos:    (st && typeof st.pos==="object"    && st.pos)    || {},
      moves:  (st && typeof st.moves==="object"  && st.moves)  || {},
      attach: (st && typeof st.attach==="object" && st.attach) || {},
      note:   (st && typeof st.note==="string") ? st.note.slice(0,90) : ""
    })),
    createdAt: typeof raw.createdAt==="string" ? raw.createdAt : nowISO(),
    updatedAt: typeof raw.updatedAt==="string" ? raw.updatedAt : nowISO()
  };
}

/* מיגרציה חד-פעמית מהפורמט הישן {שם: תרגיל}.
   המפתח הישן נשאר על הדיסק בכוונה — "אין גיבוי" הוא הבאג שאנחנו פותרים כאן. */
export function migrate(){
  if(fetchK(LS_V2)) return;
  let old = null;
  try{ old = JSON.parse(fetchK(LS_V1)||"null"); }catch(e){}
  const lib = {version:2, drills:{}};
  if(old && typeof old==="object"){
    Object.keys(old).forEach(name=>{
      const d = sanitizeDrill(old[name]);
      if(!d) return;
      d.id = newId();
      if(!old[name].name) d.name = name;
      lib.drills[d.id] = d;
    });
  }
  writeLib(lib);
}

export function nextUid(d){
  let m = 0;
  (d.tokens||[]).forEach(t=>{ const k = parseInt(String(t.id).replace(/^t/,""),10); if(k>m) m=k; });
  return m+1;
}
