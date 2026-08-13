import { useI18n } from "../hooks/useI18n.jsx";
import { Flag } from "./ui/Bits.jsx";
import { formatAgorot } from "../utils/money.js";
import { formatCarat, formatDate } from "../utils/format.js";

// ============================================================================
// PriceBreakdown — שורות קו-שיער זהות לטבלת המפרט. שורת הסיכום מופרדת
// ב**קו `ink`** (לא `line`) — זה מה שמסמן סיכום במקום מסגרת או רקע.
//
// הסכום: 24/28px משקל **400**. משקל רגיל בגודל גדול הוא הדבר היוקרתי;
// bold בגודל הזה הוא צעקה. `aria-live="polite"` — הסכום משתנה בלי ניווט.
//
// 🔴 A5.8א — ה-disclaimer צמוד לסכום, כ-`.flag` ולא כבאנר ענבר.
// ============================================================================

export default function PriceBreakdown({ model, price, diamond, config, priceIncludes }) {
  const { t, lang } = useI18n();

  const rows = [
    { label: t("model.priceBase"), value: price.baseAgorot },
    price.karatSurchargeAgorot
      ? {
          label: t("model.priceKaratSurcharge", {
            karat: t(`taxonomy.metalKaratShort.${config.metalKarat}`),
          }),
          value: price.karatSurchargeAgorot,
        }
      : null,
    price.metalSurchargeAgorot
      ? {
          label: t("model.priceMetalSurcharge", { metal: t(`taxonomy.metalColor.${config.metalColor}`) }),
          value: price.metalSurchargeAgorot,
        }
      : null,
    diamond
      ? {
          label:
            price.stoneCount > 1
              ? t("model.priceDiamondMultiple", {
                  count: price.stoneCount,
                  carat: formatCarat(diamond.carat),
                  shape: t(`taxonomy.shape.${diamond.shape}`),
                  color: diamond.color,
                  clarity: diamond.clarity,
                })
              : t("model.priceDiamond", {
                  carat: formatCarat(diamond.carat),
                  shape: t(`taxonomy.shape.${diamond.shape}`),
                  color: diamond.color,
                  clarity: diamond.clarity,
                }),
          value: price.diamondsAgorot,
        }
      : null,
  ].filter(Boolean);

  return (
    <section className="mt-12 border-t border-ink pt-6" aria-labelledby="price-title">
      <h3 id="price-title" className="eyebrow mb-4">
        {t("model.priceTitle")}
      </h3>

      <dl>
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex min-h-11 items-baseline justify-between gap-4 border-b border-b-line py-3"
          >
            <dt className="text-spec text-ink-80">{row.label}</dt>
            <dd className="num shrink-0 text-spec font-medium text-ink">{formatAgorot(row.value, lang)}</dd>
          </div>
        ))}

        {/* שורת הסיכום — מופרדת בקו ink, לא בקו שיער. */}
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-ink pt-4">
          <dt className="text-spec font-medium text-ink">
            {price.hasDiamond ? t("model.priceTotal") : t("model.priceTotalPartial")}
          </dt>
          <dd className="num text-priceTotal font-normal text-ink lg:text-priceTotalLg" aria-live="polite">
            {formatAgorot(price.totalAgorot, lang)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-meta text-muted">{t("model.priceIncludesVat")}</p>

      {/* 🔴 A5.8א — צמוד לסכום. אותו `.flag` בדיוק ששורת הטיפולים משתמשת בו:
          מנגנון אחד = הלקוח לומד אותו אחרי הפעם הראשונה. */}
      <Flag className="mt-4">{t("model.quoteDisclaimer")}</Flag>

      {priceIncludes ? (
        <div className="mt-6">
          <h4 className="eyebrow mb-2">{t("model.priceIncludesTitle")}</h4>
          <p className="max-w-prose text-meta leading-relaxed text-ink-80">{priceIncludes}</p>
        </div>
      ) : null}

      {model.priceUpdatedAt ? (
        <p className="mt-3 text-meta text-muted">
          {t("model.priceUpdatedAt", { date: formatDate(model.priceUpdatedAt, lang) })}
        </p>
      ) : null}
    </section>
  );
}
