import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import DiamondRow from "../components/DiamondRow.jsx";
import DiamondFilters from "../components/DiamondFilters.jsx";
import Sheet from "../components/ui/Sheet.jsx";
import Button from "../components/ui/Button.jsx";
import WhatsAppButton from "../components/ui/WhatsAppButton.jsx";
import { EmptyState, PageTitle } from "../components/ui/Bits.jsx";
import { filterDiamonds, sortDiamonds, countActiveFilters } from "../utils/filters.js";
import { contactFor } from "../utils/defaults.js";
import { whatsappHref, diamondMessage } from "../utils/whatsapp.js";
import { EMPTY_DIAMOND_FILTERS, DIAMOND_SORTS } from "../constants.js";

// עמוד מלאי האבנים. הכניסה ההפוכה לקונפיגורטור: מי שמתחיל מהאבן ולא מהדגם.
//
// 🔴 השינוי המבני: **רשימת מסמכים, לא גריד כרטיסים.** אבן היא מפרט + תעודה,
// והצילום שלה כמעט תמיד לא קיים (וכשהוא לא קיים — אסור להחליף אותו בסטוק).
// שורה ברוחב מלא נותנת מקום למקור, לטיפולים ולמספר התעודה בלי לדחוס אותם.
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
    <div className="container-page py-8 lg:py-12">
      <PageTitle sub={t("diamondsPage.subtitle")}>{t("diamondsPage.title")}</PageTitle>

      <div className="mb-6 flex flex-wrap items-center gap-4 border-y border-line py-3">
        <Button variant="link" className="lg:hidden" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal size={18} strokeWidth={1.5} aria-hidden="true" />
          {t("catalog.openFilters")}
          {activeCount ? <span className="num">({activeCount})</span> : null}
        </Button>

        <div className="ms-auto flex items-center gap-3">
          <label htmlFor="d-sort" className="text-meta text-muted">
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

      <div className="grid gap-10 lg:grid-cols-[18rem_1fr] lg:gap-12">
        <aside className="hidden lg:block">
          <h2 className="eyebrow mb-5">{t("catalog.filtersTitle")}</h2>
          {panel}
          {activeCount ? (
            <Button variant="link" className="mt-6" onClick={() => setFilters(EMPTY_DIAMOND_FILTERS)}>
              {t("catalog.clearAll")}
            </Button>
          ) : null}
        </aside>

        <div>
          <p className="mb-2 text-meta font-medium" aria-live="polite">
            {visible.length === 1
              ? t("diamondsPage.resultsCountOne")
              : t("diamondsPage.resultsCount", { count: visible.length })}
          </p>

          {visible.length === 0 ? (
            <EmptyState title={t("diamondsPage.resultsNone")} body={t("diamondsPage.noResultsHint")} />
          ) : (
            <ul className="border-t border-line">
              {visible.map((d) => {
                const wa = whatsappHref(contact.whatsapp, diamondMessage(t, d, contact, lang));
                return (
                  <li key={d.id}>
                    <DiamondRow
                      diamond={d}
                      action={
                        wa ? (
                          <WhatsAppButton href={wa} size="sm">
                            {t("diamondsPage.askAbout")}
                          </WhatsAppButton>
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
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              {t("common.apply")}
            </Button>
            <Button
              variant="outline"
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
