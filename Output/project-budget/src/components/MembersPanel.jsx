import { useState } from "react";
import { Button, Pill } from "./ui/Button.jsx";
import { Field, Select } from "./ui/Field.jsx";
import { IconPlus, IconDelete, IconInfo, IconWarning } from "./ui/icons.jsx";
import { makeProject } from "../schema.js";
import { ROLE_LABEL, ROLES } from "../constants.js";
import { canRemoveMember, memberList, normalizeEmail, roleOf } from "../utils/access.js";

const TONE = { owner: "blue", manager: "green", viewer: "slate" };

const ROLE_HELP = {
  owner: "הכול — תקציב, מנות, חברים.",
  manager: "מזין חשבוניות, תשלומים וספקים. לא נוגע בתקציב ולא בדרישה מהרשות.",
  viewer: "קריאה בלבד, על כל הפרויקט.",
};

/**
 * ניהול חברי הפרויקט. הזיהוי לפי **מייל** — הבעלים מוסיף כתובת, ומי שנכנס
 * עם המייל הזה מקבל את התפקיד. אין מנגנון הזמנה/אישור, ולכן אין גם מצב
 * ביניים של "הוזמן וטרם אישר" שצריך לתחזק.
 */
export default function MembersPanel({ project, store, myEmail, canEdit, cloudMode }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState("");

  const members = memberList(project);

  const add = () => {
    const clean = normalizeEmail(email);
    setError("");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setError("כתובת מייל לא תקינה.");
      return;
    }
    if (roleOf(project, clean)) {
      setError("הכתובת כבר ברשימה.");
      return;
    }
    store.upsert(
      "projects",
      makeProject({ ...project, memberRoles: { ...project.memberRoles, [clean]: role } }),
    );
    setEmail("");
  };

  const changeRole = (target, nextRole) => {
    const next = { ...project.memberRoles, [target]: nextRole };
    if (!Object.values(next).includes("owner")) {
      setError("חייב להישאר לפחות בעלים אחד.");
      return;
    }
    setError("");
    store.upsert("projects", makeProject({ ...project, memberRoles: next }));
  };

  const removeMember = (target) => {
    if (!canRemoveMember(project, target)) {
      setError("אי אפשר להסיר את הבעלים האחרון.");
      return;
    }
    if (!confirm(`להסיר את ${target} מהפרויקט?`)) return;
    const next = { ...project.memberRoles };
    delete next[target];
    setError("");
    store.upsert("projects", makeProject({ ...project, memberRoles: next }));
  };

  return (
    <div>
      {!cloudMode && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning-solid/30 bg-warning-fill p-3 text-sm text-warning-text">
          <IconWarning size={18} className="mt-0.5 shrink-0" />
          <p>
            <strong>מצב מקומי — התפקידים כאן אינם נאכפים.</strong> אין התחברות ואין שרת,
            כך שכל מי שפותח את הדפדפן הזה רואה הכול. הרשימה נשמרת ותיכנס לתוקף כשהפרויקט
            יעלה לענן.
          </p>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-alt text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-right font-semibold">מייל</th>
              <th className="px-3 py-2 text-right font-semibold">תפקיד</th>
              <th className="px-3 py-2 text-right font-semibold">מה מותר</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-ink-faint">
                  אין חברים רשומים.
                </td>
              </tr>
            )}
            {members.map((m) => {
              const isMe = normalizeEmail(m.email) === normalizeEmail(myEmail);
              return (
                <tr key={m.email} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <span className="num text-navy">{m.email}</span>
                    {isMe && <span className="mr-2 text-xs text-ink-faint">(אתה)</span>}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <div className="w-40">
                        <Select
                          value={m.role}
                          onChange={(v) => changeRole(m.email, v)}
                          options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                        />
                      </div>
                    ) : (
                      <Pill tone={TONE[m.role]}>{ROLE_LABEL[m.role]}</Pill>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">{ROLE_HELP[m.role]}</td>
                  <td className="px-3 py-2 text-left">
                    {canEdit && (
                      <button
                        onClick={() => removeMember(m.email)}
                        title="הסרה"
                        aria-label={`הסרת ${m.email}`}
                        disabled={!canRemoveMember(project, m.email)}
                        className="rounded-sm p-1.5 text-ink-muted transition hover:bg-danger-fill hover:text-danger-text disabled:opacity-30"
                      >
                        <IconDelete size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="rounded-lg border border-border bg-surface-alt p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink-body">הוספת חבר</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Field label="כתובת מייל" value={email} onChange={setEmail} placeholder="name@example.com" />
            </div>
            <div className="w-44">
              <Select
                label="תפקיד"
                value={role}
                onChange={setRole}
                options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              />
            </div>
            <Button onClick={add} disabled={!email.trim()}>
              <IconPlus size={16} /> הוספה
            </Button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-muted">
            <IconInfo size={14} className="mt-0.5 shrink-0" />
            הכתובת חייבת להיות זו שאיתה הוא נכנס ל-Google. אין הזמנה במייל — ברגע שהוא
            נכנס עם הכתובת הזו, הוא בפנים.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-danger-text">
          <IconWarning size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
