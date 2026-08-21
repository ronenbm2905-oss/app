/** תג קטן לצד שם — "מושבת", "קטלוג", "טרם החליף סיסמה". */

import type { ReactNode } from 'react';

type Tone = 'neutral' | 'muted' | 'warning' | 'accent';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  muted: 'border-slate-200 bg-white text-slate-500',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  accent: 'border-sky-200 bg-sky-50 text-sky-800',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
