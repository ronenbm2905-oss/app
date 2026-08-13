import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import ModelCard from "../components/ModelCard.jsx";
import Sheet from "../components/ui/Sheet.jsx";
import Button from "../components/ui/Button.jsx";
import { Chip, EmptyState, PageTitle } from "../components/ui/Bits.jsx";
import { Field, SelectInput, TextInput } from "../components/ui/Field.jsx";
import { filterModels, sortModels, countActiveFilters } from "../utils/filters.js";
import { toAgorot, toShekels } from "../utils/money.js";
import {
  CATEGORIES,
  SUBCATEGORIES,
  SHAPES,
  METAL_COLORS,
  MODEL_SORTS,
  EMPTY_MODEL_FILTERS,
} from "../constants.js";

// קטלוג הדגמים. הסינון במובייל הוא bottom-sheet (דרישה מפורשת), ואותו
// רכיב סינון משמש גם את הסיידבר בדסקטופ — מקור אחד, שתי תצוגות.
export default function CatalogPage({ models, diamonds, route, navigate }) {
  const { t } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);

  const filters = {
    ...EMPTY_MODEL_FILTERS,
    category: route.query.category || null,
    subcategory: route.query.subcategory || null,
    metalColor: route.query.metal || null,
    shape: route.query.shape || null,
    priceMinAgorot: route.query.priceMin ? Number(route.query.priceMin) : null,
    priceMaxAgorot: route.query.priceMax ? Number(route.query.priceMax) : null,
  };
  const sort = MODEL_SORTS.includes(route.query.sort) ? route.query.sort : "newest";

  const setFilters = (next) =>
    navigate("/catalog", {
      category: next.category,
      subcategory: next.subcategory,
      metal: next.metalColor,
      shape: next.shape,
      priceMin: next.priceMinAgorot,
      priceMax: next.priceMaxAgorot,
      sort,
    });

  const setSort = (nextSort) =>
    navigate("/catalog", {
      category: filters.category,
      subcategory: filters.subcategory,
      metal: filters.metalColor,
      shape: filters.shape,
      priceMin: filters.priceMinAgorot,
      priceMax: filters.priceMaxAgorot,
      sort: nextSort,
    });

  const visible = sortModels(filterModels(models, filters, diamonds), sort, diamonds);
  const activeCount = countActiveFilters(filters);

  const filterPanel = <ModelFilters filters={filters} onChange={setFilters} />;

  return (
    <div className="container-page py-8 lg:py-12">
      <PageTitle sub={t("catalog.subtitle")}>{t("catalog.title")}</PageTitle>

      <div className="mb-6 flex flex-wrap items-center gap-4 border-y border-line py-3">
        <Button variant="link" className="lg:hidden" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal size={18} strokeWidth={1.5} aria-hidden="true" />
          {t("catalog.openFilters")}
          {activeCount ? <span className="num">({activeCount})</span> : null}
        </Button>

        <div className="ms-auto flex items-center gap-3">
          <label htmlFor="catalog-sort" className="text-meta text-muted">
            {t("catalog.sortLabel")}
          </label>
          <select
            id="catalog-sort"
            className="input w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {MODEL_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[16rem_1fr] lg:gap-12">
        <aside className="hidden lg:block">
          <h2 className="eyebrow mb-5">{t("catalog.filtersTitle")}</h2>
          {filterPanel}
          {activeCount ? (
            <Button variant="link" className="mt-6" onClick={() => setFilters(EMPTY_MODEL_FILTERS)}>
              {t("catalog.clearAll")}
            </Button>
          ) : null}
        </aside>

        <div>
          {/* O5.5 — מונה התוצאות מוכרז ב-aria-live בכל שינוי סינון. */}
          <p className="mb-5 text-meta font-medium" aria-live="polite">
            {visible.length === 1
              ? t("catalog.resultsCountOne")
              : t("catalog.resultsCount", { count: visible.length })}
          </p>

          {visible.length === 0 ? (
            <EmptyState title={t("catalog.resultsNone")} body={t("catalog.noResultsHint")} />
          ) : (
            // גריד מובייל: 2 טורים / gap 12 · ≥640: 3 · ≥1024: 4 / gap 24
            <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-6 xl:grid-cols-4">
              {visible.map((m) => (
                <li key={m.id}>
                  <ModelCard model={m} diamonds={diamonds} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t("catalog.filtersTitle")}
        footer={
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              {t("common.apply")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFilters(EMPTY_MODEL_FILTERS);
                setSheetOpen(false);
              }}
            >
              {t("common.clear")}
            </Button>
          </div>
        }
      >
        {filterPanel}
      </Sheet>
    </div>
  );
}

function ModelFilters({ filters, onChange }) {
  const { t } = useI18n();
  const set = (patch) => onChange({ ...filters, ...patch });
  const subs = filters.category ? SUBCATEGORIES[filters.category] || [] : [];

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="label">{t("filters.category")}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip selected={!filters.category} dismissible={false} onClick={() => set({ category: null, subcategory: null })}>
            {t("filters.any")}
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              selected={filters.category === c}
              onClick={() => set({ category: c, subcategory: null })}
            >
              {t(`taxonomy.category.${c}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      {subs.length ? (
        <fieldset>
          <legend className="label">{t("filters.subcategory")}</legend>
          <div className="flex flex-wrap gap-2">
            <Chip selected={!filters.subcategory} dismissible={false} onClick={() => set({ subcategory: null })}>
              {t("filters.any")}
            </Chip>
            {subs.map((s) => (
              <Chip key={s} selected={filters.subcategory === s} onClick={() => set({ subcategory: s })}>
                {t(`taxonomy.subcategory.${s}`)}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      <Field label={t("filters.shapeFit")}>
        {(p) => (
          <SelectInput {...p} value={filters.shape ?? ""} onChange={(e) => set({ shape: e.target.value || null })}>
            <option value="">{t("filters.anyShape")}</option>
            {SHAPES.map((s) => (
              <option key={s} value={s}>
                {t(`taxonomy.shape.${s}`)}
              </option>
            ))}
          </SelectInput>
        )}
      </Field>

      <fieldset>
        <legend className="label">{t("filters.metalColor")}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip selected={!filters.metalColor} dismissible={false} onClick={() => set({ metalColor: null })}>
            {t("filters.any")}
          </Chip>
          {METAL_COLORS.map((m) => (
            <Chip key={m} selected={filters.metalColor === m} onClick={() => set({ metalColor: m })}>
              {t(`taxonomy.metalColor.${m}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("filters.priceFrom")}>
          {(p) => (
            <TextInput
              {...p}
              type="number"
              inputMode="numeric"
              min="0"
              step="500"
              dir="ltr"
              value={filters.priceMinAgorot == null ? "" : toShekels(filters.priceMinAgorot)}
              onChange={(e) =>
                set({ priceMinAgorot: e.target.value === "" ? null : toAgorot(e.target.value) })
              }
            />
          )}
        </Field>
        <Field label={t("filters.priceTo")}>
          {(p) => (
            <TextInput
              {...p}
              type="number"
              inputMode="numeric"
              min="0"
              step="500"
              dir="ltr"
              value={filters.priceMaxAgorot == null ? "" : toShekels(filters.priceMaxAgorot)}
              onChange={(e) =>
                set({ priceMaxAgorot: e.target.value === "" ? null : toAgorot(e.target.value) })
              }
            />
          )}
        </Field>
      </div>
    </div>
  );
}
