import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle, ShieldCheck, ExternalLink } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import SmartImage from "../components/ui/SmartImage.jsx";
import Sheet from "../components/ui/Sheet.jsx";
import Button from "../components/ui/Button.jsx";
import { Badge, Chip, EmptyState, Notice, SectionTitle } from "../components/ui/Bits.jsx";
import DiamondCard from "../components/DiamondCard.jsx";
import DiamondFilters from "../components/DiamondFilters.jsx";
import LeadForm from "../components/LeadForm.jsx";
import { ModelImageLabel } from "../components/ModelCard.jsx";
import { href } from "../utils/routes.js";
import { formatAgorot } from "../utils/money.js";
import { formatCarat, formatDate } from "../utils/format.js";
import { originLabel, certVerifyUrl } from "../utils/validate.js";
import { contactFor } from "../utils/defaults.js";
import { whatsappHref, configMessage, buildListingSnapshot, treatmentsLabel } from "../utils/whatsapp.js";
import {
  compatibleDiamonds,
  computeConfigPrice,
  normalizeConfig,
  defaultConfig,
} from "../utils/pricing.js";
import { filterDiamonds, sortDiamonds } from "../utils/filters.js";
import { EMPTY_DIAMOND_FILTERS, DIAMOND_SORTS } from "../constants.js";

