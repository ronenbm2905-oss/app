// ============================================================================
// orgMembers.js — פעולות הענן של **חברות בארגון**: גילוי, תביעת הזמנה,
// הזמנה, ביטול, והסרת חבר.
//
// ============================================================================
// הבאג ששלושת המנגנונים כאן מתקנים (פרודקשן, 2026-08-17)
// ============================================================================
// המשתמש שלח את הקישור למנהלת הכספים כדי שתהיה אדמין שנייה. היא התחברה
// וקיבלה **מסך הקמה ראשונית** במקום את הצי. הסיבה לא הייתה בכללים:
//
//   useData.js:63   const orgId = isFirebaseConfigured ? user?.uid || null : "local";
//
// ה-orgId היה **ה-uid של המשתמש המחובר, קשיח**. לכן גם הוספה ידנית של ה-uid
// שלה ל-`org.members` בקונסול לא הייתה עוזרת: הקליינט היה ממשיך לבקש
// `orgs/{ה-uid שלה}`, שאינו קיים → probe מחזיר missing → onboarding. ואם
// הייתה משלימה אותו — היה **נוצר ארגון שני נפרד**, עם אפס רכבים.
//
// `memberships/{uid}` היה קיים, נכתב, ומתועד בכללים כ"כדי שמשתמש יגלה לאיזה
// ארגון הוא שייך" — אבל **הקליינט לא קרא אותו לעולם.** מסמך יתום.
//
// שלושת התיקונים:
//   1. `resolveOrgAccess` — ה-orgId **נגזר** מ-`memberships/{uid}.orgId`.
//      ליוצר הארגון זה יוצא אותו ערך (orgId === uid), ולכן אין רגרסיה.
//   2. `claimInvite` — הדרך היחידה שמשתמש חדש נכנס לארגון קיים, ורק עם
//      הזמנה תקפה למייל **המאומת** שלו.
//   3. "אין חברות ואין הזמנה" הוא **מצב מוכר** שמחזיר `status: 'none'` —
//      מסך "פנה למנהל המערכת", לא שגיאה ולא onboarding.
//
// ============================================================================
// למה updateDoc + FieldPath ולא setDoc(merge) על המודל שבזיכרון
// ============================================================================
// שתי סיבות, שתיהן חוסמות:
//
// (א) **התובעת אינה יכולה לקרוא את מסמך הארגון לפני שהיא חברה** (הכלל הוא
//     `allow read: if isOrgAdmin`). לכן היא אינה יודעת מה מפת החברים הקיימת,
//     ואינה יכולה לכתוב אותה חזרה. `updateDoc` עם FieldPath כותב **עלה בודד**
//     ואינו דורש קריאה: ה-rules רואות ב-`request.resource.data` את התוצאה
//     הממוזגת ומאמתות אותה מול `resource.data`. אפס נתונים נחשפים.
//
// (ב) `setDoc(..., {merge:true})` **אינו מוחק מפתחות ממפה.** ביטול הזמנה או
//     הסרת חבר דרך המודל שבזיכרון היו "עוברים" בשקט ולא מוחקים כלום.
//     מחיקה דורשת `deleteField()` על FieldPath מפורש.
//
// ⚠️ FieldPath עם סגמנטים מפורשים הוא גם **הכרח** ולא נוחות: מפתח ההזמנה
// הוא כתובת מייל, ובה נקודות. נתיב-שדה כמחרוזת ("org.invites.a.b@c.com")
// היה מתפרש כשרשרת מפות מקוננות. `new FieldPath("org","invites",email)`
// מעביר את המייל כסגמנט אחד, נקודות ועוד.
// ============================================================================

import { normalizeEmail, buildInvite, buildInvitePointer, isInviteExpired } from "./invites.js";
import { probeOrg, readMembership, ensureMembership } from "./firestoreSync.js";

export const INVITES_COLLECTION = "invites";

// אוסף הגילוי: `invites/{email}` — ה-id הוא המייל המנורמל, כי זו הכתובת
// היחידה שמוזמנת יכולה לחשב בעצמה בלי לדעת כלום על הארגון.
export function invitePointerId(email) {
  return normalizeEmail(email);
}

// permission-denied כאן אינו שגיאה להציג: הוא התשובה "אין לך את זה".
// כל שגיאה אחרת (רשת, קונפיג) **נזרקת** — לא בולעים הכל.
async function softGet(getter) {
  try {
    return { ok: true, snap: await getter() };
  } catch (err) {
    if (err?.code === "permission-denied") return { ok: false, denied: true, error: err };
    throw err;
  }
}

