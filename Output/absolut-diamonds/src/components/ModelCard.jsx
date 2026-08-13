import SmartImage from "./ui/SmartImage.jsx";
import { Badge } from "./ui/Bits.jsx";
import { useI18n } from "../hooks/useI18n.jsx";
import { href } from "../utils/routes.js";
import { formatAgorot } from "../utils/money.js";
import { catalogPrice } from "../utils/pricing.js";

// A1ד — תווית תמונת הדגם. **על גבי התמונה, כשכבה קבועה** — לא tooltip, לא
// hover, ולא שורה מתחת לקיפול. באותו אזור משקל ויזואלי של המחיר, ובניגודיות
// שעוברת AA (טקסט לבן על ink/85 ≈ 12:1).
export function ModelImageLabel({ short = false }) {
  const { t } = useI18n();
  return (
    <span className="absolute inset-x-0 bottom-0 bg-ink/85 px-3 py-1.5 text-sm font-medium leading-snug text-white">
      {short ? t("legal.modelImageLabelShort") : t("legal.modelImageLabel")}
    </span>
  );
}

export default function ModelCard({ model, diamonds }) {
  const { t, lang } = useI18n();
  const price = catalogPrice(model, diamonds);
  const images = model.imagesByMetal?.[model.metalOptions?.[0]] || [];
  const cover = images[0];
  const alt = (lang === "en" ? cover?.alt_en : cover?.alt_he) ?? "";
  const title = (lang === "en" ? model.title_en : model.title_he) || model.title_he;

  const shapes = (model.compatibleShapes || []).map((s) => t(`taxonomy.shape.${s}`)).join(", ");

  return (
    <a
      href={href.model(model.id)}
      className="card group block overflow-hidden transition-shadow hover:shadow-lg"
    >
      <div className="relative">
        <SmartImage src={cover?.url} alt={alt} className="aspect-square w-full" />
        {/* התווית מוצגת כשהתמונה אינה צילום של הפריט — כלומר כמעט תמיד לדגם. */}
        {cover?.isStock ? <ModelImageLabel short /> : null}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-0.5 text-sm text-muted">
          <span className="num">{model.sku}</span> · {t(`taxonomy.category.${model.category}`)}
        </p>

        <p className="mt-2 text-sm text-muted">{t("catalog.fitsShapes", { shapes })}</p>

        <div className="mt-3">
          {price.valueAgorot == null ? (
            <p className="text-muted">{t("diamond.priceOnRequest")}</p>
          ) : price.kind === "from" ? (
            <>
              <p className="text-lg font-semibold">
                <span className="num">
                  {t("catalog.priceFrom", { price: formatAgorot(price.valueAgorot, lang) })}
                </span>
              </p>
              {/* A5.6 — "החל מ־" מחושב מהמלאי הזמין בפועל, ולכן אפשר להסביר
                  מה הוא כולל. מחרוזת קשיחה לא הייתה יכולה. */}
              <p className="text-sm text-muted">{t("catalog.priceFromNote")}</p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">
                <span className="num">
                  {t("catalog.settingOnly", { price: formatAgorot(price.valueAgorot, lang) })}
                </span>
              </p>
              <p className="text-sm text-muted">{t("catalog.settingOnlyNote")}</p>
            </>
          )}
        </div>

        {model.stoneCount > 1 ? (
          <Badge className="mt-2">{t("model.stoneCountNote", { count: model.stoneCount })}</Badge>
        ) : null}
      </div>
    </a>
  );
}
