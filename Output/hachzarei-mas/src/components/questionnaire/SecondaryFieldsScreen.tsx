import { forwardRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { QuestionnaireConfig } from '@shared/types/questionnaire';
import { leadSchema, secondaryFields } from '@/lib/validation';
import { Button } from '@/components/ui/Button';

interface Props {
  config: QuestionnaireConfig;
  onSubmit: (extra: Record<string, unknown>) => Promise<void>;
  onSkip: () => void;
}

/**
 * מסך N+3 — השלמת פרטים.
 *
 * מוצג רק אחרי שהליד **כבר נשלח**. אי-מילוי לא פוגע בו בשום צורה,
 * ולכן אין כאן שדות חובה ואין הודעת שגיאה חוסמת.
 */
export const SecondaryFieldsScreen = forwardRef<HTMLHeadingElement, Props>(
  function SecondaryFieldsScreen({ config, onSubmit, onSkip }, ref) {
    const [saving, setSaving] = useState(false);
    const fields = secondaryFields(config);
    const { register, handleSubmit } = useForm({
      resolver: zodResolver(leadSchema(config, 'secondary')),
    });

    return (
      <section className="mx-auto w-full max-w-2xl px-5 py-10">
        <h1 ref={ref} tabIndex={-1} className="text-2xl font-bold">
          כמה פרטים נוספים יזרזו את הטיפול
        </h1>
        <p className="mt-2 text-muted">הפנייה שלך כבר נשלחה — אפשר לדלג בכל שלב.</p>

        <form
          noValidate
          className="mt-8 space-y-5"
          onSubmit={handleSubmit(async (values) => {
            setSaving(true);
            try {
              await onSubmit(values);
            } finally {
              setSaving(false);
            }
          })}
        >
          {fields.map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className="mb-1.5 block font-semibold">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  id={field.id}
                  className="min-h-touch w-full rounded-xl border-2 border-line bg-white px-4 py-3 text-base"
                  defaultValue=""
                  {...register(field.id)}
                >
                  <option value="">בחר…</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={field.id}
                  type={field.type}
                  min={field.type === 'number' ? 0 : undefined}
                  className="min-h-touch w-full rounded-xl border-2 border-line bg-white px-4 py-3 text-base"
                  {...register(field.id)}
                />
              )}
            </div>
          ))}

          <Button type="submit" disabled={saving}>
            {saving ? 'שומר…' : 'שמור והמשך'}
          </Button>

          <div className="pt-1">
            <Button variant="ghost" type="button" onClick={onSkip}>
              דלג
            </Button>
          </div>
        </form>
      </section>
    );
  }
);
