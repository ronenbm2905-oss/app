import { useI18n } from "../hooks/useI18n.jsx";
import { ROLES } from "../utils/access.js";

// מתג תפקיד לדמו — מוצג רק במצב מקומי (isLocal). מסומן בבירור כ-DEV/DEMO.
// מאפשר לבדוק את מסכי הבעלים/הדייר/התחזוקה בלי הקמת ענן.
export function DevRoleSwitcher({ state, role, demo, setDemo }) {
  const { t } = useI18n();

  const tenants = state.tenants || [];
  const assigneeEmails = [
    ...new Set(
      (state.tickets || [])
        .filter((tk) => tk.assigneeEmail)
        .map((tk) => tk.assigneeEmail.toLowerCase())
    ),
  ];

  const onRole = (r) => {
    if (r === "tenant") setDemo({ role: r, subjectId: tenants[0]?.id || null });
    else if (r === "maintenance") setDemo({ role: r, subjectId: assigneeEmails[0] || null });
    else setDemo({ role: r, subjectId: null });
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <span className="rounded bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">
          {t("dev.badge")}
        </span>
        <span className="font-medium text-amber-900">{t("dev.roleSwitch")}:</span>
        <div className="flex gap-1">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => onRole(r)}
              aria-pressed={role === r}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                role === r ? "bg-amber-600 text-white" : "bg-white text-amber-800 hover:bg-amber-100"
              }`}
            >
              {t(`role.${r}`)}
            </button>
          ))}
        </div>

        {/* בורר נושא לפי התפקיד */}
        {demo.role === "tenant" &&
          (tenants.length ? (
            <select
              value={demo.subjectId || ""}
              onChange={(e) => setDemo({ role: "tenant", subjectId: e.target.value })}
              className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs"
              aria-label={t("dev.pickTenant")}
            >
              {tenants.map((tn) => (
                <option key={tn.id} value={tn.id}>
                  {tn.fullName || tn.email || tn.id}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-amber-700">{t("dev.noTenants")}</span>
          ))}

        {demo.role === "maintenance" &&
          (assigneeEmails.length ? (
            <select
              value={demo.subjectId || ""}
              onChange={(e) => setDemo({ role: "maintenance", subjectId: e.target.value })}
              className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs"
              aria-label={t("dev.pickAssignee")}
            >
              {assigneeEmails.map((em) => (
                <option key={em} value={em}>
                  {em}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-amber-700">{t("dev.noAssignees")}</span>
          ))}

        <span className="ms-auto hidden text-xs text-amber-600 sm:inline">{t("dev.roleHint")}</span>
      </div>
    </div>
  );
}