// ============================================================================
// readInvitePointer — האם למשתמש הזה יש הזמנה ממתינה.
// denied ⇒ המייל אינו מאומת (הכלל דורש `email_verified == true`), וזה מצב
// שהמסך מסביר בנפרד: "המייל שלך אינו מאומת", ולא "אין לך הזמנה".
// ============================================================================
export async function readInvitePointer(db, email) {
  const id = invitePointerId(email);
  if (!id) return { invite: null, denied: false };
  const { doc, getDoc } = await import("firebase/firestore");
  const res = await softGet(() => getDoc(doc(db, INVITES_COLLECTION, id)));
  if (!res.ok) return { invite: null, denied: true };
  return { invite: res.snap.exists() ? { email: id, ...res.snap.data() } : null, denied: false };
}

// ============================================================================
// resolveOrgAccess — **הגזירה של orgId**, במקום `user.uid` הקשיח.
//
//   status: 'member'  → orgId מוכר, מותר להירשם למאזינים.
//   status: 'invited' → יש הזמנה ממתינה; מסך "צירוף לארגון".
//   status: 'none'    → אין חברות ואין הזמנה. מסך "פנה למנהל המערכת".
//   status: 'error'   → שגיאת רשת/קונפיג אמיתית. לא ממציאים מצב.
//
// ⚠️ סדר הבדיקות אינו שרירותי: רשומת החברות **קודמת** להזמנה, כדי שמשתמש
// שכבר תבע את ההזמנה שלו ייכנס לארגון גם אם מצביע ההזמנה נשאר תקוע.
// ⚠️ הבדיקה השנייה (orgs/{uid}) היא התאימות-לאחור ליוצר הארגון: הוא ייתכן
// שאין לו רשומת חברות (היא נכתבת מאז 16.8 בלבד), ואצלו orgId === uid.
// ============================================================================
export async function resolveOrgAccess(db, user, { now = Date.now() } = {}) {
  const base = {
    status: "none",
    orgId: null,
    invite: null,
    role: null,
    emailVerified: Boolean(user?.emailVerified),
    email: normalizeEmail(user?.email),
    error: null,
  };
  if (!user?.uid) return { ...base, status: "none" };

  try {
    // -- 1. רשומת החברות: uid → orgId --------------------------------------
    const membership = await readMembership(db, user.uid).catch((err) => {
      if (err?.code === "permission-denied") return null;
      throw err;
    });
    if (membership?.orgId) {
      const probe = await probeOrg(db, membership.orgId);
      if (probe.state === "error") return { ...base, status: "error", error: probe.error };
      if (probe.state === "exists")
        return { ...base, status: "member", orgId: membership.orgId, role: membership.role || null };
      // 'missing' כאן = הארגון נמחק, או שהוסרנו ממנו. ממשיכים הלאה; אולי
      // יש הזמנה חדשה. **לא** שגיאה אדומה.
    }

    // -- 2. יוצר הארגון: orgId === uid --------------------------------------
    const selfProbe = await probeOrg(db, user.uid);
    if (selfProbe.state === "error") return { ...base, status: "error", error: selfProbe.error };
    if (selfProbe.state === "exists") {
      // ריפוי עצמי: הרשומה תיכתב בכל מקרה ע"י startOrgSync, אבל מכאן
      // הזרימה בפעם הבאה מתחילה בשלב 1 ולא בניחוש.
      ensureMembership(db, user.uid, user.uid, "admin").catch(() => {});
      return { ...base, status: "member", orgId: user.uid, role: "admin" };
    }

    // -- 3. הזמנה ממתינה ---------------------------------------------------
    const { invite, denied } = await readInvitePointer(db, user.email);
    if (invite && !isInviteExpired(invite, now))
      return { ...base, status: "invited", invite, role: invite.role || null };
    if (invite) return { ...base, status: "none", invite, error: null };
    if (denied) return { ...base, status: "none", emailVerified: false };

    // -- 4. אין ארגון ואין הזמנה -------------------------------------------
    // זה המצב שבו מנהלת הכספים נתקעה. הוא **לא** מוביל ל-onboarding.
    return { ...base, status: "none" };
  } catch (err) {
    return { ...base, status: "error", error: err };
  }
}

