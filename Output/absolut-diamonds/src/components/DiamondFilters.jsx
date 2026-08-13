import { useI18n } from "../hooks/useI18n.jsx";
import { Chip } from "./ui/Bits.jsx";
import { Field, SelectInput, TextInput } from "./ui/Field.jsx";
import { SHAPES, ORIGINS, COLORS, CLARITIES } from "../constants.js";
import { originLabel } from "../utils/validate.js";
import { toAgorot, toShekels } from "../utils/money.js";

// ============================================================================
// DiamondFilters — משמש גם בעמוד המלאי וגם בבורר שבתוך הקונפיגורטור.
//
// O5.5 — **שדות מספר min/max, בלי סליידרים.** סליידר לקראט ולמחיר הוא כשל
// מקלדת/AT ידוע, והמסקנה בסקירה הייתה מפורשת. שדה מספר עובד בכל טכנולוגיה
// מסייעת, ניתן להקלדה ישירה, ואפשר להצמיד לו תווית אמיתית.
//
// הצ'יפים נושאים `aria-pressed` — בלעדיו קורא מסך שומע "עגול" ולא יודע
// שהוא נבחר.
// ============================================================================

export default function DiamondFilters({ filters, onChange, showShapes = true }) {
  const { t, lang } = useI18n();

  const set = (patch) => onChange({ ...filters, ...patch });

  const toggleShape = (shape) => {
    const list = filters.shapes || [];
    set({ shapes: list.includes(shape) ? list.filter((s) => s !== shape) : [...list, shape] });
  };

  const numOrNull = (v) => (v === "" || v == null ? null : Number(v));

  return (
    <div className="space-y-6">
      {showShapes ? (
        <fieldset>
          <legend className="label">{t("filters.shape")}</legend>
          <div className="flex flex-wrap gap-2">
            {SHAPES.map((shape) => (
              <Chip
                key={shape}
                selected={(filters.shapes || []).includes(shape)}
                onClick={() => toggleShape(shape)}
              >
                {t(`taxonomy.shape.${shape}`)}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      {/* 🔴 A2 — הסינון לפי מקור קיים, אבל הוא **אינו** נחשב גילוי.
          הגילוי עצמו יושב על כל כרטיס ובכל דף אבן. */}
      <fieldset>
        <legend className="label">{t("filters.origin")}</legend>
        <div className="flex flex-wrap gap-2">
          <Chip selected={!filters.origin} dismissible={false} onClick={() => set({ origin: null })}>
            {t("filters.any")}
          </Chip>
          {ORIGINS.map((o) => (
            <Chip key={o} selected={filters.origin === o} onClick={() => set({ origin: o })}>
              {originLabel(o, lang)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("filters.caratFrom")}>
          {(p) => (
            <TextInput
              {...p}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              dir="ltr"
              value={filters.caratMin ?? ""}
              onChange={(e) => set({ caratMin: numOrNull(e.target.value) })}
            />
          )}
        </Field>
        <Field label={t("filters.caratTo")}>
          {(p) => (
            <TextInput
              {...p}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              dir="ltr"
              value={filters.caratMax ?? ""}
              onChange={(e) => set({ caratMax: numOrNull(e.target.value) })}
            />
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("filters.colorFrom")}>
          {(p) => (
            <SelectInput
              {...p}
              value={filters.colorFrom ?? ""}
              onChange={(e) => set({ colorFrom: e.target.value || null })}
            >
              <option value="">{t("filters.any")}</option>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t("filters.colorTo")}>
          {(p) => (
            <SelectInput
              {...p}
              value={filters.colorTo ?? ""}
              onChange={(e) => set({ colorTo: e.target.value || null })}
            >
              <option value="">{t("filters.any")}</option>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("filters.clarityFrom")}>
          {(p) => (
            <SelectInput
              {...p}
              value={filters.clarityFrom ?? ""}
              onChange={(e) => set({ clarityFrom: e.target.value || null })}
            >
              <option value="">{t("filters.any")}</option>
              {CLARITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t("filters.clarityTo")}>
          {(p) => (
            <SelectInput
              {...p}
              value={filters.clarityTo ?? ""}
              onChange={(e) => set({ clarityTo: e.target.value || null })}
            >
              <option value="">{t("filters.any")}</option>
              {CLARITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      </div>

      {/* המחיר נקלט בשקלים ונשמר באגורות — המרה במקום אחד. */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("filters.priceFrom")}>
          {(p) => (
            <TextInput
              {...p}
              type="number"
              inputMode="numeric"
              min="0"
              step="100"
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
              step="100"
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
