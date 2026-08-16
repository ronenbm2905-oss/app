import { Camera } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Field, TextInput, NumberInput, DateInput, PhoneInput } from "./ui/Field.jsx";
import FileInput from "./FileInput.jsx";

// ============================================================================
// VehicleForm — שדות הרכב. **הטופס הזה תמיד גלוי** במסך ההוספה: הוא המסלול
// הראשי, והמשיכה ממשרד התחבורה היא קיצור שממלא אותו — לא תנאי מקדים.
// משתמש בלי רשת משלים הוספת רכב מקצה לקצה בלי לגעת בכפתור החיפוש.
//
// כל תווית גלויה מעל השדה, תמיד. בלי placeholder-כתווית.
// ============================================================================

export function VehicleForm({ values, set, disabled = false, local = false }) {
  const { t } = useI18n();
  const bind = (key) => ({
    value: values[key] ?? "",
    onChange: (e) => set(key, e.target.value),
    disabled,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Field label={t("vehicle.field.nickname")} hint={t("vehicle.field.nickname.hint")}>
          {({ id, ...aria }) => <TextInput id={id} {...aria} {...bind("nickname")} />}
        </Field>
        <Field label={t("vehicle.field.manufacturer")}>
          {({ id, ...aria }) => <TextInput id={id} {...aria} {...bind("manufacturer")} />}
        </Field>
        <Field label={t("vehicle.field.model")}>
          {({ id, ...aria }) => <TextInput id={id} {...aria} {...bind("commercialName")} />}
        </Field>
        <Field label={t("vehicle.field.year")}>
          {({ id, ...aria }) => <NumberInput id={id} {...aria} {...bind("year")} />}
        </Field>
        <Field label={t("vehicle.field.color")}>
          {({ id, ...aria }) => <TextInput id={id} {...aria} {...bind("color")} />}
        </Field>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">{t("task.type.test")}</h2>
        <Field label={t("vehicle.field.testValidUntil")} hint={t("vehicle.field.testValidUntil.hint")}>
          {({ id, ...aria }) => <DateInput id={id} {...aria} {...bind("testValidUntil")} />}
        </Field>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">{t("task.type.insurance")}</h2>
        <Field label={t("vehicle.field.compulsoryUntil")}>
          {({ id, ...aria }) => <DateInput id={id} {...aria} {...bind("compulsoryInsuranceUntil")} />}
        </Field>
        <Field label={t("vehicle.field.comprehensiveUntil")}>
          {({ id, ...aria }) => <DateInput id={id} {...aria} {...bind("comprehensiveInsuranceUntil")} />}
        </Field>
        <Field label={t("vehicle.field.insurer")}>
          {({ id, ...aria }) => <TextInput id={id} {...aria} {...bind("insurerName")} />}
        </Field>
        <Field label={t("vehicle.field.policyNumber")}>
          {({ id, ...aria }) => <TextInput id={id} dir="ltr" className="num" {...aria} {...bind("policyNumber")} />}
        </Field>
        {/* הטלפון הזה הופך לכפתור החיוג הראשי במסך החירום — ולכן ההסבר. */}
        <Field label={t("vehicle.field.insurerPhone")} hint={t("vehicle.field.insurerPhone.hint")}>
          {({ id, ...aria }) => <PhoneInput id={id} {...aria} {...bind("insurerEmergencyPhone")} />}
        </Field>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">{t("task.type.service")}</h2>
        <Field label={t("vehicle.field.garageName")}>
          {({ id, ...aria }) => <TextInput id={id} {...aria} {...bind("garageName")} />}
        </Field>
        <Field label={t("vehicle.field.garagePhone")}>
          {({ id, ...aria }) => <PhoneInput id={id} {...aria} {...bind("garagePhone")} />}
        </Field>
        <Field label={t("vehicle.field.lastService")}>
          {({ id, ...aria }) => <DateInput id={id} {...aria} {...bind("lastServiceDate")} />}
        </Field>
        <Field label={t("vehicle.field.currentKm")} hint={t("vehicle.field.currentKm.hint")}>
          {({ id, ...aria }) => <NumberInput id={id} {...aria} {...bind("currentKm")} />}
        </Field>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">{t("vehicle.field.photo")}</h2>
        <p className="max-w-prose text-base text-ink-muted">{t("vehicle.field.photo.hint")}</p>
        {values.photoData ? (
          <img
            src={values.photoData}
            alt={t("vehicle.field.photo")}
            className="aspect-[16/9] w-full rounded-2xl object-cover"
          />
        ) : null}
        {/* תמונת רכב מותרת גם במצב מקומי — בניגוד למסמכים אישיים. */}
        <FileInput
          label={t("vehicle.field.photo.cta")}
          icon={<Camera size={24} aria-hidden="true" />}
          domain="photo"
          local={local}
          disabled={disabled}
          onPicked={(res) => {
            set("photoData", res.localData || null);
            set("photoRef", res.fileRef || null);
            set("photoName", res.fileName || "");
            set("photoStorageMode", res.storageMode);
          }}
        />
      </div>
    </div>
  );
}

export default VehicleForm;
