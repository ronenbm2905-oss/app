/* חיווט הממשק ואתחול. המודול היחיד שרושם מאזינים לכפתורים. */
import { ST } from "./state.js";
import { addToken, attachOf, courtH, hasNotes, migrate, newDrill, newId, nextUid, nowISO, posOf, readLib, removeToken, sanitizeDrill, setAttach, tok, writeLib } from "./model.js";
import { ease, movePts, noteText, pathLen, pointAt, positionsAt, render } from "./render.js";
import { dialog, draw, fillLoad, layout, place, renderSteps, setCourt, snapshot, startPlay, status, stopPlay, syncSel, syncUndo, toast, undo } from "./ui.js";
import { simplify } from "./interact.js";
import { BUILD, deliver, exportView, loadGif, narEnd, narNext, narStart } from "./export.js";

ST.D = newDrill();                     // התרגיל הראשון, לפני שמשהו מצייר

document.getElementById("playBtn").onclick = ()=> ST.play.on ? stopPlay() : startPlay();

document.getElementById("halfBtn").onclick = ()=> setCourt("half");

document.getElementById("fullBtn").onclick = ()=> setCourt("full");

document.getElementById("name").oninput = e=> ST.D.name = e.target.value;

/* הערה לשלב: snapshot אחד לכל סבב עריכה, לא אחד לכל תו */
let noteDirty = false;

document.getElementById("note").addEventListener("focus", ()=>{ noteDirty = false; });

document.getElementById("note").addEventListener("input", e=>{
  if(!noteDirty){ noteDirty = true; snapshot(); }
  const had = hasNotes();
  ST.D.steps[ST.cur].note = e.target.value;
  if(had !== hasNotes()) layout(); else draw();   // הרצועה נכנסת/יוצאת = שינוי גובה הקנבס
});

document.getElementById("addOff").onclick = ()=> place("off");

document.getElementById("addDef").onclick = ()=> place("def");

document.getElementById("addBall").onclick = ()=> place("ball");

document.getElementById("addCone").onclick = ()=> place("cone");

document.getElementById("addScreen").onclick = ()=> place("screen");

document.getElementById("addHandoff").onclick = ()=> place("handoff");

document.getElementById("delTok").onclick = ()=>{ if(ST.sel){ snapshot(); removeToken(ST.sel); syncSel(); draw(); } };

document.getElementById("undoBtn").onclick = undo;

document.getElementById("narBtn").onclick = narStart;

document.getElementById("narNextBtn").onclick = narNext;

document.getElementById("narStopBtn").onclick = narEnd;

/* הכפתור נשאר תמיד. אם הדפדפן לא תומך — אומרים בדיוק מה חסר, במקום להיעלם בשקט. */
document.getElementById("pathBtn").onclick = ()=>{
  if(ST.cur===0){ toast("מסלול מציירים משלב 2 והלאה"); return; }
  ST.mode = ST.mode==="path" ? "move" : "path"; syncSel();
  if(ST.mode==="path") toast("גרור על המגרש את מסלול השחקן");
};

document.getElementById("rotBtn").onclick = ()=>{
  if(!ST.sel) return;
  const t=tok(ST.sel); if(t.type!=="screen" && t.type!=="handoff") return;
  snapshot();
  t.angle = ((t.angle||0) + Math.PI/6) % (Math.PI*2);
  syncSel(); draw();
};

document.getElementById("preset5").onclick = ()=>{
  stopPlay(); snapshot();
  let pg=null;
  [[7.5,9.2],[2.8,7.6],[12.2,7.6],[1.3,2.6],[13.7,2.6]].forEach((p,i)=>{
    const id = addToken("off",p[0],p[1]); if(i===0) pg=id;
  });
  const ball = addToken("ball", 8.2, 9.4);
  ST.D.steps.forEach((s,i)=> setAttach(i, ball, pg));
  draw(); toast("מערך 5 בחוץ נוסף");
};

document.getElementById("preset131").onclick = ()=>{
  stopPlay(); snapshot();
  [[7.5,7.0],[3.6,5.4],[11.4,5.4],[7.5,4.4],[7.5,1.7]].forEach(p=> addToken("def",p[0],p[1]));
  draw(); toast("הגנת 1-3-1 נוספה");
};

/* מחיקת התרגיל הפתוח מהרשימה. הוא נשאר על המסך בכוונה — "שמור" מחזיר אותו,
   וזו הבקרה היחידה שיש כאן במקום "בצע שוב" שאין. */
