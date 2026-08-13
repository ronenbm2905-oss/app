import { Check } from "lucide-react";
import DiamondVisual from "./DiamondVisual.jsx";
import { Badge } from "./ui/Bits.jsx";
import { useI18n } from "../hooks/useI18n.jsx";
import { formatCarat } from "../utils/format.js";
import { formatAgorot } from "../utils/money.js";
import { originLabel } from "../utils/validate.js";

// כרטיס אבן. משמש בבורר שבקונפיגורטור ובעמוד המלאי.
// `onSelect` נתון → הכרטיס כולו כפתור בחירה; אחרת תצוגה בלבד.
export default function DiamondCard({ diamond, selected = false, onSelect, action }) {
  const { t, lang } = useI18n();
  const shapeLabel = t(`taxonomy.shape.${diamond.shape}`);
  const isSold = diamond.status === "sold";

  const treatments = Array.isArray(diamond.treatments) ? diamond.treatments : [];
  const isTreated = treatments.length > 0 && treatments.some((tr) => tr !== "none");

  const body = (
    <>
      <div className="relative">
        <DiamondVisual diamond={diamond} className="w-full" />
        {selected ? (
          <span className="absolute end-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white">
            <Check size={18} aria-hidden="true" />
            <span className="sr-only">{t("common.chosen")}</span>
          </span>
        ) : null}
        {isSold ? (
          <span className="absolute inset-x-0 bottom-0 bg-ink/85 py-1 text-center text-sm font-medium text-white">
            {t("diamond.sold")}
          </span>
        ) : null}
      </div>

      <div className="p-3">
        <p className="font-semibold">
          <span className="num">{formatCarat(diamond.carat)}</span> {t("diamond.caratShort")} · {shapeLabel}
        </p>

        {/* 🔴 A2.3(א) — מונח המקור הנגזר, על הכרטיס בגריד. לא רק בטבלה,
            ובוודאי לא רק בפילטר. טקסט ולא צבע בלבד (O5.4). */}
        <p className="mt-1 font-medium text-ink">{originLabel(diamond.origin, lang)}</p>

        <p className="mt-1 text-sm text-muted">
          {t("diamond.color")} <span className="num font-medium text-ink">{diamond.color}</span>
          {" · "}
          {t("diamond.clarity")} <span className="num font-medium text-ink">{diamond.clarity}</span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* 🔴 A3 — אבן מטופלת מסומנת בסמיכות למחיר, לא בהערת שוליים. */}
          {isTreated ? (
            <Badge tone="warn">
              {treatments.filter((tr) => tr !== "none").map((tr) => t(`taxonomy.treatment.${tr}`)).join(", ")}
            </Badge>
          ) : null}
          {/* A4.5 — מספר תעודה מוצג רק כשהאבן זמינה. */}
          {!isSold && diamond.certNumber && diamond.certFileUrl ? (
            <Badge>
              {diamond.certLab} <span className="num">{diamond.certNumber}</span>
            </Badge>
          ) : null}
        </div>

        {/* A4.5 — אבן שנמכרה: בלי מחיר ובלי CTA. */}
        {isSold ? (
          <p className="mt-3 text-muted">{t("diamond.soldHint")}</p>
        ) : (
          <p className="mt-3 text-lg font-semibold">
            <span className="num">
              {formatAgorot(diamond.priceAgorot, lang) || t("diamond.priceOnRequest")}
            </span>
          </p>
        )}
        <p className="text-sm text-muted">
          <span className="num">{diamond.stoneId}</span>
        </p>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(diamond)}
        aria-pressed={selected}
        disabled={isSold}
        className={`card overflow-hidden text-start transition-shadow hover:shadow-lg disabled:opacity-60 ${
          selected ? "ring-2 ring-rose-600" : ""
        }`}
      >
        {body}
      </button>
    );
  }

  return (
    <div className="card overflow-hidden">
      {body}
      {action ? <div className="border-t border-line p-3">{action}</div> : null}
    </div>
  );
}
