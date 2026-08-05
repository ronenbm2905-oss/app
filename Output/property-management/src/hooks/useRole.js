import { useState, useMemo } from "react";
import { tenantForIdentity, assigneeKeyForIdentity } from "../utils/access.js";

const DEMO_KEY = "pm_demo_role";

// useRole — קובע את תפקיד המשתמש.
// מצב ענן: נגזר מזהות המשתמש (email/uid) מול הנתונים. ברירת מחדל owner.
// מצב מקומי: מתג דמו ידני (owner/tenant/maintenance) לבדיקת שלושת המסכים.
export function useRole(state, user, isLocal) {
  const [demo, setDemoState] = useState(() => {
    if (!isLocal) return null;
    try {
      return JSON.parse(localStorage.getItem(DEMO_KEY)) || { role: "owner", subjectId: null };
    } catch {
      return { role: "owner", subjectId: null };
    }
  });

  const setDemo = (next) => {
    setDemoState(next);
    if (isLocal) localStorage.setItem(DEMO_KEY, JSON.stringify(next));
  };

  const resolved = useMemo(() => {
    // מצב ענן — זיהוי אוטומטי לפי הזהות.
    if (!isLocal) {
      const tenant = tenantForIdentity(state, user);
      if (tenant) return { role: "tenant", tenantId: tenant.id, assigneeKey: null };
      const key = assigneeKeyForIdentity(state, user);
      if (key) return { role: "maintenance", tenantId: null, assigneeKey: key };
      return { role: "owner", tenantId: null, assigneeKey: null };
    }
    // מצב מקומי — לפי מתג הדמו.
    if (demo.role === "tenant") {
      const id = demo.subjectId || state.tenants?.[0]?.id || null;
      return { role: "tenant", tenantId: id, assigneeKey: null };
    }
    if (demo.role === "maintenance") {
      // subjectId מחזיק אימייל של assignee (מפתח היציב במצב מקומי).
      const email = demo.subjectId || firstAssigneeEmail(state);
      return { role: "maintenance", tenantId: null, assigneeKey: email ? { email } : null };
    }
    return { role: "owner", tenantId: null, assigneeKey: null };
  }, [state, user, isLocal, demo]);

  return { ...resolved, demo, setDemo, isLocal };
}

function firstAssigneeEmail(state) {
  const tk = (state.tickets || []).find((t) => t.assigneeEmail);
  return tk ? tk.assigneeEmail.toLowerCase() : null;
}
