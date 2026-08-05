import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Button } from "./ui/Button.jsx";
import { IconCheck } from "./ui/icons.jsx";
import { PropertyForm } from "./PropertyForm.jsx";
import { createProperty } from "../schema.js";
import { PORTFOLIO_SIZES } from "../constants.js";

// מסך 0 — Onboarding: זרימה מונחית (לא טופס ארוך).
// שלב 1: כמה נכסים (מכוונן portfolioSize) · שלב 2: כתובת+סוג בלבד · שלב 3: סיום.
export function Onboarding({ ownerId, onComplete, onSkip }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [portfolioSize, setPortfolioSize] = useState(null);
  const [draftProperty, setDraftProperty] = useState(null); // נשמר לוקלית עד הסיום

  const steps = [t("onb.step.size"), t("onb.step.address"), t("onb.step.done")];

  // הנכס נאסף לוקלית ומוצג מסך הסיום; ההתמדה הגלובלית קורית פעם אחת בסיום
  // (אחרת persist מוקדם היה מפיל את תנאי ה-onboarding ומדלג על מסך הסיום).
  function handleCreate(property) {
    setDraftProperty(property);
    setStep(2);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* מחוון שלבים */}
      <ol className="mb-8 flex items-center justify-center gap-2 text-xs">
        {steps.map((label, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full font-semibold ${
                i <= step ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {i < step ? <IconCheck size={16} /> : i + 1}
            </span>
            <span className={i <= step ? "text-slate-700" : "text-slate-400"}>{label}</span>
            {i < steps.length - 1 && <span className="mx-1 text-slate-300">—</span>}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        {step === 0 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-slate-800">{t("onb.welcome")}</h1>
            <p className="mb-6 text-slate-600">{t("onb.intro")}</p>
            <h2 className="mb-3 text-lg font-semibold text-slate-700">{t("onb.q.portfolio")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PORTFOLIO_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setPortfolioSize(size);
                    setStep(1);
                  }}
                  className={`rounded-xl border-2 p-4 text-center text-sm font-medium transition ${
                    portfolioSize === size
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-brand-300"
                  }`}
                >
                  {t(`enum.portfolio.${size}`)}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={onSkip}>
                {t("onb.skip")}
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="mb-1 text-2xl font-bold text-slate-800">{t("onb.address.title")}</h1>
            <p className="mb-6 text-slate-600">{t("onb.address.hint")}</p>
            <PropertyForm
              initial={createProperty({ ownerId })}
              mode="onboarding"
              onSubmit={handleCreate}
              onCancel={() => setStep(0)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
              <IconCheck size={32} />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-slate-800">{t("onb.done.title")}</h1>
            <p className="mb-6 text-slate-600">{t("onb.done.body")}</p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => onComplete({ property: draftProperty, portfolioSize, goTo: null })}>
                {t("nav.lobby")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => onComplete({ property: draftProperty, portfolioSize, goTo: draftProperty?.id })}
              >
                {t("onb.goToProperty")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
