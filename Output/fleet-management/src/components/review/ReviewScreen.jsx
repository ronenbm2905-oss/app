import { useMemo, useState } from "react";
import { ClipboardCheck, CheckCircle2, ShieldAlert } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import Card, { EmptyState } from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import ReviewItem from "./ReviewItem.jsx";
import { reviewAssignments, reviewProgress } from "../../utils/review.js";

// ============================================================================
// מסך 7 — תיקון ההחזקות שסומנו לבדיקה.
//
// 9 ההחזקות האלה הן היחידות שחוסמות שיוך קנס אוטומטי (D5). כל עוד הן פתוחות,
// הפיצ'ר שבשבילו נבנתה המערכת לא עובד על הרכבים שלהן. המסך מרכז אותן, מציג
// לכל אחת את הטקסט המקורי, את הסיבות ואת ההצעה — ומאפשר לפתור בלי לצאת ממנו.
// ============================================================================
export default function ReviewScreen({ data, actions, onDone }) {
  const { t } = useI18n();
  const [showResolved, setShowResolved] = useState(false);

  const items = useMemo(() => reviewAssignments(data), [data.assignments]);
  const progress = useMemo(() => reviewProgress(data), [data.assignments]);
  const pending = items.filter((a) => a.needsReview);
  const resolved = items.filter((a) => !a.needsReview);
  const pct = progress.total ? Math.round((progress.resolved / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <ClipboardCheck size={18} className="text-slate-500" />
          {t("reviewx.title")}
        </h1>
        <p className="mt-0.5 max-w-3xl text-sm text-slate-600">{t("reviewx.subtitle")}</p>
      </header>

      {progress.total === 0 ? (
        <Card>
          <EmptyState title={t("reviewx.emptyTitle")} hint={t("reviewx.emptyHint")} />
        </Card>
      ) : (
        <>
          {/* -- מונה ההתקדמות -- */}
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-slate-800">
                {t("reviewx.progress", { resolved: progress.resolved, total: progress.total })}
              </span>
              <div
                className="h-2 min-w-40 flex-1 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={progress.resolved}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-label={t("reviewx.progressAria")}
              >
                <div
                  className={`h-full ${progress.done ? "bg-emerald-500" : "bg-brand-600"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {progress.pending > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-amber-800">
                  <ShieldAlert size={14} />
                  {t("reviewx.blockedCount", { n: progress.pending })}
                </span>
              )}
              {resolved.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => setShowResolved((v) => !v)}>
                  {showResolved ? t("reviewx.hideResolved") : t("reviewx.showResolved")}
                </Button>
              )}
            </div>
          </Card>

          {/* -- הכל נפתר -- */}
          {progress.done && (
            <Card>
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
                <p className="text-sm font-medium text-slate-800">{t("reviewx.allDoneTitle")}</p>
                <p className="max-w-xl text-xs text-slate-500">{t("reviewx.allDoneBody")}</p>
                {onDone && (
                  <Button variant="secondary" size="sm" onClick={onDone}>
                    {t("reviewx.goVehicles")}
                  </Button>
                )}
              </div>
            </Card>
          )}

          <div className="space-y-3">
            {pending.map((a) => (
              <ReviewItem key={a.id} assignment={a} data={data} onResolve={actions.resolveReview} />
            ))}
            {showResolved &&
              resolved.map((a) => (
                <ReviewItem key={a.id} assignment={a} data={data} onResolve={actions.resolveReview} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
