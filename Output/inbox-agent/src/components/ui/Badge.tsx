// ============================================================================
// Badge.tsx + Banner.tsx — רכיבי UI משותפים קטנים.
// מקור אחד לצבע ולצורה, כדי ששום מסך לא ימציא "אדום" משלו.
// ============================================================================

import type { ReactNode } from 'react';

type Tone = 'danger' | 'warn' | 'info' | 'quiet';

const TONES: Record<Tone, string> = {
  danger: 'bg-red-100 text-red-800 border-red-300',
  warn: 'bg-amber-100 text-amber-900 border-amber-300',
  info: 'bg-sky-100 text-sky-900 border-sky-300',
  quiet: 'bg-slate-100 text-slate-600 border-slate-300',
};

export function Badge({ tone = 'quiet', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Banner({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${TONES[tone]}`} role="status">
      {title ? <div className="mb-1 font-semibold">{title}</div> : null}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
