import { ExternalLink } from "lucide-react";
import SpecTable from "./ui/SpecTable.jsx";
import { useI18n } from "../hooks/useI18n.jsx";
import { formatCarat } from "../utils/format.js";
import { originLabel, certVerifyUrl } from "../utils/validate.js";

// ============================================================================
// SpecBlock — 🔴 המשימה העיצובית המרכזית, בקומפוננטה אחת.
//
// המסגור: **הגילוי הוא סימן היוקרה, לא הפגיעה בו.** מותג שמראה את מקור
// האבן, את הטיפולים ואת מספר התעודה באותה טיפוגרפיה שבה הוא מראה את המחיר
// משדר ביטחון. מותג שמצמצם את זה ל-10px אפור בפינה משדר שיש לו מה להסתיר.
// אנחנו מעצבים **תיעוד**, לא אזהרות.
//
// שלושת המנגנונים:
//   1. מיקום = מבנה. `origin` הוא גם **כותרת המשנה של הפריט** וגם **השורה
//      הראשונה בטבלה** — ההמוסכמה הקלאסית של מוצר יוקרה: שם → חומר.
//   2. חומרה = משקל וקו (`.flag`), לא צבע. אין ענבר, אין משולש.
//   3. סדר השורות נעול משפטית. **אין לשנות אותו.**
// ============================================================================

// כותרת המשנה של הפריט = מונח המקור. A2.3(ב): לא Badge, לא צבע, לא tone.
// 15px `ink` משקל 500 — מיד מתחת ל-H1/לשם.
export function OriginSubtitle({ origin, className = "" }) {
  const { lang } = useI18n();
  return <p className={`text-spec font-medium text-ink ${className}`}>{originLabel(origin, lang)}</p>;
}

export function treatmentsOf(diamond) {
  const list = Array.isArray(diamond?.treatments) ? diamond.treatments : [];
  const active = list.filter((tr) => tr !== "none");
  return { list, active, isTreated: active.length > 0 };
}

// ---------------------------------------------------------------------------
// שורות המפרט — **הסדר כאן הוא הסדר המשפטי.** אל תמיין, אל תסנן, אל תהפוך.
// ---------------------------------------------------------------------------
export function diamondSpecRows(diamond, t, lang) {
  const { active, isTreated } = treatmentsOf(diamond);
  const verify = certVerifyUrl(diamond?.certLab);
  const note = lang === "en" ? diamond?.treatmentNote_en : diamond?.treatmentNote_he;

  const rows = [
    // 1 — המקור ראשון. FTC: הסיוג בתחילת התיאור, לא בסופו.
    { key: "origin", term: t("diamond.origin"), value: originLabel(diamond?.origin, lang) },
    {
      key: "carat",
      term: t("diamond.carat"),
      value: (
        <span className="num">
          {formatCarat(diamond?.carat)} {t("diamond.caratShort")}
        </span>
      ),
    },
    { key: "shape", term: t("diamond.shape"), value: t(`taxonomy.shape.${diamond?.shape}`) },
    { key: "color", term: t("diamond.color"), value: <span className="num">{diamond?.color}</span> },
    { key: "clarity", term: t("diamond.clarity"), value: <span className="num">{diamond?.clarity}</span> },
    diamond?.cut
      ? { key: "cut", term: t("diamond.cut"), value: t(`taxonomy.cut.${diamond.cut}`) }
      : null,
    // 🔴 A3.2 — הטיפולים **לפני** התעודה ובסמיכות למחיר.
    // כשאין טיפול: שורה רגילה "ללא טיפול" — בחירה אקטיבית נראית, לא היעדר שורה.
    isTreated
      ? {
          key: "treatments",
          flag: true,
          span: true,
          term: t("diamond.treatments"),
          value: (
            <span>
              {t("diamond.treatedWarning", {
                treatments: active.map((tr) => t(`taxonomy.treatment.${tr}`)).join(", "),
              })}
              {note ? <span className="mt-1 block text-meta font-normal text-ink-80">{note}</span> : null}
            </span>
          ),
        }
      : { key: "treatments", term: t("diamond.treatments"), value: t("diamond.noTreatment") },
    // 🔴 A4.1 — מספר תעודה **לעולם לא מרונדר בלי קובץ התעודה**.
    diamond?.certNumber && diamond?.certFileUrl
      ? {
          key: "cert",
          span: true,
          term: t("diamond.cert"),
          value: (
            <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
              <span className="num">
                {diamond.certLab} {diamond.certNumber}
              </span>
              <a className="link-ink font-normal" href={diamond.certFileUrl} target="_blank" rel="noopener noreferrer">
                {t("diamond.certFile")}
              </a>
              {/* A4.4 — אימות עצמאי הופך טענה לעובדה ניתנת לבדיקה. */}
              {verify ? (
                <a
                  className="link-ink inline-flex items-center gap-1 font-normal"
                  href={verify}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("diamond.certVerify")}
                  <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
                </a>
              ) : null}
            </span>
          ),
        }
      : null,
  ];
  return rows.filter(Boolean);
}

export default function SpecBlock({ diamond, title, columns = 1, className = "" }) {
  const { t, lang } = useI18n();
  if (!diamond) return null;
  return (
    <section className={className} aria-label={title || t("diamond.specTitle")}>
      {title ? <h3 className="eyebrow mb-3">{title}</h3> : null}
      <SpecTable rows={diamondSpecRows(diamond, t, lang)} columns={columns} />
    </section>
  );
}
