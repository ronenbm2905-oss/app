import { useState } from "react";
import { Search, Info } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { isValidPlate, formatPlate } from "../utils/mot.js";
import { formatDate } from "../utils/format.js";
import { Field, TextInput } from "./ui/Field.jsx";
import Button from "./ui/Button.jsx";
import { Card, Notice } from "./ui/Card.jsx";

// ============================================================================
// PlateLookup — **קיצור, לא שער.** הטופס הידני נמצא מתחת ותמיד גלוי, וגם
// כפתור "אני מעדיף להזין ידנית" נשאר פעיל **גם בזמן הטעינה**: לעולם לא
// נועלים משתמש בהמתנה לרשת.
//
// מצבי הכישלון הם **ענבר, לא אדום** — זו לא אשמת המשתמש. ולעולם לא
// "Error 404", לא קוד שגיאה, ולא "שגיאת ולידציה" (PRD §9.3).
// ============================================================================

export function PlateLookup({ plate, setPlate, lookup, state, result, slow, onAccept, onManual }) {
  const { t, lang } = useI18n();
  const [touched, setTouched] = useState(false);

  const invalid = touched && plate && !isValidPlate(plate);
  const loading = state === "loading";

  const submit = () => {
    setTouched(true);
    if (!plate || !isValidPlate(plate)) return;
    lookup(plate);
  };

  const v = result?.vehicle;

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-ink-strong">{t("vehicle.add.title")}</h1>
        <p className="max-w-prose text-lg text-ink-muted">{t("vehicle.add.sub")}</p>
      </div>

      <Field
        label={t("vehicle.add.plate.label")}
        hint={t("vehicle.add.plate.hint")}
        error={invalid ? t("vehicle.add.plate.error.invalid") : null}
      >
        {({ id, ...aria }) => (
          <TextInput
            id={id}
            {...aria}
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            onBlur={() => setTouched(true)}
            invalid={Boolean(invalid)}
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            placeholder={t("vehicle.add.plate.placeholder")}
            className="num h-[72px] text-center text-2xl"
          />
        )}
      </Field>

      <Button variant="primary" onClick={submit} loading={loading} loadingLabel={t("vehicle.add.loading")}>
        <Search size={24} aria-hidden="true" />
        {t("vehicle.add.submit")}
      </Button>

      {/* הכפתור הזה **לא** מושבת בזמן טעינה. במכוון. */}
      <Button variant="quiet" size="md" onClick={onManual}>
        {t("vehicle.add.manualLink")}
      </Button>

      {loading && (
        <p className="text-lg text-ink-muted" aria-live="polite">
          {slow ? t("vehicle.add.loading.slow") : t("vehicle.add.loading")}
        </p>
      )}

      {/* -- נמצא: מציגים מה נמצא **לפני** שמירה ------------------------- */}
      {state === "found" && v && (
        <Card className="space-y-3 p-4">
          <h2 className="text-xl font-semibold text-ink">{t("vehicle.add.found.title")}</h2>
          <p className="max-w-prose text-base text-ink-muted">{t("vehicle.add.found.sub")}</p>
          <dl className="divide-y divide-line-soft">
            {[
              ["vehicle.add.found.plate", formatPlate(v.plate), true],
              ["vehicle.add.found.model", [v.manufacturer, v.commercialName].filter(Boolean).join(" "), false],
              ["vehicle.add.found.year", v.year, true],
              ["vehicle.add.found.color", v.color, false],
              ["vehicle.add.found.fuel", v.fuelType, false],
              ["vehicle.add.found.testValid", formatDate(v.testValidUntil, lang), true],
            ].map(([key, value, numeric]) => (
              <div key={key} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-base text-ink-muted">{t(key)}</dt>
                {/* שדה ריק מוצג כ"לא ידוע" — **אף פעם לא שורה ריקה**,
                    שנראית למשתמש מבוגר כמו אפליקציה שנשברה. */}
                <dd className={`text-lg text-ink ${numeric ? "num" : ""}`}>
                  {value || t("common.notSet")}
                </dd>
              </div>
            ))}
          </dl>
          {!v.testValidUntil && (
            <p className="text-base text-warn-700">{t("vehicle.add.found.testValid.none")}</p>
          )}
          <p className="max-w-prose text-sm text-ink-soft">{t("vehicle.add.found.disclaimer")}</p>
          <Button variant="confirm" onClick={() => onAccept(v)}>
            {t("vehicle.add.found.confirm")}
          </Button>
        </Card>
      )}

      {/* -- מבוטל -------------------------------------------------------- */}
      {state === "deregistered" && v && (
        <Notice tone="warn" icon={<Info size={24} />} title={t("vehicle.add.deregistered.title")}>
          <p>
            {v.deregisteredAt
              ? t("vehicle.add.deregistered.body", {
                  plate: formatPlate(v.plate),
                  date: formatDate(v.deregisteredAt, lang),
                })
              : t("vehicle.add.deregistered.body.noDate", { plate: formatPlate(v.plate) })}
          </p>
          <p className="mt-2">{t("vehicle.add.deregistered.hint")}</p>
        </Notice>
      )}

      {/* -- לא נמצא / רשת — ענבר, והטופס הידני כבר פתוח מתחת ------------- */}
      {state === "notFound" && (
        <Notice tone="warn" icon={<Info size={24} />} title={t("vehicle.add.notFound.title")}>
          <p>{t("vehicle.add.notFound.body")}</p>
        </Notice>
      )}
      {state === "network" && (
        <Notice tone="warn" icon={<Info size={24} />} title={t("vehicle.add.network.title")}>
          <p>{t("vehicle.add.network.body")}</p>
        </Notice>
      )}
    </section>
  );
}

export default PlateLookup;
