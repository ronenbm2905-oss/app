/**
 * תבניות תוכנית — שמירה, טעינה ומחיקה.
 *
 * תבנית היא **נוחות ולא היסטוריה**, ולכן זו הקולקציה היחידה במערכת שבה מחיקה
 * אמיתית מותרת (`firestore.rules` → planTemplates). המחיקה מוגבלת שם לבעלים,
 * והמסך לא מציג כפתור מחיקה לתבנית של מאמן אחר — מראה של הכלל, לא תחליף לו.
 *
 * טעינת תבנית **לא מפרסמת דבר**: היא ממלאת את הטופס בלבד. תבנית ישנה יכולה
 * להכיל תרגיל שהוסר מהספרייה בינתיים, ולכן `templateToDraft` משמיט אותו
 * והמסך מדווח כמה הושמטו.
 */

import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { TEMPLATE_NAME_MAX_LENGTH, validateTemplateName } from '../../lib/plans';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import type { LoadStatus } from '../../hooks/loadStatus';
import type { PlanTemplateDoc } from '../../types/types';

interface PlanTemplatesPanelProps {
  status: LoadStatus;
  templates: PlanTemplateDoc[];
  coachUid: string;
  /** אין מה לשמור כשאין פריטים או כשהם לא תקינים. */
  canSave: boolean;
  busy: boolean;
  onSave: (name: string) => Promise<boolean>;
  onLoad: (template: PlanTemplateDoc) => void;
  onDelete: (template: PlanTemplateDoc) => Promise<boolean>;
}

export function PlanTemplatesPanel({
  status,
  templates,
  coachUid,
  canSave,
  busy,
  onSave,
  onLoad,
  onDelete,
}: PlanTemplatesPanelProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);

  async function handleSave() {
    const problem = validateTemplateName(
      name,
      templates.map((template) => template.name),
    );
    setError(problem);
    if (problem) return;

    const saved = await onSave(name);
    if (saved) setName('');
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{t('coach.plan.templates.title')}</h2>

      <div className="mt-3 space-y-2">
        <TextField
          id="plan-template-name"
          label={t('coach.plan.templates.nameLabel')}
          placeholder={t('coach.plan.templates.namePlaceholder')}
          maxLength={TEMPLATE_NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={error ? t(error) : null}
        />

        <Button variant="secondary" busy={busy} disabled={!canSave} onClick={() => void handleSave()}>
          {busy ? t('coach.plan.templates.saving') : t('coach.plan.templates.save')}
        </Button>
      </div>

      {status === 'loading' ? (
        <p className="mt-3 text-sm text-slate-500">{t('coach.plan.templates.loading')}</p>
      ) : status === 'error' ? (
        <p className="mt-3 text-sm text-red-600">{t('coach.plan.templates.loadError')}</p>
      ) : templates.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('coach.plan.templates.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {templates.map((template) => {
            const mine = template.coachUid === coachUid;

            return (
              <li
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                  <p className="text-xs text-slate-500">
                    {t('coach.plan.templates.itemsCount', { count: template.items.length })}
                    {mine ? '' : ` · ${t('coach.plan.templates.ownerOnly')}`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" fullWidth={false} onClick={() => onLoad(template)}>
                    {t('coach.plan.templates.load')}
                  </Button>
                  {mine ? (
                    <Button
                      variant="ghost"
                      fullWidth={false}
                      onClick={() => void onDelete(template)}
                    >
                      {t('coach.plan.templates.delete')}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