document.getElementById("delDrillBtn").onclick = ()=>{
  const lib = readLib();
  const rec = lib.drills[ST.D.id];
  if(!rec){ toast("התרגיל הזה עדיין לא נשמר, אז אין מה למחוק"); return; }
  if(!confirm("למחוק את \"" + rec.name + "\" מהרשימה?\n\nהוא יישאר פתוח על המסך, ולחיצה על \"שמור\" תחזיר אותו.")) return;
  delete lib.drills[ST.D.id];
  writeLib(lib); fillLoad();
  status("נמחק: " + rec.name);
  toast("נמחק: " + rec.name + " · עדיין פתוח על המסך");
};

document.getElementById("newBtn").onclick = ()=>{
  if(!confirm("להתחיל תרגיל חדש?")) return;
  ST.D=newDrill(); ST.cur=0; ST.sel=null; ST.undoStack=[]; syncUndo();
  document.getElementById("name").value=ST.D.name;
  renderSteps(); syncSel(); layout();
};

document.getElementById("saveBtn").onclick = ()=>{
  const lib = readLib();
  if(!ST.D.id) ST.D.id = newId();
  if(!ST.D.name || !ST.D.name.trim()){
    ST.D.name = "תרגיל "+(Object.keys(lib.drills).length+1);
    document.getElementById("name").value = ST.D.name;
  }
  const prev = lib.drills[ST.D.id];
  const rec = JSON.parse(JSON.stringify(ST.D));
  rec.createdAt = (prev && prev.createdAt) || nowISO();
  rec.updatedAt = nowISO();
  lib.drills[ST.D.id] = rec;
  writeLib(lib); fillLoad();
  const word = prev ? "עודכן" : "נשמר";
  status(word + ": " + ST.D.name);
  toast(word + ": " + ST.D.name);          // שורת ההודעה לבדה נעלמת מתחת לקצה הפאנל בטלפון
};

document.getElementById("loadSel").onchange = e=>{
  const rec = readLib().drills[e.target.value];
  if(!rec) return;
  stopPlay();
  ST.D = JSON.parse(JSON.stringify(rec));     // עותק — עריכה לא נוגעת בשמור
  ST.D.steps.forEach(st=>{ st.pos = st.pos||{}; st.moves = st.moves||{}; st.attach = st.attach||{}; });
  ST.cur=0; ST.sel=null; ST.mode="move"; ST.uid = nextUid(ST.D); ST.undoStack=[]; syncUndo();
  document.getElementById("name").value = ST.D.name;
  setCourt(ST.D.court||"half"); renderSteps(); syncSel(); layout();
  status("נטען: "+ST.D.name);
  toast("נטען: "+ST.D.name);
};

/* ---------- גיבוי ושחזור ---------- */
document.getElementById("exportBtn").onclick = ()=>{
  const list = Object.values(readLib().drills);
  if(!list.length){ toast("אין תרגילים שמורים לגיבוי"); return; }
  const payload = {app:"drills", version:2, exportedAt:nowISO(), drills:list};
  const blob = new Blob([JSON.stringify(payload, null, 1)], {type:"application/json"});
  const d = new Date(), pad = k=>String(k).padStart(2,"0");
  const fn = "תרגילים-"+d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+".json";
  deliver(blob, fn, "application/json");
  status("גיבוי: "+list.length+" תרגילים");
  toast("גיבוי של "+list.length+" תרגילים ירד");
};

document.getElementById("importBtn").onclick = ()=> document.getElementById("importFile").click();

document.getElementById("importFile").onchange = async e=>{
  const f = e.target.files && e.target.files[0];
  e.target.value = "";
  if(!f) return;
  let data;
  try{ data = JSON.parse(await f.text()); }
  catch(err){ dialog("הקובץ אינו JSON תקין. לא שיניתי כלום."); return; }
  if(!data || data.app!=="drills" || !Array.isArray(data.drills)){
    dialog("זה לא קובץ גיבוי של לוח התרגילים. בחר קובץ שנוצר בכפתור הגיבוי. לא שיניתי כלום.");
    return;
  }
  const lib = readLib();
  const names = new Set(Object.values(lib.drills).map(d=>d.name));
  let added=0, updated=0, skipped=0;
  data.drills.forEach(raw=>{
    const d = sanitizeDrill(raw);
    if(!d){ skipped++; return; }
    if(!d.id){                                  // קובץ ישן או ערוך ביד
      d.id = newId();
      if(names.has(d.name)) d.name += " (מיובא)";
      lib.drills[d.id] = d; names.add(d.name); added++; return;
    }
    const have = lib.drills[d.id];
    if(!have){ lib.drills[d.id] = d; names.add(d.name); added++; return; }
    if(String(d.updatedAt||"") > String(have.updatedAt||"")){ lib.drills[d.id] = d; updated++; }
    else skipped++;                             // ייבוא חוזר של אותו קובץ = לא כלום
  });
  writeLib(lib); fillLoad();
  status("יובאו "+added+" חדשים · "+updated+" עודכנו · "+skipped+" דולגו");
  dialog("יובאו "+added+" תרגילים חדשים, "+updated+" עודכנו ו-"+skipped+" דולגו.\n\n" +
         "התרגיל שפתוח על המסך לא השתנה — בחר תרגיל מהרשימה כדי לפתוח אותו.");
};

