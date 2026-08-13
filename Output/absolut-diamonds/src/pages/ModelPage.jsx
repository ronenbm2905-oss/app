import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import SmartImage from "../components/ui/SmartImage.jsx";
import Sheet from "../components/ui/Sheet.jsx";
import Button from "../components/ui/Button.jsx";
import WhatsAppButton from "../components/ui/WhatsAppButton.jsx";
import { EmptyState, Flag, Selector, SelectorGroup } from "../components/ui/Bits.jsx";
import DiamondRow from "../components/DiamondRow.jsx";
import DiamondFilters from "../components/DiamondFilters.jsx";
import LeadForm from "../components/LeadForm.jsx";
import PriceBreakdown from "../components/PriceBreakdown.jsx";
import SpecBlock, { OriginSubtitle } from "../components/SpecBlock.jsx";
import { ModelImageLabel } from "../components/ModelCard.jsx";
import { href } from "../utils/routes.js";
import { formatCarat } from "../utils/format.js";
import { contactFor } from "../utils/defaults.js";
import { whatsappHref, configMessage, buildListingSnapshot } from "../utils/whatsapp.js";
import { compatibleDiamonds, computeConfigPrice, normalizeConfig } from "../utils/pricing.js";
import { filterDiamonds, sortDiamonds } from "../utils/filters.js";
import { EMPTY_DIAMOND_FILTERS, DIAMOND_SORTS, METAL_SWATCH } from "../constants.js";

// ============================================================================
// ModelPage — **המסך המרכזי.** דגם + קונפיגורטור.
//
// הקונפיגורציה יושבת ב-URL (`?metal=rose&karat=18k&diamond=d-2004`) ולא ב-
// state. שלוש סיבות: הלקוח יכול לשלוח את מה שהרכיב, רענון לא מאבד אותו,
// וכפתור "חזרה" עובד.
//
// A5.8א — הסכום המוצג הוא **הצעת מחיר**. ה-disclaimer צמוד לסכום עצמו,
// לא בתקנון, וגם נכנס להודעת הוואטסאפ ולתצלום המצב שנשמר בליד.
//
// עיצוב: **רקע אחד בלבד** (`paper`) — כל הבלוקים מופרדים בקווי שיער.
// אין `.card`, אין קופסאות לבנות, אין צל.
// ============================================================================

