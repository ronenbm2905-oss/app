// ============================================================================
// MorningBriefView.tsx — מסך דוח הבוקר. שלוש רמות: 🔴 / 🟡 / ⚪.
//
// למה קבוצת הרעש **מקופלת** ולא מוסתרת: המשתמשת צריכה לראות את המספר כדי
// לסמוך על הכלי ("הוא לא בלע לי משהו?"), ולא צריכה לראות את הפריטים. מספר
// גלוי + פתיחה בלחיצה נותן את שניהם. הסתרה מלאה הייתה הופכת את המסנן לקופסה
// שחורה, וכלי שסוגר דברים בלי שאפשר לבדוק אותו לא זוכה לאמון — במיוחד אצל
// משתמשת לא-טכנית שכבר פספסה מייל פעם אחת.
// ============================================================================

import { useMemo, useState } from 'react';
import {
  isClassified,
  type BriefLevel,
  type ClassifiedItem,
  type RunStats,
  type TriageItem,
} from '../../shared/types';
import { levelOf } from '../utils/pipeline';
import { t } from '../i18n';
import { NoiseItemRow, TriageItemCard } from './TriageItemCard';

const LEVELS: Array<{ key: BriefLevel; dot: string; label: string; ring: string }> = [
  { key: 'action', dot: '🔴', label: t('levelAction'), ring: 'border-red-200 bg-red-50' },
  { key: 'review', dot: '🟡', label: t('levelReview'), ring: 'border-amber-200 bg-amber-50' },
  { key: 'noise', dot: '⚪', label: t('levelNoise'), ring: 'border-slate-200 bg-slate-50' },
];

export interface MorningBriefViewProps {
  items: TriageItem[];
  bodies: Map<string, string>;
  stats: RunStats;
  canEdit: boolean;
  onCreateTask: (item: ClassifiedItem) => void;
  onToggleHandled: (id: string) => void;
}

export function MorningBriefView({
  items,
  bodies,
  stats,
  canEdit,
  onCreateTask,
  onToggleHandled,
}: MorningBriefViewProps) {
  const [noiseOpen, setNoiseOpen] = useState(false);

  const grouped = useMemo(() => {
    const g: Record<BriefLevel, TriageItem[]> = { action: [], review: [], noise: [], order: [] };
    for (const item of items) g[levelOf(item)].push(item);
    return g;
  }, [items]);

  /**
   * ★ הזמנות **אינן** קבוצה בדוח הבוקר — הן שורה שמצביעה למסך אחר.
   *
   * הכרעה מוצרית ולא טכנית: הזמנה אינה "מייל לקרוא" אלא "חבילה לארוז", והיא
   * דורשת מסך עם כמות גדולה וכפתור העתקה. שכפול שלה לשני מסכים היה יוצר שני
   * מקומות לסמן בהם "נשלח", ומצב שבו סימון במקום אחד לא מופיע בשני.
   *
   * ובכל זאת המספר מופיע כאן: אם המסך השני יישבר, המשתמשת עדיין תראה שהגיעו
   * הזמנות. מסך שמסתיר לגמרי הוא מסך שאי אפשר לגלות דרכו תקלה.
   */
  const orderCount = grouped.order.length;

  return (
    <div className="space-y-5">
      <FilterStats stats={stats} />

      {orderCount > 0 ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          הגיעו {orderCount} הודעות על הזמנות ששולמו. הן מחכות לך בלשונית
          <span className="font-semibold"> הזמנות לשליחה</span>, עם הכתובת והכמות לכל אחת.
        </p>
      ) : null}

      {LEVELS.map(({ key, dot, label, ring }) => {
        const group = grouped[key];
        const isNoise = key === 'noise';
        const visible = !isNoise || noiseOpen;

        return (
          <section key={key} className={`rounded-xl border p-3 ${ring}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <span aria-hidden="true">{dot}</span>
                <span>{label}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {group.length}
                </span>
              </h2>

              {isNoise && group.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setNoiseOpen((v) => !v)}
                  aria-expanded={noiseOpen}
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {noiseOpen ? t('noiseGroupHide') : t('noiseGroupShow')}
                </button>
              ) : null}
            </div>

            {group.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">{t('emptyLevel')}</p>
            ) : visible ? (
              <ul className="mt-3 space-y-2">
                {group.map((item) =>
                  // הענף כאן אינו סגנוני: `NoiseItem` פשוט לא נושא כותרת
                  // וכתובת, ולכן אי אפשר לרנדר אותו באותו כרטיס.
                  isClassified(item) ? (
                    <TriageItemCard
                      key={item.id}
                      item={item}
                      body={bodies.get(item.id)}
                      canEdit={canEdit}
                      onCreateTask={onCreateTask}
                      onToggleHandled={onToggleHandled}
                    />
                  ) : item.verdict === 'noise' ? (
                    <NoiseItemRow key={item.id} item={item} />
                  ) : null,
                )}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/**
 * הספירות. זה המסך שמסביר למה הכלי שווה משהו: לא "סיווגנו 42 מיילים" אלא
 * "30 מהם לא נקראו בידי אף מודל ולא עלו כלום".
 */
function FilterStats({ stats }: { stats: RunStats }) {
  const pct = Math.round(stats.filterRate * 100);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-800">{t('statsTitle')}</h2>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('statsFetched')} value={String(stats.fetched)} />
        <Stat label={t('statsFiltered')} value={String(stats.filteredOut)} accent />
        <Stat label={t('statsLlm')} value={String(stats.llmCalls)} />
        {/* ★ לא דולרים. 'חסכתי לך $0.69' לא אומר לה כלום, ובמקרה הטוב
            נשמע כמו מדד של המערכת על עצמה. מה שכן אומר לה משהו: כמה
            מיילים היא לא צריכה לפתוח הבוקר. */}
        <Stat label={t('statsSaved')} value={`${stats.filteredOut}`} />
      </dl>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>{t('statsRateLabel')}</span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <div
          className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('statsRateLabel')}
        >
          <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">{t('statsExplain')}</p>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${accent ? 'border-slate-300 bg-slate-50' : 'border-slate-200'}`}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-slate-900">{value}</dd>
    </div>
  );
}
