import { forwardRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { LeadData, QuestionnaireConfig } from '@shared/types/questionnaire';
import { leadSchema, primaryFields } from '@/lib/validation';
import { Button } from '@/components/ui/Button';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';

interface Props {
  config: QuestionnaireConfig;
  submitting: boolean;
  error: string | null;
  onSubmit: (lead: LeadData, website: string) => void;
  onBack: () => void;
}

type FormValues = Record<string, string | boolean | number>;

export const LeadCaptureScreen = forwardRef<HTMLHeadingElement, Props>(
  function LeadCaptureScreen({ config, submitting, error, onSubmit, onBack }, ref) {
    const fields = primaryFields(config);
    const {
      register,
      handleSubmit,
      formState: { errors },
    } = useForm<FormValues>({
      resolver: zodResolver(leadSchema(config, 'primary')),
      mode: 'onBlur',
    });

    return (
      <section className="mx-auto w-full max-w-2xl px-5 py-10">
        <h1 ref={ref} tabIndex={-1} className="text-2xl font-bold sm:text-3xl">
          {config.leadCaptureHeadline}
        </h1>
        {config.leadCaptureSubline && (
          <p className="mt-2 text-muted">{config.leadCaptureSubline}</p>
        )}

        <form
          noValidate
          className="mt-8 space-y-5"
          onSubmit={handleSubmit((values) => {
            const { website, ...lead } = values as FormValues & { website?: string };
            onSubmit(lead as unknown as LeadData, String(website ?? ''));
          })}
        >
          {/* honeypot — בוטים ממלאים, בני אדם לא רואים (§6.3) */}
          <div className="hp-field" aria-hidden="true">
            <label htmlFor="website">אתר אינטרנט</label>
            <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
          </div>

          {fields.map((field) => {
            const message = errors[field.id]?.message as string | undefined;

            if (field.type === 'checkbox') {
              return (
                <div key={field.id} className="rounded-xl bg-surface p-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                    <input
                      id={field.id}
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
                      {...register(field.id)}
                    />
                    <span>{field.label}</span>
                  </label>
                  {message && <p className="mt-2 text-sm text-brand">{message}</p>}
                </div>
              );
            }

            return (
              <div key={field.id}>
                <label htmlFor={field.id} className="mb-1.5 block font-semibold">
                  {field.label}
                  {field.required && <span aria-hidden="true"> *</span>}
                </label>
                <input
                  id={field.id}
                  type={field.type}
                  inputMode={field.type === 'tel' ? 'tel' : undefined}
                  autoComplete={
                    field.id === 'fullName' ? 'name' : field.type === 'tel' ? 'tel' : field.type
                  }
                  placeholder={field.placeholder}
                  aria-required={field.required}
                  aria-invalid={message ? true : undefined}
                  aria-describedby={message ? `${field.id}-error` : undefined}
                  className={`min-h-touch w-full rounded-xl border-2 bg-white px-4 py-3 text-base ${
                    message ? 'border-brand' : 'border-line'
                  }`}
                  {...register(field.id)}
                />
                {message && (
                  <p id={`${field.id}-error`} role="alert" className="mt-1.5 text-sm text-brand">
                    {message}
                  </p>
                )}
              </div>
            );
          })}

          <Button type="submit" disabled={submitting}>
            {submitting ? 'שולח…' : config.submitLabel}
          </Button>

          {error && (
            <div role="alert" className="space-y-3 rounded-xl border-2 border-line bg-surface p-4">
              <p className="font-semibold">אירעה תקלה בשליחה. אנא צור קשר ישירות בוואטסאפ.</p>
              <WhatsAppButton formSlug={config.slug} tier="A" label="פנייה בוואטסאפ" />
            </div>
          )}

          <div className="pt-1">
            <Button variant="ghost" onClick={onBack} type="button">
              חזור לשאלה הקודמת
            </Button>
          </div>

          <p className="pt-2 text-xs leading-relaxed text-muted">
            הפרטים נשמרים לצורך הבדיקה בלבד. פירוט מלא ב
            <a href="/privacy" className="underline underline-offset-2">
              מדיניות הפרטיות
            </a>
            .
          </p>
        </form>
      </section>
    );
  }
);