export default function ModelPage({ models, diamonds, settings, submitLead, modelId, route, navigate }) {
  const { t, lang } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);

  const model = models.find((m) => m.id === modelId);

  if (!model) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title={t("model.notFound")}
          body={t("model.notFoundHint")}
          action={
            <Button as="a" href={href.catalog()}>
              {t("model.backToCatalog")}
            </Button>
          }
        />
      </div>
    );
  }

  const config = normalizeConfig(model, {
    metalColor: route.query.metal,
    metalKarat: route.query.karat,
    diamondId: route.query.diamond,
  });

  const fitting = useMemo(() => compatibleDiamonds(model, diamonds), [model, diamonds]);
  const selectedDiamond = fitting.find((d) => d.id === config.diamondId) || null;

  const price = computeConfigPrice(model, {
    metalColor: config.metalColor,
    metalKarat: config.metalKarat,
    diamond: selectedDiamond,
  });

  const setConfig = (patch) => {
    const next = { ...config, ...patch };
    navigate(`/model/${model.id}`, {
      metal: next.metalColor,
      karat: next.metalKarat,
      diamond: next.diamondId || null,
    });
  };

  const images = model.imagesByMetal?.[config.metalColor] || [];
  const title = (lang === "en" ? model.title_en : model.title_he) || model.title_he;
  const description = (lang === "en" ? model.description_en : model.description_he) || model.description_he;
  const priceIncludes =
    (lang === "en" ? model.priceIncludes_en : model.priceIncludes_he) || model.priceIncludes_he;

  const contact = contactFor(settings);
  const waMessage = configMessage(
    t,
    {
      model,
      metalColor: config.metalColor,
      metalKarat: config.metalKarat,
      diamond: selectedDiamond,
      totalAgorot: price.totalAgorot,
      priceUpdatedAt: model.priceUpdatedAt,
    },
    contact,
    lang
  );
  const waHref = whatsappHref(contact.whatsapp, waMessage);

  const snapshot = buildListingSnapshot(
    t,
    { model, metalColor: config.metalColor, metalKarat: config.metalKarat, diamond: selectedDiamond, price },
    lang
  );

  return (
    <div className="container-page py-6 lg:py-12">
      <a href={href.catalog()} className="link-ink mb-8 inline-flex items-center gap-1.5 text-meta">
        <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" className="rtl:rotate-180" />
        {t("model.backToCatalog")}
      </a>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* ---------------- גלריה ---------------- */}
        <div>
          <div className="relative">
            <SmartImage
              src={images[0]?.url}
              alt={(lang === "en" ? images[0]?.alt_en : images[0]?.alt_he) ?? ""}
              className="aspect-square w-full"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            {/* 🔴 A1ד — התווית **בכל מקום שבו התמונה מופיעה**, כשכבה קבועה
                על גבי התמונה, ובניגודיות שעוברת AA. */}
            {images[0]?.isStock ? <ModelImageLabel /> : null}
          </div>

          {images.length > 1 ? (
            <ul className="mt-3 grid grid-cols-4 gap-3">
              {images.slice(1).map((img, i) => (
                <li key={i} className="relative">
                  <SmartImage
                    src={img.url}
                    alt={(lang === "en" ? img.alt_en : img.alt_he) ?? ""}
                    className="aspect-square w-full"
                  />
                  {img.isStock ? <ModelImageLabel short /> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* ---------------- קונפיגורטור ---------------- */}
        <div>
          <h1 className="text-display2 font-light lg:text-display2Lg">{title}</h1>
          {/* A2.3(ב) — כשנבחרה אבן, המקור הוא **כותרת המשנה של הפריט**:
              שם → חומר, ההמוסכמה הקלאסית של מוצר יוקרה. */}
          {selectedDiamond ? <OriginSubtitle origin={selectedDiamond.origin} className="mt-2" /> : null}
          <p className="mt-2 text-meta text-muted">
            {t("model.sku")} <span className="num">{model.sku}</span>
          </p>
          {description ? <p className="mt-5 max-w-prose text-body text-ink-80">{description}</p> : null}

          <section className="mt-12" aria-labelledby="config-title">
            <h2 id="config-title" className="eyebrow">
              {t("model.configTitle")}
            </h2>

            {/* --- גוון המתכת --- */}
            {/* דגימת החומר 12px היא **יוצא הדופן היחיד לצבע בממשק**, ותמיד
                לצד התווית המילולית — לעולם לא במקומה (1.4.1). */}
            <fieldset className="mt-6 border-t border-line pt-6">
              <legend className="label float-none">{t("model.stepMetal")}</legend>
              <SelectorGroup label={t("filters.metalColor")}>
                {(model.metalOptions || []).map((m) => (
                  <Selector
                    key={m}
                    selected={config.metalColor === m}
                    swatch={METAL_SWATCH[m]}
                    onClick={() => setConfig({ metalColor: m })}
                  >
                    {t(`taxonomy.metalColor.${m}`)}
                  </Selector>
                ))}
              </SelectorGroup>
              <p className="mt-3 text-meta text-muted">{t("model.metalHint")}</p>
            </fieldset>

            {/* --- סוג זהב --- */}
            <fieldset className="mt-6 border-t border-line pt-6">
              <legend className="label float-none">{t("model.stepKarat")}</legend>
              <SelectorGroup label={t("filters.metalKarat")}>
                {(model.karatOptions || []).map((k) => (
                  <Selector
                    key={k}
                    selected={config.metalKarat === k}
                    onClick={() => setConfig({ metalKarat: k })}
                  >
                    {t(`taxonomy.metalKarat.${k}`)}
                  </Selector>
                ))}
              </SelectorGroup>
            </fieldset>

            {/* --- אבן --- */}
            <div className="mt-6 border-t border-line pt-6">
              <h3 className="label">{t("model.stepDiamond")}</h3>

              {fitting.length === 0 ? (
                <Flag note={t("model.noCompatibleHint")}>{t("model.noCompatible")}</Flag>
              ) : selectedDiamond ? (
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-title font-medium">
                        <span className="num">{formatCarat(selectedDiamond.carat)}</span>{" "}
                        {t("diamond.caratShort")} · {t(`taxonomy.shape.${selectedDiamond.shape}`)}
                      </p>
                      <p className="mt-0.5 num text-meta text-muted">{selectedDiamond.stoneId}</p>
                    </div>
                    <Button variant="link" onClick={() => setPickerOpen(true)}>
                      {t("model.changeDiamond")}
                    </Button>
                  </div>

                  {/* 🔴 המפרט והגילוי — אותה טיפוגרפיה, אותה טבלה, סדר נעול. */}
                  <SpecBlock
                    diamond={selectedDiamond}
                    title={t("diamond.specTitle")}
                    className="mt-5"
                  />
                </div>
              ) : (
                <div>
                  <p className="text-title font-medium">{t("model.noDiamondChosen")}</p>
                  <p className="mt-1 text-meta text-muted">{t("model.noDiamondChosenHint")}</p>
                  <Button className="mt-4" onClick={() => setPickerOpen(true)}>
                    {t("model.chooseDiamond")}
                  </Button>
                  <p className="mt-3 text-meta text-muted">
                    {fitting.length === 1
                      ? t("model.compatibleCountOne")
                      : t("model.compatibleCount", { count: fitting.length })}
                  </p>
                </div>
              )}
            </div>

            {/* --- מחיר --- */}
            <PriceBreakdown
              model={model}
              price={price}
              diamond={selectedDiamond}
              config={config}
              priceIncludes={priceIncludes}
            />

            {/* --- CTA --- */}
            <div className="mt-12 border-t border-line pt-6">
              <h3 className="text-titleLg font-medium">{t("model.ctaTitle")}</h3>
              <p className="mt-2 max-w-prose text-meta text-muted">{t("model.ctaSub")}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                {waHref ? (
                  <WhatsAppButton href={waHref} size="lg">
                    {t("model.ctaWhatsapp")}
                  </WhatsAppButton>
                ) : (
                  <Flag>{t("whatsapp.unavailable")}</Flag>
                )}
                <Button as="a" href="#lead-form" variant="outline" size="lg">
                  {t("model.ctaForm")}
                </Button>
              </div>
              {/* A7.5 — הוואטסאפ הוא העברה לצד שלישי, וזה נאמר ליד הכפתור. */}
              {waHref ? <p className="mt-4 text-meta text-muted">{t("whatsapp.metaNotice")}</p> : null}
            </div>
          </section>
        </div>
      </div>

      {/* ---------------- טופס ---------------- */}
      <section id="lead-form" className="mt-16 max-w-2xl lg:mt-24">
        <LeadForm onSubmit={submitLead} source="configuratorForm" listingSnapshot={snapshot} />
      </section>

      {/* ---------------- בורר האבנים ---------------- */}
      <DiamondPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        diamonds={fitting}
        selectedId={config.diamondId}
        onSelect={(d) => {
          setConfig({ diamondId: d.id });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// בורר האבנים — bottom-sheet במובייל, פאנל צד בדסקטופ.
// רשימת `DiamondRow` (מסמכים), לא גריד כרטיסים. `radiogroup` — בחירה יחידה.
// ---------------------------------------------------------------------------
function DiamondPicker({ open, onClose, diamonds, selectedId, onSelect }) {
  const { t } = useI18n();
  const [filters, setFilters] = useState(EMPTY_DIAMOND_FILTERS);
  const [sort, setSort] = useState("priceAsc");

  const visible = sortDiamonds(filterDiamonds(diamonds, filters), sort);

  return (
    <Sheet open={open} onClose={onClose} title={t("diamond.pickerTitle")}>
      <p className="mb-6 text-meta text-muted">{t("diamond.pickerSub")}</p>

      <div className="mb-6">
        <label className="label" htmlFor="picker-sort">
          {t("catalog.sortLabel")}
        </label>
        <select
          id="picker-sort"
          className="input"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {DIAMOND_SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`sort.${s}`)}
            </option>
          ))}
        </select>
      </div>

      <details className="mb-6 border-y border-line py-3">
        <summary className="cursor-pointer text-spec font-medium">{t("diamond.pickerFilters")}</summary>
        <div className="mt-5">
          <DiamondFilters filters={filters} onChange={setFilters} />
        </div>
      </details>

      {/* O5.5 — מונה התוצאות מוכרז; אחרת משתמש מקלדת לא יודע שקרה משהו. */}
      <p className="mb-2 text-meta font-medium" aria-live="polite">
        {t("diamond.pickerCount", { count: visible.length })}
      </p>

      {visible.length === 0 ? (
        <EmptyState title={t("diamond.pickerEmpty")} body={t("diamond.pickerEmptyHint")} />
      ) : (
        <div role="radiogroup" aria-label={t("diamond.pickerTitle")} className="border-t border-line">
          {visible.map((d) => (
            <DiamondRow
              key={d.id}
              diamond={d}
              selected={d.id === selectedId}
              onSelect={onSelect}
              asRadio
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