// ============================================================================
// claimInvite — התביעה עצמה. **כתיבה אחת, שני עלים:**
//   org.members[uid] = role   (התפקיד נלקח מההזמנה שבמסמך, לא מהקליינט)
//   org.invites[email] = ⌫    (ההזמנה נצרכת — פעם אחת, לא יותר)
//
// ה-rules מאמתות שאלה **בדיוק** שני העלים שהשתנו: לא members של אחר, לא
// settings, ולא הזמנה של מישהו אחר. אין כאן שום דבר שהקליינט "מבטיח" —
// הוא פשוט אינו יכול לכתוב יותר מזה.
// ============================================================================
export async function claimInvite(db, user, invite) {
  const { doc, updateDoc, deleteDoc, deleteField, FieldPath } = await import("firebase/firestore");
  const email = normalizeEmail(user?.email);
  const orgId = invite?.orgId;
  const role = invite?.role;
  if (!user?.uid || !email || !orgId || !role) return { ok: false, errorKey: "join.err.noInvite" };

  try {
    await updateDoc(
      doc(db, "orgs", orgId),
      new FieldPath("org", "members", user.uid),
      role,
      new FieldPath("org", "invites", email),
      deleteField()
    );
  } catch (err) {
    console.error("claimInvite failed", err);
    return { ok: false, errorKey: err?.code === "permission-denied" ? "join.err.denied" : "join.err.failed", error: err };
  }

  // מכאן והלאה כשלונות אינם מבטלים את ההצטרפות — היא כבר במסמך הארגון.
  // רשומת החברות היא ה**מצביע**, וגם אם תיכשל עכשיו היא תיכתב ב-startOrgSync.
  await ensureMembership(db, user.uid, orgId, role).catch((err) =>
    console.warn("membership write after claim skipped", err)
  );
  // ניקוי מצביע הגילוי. אם ייכשל — נשאר מצביע מיותר שאינו מעניק כלום,
  // ורשומת החברות (שנבדקת קודם) תנצח אותו בכל התחברות.
  await deleteDoc(doc(db, INVITES_COLLECTION, invitePointerId(email))).catch((err) =>
    console.warn("invite pointer cleanup skipped", err)
  );

  return { ok: true, errorKey: null, orgId, role };
}

// ============================================================================
// sendInvite — אדמין מוסיף מייל לרשימת המוזמנים.
// שתי כתיבות, וסדרן חשוב: קודם **הסמכות** (מסמך הארגון), אחריה המצביע.
// מצביע שנכשל = הזמנה שאי אפשר לגלות (המוזמן יראה "פנה למנהל"); סמכות
// שנכשלה = תביעה שתידחה. שני הכיוונים נכשלים לצד הבטוח.
// ============================================================================
export async function sendInvite(db, { orgId, orgName = "", email, role = "admin", invitedBy = null, nowMs = Date.now(), ttlDays } = {}) {
  const { doc, updateDoc, setDoc, FieldPath } = await import("firebase/firestore");
  const e = normalizeEmail(email);
  if (!orgId || !e) return { ok: false, errorKey: "team.err.email" };

  const invite = buildInvite({ role, invitedBy, nowMs, ttlDays });
  try {
    await updateDoc(doc(db, "orgs", orgId), new FieldPath("org", "invites", e), invite);
  } catch (err) {
    console.error("sendInvite (org doc) failed", err);
    return { ok: false, errorKey: "team.err.failed", error: err };
  }
  try {
    await setDoc(
      doc(db, INVITES_COLLECTION, invitePointerId(e)),
      buildInvitePointer({ email: e, orgId, orgName, invite })
    );
  } catch (err) {
    console.error("sendInvite (pointer) failed", err);
    return { ok: false, errorKey: "team.err.pointerFailed", error: err, invite };
  }
  return { ok: true, errorKey: null, invite };
}

// revokeInvite — הסמכות נמחקת ראשונה, כדי שלא יישאר חלון שבו ההזמנה עוד
// ניתנת לתביעה אחרי שהאדמין ביטל אותה.
export async function revokeInvite(db, { orgId, email } = {}) {
  const { doc, updateDoc, deleteDoc, deleteField, FieldPath } = await import("firebase/firestore");
  const e = normalizeEmail(email);
  if (!orgId || !e) return { ok: false, errorKey: "team.err.email" };
  try {
    await updateDoc(doc(db, "orgs", orgId), new FieldPath("org", "invites", e), deleteField());
  } catch (err) {
    console.error("revokeInvite failed", err);
    return { ok: false, errorKey: "team.err.failed", error: err };
  }
  await deleteDoc(doc(db, INVITES_COLLECTION, invitePointerId(e))).catch((err) =>
    console.warn("invite pointer delete skipped", err)
  );
  return { ok: true, errorKey: null };
}

// removeMember — הסרת חבר מהארגון. **לא הסרה עצמית** (ראה canRemoveMember
// ב-invites.js): ב-rules כל עדכון של מסמך הארגון דורש שהכותב יישאר admin,
// ולכן "ארגון בלי אדמין" אינו מצב שאפשר להגיע אליו.
export async function removeMember(db, { orgId, uid } = {}) {
  const { doc, updateDoc, deleteField, FieldPath } = await import("firebase/firestore");
  if (!orgId || !uid) return { ok: false, errorKey: "team.err.notFound" };
  try {
    await updateDoc(doc(db, "orgs", orgId), new FieldPath("org", "members", uid), deleteField());
  } catch (err) {
    console.error("removeMember failed", err);
    return { ok: false, errorKey: "team.err.failed", error: err };
  }
  return { ok: true, errorKey: null };
}
