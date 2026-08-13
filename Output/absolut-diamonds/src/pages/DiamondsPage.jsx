import { useState } from "react";
import { SlidersHorizontal, MessageCircle } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import DiamondCard from "../components/DiamondCard.jsx";
import DiamondFilters from "../components/DiamondFilters.jsx";
import Sheet from "../components/ui/Sheet.jsx";
import Button from "../components/ui/Button.jsx";
import { EmptyState, SectionTitle } from "../components/ui/Bits.jsx";
import { filterDiamonds, sortDiamonds, countActiveFilters } from "../utils/filters.js";
import { contactFor } from "../utils/defaults.js";
import { whatsappHref, diamondMessage } from "../utils/whatsapp.js";
import { EMPTY_DIAMOND_FILTERS, DIAMOND_SORTS } from "../constants.js";

// עמוד מלאי האבנים. הכניסה ההפוכה לקונפיגורטור: מי שמתחיל מהאבן ולא מהדגם.
export default function DiamondsPage({ diamonds, settings }) {
  const { t, lang } = useI18n();
  const [filters, setFilters] = useState(EMPTY_DIAMOND_FILTERS);
  const [sort, setSort] = useState("priceAsc");
  const [sheetOpen, setSheetOpen] = useState(false);

  const contact = contactFor(settings);
  const visible = sortDiamonds(filterDiamonds(diamonds, filters), sort);
  const activeCount = countActiveFilters(filters);

  const panel = <DiamondFilters filters={filters} onChange={setFilters} />;

  return (
    <div className="container-page py-8">
      <SectionTitle sub={t("diamondsPage.subtitle")}>{t("diamondsPage.title")}</SectionTitle>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" className="lg:hidden" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal size={18} aria-hidden="true" />
          {t("catalog.openFilters")}
          {activeCount ? <span className="num">({activeCount})</span> : null}
        </Button>

        <div className="ms-auto flex items-center gap-2">
          <label htmlFor="d-sort" className="text-sm text-muted">
            {t("catalog.sortLabel")}
          </label>
          <select id="d-sort" className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
            {DIAMOND_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="hidden lg:block">
          <h2 className="mb-4 text-lg font-semibold">{t("catalog.filtersTitle")}</h2>
          {panel}
          {activeCount ? (
            <Button variant="ghost" className="mt-4" onClick={() => setFilters(EMPTY_DIAMOND_FILTERS)}>
              {t("catalog.clearAll")}
            </Button>
          ) : null}
        </aside>

        <div>
          <p className="mb-4 text-sm font-medium" aria-live="polite">
            {visible.length === 1
              ? t("diamondsPage.resultsCountOne")
              : t("diamondsPage.resultsCount", { count: visible.length })}
          </p>

          {visible.length === 0 ? (
            <EmptyState title={t("diamondsPage.resultsNone")} body={t("diamondsPage.noResultsHint")} />
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((d) => {
                const wa = whatsappHref(contact.whatsapp, diamondMessage(t, d, contact, lang));
                return (
                  <li key={d.id}>
                    <DiamondCard
                      diamond={d}
                      action={
                        wa ? (
                          <Button
                            as="a"
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="whatsapp"
                            className="w-full"
                          >
                            <MessageCircle size={18} aria-hidden="true" />
                            {t("diamondsPage.askAbout")}
                          </Button>
                        ) : null
                      }
                    />
                  </li>
                );
              })}
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
              variant="secondary"
              onClick={() => {
                setFilters(EMPTY_DIAMOND_FILTERS);
                setSheetOpen(false);
              }}
            >
              {t("common.clear")}
            </Button>
          </div>
        }
      >
        {panel}
      </Sheet>
    </div>
  );
}
