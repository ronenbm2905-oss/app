/**
 * הקבוצות של המאמן.
 *
 * השאילתה: query(collection(db, 'teams'), where('orgId', '==', orgId)) —
 * שוב הסינון ב-orgId, כי כלל הקריאה על teams הוא sameOrg(resource.data.orgId).
 *
 * הסינון לפי coachUid נעשה **בלקוח**: שני שוויונות באותה שאילתה היו דורשים
 * אינדקס מורכב, ובארגון אחד יש קומץ קבוצות. ה-MVP הוא קבוצה אחת ממילא —
 * הרשימה קיימת כדי שהמסך לא יקבע את זה בקוד.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Team, TeamDoc } from '../types/types';
import type { LoadStatus } from './loadStatus';

export interface CoachTeamsState {
  status: LoadStatus;
  teams: TeamDoc[];
}

interface TeamsSnapshot extends CoachTeamsState {
  orgId: string;
}

const NO_TEAMS: TeamDoc[] = [];

export function useCoachTeams(
  orgId: string | undefined,
  coachUid: string | undefined,
): CoachTeamsState {
  const [snapshotState, setSnapshotState] = useState<TeamsSnapshot | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const teamsQuery = query(collection(db, 'teams'), where('orgId', '==', orgId));

    return onSnapshot(
      teamsQuery,
      (snapshot) => {
        const teams = snapshot.docs.map((document) => ({
          ...(document.data() as Team),
          id: document.id,
        }));
        setSnapshotState({ orgId, status: 'ready', teams });
      },
      (error) => {
        console.error('[CoachTrack] טעינת הקבוצות נכשלה', error);
        setSnapshotState({ orgId, status: 'error', teams: [] });
      },
    );
  }, [orgId]);

  const fresh = orgId && snapshotState?.orgId === orgId ? snapshotState : null;
  const rawTeams = fresh ? fresh.teams : NO_TEAMS;

  const teams = useMemo(() => {
    const mine = coachUid ? rawTeams.filter((team) => team.coachUid === coachUid) : rawTeams;
    return [...mine].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [rawTeams, coachUid]);

  return { status: fresh ? fresh.status : 'loading', teams };
}