// ============================================================================
// ModelPage — **המסך המרכזי.** דגם + קונפיגורטור.
//
// הקונפיגורציה יושבת ב-URL (`?metal=rose&karat=18k&diamond=d-2004`) ולא ב-
// state. שלוש סיבות: הלקוח יכול לשלוח את מה שהרכיב, רענון לא מאבד אותו,
// וכפתור "חזרה" עובד.
//
// A5.8א — הסכום המוצג הוא **הצעת מחיר**. ה-disclaimer צמוד לסכום עצמו,
// לא בתקנון, וגם נכנס להודעת הוואטסאפ ולתצלום המצב שנשמר בליד.
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
    <div className="container-page py-6 sm:py-10">
      <a href={href.catalog()} className="mb-4 inline-flex items-center gap-1.5 text-sm underline">
        <ArrowRight size={16} aria-hidden="true" className="rtl:rotate-180" />
        {t("model.backToCatalog")}
      </a>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ---------------- גלריה ---------------- */}
        <div>
          <div className="relative">
            <SmartImage
              src={images[0]?.url}
              alt={(lang === "en" ? images[0]?.alt_en : images[0]?.alt_he) ?? ""}
              className="aspect-square w-full rounded-2xl"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            {/* 🔴 A1ד — התווית **בכל מקום שבו התמונה מופיעה**, כשכבה קבועה
                על גבי התמונה, ובניגודיות שעוברת AA. */}
            {images[0]?.isStock ? <ModelImageLabel /> : null}
          </div>

          {images.length > 1 ? (
            <ul className="mt-3 grid grid-cols-4 gap-2">
              {images.slice(1).map((img, i) => (
                <li key={i} className="relative">
                  <SmartImage
                    src={img.url}
                    alt={(lang === "en" ? img.alt_en : img.alt_he) ?? ""}
                    className="aspect-square w-full rounded-lg"
                  />
                  {img.isStock ? (
                    <span className="absolute inset-x-0 bottom-0 bg-ink/85 px-1 py-0.5 text-center text-[11px] font-medium text-white">
                      {t("legal.modelImageLabelShort")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* ---------------- קונפיגורטור ---------------- */}
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
          <p className="mt-1 text-muted">
            {t("model.sku")} <span className="num">{model.sku}</span>
          </p>
          {description ? <p className="mt-3 leading-relaxed">{description}</p> : null}

          <section className="mt-8" aria-labelledby="config-title">
            <h2 id="config-title" className="text-xl font-semibold">
              {t("model.configTitle")}
            </h2>

            {/* --- גוון --- */}
            <fieldset className="mt-5">
              <legend className="label">{t("model.stepMetal")}</legend>
              <div className="flex flex-wrap gap-2">
                {(model.metalOptions || []).map((m) => (
                  <Chip
                    key={m}
                    selected={config.metalColor === m}
                    onClick={() => setConfig({ metalColor: m })}
                  >
                    {t(`taxonomy.metalColor.${m}`)}
                  </Chip>
                ))}
              </div>
              <p className="mt-1 text-sm text-muted">{t("model.metalHint")}</p>
            </fieldset>

            {/* --- סוג זהב --- */}
            <fieldset className="mt-5">
              <legend className="label">{t("model.stepKarat")}</legend>
              <div className="flex flex-wrap gap-2">
                {(model.karatOptions || []).map((k) => (
                  <Chip
                    key={k}
                    selected={config.metalKarat === k}
                    onClick={() => setConfig({ metalKarat: k })}
                  >
                    {t(`taxonomy.metalKarat.${k}`)}
                  </Chip>
                ))}
              </div>
            </fieldset>

            {/* --- אבן --- */}
            <div className="mt-6">
              <h3 className="label">{t("model.stepDiamond")}</h3>

              {fitting.length === 0 ? (
                <Notice tone="warn">
                  <p className="font-medium">{t("model.noCompatible")}</p>
                  <p className="mt-1">{t("model.noCompatibleHint")}</p>
                </Notice>
              ) : selectedDiamond ? (
                <div className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        <span className="num">{formatCarat(selectedDiamond.carat)}</span>{" "}
                        {t("diamond.caratShort")} · {t(`taxonomy.shape.${selectedDiamond.shape}`)}
                      </p>
                      {/* A2.3(ב) — מונח המקור בסמיכות לפרטי האבן, לא רק בטבלה */}
                      <p className="font-medium">{originLabel(selectedDiamond.origin, lang)}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {t("diamond.color")}{" "}
                        <span className="num font-medium text-ink">{selectedDiamond.color}</span> ·{" "}
                        {t("diamond.clarity")}{" "}
                        <span className="num font-medium text-ink">{selectedDiamond.clarity}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-muted num">{selectedDiamond.stoneId}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                      {t("model.changeDiamond")}
                    </Button>
                  </div>

                  <DiamondDisclosures diamond={selectedDiamond} />
                </div>
              ) : (
                <div className="card p-4">
                  <p className="font-medium">{t("model.noDiamondChosen")}</p>
                  <p className="mt-1 text-sm text-muted">{t("model.noDiamondChosenHint")}</p>
                  <Button className="mt-3" onClick={() => setPickerOpen(true)}>
                    {t("model.chooseDiamond")}
                  </Button>
                  <p className="mt-2 text-sm text-muted">
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
            <div className="mt-6 card p-5">
              <h3 className="text-lg font-semibold">{t("model.ctaTitle")}</h3>
              <p className="mt-1 text-sm text-muted">{t("model.ctaSub")}</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {waHref ? (
                  <Button as="a" href={waHref} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="lg">
                    <MessageCircle size={20} aria-hidden="true" />
                    {t("model.ctaWhatsapp")}
                  </Button>
                ) : (
                  <Notice tone="warn">{t("whatsapp.unavailable")}</Notice>
                )}
                <Button as="a" href="#lead-form" variant="secondary" size="lg">
                  {t("model.ctaForm")}
                </Button>
              </div>
              {/* A7.5 — הוואטסאפ הוא העברה לצד שלישי, וזה נאמר ליד הכפתור. */}
              {waHref ? <p className="mt-3 text-sm text-muted">{t("whatsapp.metaNotice")}</p> : null}
            </div>
          </section>
        </div>
      </div>

      {/* ---------------- טופס ---------------- */}
      <section id="lead-form" className="mt-12 max-w-2xl">
        <SectionTitle>{t("lead.title")}</SectionTitle>
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
// גילויים על האבן שנבחרה — A3 בסמיכות למחיר, A4 תעודה אטומית + אימות עצמאי.
// ---------------------------------------------------------------------------
function DiamondDisclosures({ diamond }) {
  const { t, lang } = useI18n();
  const treatments = Array.isArray(diamond.treatments) ? diamond.treatments : [];
  const isTreated = treatments.length > 0 && treatments.some((tr) => tr !== "none");
  const verify = certVerifyUrl(diamond.certLab);
  const note = lang === "en" ? diamond.treatmentNote_en : diamond.treatmentNote_he;

  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      {/* 🔴 A3.2 — שורה בולטת בסמיכות למחיר, לא הערת שוליים. */}
      {isTreated ? (
        <Notice tone="warn">
          <p className="font-medium">
            {t("diamond.treatedWarning", {
              treatments: treatments
                .filter((tr) => tr !== "none")
                .map((tr) => t(`taxonomy.treatment.${tr}`))
                .join(", "),
            })}
          </p>
          {note ? <p className="mt-1">{note}</p> : null}
        </Notice>
      ) : (
        <p className="text-sm text-muted">
          {t("diamond.treatments")}: {t("diamond.noTreatment")}
        </p>
      )}

      {/* 🔴 A4.1 — מספר תעודה **לעולם לא מרונדר בלי קישור לקובץ**. */}
      {diamond.certNumber && diamond.certFileUrl ? (
        <div className="text-sm">
          <p className="flex flex-wrap items-center gap-1.5">
            <ShieldCheck size={16} aria-hidden="true" className="text-gold-600" />
            <span>{t("diamond.cert")}</span>
            <span className="num font-medium">
              {diamond.certLab} {diamond.certNumber}
            </span>
          </p>
          <div className="mt-1 flex flex-wrap gap-3">
            <a className="underline hover:text-rose-700" href={diamond.certFileUrl} target="_blank" rel="noopener noreferrer">
              {t("diamond.certFile")}
            </a>
            {/* A4.4 — אימות עצמאי הופך טענה לעובדה ניתנת לבדיקה. */}
            {verify ? (
              <a
                className="inline-flex items-center gap-1 underline hover:text-rose-700"
                href={verify}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("diamond.certVerify")}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// פירוק המחיר — שקוף שורה-שורה, עם ה-disclaimer צמוד לסכום (A5.8א).
// ---------------------------------------------------------------------------
function PriceBreakdown({ model, price, diamond, config, priceIncludes }) {
  const { t, lang } = useI18n();

  const rows = [
    { label: t("model.priceBase"), value: price.baseAgorot },
    price.karatSurchargeAgorot
      ? {
          label: t("model.priceKaratSurcharge", { karat: t(`taxonomy.metalKaratShort.${config.metalKarat}`) }),
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
    <section className="mt-6 card p-5" aria-labelledby="price-title">
      <h3 id="price-title" className="text-lg font-semibold">
        {t("model.priceTitle")}
      </h3>

      <dl className="mt-3 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted">{row.label}</dt>
            <dd className="num shrink-0 font-medium">{formatAgorot(row.value, lang)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
          <dt className="font-semibold">
            {price.hasDiamond ? t("model.priceTotal") : t("model.priceTotalPartial")}
          </dt>
          {/* aria-live — הסכום משתנה בלי ניווט; בלי ההכרזה משתמש AT לא יודע. */}
          <dd className="num text-2xl font-semibold" aria-live="polite">
            {formatAgorot(price.totalAgorot, lang)}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-sm text-muted">{t("model.priceIncludesVat")}</p>

      {/* 🔴 A5.8א — צמוד לסכום. לא בתקנון, לא מתחת לקיפול. */}
      <Notice tone="warn" className="mt-3">
        {t("model.quoteDisclaimer")}
      </Notice>

      {priceIncludes ? (
        <div className="mt-3">
          <h4 className="text-sm font-semibold">{t("model.priceIncludesTitle")}</h4>
          <p className="mt-1 text-sm leading-relaxed text-muted">{priceIncludes}</p>
        </div>
      ) : null}

      {model.priceUpdatedAt ? (
        <p className="mt-2 text-sm text-muted">
          {t("model.priceUpdatedAt", { date: formatDate(model.priceUpdatedAt, lang) })}
        </p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// בורר האבנים — bottom-sheet במובייל, פאנל צד בדסקטופ.
// ---------------------------------------------------------------------------
function DiamondPicker({ open, onClose, diamonds, selectedId, onSelect }) {
  const { t } = useI18n();
  const [filters, setFilters] = useState(EMPTY_DIAMOND_FILTERS);
  const [sort, setSort] = useState("priceAsc");

  const visible = sortDiamonds(filterDiamonds(diamonds, filters), sort);

  return (
    <Sheet open={open} onClose={onClose} title={t("diamond.pickerTitle")}>
      <p className="mb-4 text-sm text-muted">{t("diamond.pickerSub")}</p>

      <div className="mb-4">
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

      <details className="mb-4 rounded-xl border border-line bg-white p-3">
        <summary className="cursor-pointer font-medium">{t("diamond.pickerFilters")}</summary>
        <div className="mt-4">
          <DiamondFilters filters={filters} onChange={setFilters} />
        </div>
      </details>

      {/* O5.5 — מונה התוצאות מוכרז; אחרת משתמש מקלדת לא יודע שקרה משהו. */}
      <p className="mb-3 text-sm font-medium" aria-live="polite">
        {t("diamond.pickerCount", { count: visible.length })}
      </p>

      {visible.length === 0 ? (
        <EmptyState title={t("diamond.pickerEmpty")} body={t("diamond.pickerEmptyHint")} />
      ) : (
        <ul className="grid gap-3">
          {visible.map((d) => (
            <li key={d.id}>
              <DiamondCard diamond={d} selected={d.id === selectedId} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
