/* ייצוא: PNG, GIF, והקלטת הסבר (וידאו עם קול). */
import { ST } from "./state.js";
import { BAND, CW, courtH, hasNotes } from "./model.js";
import { render } from "./render.js";
import { ctx, cv, dialog, layout, renderSteps, status, stopPlay, syncSel, toast } from "./ui.js";

/* ---------- ייצוא ---------- */
export function exportView(px){
  const H = courtH();
  const rot = ST.D.court === "full";          // מגרש שלם מיוצא לרוחב, אחרת יוצא עמוד צר וארוך
  const cw = rot ? H : CW, ch = rot ? CW : H;
  const band = hasNotes() ? BAND : 0;
  const S = px/(cw+1.2);
  return {S, padX:0.6*S, padY:0.6*S, rot,
          w:Math.round((cw+1.2)*S), h:Math.round((ch+1.2+band)*S), band:band*S};
}

export let gifReady = false;

export function loadGif(){
  return new Promise((res,rej)=>{
    if(gifReady) return res();
    const s=document.createElement("script");
    s.src="vendor/gif.js";
    s.onload=()=>{ gifReady=true; res(); }; s.onerror=rej;
    document.head.appendChild(s);
  });
}

export const BUILD = "drills-v11";               // חייב להתאים ל-CACHE ב-sw.js

export const NAR_MAX_SEC = 180;                 // תקרה, שלא תישאר הקלטה פתוחה בכיס

export function narMime(){
  if(typeof MediaRecorder === "undefined") return null;
  return ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4",
          "video/webm;codecs=vp8,opus", "video/webm"]
         .find(t => MediaRecorder.isTypeSupported(t)) || null;
}

export function narMissing(){
  const m = [];
  if(!isSecureContext) m.push("חיבור מאובטח (https)");
  if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) m.push("גישה למיקרופון");
  if(typeof MediaRecorder === "undefined") m.push("הקלטת מדיה (MediaRecorder)");
  if(typeof cv.captureStream !== "function") m.push("צילום הלוח (captureStream)");
  else if(!narMime()) m.push("פורמט וידאו נתמך");
  return m;
}

export function narSync(){
  const atEnd = ST.cur >= ST.D.steps.length-1;
  const b = document.getElementById("narNextBtn");
  document.getElementById("narStep").textContent =
    (ST.cur+1) + " מתוך " + ST.D.steps.length + (ST.cur===0 ? " · פתיחה" : "");
  /* aria-disabled ולא disabled: המטפל ממילא חוסם, ו-disabled מעיף את הפוקוס בכל שלב */
  b.setAttribute("aria-disabled", (atEnd || !!(ST.nar && ST.nar.playing)) ? "true" : "false");
  b.textContent = atEnd ? "סוף התרגיל" : "השלב הבא";
}

export async function narStart(){
  if(ST.D.steps.length < 2){ toast("צריך לפחות שני שלבים"); return; }
  if(document.hidden){ toast("צריך שהאפליקציה תהיה על המסך כדי להקליט"); return; }
  const missing = narMissing();
  if(missing.length){
    dialog("הדפדפן הזה לא תומך בהקלטת הסבר.\n\nחסר: " + missing.join(" · ") + "\n\n" +
           "באנדרואיד — Chrome. באייפון — Safari מגרסה 15 ומעלה.\n" +
           "ייצוא GIF ממשיך לעבוד בכל מקרה.\n\nגרסה " + BUILD);
    return;
  }
  stopPlay();
  let mic;
  try{
    mic = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true}});
  }catch(e){
    dialog("לא ניתנה גישה למיקרופון, ולכן אי אפשר להקליט הסבר.\nאפשר לאשר אותה בהגדרות הדפדפן ולנסות שוב.");
    return;
  }
  const mime = narMime();
  const view = exportView(720);
  view.h += view.h % 2;                  // גובה אי-זוגי מפיל קידוד H.264
  const c2 = document.createElement("canvas");
  c2.width = view.w; c2.height = view.h;
  const stream = c2.captureStream(30);
  mic.getAudioTracks().forEach(t => stream.addTrack(t));

  let rec;
  try{
    rec = new MediaRecorder(stream, {mimeType:mime, videoBitsPerSecond:1800000, audioBitsPerSecond:96000});
  }catch(e){
    mic.getTracks().forEach(t=>t.stop());
    dialog("הדפדפן לא הצליח להתחיל הקלטה. נסה דפדפן אחר, או ייצא GIF בינתיים.");
    return;
  }

  /* ST.nar נקבע רק אחרי ש-start() הצליח. אם הוא זורק, אין שורת הקלטה, narTick לא מתחיל,
     תקרת שלוש הדקות לא נאכפת — והמיקרופון היה נשאר פתוח בלי שום כפתור לעצור אותו. */
  const state = {rec, mic, stream, canvas:c2, ctx:c2.getContext("2d"), view, mime,
                 chunks:[], seg:0, t:0, playing:false, stopping:false,
                 last:performance.now(), t0:Date.now(), raf:0};
  rec.ondataavailable = e => { if(e.data && e.data.size) state.chunks.push(e.data); };
  rec.onstop = narFinish;
  rec.onerror = () => { if(ST.nar && !ST.nar.stopping) narEnd(); };
  try{
    rec.start(1000);
  }catch(e){
    mic.getTracks().forEach(t=>t.stop());
    stream.getTracks().forEach(t=>t.stop());
    dialog("הדפדפן לא הצליח להתחיל את ההקלטה, והמיקרופון נסגר.\nנסה שוב, או ייצא GIF בינתיים.");
    return;
  }
  ST.nar = state;
  ST.cur = 0; ST.sel = null; ST.mode = "move";
  if(navigator.wakeLock && navigator.wakeLock.request){          // שהמסך לא ייכבה באמצע
    navigator.wakeLock.request("screen").then(w=>{ if(ST.nar) ST.nar.wake = w; }).catch(()=>{});
  }

  document.querySelector(".panel").classList.add("recording");
  document.getElementById("narBar").hidden = false;
  renderSteps(); syncSel(); narSync(); layout();
  ST.nar.raf = requestAnimationFrame(narTick);
  toast("מקליט · מדברים על תפקידים ומספרים, לא בשמות");
}

