/**
 * שורת שחקן ברשימת הקבוצה: שם, שם משתמש, תגיות מצב, ושלוש פעולות —
 * איפוס סיסמה, השבתה, והפעלה מחדש.
 *
 * **אין כפתור מחיקה, ולא יהיה.** כלל 5: אין מחיקה קשיחה, וגם `firestore.rules`
 * חוסמים אותה (`allow delete: if false`). שחקן שעזב מסומן `active: false`
 * וההיסטוריה שלו נשארת.
 *
 * פאנל איפוס הסיסמה לא "מאפס" כלום — הוא מציג את הפקודה שצריך להריץ. אין נתיב
 * איפוס בצד לקוח, וההסתרה של העובדה הזו הייתה גורמת למאמן לחפש כפתור שלא קיים.
 */

import { useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { resetPasswordCommand } from '../../lib/players';
import { t } from '../../i18n/he';
import type { UserDoc } from '../../types/types';

interface PlayerRowProps {
  player: UserDoc;
  /** מחזירה false אם העדכון נכשל (ההודעה מוצגת ברמת המסך). */
  onSetActive: (player: UserDoc, active: boolean) => Promise<boolean>;
  busy: boolean;
}

export function PlayerRow({ player, onSetActive, busy }: PlayerRowProps) {
  const [showReset, setShowReset] = useState(false);
  const [copied, setCopied] = useState(false);

  const command = resetPasswordCommand(player.username);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      // דפדפן שחוסם גישה ללוח — הפקודה ממילא מוצגת על המסך להעתקה ידנית.
      setCopied(false);
    }
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`truncate text-base font-semibold ${
              player.active ? 'text-slate-900' : 'text-slate-400'
            }`}
          >
            {player.displayName}
          </p>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {t('coach.team.usernameLine', { username: player.username })}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {player.active ? null : <Badge tone="muted">{t('coach.team.inactiveBadge')}</Badge>}
            {player.mustChangePassword ? (
              <Badge tone="warning">{t('coach.team.pendingPasswordBadge')}</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => setShowReset((previous) => !previous)}
            aria-expanded={showReset}
          >
            {t('coach.team.actions.resetPassword')}
          </Button>

          <Button
            variant="secondary"
            fullWidth={false}
            busy={busy}
            onClick={() => void onSetActive(player, !player.active)}
          >
            {player.active
              ? t('coach.team.actions.deactivate')
              : t('coach.team.actions.activate')}
          </Button>
        </div>
      </div>

      {showReset ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-900">{t('coach.team.reset.title')}</p>
          <p className="mt-1 text-sm text-slate-600">{t('coach.team.reset.body')}</p>
          <p className="mt-2 text-sm text-slate-600">{t('coach.team.reset.instruction')}</p>

          <code
            dir="ltr"
            className="mt-1 block overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-start text-xs text-slate-100"
          >
            {command}
          </code>

          <div className="mt-2 flex items-center gap-2">
            <Button variant="secondary" fullWidth={false} onClick={() => void copyCommand()}>
              {t('coach.team.reset.copy')}
            </Button>
            {copied ? (
              <span className="text-xs text-emerald-700">{t('coach.team.reset.copied')}</span>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-slate-500">{t('coach.team.reset.note')}</p>
        </div>
      ) : null}
    </li>
  );
}
