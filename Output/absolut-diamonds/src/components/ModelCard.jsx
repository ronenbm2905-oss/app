import SmartImage from "./ui/SmartImage.jsx";
import { useI18n } from "../hooks/useI18n.jsx";
import { href } from "../utils/routes.js";
import { formatAgorot } from "../utils/money.js";
import { catalogPrice } from "../utils/pricing.js";
import { A1D, a1dLabelAttrs, a1dPriceAttrs, a1dClusterAttrs } from "../utils/disclosure.js";

// ============================================================================
// 🔴 A1ד — תווית תמונת הדגם. **על גבי התמונה, כשכבה קבועה** — לא tooltip,
// לא hover, ולא שורה מתחת לקיפול.
//
// עיצובית: **לוח, לא מדבקה.** רצועה ברוחב מלא בתחתית התמונה, `scrimInk`‎.88,
// קצוות חדים, radius 0. היא נראית כמו כיתוב תחת צילום בקטלוג מוזיאון —
// לא כמו watermark. הגדלים והמשקל מגיעים מ-`utils/disclosure.js`, שהוא גם
// מה ש-`render:check` בודק.
// ============================================================================
export function ModelImageLabel({ short = false }) {
  const { t } = useI18n();
  return (
    <span
      {...a1dLabelAttrs()}
      className="absolute inset-x-0 bottom-0 bg-scrim px-3 py-2.5 text-disclosure font-medium text-paper lg:px-4 lg:py-3"
    >
      {short ? t("legal.modelImageLabelShort") : t("legal.modelImageLabel")}
    </span>
  );
}

// ============================================================================
// ModelCard — **מהכרטיס לאריח.** אין border, אין bg-white, אין shadow,
// אין radius. ההפרדה בין אריחים היא רווח הגריד בלבד.
//
// hover: קו תחתון לשם. אין scale, אין lift, אין shadow-lg.
// ============================================================================
export default function ModelCard({ model, diamonds }) {
  const { t, lang } = useI18n();
  const price = catalogPrice(model, diamonds);
  const images = model.imagesByMetal?.[model.metalOptions?.[0]] || [];
  const cover = images[0];
  const alt = (lang === "en" ? cover?.alt_en : cover?.alt_he) ?? "";
  const title = (lang === "en" ? model.title_en : model.title_he) || model.title_he;

  // האשכול של A1ד נפתח **רק כשיש גם תווית וגם מחיר** — אחרת אין מול מה
  // למדוד, והאסרשן היה נכשל על אריח שאין בו הפרה.
  const cluster =
    cover?.isStock && price.valueAgorot != null ? a1dClusterAttrs(A1D.maxGapPx) : {};

  return (
    // התווית והמחיר יושבים באשכול יחד, מיושרים לאותה עמודת סריקה,
    // ומופרדים בצעד ריווח אחד (12px) בין בלוק התמונה לבלוק הטקסט.
    <a {...cluster} href={href.model(model.id)} className="group block">
      <div className="relative">
        <SmartImage src={cover?.url} alt={alt} className="aspect-square w-full" />
        {/* התווית מוצגת כשהתמונה אינה צילום של הפריט — כלומר כמעט תמיד לדגם. */}
        {cover?.isStock ? <ModelImageLabel short /> : null}
      </div>

      {/* mt-3 = 12px = A1D.maxGapPx. אין להגדיל בלי לעדכן את הטוקן. */}
      <div className="mt-3">
        <h3 className="text-title font-normal text-ink group-hover:underline">{title}</h3>
        <p className="mt-1 text-meta text-muted">
          <span className="num">{model.sku}</span> · {t(`taxonomy.category.${model.category}`)}
        </p>

        <div className="mt-2">
          {price.valueAgorot == null ? (
            <p className="text-title font-medium text-ink">{t("diamond.priceOnRequest")}</p>
          ) : price.kind === "from" ? (
            <>
              <p {...a1dPriceAttrs()} className="text-title font-medium text-ink">
                <span className="num">
                  {t("catalog.priceFrom", { price: formatAgorot(price.valueAgorot, lang) })}
                </span>
              </p>
              {/* A5.6 — "החל מ־" מחושב מהמלאי הזמין בפועל, ולכן אפשר להסביר
                  מה הוא כולל. מחרוזת קשיחה לא הייתה יכולה. */}
              <p className="mt-1 text-meta text-muted">{t("catalog.priceFromNote")}</p>
            </>
          ) : (
            <>
              <p {...a1dPriceAttrs()} className="text-title font-medium text-ink">
                <span className="num">
                  {t("catalog.settingOnly", { price: formatAgorot(price.valueAgorot, lang) })}
                </span>
              </p>
              <p className="mt-1 text-meta text-muted">{t("catalog.settingOnlyNote")}</p>
            </>
          )}
        </div>

        {model.stoneCount > 1 ? (
          <p className="mt-2 text-meta text-muted">
            {t("model.stoneCountNote", { count: model.stoneCount })}
          </p>
        ) : null}
      </div>
    </a>
  );
}
