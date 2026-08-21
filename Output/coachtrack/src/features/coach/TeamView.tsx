/**
 * מסך ניהול הקבוצה — התצוגה בלבד.
 *
 * הקומפוננטה לא נוגעת ב-Firestore: כל הנתונים מגיעים ב-props וכל פעולה יוצאת
 * דרך callback. זה מה שמאפשר לרנדר אותה בטסט בלי דפדפן ובלי ענן, ולבדוק שהמסך
 * אומר את הדברים הנכונים בכל מצב (ריק, טעינה, שגיאה, שחקן מושבת).
 *
 * הסינון לפי קבוצה, החיפוש והמיון נעשים כאן בצד הלקוח דרך `lib/players.ts` —
 * ראה `hooks/useOrgUsers.ts` להסבר למה השאילתה עצמה לא מסננת לפי קבוצה.
 */

import { useMemo, useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Select';
import { TextField } from '../../components/ui/TextField';
import { onlyPlayers, playersOfTeam, visiblePlayers } from '../../lib/players';
import type { NewPlayerFormValues } from '../../lib/players';
import type { Feedback } from '../../lib/feedback';
import type { LoadStatus } from '../../hooks/loadStatus';
import { t } from '../../i18n/he';
import type { TeamDoc, UserDoc } from '../../types/types';
import { AddPlayerForm } from './AddPlayerForm';
import { PlayerRow } from './PlayerRow';

export interface TeamViewProps {
  status: LoadStatus;
  teams: TeamDoc[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  /** כל משתמשי הארגון. הסינון לשחקנים ולקבוצה נעשה כאן. */
  users: UserDoc[];
  onAddPlayer: (values: NewPlayerFormValues) => Promise<boolean>;
  onSetActive: (player: UserDoc, active: boolean) => Promise<boolean>;
  /** ה-uid שפעולה עליו רצה כרגע, כדי לחסום לחיצה כפולה. */
  busyUid: string | null;
  feedback: Feedback | null;
}

export function TeamView({
  status,
  teams,
  selectedTeamId,
  onSelectTeam,
  users,
  onAddPlayer,
  onSetActive,
  busyUid,
  feedback,
}: TeamViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const teamPlayers = useMemo(
    () => playersOfTeam(onlyPlayers(users), selectedTeamId),
    [users, selectedTeamId],
  );
  const shown = useMemo(
    () => visiblePlayers(users, selectedTeamId, searchTerm),
    [users, selectedTeamId, searchTerm],
  );

  const activeCount = teamPlayers.filter((player) => player.active).length;
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const takenUsernames = onlyPlayers(users).map((player) => player.username);

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">{t('coach.team.loading')}</p>;
  }

  if (status === 'error') {
    return <Alert tone="error">{t('coach.team.loadError')}</Alert>;
  }

  return (
    <div className="space-y-4">
      {feedback ? <Alert tone={feedback.tone}>{feedback.text}</Alert> : null}

      {teams.length === 0 ? <Alert tone="info">{t('coach.team.noTeam')}</Alert> : null}

      {/* בורר קבוצה רק כשיש יותר מאחת. ב-MVP יש קבוצה אחת, והבורר מיותר. */}
      {teams.length > 1 ? (
        <SelectField
          id="team-select"
          label={t('coach.team.teamSelectLabel')}
          value={selectedTeamId ?? ''}
          onChange={(event) => onSelectTeam(event.target.value)}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      {selectedTeam && !showAddForm ? (
        <Button onClick={() => setShowAddForm(true)}>{t('coach.team.add.toggle')}</Button>
      ) : null}

      {selectedTeam && showAddForm ? (
        <AddPlayerForm
          teamName={selectedTeam.name}
          takenUsernames={takenUsernames}
          onSubmit={onAddPlayer}
          onClose={() => setShowAddForm(false)}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{t('coach.team.playersTitle')}</h2>
          <p className="text-sm text-slate-500">
            {t('coach.team.playersCount', {
              active: activeCount,
              total: teamPlayers.length,
            })}
          </p>
        </div>

        {teamPlayers.length > 0 ? (
          <TextField
            id="player-search"
            label={t('coach.team.searchLabel')}
            placeholder={t('coach.team.searchPlaceholder')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            type="search"
          />
        ) : null}

        {teamPlayers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            {t('coach.team.empty')}
          </p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-500">{t('coach.team.noResults')}</p>
        ) : (
          <ul className="space-y-3">
            {shown.map((player) => (
              <PlayerRow
                key={player.uid}
                player={player}
                onSetActive={onSetActive}
                busy={busyUid === player.uid}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
