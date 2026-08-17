import { useMemo } from "react";
import { isFirebaseConfigured, db } from "../firebase.js";
import { sendInvite, revokeInvite, removeMember } from "../utils/orgMembers.js";
import {
  buildInvite,
  normalizeEmail,
  validateInviteInput,
  canRemoveMember,
} from "../utils/invites.js";

// ============================================================================
// useTeam — פעולות הצוות (הזמנה / ביטול / הסרת חבר).
//
// למה לא ב-useActions: הפעולות האלה **אינן דלתא על המודל**. הסרת מפתח ממפה
// דורשת `deleteField()` על FieldPath מפורש, ו-`setDoc(merge)` שעליו useActions
// בנוי היה "מצליח" בשקט בלי למחוק כלום (ראה firestoreSync.js:writeOrgDiff).
//
// במצב מקומי (בלי Firebase) אין למי להזמין, אבל המסך חייב לעבוד כדי שיהיה
// אפשר לבדוק אותו — ולכן שם הפעולות מעדכנות את המודל ב-localStorage.
// כולן מחזירות { ok, errorKey } — המסך לא מנחש אם הצליח.
// ============================================================================
export function useTeam({ orgId, data, user, update }) {
  const org = data?.org || null;
  const orgName = org?.name || "";
  const selfUid = user?.uid || null;

  return useMemo(() => {
    const invite = async ({ email, role = "admin" }) => {
      const errors = validateInviteInput({ email, role, selfEmail: user?.email }, { org });
      if (errors.length) return { ok: false, errorKey: errors[0] };
      const e = normalizeEmail(email);

      if (!isFirebaseConfigured) {
        const record = buildInvite({ role, invitedBy: selfUid });
        await update((d) => {
          d.org = { ...d.org, invites: { ...(d.org?.invites || {}), [e]: record } };
        });
        return { ok: true, errorKey: null };
      }
      return sendInvite(db, { orgId, orgName, email: e, role, invitedBy: selfUid });
    };

    const revoke = async (email) => {
      const e = normalizeEmail(email);
      if (!e) return { ok: false, errorKey: "team.err.email" };
      if (!isFirebaseConfigured) {
        await update((d) => {
          const next = { ...(d.org?.invites || {}) };
          delete next[e];
          d.org = { ...d.org, invites: next };
        });
        return { ok: true, errorKey: null };
      }
      return revokeInvite(db, { orgId, email: e });
    };

    const remove = async (uid) => {
      // ⚠️ הסרה עצמית חסומה — ראה canRemoveMember: "ארגון בלי אף אדמין" חייב
      // להיות בלתי-אפשרי, ו-firestore.rules אוכפות את זה בכל עדכון.
      const check = canRemoveMember(org, selfUid, uid);
      if (!check.ok) return check;
      if (!isFirebaseConfigured) {
        await update((d) => {
          const next = { ...(d.org?.members || {}) };
          delete next[uid];
          d.org = { ...d.org, members: next };
        });
        return { ok: true, errorKey: null };
      }
      return removeMember(db, { orgId, uid });
    };

    return { invite, revoke, remove };
  }, [orgId, orgName, selfUid, user?.email, org, update]);
}

export default useTeam;
