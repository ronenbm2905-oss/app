import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Field, TextInput, TextArea, Checkbox } from "./ui/Field.jsx";
import Button from "./ui/Button.jsx";
import { Notice } from "./ui/Bits.jsx";
import { validateLead, hasErrors } from "../utils/validate.js";
import { href } from "../utils/routes.js";

// ============================================================================
// LeadForm — נקודת האיסוף היחידה של PII באפליקציה.
//
// מה שחייב להיות כאן ואי אפשר להוסיף בדיעבד (A7):
//   • **שתי הסכמות נפרדות**, אף אחת לא מסומנת מראש. איחודן הורג את שתיהן:
//     השיווקית אינה "מפורשת מראש" לפי ס' 30א, וההסכמה ליצירת קשר נראית כפויה.
//   • **היידוע צמוד לטופס**, לא רק בעמוד נפרד (O2).
//   • `listingSnapshot` — מה שהלקוח ראה, כערכים משוכפלים (A7.6).
//   • תוויות `<label for>` אמיתיות — **לא placeholder כתווית** (O5.6).
//
// ⚠️ אין כאן שדה "תקציב" ואין "לרגל איזה אירוע" (A7.4) — שאלות שמזמינות
// מידע על מצב כלכלי, משפחתי או דת. `message` חופשי, והתווית שלו נייטרלית.
// ============================================================================

const EMPTY = {
  name: "",
  phone: "",
  email: "",
  message: "",
  consentContact: false,
  consentMarketing: false,
};

export default function LeadForm({ onSubmit, source = "contactForm", listingSnapshot = null, compact = false }) {
  const { t, lang } = useI18n();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | sent | error

  const set = (key) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setValues((p) => ({ ...p, [key]: val }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateLead(values);
    setErrors(errs);
    if (hasErrors(errs)) {
      // מיקוד לשדה הראשון עם שגיאה — אחרת משתמש מקלדת לא יודע מה נכשל.
      const first = document.querySelector('[aria-invalid="true"]');
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    setState("sending");
    try {
      await onSubmit(
        {
          ...values,
          source,
          listingSnapshot: listingSnapshot || undefined,
        },
        lang
      );
      setState("sent");
      setValues(EMPTY);
    } catch (err) {
      console.error("lead submit failed", err);
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="card p-6" role="status">
        <h3 className="text-xl font-semibold">{t("lead.successTitle")}</h3>
        <p className="mt-2 text-muted">{t("lead.successBody")}</p>
        <Button className="mt-4" variant="secondary" onClick={() => setState("idle")}>
          {t("lead.sendAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={compact ? "" : "card p-5 sm:p-6"}>
      {!compact ? <h3 className="mb-4 text-xl font-semibold">{t("lead.title")}</h3> : null}

      {listingSnapshot ? (
        <Notice className="mb-4">{t("lead.attachedConfig")}</Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("lead.name")} required error={errors.name ? t(errors.name) : null}>
          {(p) => (
            <TextInput
              {...p}
              value={values.name}
              onChange={set("name")}
              autoComplete="name"
              placeholder={t("lead.namePlaceholder")}
              error={Boolean(errors.name)}
            />
          )}
        </Field>

        <Field label={t("lead.phone")} required error={errors.phone ? t(errors.phone) : null}>
          {(p) => (
            <TextInput
              {...p}
              value={values.phone}
              onChange={set("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder={t("lead.phonePlaceholder")}
              error={Boolean(errors.phone)}
            />
          )}
        </Field>

        <Field
          label={t("lead.email")}
          hint={t("common.optional")}
          error={errors.email ? t(errors.email) : null}
          className="sm:col-span-2"
        >
          {(p) => (
            <TextInput
              {...p}
              value={values.email}
              onChange={set("email")}
              type="email"
              autoComplete="email"
              dir="ltr"
              placeholder={t("lead.emailPlaceholder")}
              error={Boolean(errors.email)}
            />
          )}
        </Field>

        <Field label={t("lead.message")} className="sm:col-span-2">
          {(p) => (
            <TextArea
              {...p}
              value={values.message}
              onChange={set("message")}
              placeholder={t("lead.messagePlaceholder")}
            />
          )}
        </Field>
      </div>

      {/* O2 — היידוע **בנקודה שבה הוא נקרא**, לא רק בעמוד נפרד. */}
      <div className="mt-5 rounded-xl border border-line bg-sand/50 p-4">
        <h4 className="text-sm font-semibold">{t("lead.privacyNoticeTitle")}</h4>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t("lead.privacyNoticeBody")}</p>
        <a className="mt-1 inline-block text-sm underline hover:text-rose-700" href={href.privacy()}>
          {t("lead.privacyLink")}
        </a>
      </div>

      {/* 🔴 A7.1 — שתי תיבות נפרדות, שתיהן לא מסומנות מראש. */}
      <div className="mt-4 space-y-3">
        <Checkbox
          checked={values.consentContact}
          onChange={set("consentContact")}
          error={errors.consentContact ? t(errors.consentContact) : null}
          label={
            <>
              {t("lead.consentContact")}{" "}
              <span className="text-muted">{t("lead.consentContactRequired")}</span>
            </>
          }
        />
        <Checkbox
          checked={values.consentMarketing}
          onChange={set("consentMarketing")}
          label={
            <>
              {t("lead.consentMarketing")}{" "}
              <span className="text-muted">{t("lead.consentMarketingOptional")}</span>
            </>
          }
        />
      </div>

      {state === "error" ? (
        <Notice tone="danger" className="mt-4">
          {t("lead.errorGeneric")}
        </Notice>
      ) : null}

      <Button type="submit" size="lg" className="mt-5 w-full sm:w-auto" disabled={state === "sending"}>
        {state === "sending" ? t("lead.submitting") : t("lead.submit")}
      </Button>
    </form>
  );
}
