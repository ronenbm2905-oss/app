import DiamondShape from "./ui/DiamondShape.jsx";
import { CheckMark } from "./ui/Bits.jsx";
import { OriginSubtitle, treatmentsOf } from "./SpecBlock.jsx";
import { useI18n } from "../hooks/useI18n.jsx";
import { formatCarat } from "../utils/format.js";
import { formatAgorot } from "../utils/money.js";

// ============================================================================
// DiamondRow — 🔴 השינוי המבני הגדול: **אבן היא מסמך, לא צילום.**
// לכן לא כרטיס בגריד אלא **שורת מפרט ברוחב מלא**:
//
//   [גליף 32px]  1.02 ct · עגול                        ₪38,900
//                יהלום מעבדה (Lab-Grown)
//                F · VS1 · IGI 12345678                    ✓
//
//   • שורה: padding 16px 0, קו שיער תחתון, בלי מסגרת ובלי רקע.
//   • שורה 2 = **המקור** ב-15px ink 500 — לא Badge ולא צבע. זה גילוי (A2.3),
//     ולכן הוא לא `muted` ולא "מטא".
//   • נבחר: קו ink 2px ב-inline-start + רקע surface + ✓ ink. לא עיגול ורוד.
//     הקו קיים תמיד בשקיפות → אין layout shift בבחירה.
//   • טופלה: שורת `.flag` נוספת (A3.2).
//   • נמכרה: בלי מחיר, בלי תעודה, בלי CTA (A4.5), **בלי opacity-60** —
//     עמעום מוריד את הטקסט מתחת ל-AA.
//
// סמנטיקה: בבורר (בחירה יחידה) `role="radio"` + `aria-checked`;
// ברשימה החופשית `aria-pressed`.
// ============================================================================

export default function DiamondRow({ diamond, selected = false, onSelect, action, asRadio = false }) {
  const { t, lang } = useI18n();
  const shapeLabel = t(`taxonomy.shape.${diamond.shape}`);
  const isSold = diamond.status === "sold";
  const { active, isTreated } = treatmentsOf(diamond);

  const body = (
    <div className="flex w-full items-start gap-4">
      <DiamondShape shape={diamond.shape} className="mt-0.5 h-8 w-8 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-title font-medium text-ink">
            <span className="num">{formatCarat(diamond.carat)}</span> {t("diamond.caratShort")} ·{" "}
            {shapeLabel}
          </p>
          {/* A4.5 — אבן שנמכרה: בלי מחיר ובלי CTA. */}
          {isSold ? (
            <span className="micro-en">{t("diamond.sold")}</span>
          ) : (
            <p className="num shrink-0 text-title font-medium text-ink">
              {formatAgorot(diamond.priceAgorot, lang) || t("diamond.priceOnRequest")}
            </p>
          )}
        </div>

        {/* 🔴 A2.3(א) — מונח המקור הנגזר, כשורה שנייה. */}
        <OriginSubtitle origin={diamond.origin} className="mt-1" />

        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-meta text-muted">
            <span className="num font-medium text-ink">{diamond.color}</span>
            {" · "}
            <span className="num font-medium text-ink">{diamond.clarity}</span>
            {/* A4.5 — מספר תעודה מוצג רק כשהאבן זמינה, ולעולם לא בלי הקובץ. */}
            {!isSold && diamond.certNumber && diamond.certFileUrl ? (
              <>
                {" · "}
                <span className="num">
                  {diamond.certLab} {diamond.certNumber}
                </span>
              </>
            ) : null}
            {" · "}
            <span className="num">{diamond.stoneId}</span>
          </p>
          {selected ? <CheckMark /> : null}
        </div>

        {/* 🔴 A3.2 — אבן מטופלת: `.flag`, בסמיכות למחיר. לא Badge ענבר. */}
        {isTreated ? (
          <p className="flag mt-2 text-meta font-semibold text-ink">
            {t("diamond.treatedWarning", {
              treatments: active.map((tr) => t(`taxonomy.treatment.${tr}`)).join(", "),
            })}
          </p>
        ) : null}

        {isSold ? <p className="mt-2 text-meta text-muted">{t("diamond.soldHint")}</p> : null}
      </div>
    </div>
  );

  const frame = `w-full border-b border-b-line border-s-2 py-4 text-start transition-colors duration-hover ${
    selected ? "border-s-ink bg-surface ps-3" : "border-s-transparent ps-3"
  }`;

  if (onSelect) {
    const flag = asRadio ? { role: "radio", "aria-checked": selected } : { "aria-pressed": selected };
    return (
      <button
        type="button"
        onClick={() => onSelect(diamond)}
        disabled={isSold}
        aria-disabled={isSold || undefined}
        {...flag}
        className={`${frame} disabled:cursor-not-allowed`}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={frame} aria-disabled={isSold || undefined}>
      {body}
      {action && !isSold ? <div className="mt-3 ps-12">{action}</div> : null}
    </div>
  );
}