document.getElementById("pngBtn").onclick = ()=>{
  const v = exportView(1000);
  const c2 = document.createElement("canvas"); c2.width=v.w; c2.height=v.h;
  const c = c2.getContext("2d");
  c.fillStyle="#12161B"; c.fillRect(0,0,v.w,v.h);
  render(c,v,{clean:true});
  c2.toBlob(b=> deliver(b, (ST.D.name||"תרגיל")+".png", "image/png"));
};

document.getElementById("gifBtn").onclick = async ()=>{
  if(ST.D.steps.length<2){ toast("צריך לפחות שני שלבים"); return; }
  stopPlay(); status("מכין GIF…");
  try{
    await loadGif();
    const wRes = await fetch("vendor/gif.worker.js");
    const wUrl = URL.createObjectURL(await wRes.blob());
    const v = exportView(720);
    const c2 = document.createElement("canvas"); c2.width=v.w; c2.height=v.h;
    const c = c2.getContext("2d");
    const gif = new window.GIF({workers:2, quality:8, width:v.w, height:v.h, workerScript:wUrl});
    const fps = 14, secPerStep = 1.6;
    const frame = (seg,t,delay)=>{
      c.fillStyle="#12161B"; c.fillRect(0,0,v.w,v.h);
      render(c,v,{playing:true, seg, t});
      gif.addFrame(c, {copy:true, delay});
    };
    frame(0,0,700);
    for(let seg=0; seg<ST.D.steps.length-1; seg++){
      const n = Math.round(fps*secPerStep);
      for(let i=1;i<=n;i++) frame(seg, i/n, Math.round(1000/fps));
      frame(seg,1,450);
    }
    gif.on("progress", p=> status("מכין GIF… "+Math.round(p*100)+"%"));
    gif.on("finished", blob=>{ status(""); deliver(blob, (ST.D.name||"תרגיל")+".gif", "image/gif"); });
    gif.render();
  }catch(err){
    status("");
    dialog("ייצוא ה-GIF נכשל. נסה שוב, או ייצא תמונה בינתיים.");
  }
};

/* ---------- הקלטת הסבר: וידאו עם קול ---------- */
/* המאמן מדבר ומקליק בין השלבים, וההסבר מסונכרן לתנועה כי הוא זה שמסנכרן אותם.
   הווידאו נבנה מקנבס ייצוא בגודל קבוע (720) ולא מהקנבס שעל המסך — כך התוצאה לא תלויה
   בגודל המכשיר ולא משתנה אם המסך מסתובב באמצע ההקלטה. */

document.getElementById("dlgOk").onclick = ()=> document.getElementById("dlg").close();

/* שורת הגילוי. תוכן קבוע בלבד — אין כאן שום קלט משתמש. */
document.getElementById("aboutBtn").onclick = ()=>{
  document.getElementById("dlgText").innerHTML =
    "הכלי פועל במכשיר שלך בלבד. התרגילים נשמרים בדפדפן הזה, ולא נשלחת שום בקשה לשרת חיצוני." +
    "<br><br>הקלטת הסבר משתמשת במיקרופון בלבד — לא במצלמה — והסרטון נוצר במכשיר ונשאר בו " +
    "עד שאתה בוחר לשתף אותו." +
    "<br><br><span style=\"color:var(--muted)\">גרסה " + BUILD + "</span>" +
    "<br><br><a href=\"vendor/NOTICES.txt\" target=\"_blank\" rel=\"noopener\" style=\"color:var(--ball)\">רישיונות</a>";
  document.getElementById("dlg").showModal();
};

/* ---------- אתחול ---------- */
window.addEventListener("resize", layout);

window.addEventListener("orientationchange", ()=> setTimeout(layout,150));

migrate();

document.getElementById("preset5").click();

ST.undoStack=[]; syncUndo();

renderSteps(); fillLoad(); layout();

setTimeout(()=>toast("גרור שחקנים, ואז הוסף שלב"), 400);

/* ידית לבדיקות בלבד, לא בשימוש בזמן ריצה */
window.__app = { ST, render, exportView, posOf, positionsAt, movePts, newDrill, addToken,
                 setAttach, sanitizeDrill, snapshot, undo, hasNotes, noteText, attachOf,
                 courtH, simplify, pathLen, pointAt, ease, nextUid };