export function narTick(now){
  if(!ST.nar) return;
  const dt = Math.min(0.05, (now - ST.nar.last)/1000); ST.nar.last = now;
  if(ST.nar.playing){
    const sp = parseFloat(document.getElementById("speed").value);
    ST.nar.t += dt*sp/1.6;
    if(ST.nar.t >= 1){
      ST.nar.t = 1; ST.nar.playing = false;
      ST.cur = Math.min(ST.nar.seg + 1, ST.D.steps.length-1);
      renderSteps(); narSync();
    }
  }
  const opts = ST.nar.playing ? {playing:true, seg:ST.nar.seg, t:ST.nar.t} : {clean:true};
  render(ST.nar.ctx, ST.nar.view, opts);        // הפריים שנכנס לווידאו
  render(ctx, ST.V, opts);                   // ואותו מצב על המסך
  const secs = Math.floor((Date.now() - ST.nar.t0)/1000);
  document.getElementById("narTime").textContent =
    Math.floor(secs/60) + ":" + String(secs%60).padStart(2,"0");
  if(secs >= NAR_MAX_SEC){ toast("שלוש דקות — מסיים את ההקלטה"); narEnd(); return; }
  ST.nar.raf = requestAnimationFrame(narTick);
}

/* דפדפן לא מייצר פריימים מקנבס כשהדף אינו גלוי — הקול ממשיך והתמונה קופאת, והתוצאה
   היא קובץ עם ערוץ וידאו ריק. עדיף לעצור ולהגיד למה, מאשר להקליט שקופית שחורה. */
document.addEventListener("visibilitychange", ()=>{
  if(document.hidden && ST.nar && !ST.nar.stopping){ ST.nar.interrupted = true; narEnd(); }
});

export function narNext(){
  if(!ST.nar || ST.nar.playing || ST.cur >= ST.D.steps.length-1) return;
  ST.nar.seg = ST.cur; ST.nar.t = 0; ST.nar.playing = true;
  narSync();
}

export function narEnd(){
  if(!ST.nar || ST.nar.stopping) return;
  ST.nar.stopping = true;
  cancelAnimationFrame(ST.nar.raf);
  try{ ST.nar.rec.stop(); }catch(e){ narFinish(); }
  status("מכין את הסרטון…");
}

export function narFinish(){
  const o = ST.nar; if(!o) return;
  ST.nar = null;
  o.mic.getTracks().forEach(t=>t.stop());      // משחרר את המיקרופון — הנורה חייבת להיכבות
  o.stream.getTracks().forEach(t=>t.stop());
  if(o.wake) o.wake.release().catch(()=>{});
  document.querySelector(".panel").classList.remove("recording");
  document.getElementById("narBar").hidden = true;
  status(""); renderSteps(); syncSel(); layout();
  const isMp4 = o.mime.indexOf("video/mp4") === 0;
  const blob = new Blob(o.chunks, {type:o.mime.split(";")[0]});
  if(!blob.size){ dialog("ההקלטה יצאה ריקה ולא נשמר קובץ. נסה שוב."); return; }
  deliver(blob, (ST.D.name||"תרגיל") + (isMp4 ? ".mp4" : ".webm"), blob.type);
  if(o.interrupted){
    dialog("ההקלטה נעצרה כי המסך כובה או שיצאת מהאפליקציה.\n" +
           "הדפדפן לא מצלם את הלוח כשהוא לא על המסך, ולכן שמרתי את מה שהספקנו.\n\n" +
           "בהקלטה הבאה — להשאיר את המסך דולק ואת האפליקציה פתוחה.");
  } else if(!isMp4){
    toast("נשמר כ-WebM. אם וואטסאפ מסרב לו, שלח מהמחשב");
  }
}

export async function deliver(blob, filename, type){
  const file = new File([blob], filename, {type});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:ST.D.name}); return; }catch(e){}
  }
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}
