import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

const TONES = {
  info: { cls: "bg-accent-soft border-accent/25 text-ink", Icon: Info },
  warn: { cls: "bg-warn-soft border-warn/30 text-ink", Icon: AlertTriangle },
  danger: { cls: "bg-danger-soft border-danger/30 text-ink", Icon: ShieldAlert },
};

export function Banner({ tone = "info", title, children }) {
  const { cls, Icon } = TONES[tone] || TONES.info;
  return (
    <div className={`flex gap-3 rounded-lg border p-3 text-sm ${cls}`} role="status">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-soft">{children}</div>}
      </div>
    </div>
  );
}
