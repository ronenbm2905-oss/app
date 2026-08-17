import { useMemo } from "react";
import { isFirebaseConfigured, db } from "../firebase.js";
import { addAdminEmail, removeAdminEmail } from "../utils/orgMembers.js";
import { validateAddAdmin, canRemoveAdmin, addToList, removeFromList, normalizeEmail } from "../utils/admins.js";

// ============================================================================
// useTeam — ניהול ה-allowlist של האדמינים (`org.adminEmails`).
//
// למה לא ב-useActions: זו **אינה דלתא על המודל**. `writeOrgDiff` שולח את
// ה-snapshot השלם של `org`, ולכן שני אדמינים שעורכים במקביל היו דורסים זה את
// המערך של זה. כאן כותבים **שדה אחד** ב-`updateDoc`.
//
// במצב מקומי (בלי Firebase) אין למי להוסיף, אבל המסך חייב לעבוד כדי שיהיה
// אפשר לבדוק אותו — ולכן שם הפעולות מעדכנות את המודל ב-localStorage.
// כולן מחזירות { ok, errorKey } — המסך לא מנחש אם הצליח.
// ============================================================================
export function useTeam({ orgId, data, update }) {
  const org = data?.org || null;

  return useMemo(() => {
    const add = async ({ email }) => {
      const errors = validateAddAdmin({ email }, { org });
      if (errors.length) return { ok: false, errorKey: errors[0] };
      if (!isFirebaseConfigured) {
        const next = addToList(org, email);
        await update((d) => {
          d.org = { ...d.org, adminEmails: next };
        });
        return { ok: true, errorKey: null };
      }
      return addAdminEmail(db, { orgId, org, email: normalizeEmail(email) });
    };

    const remove = async (email) => {
      // ⚠️ אדמין אחרון אינו מוסר — ארגון בלי אדמין הוא ארגון אבוד, ואין ממנו
      // דרך חזרה בלי גישת קונסולה ל-Firestore. נאכף גם ב-firestore.rules.
      const check = canRemoveAdmin(org, email);
      if (!check.ok) return check;
      if (!isFirebaseConfigured) {
        const next = removeFromList(org, email);
        await update((d) => {
          d.org = { ...d.org, adminEmails: next };
        });
        return { ok: true, errorKey: null };
      }
      return removeAdminEmail(db, { orgId, org, email });
    };

    return { add, remove };
  }, [orgId, org, update]);
}

export default useTeam;
