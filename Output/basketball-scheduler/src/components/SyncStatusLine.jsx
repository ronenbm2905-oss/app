import { syncState } from "../utils/syncHealth";
import { IconAlert, IconCheck } from "./ui/icons";

// One line: when the federation sync last ran, and whether that is a problem.
//
// It is placed with the import banner rather than tucked into a settings screen, because
// the two say opposite halves of the same thing. The banner appears when there IS something
// to approve; this line is what the screen says when there is not — and until now that was
// nothing at all, which read identically to a sync that had been dead since Friday.
//
// A healthy line is deliberately quiet: small, grey, no icon competing with the banner above
// it. It earns attention only when it has some.

const TONE = {
  ok: "text-stone-500",
  warn: "border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2",
  bad: "border border-red-300 bg-red-50 text-red-800 rounded-lg px-3 py-2",
  unknown: "text-stone-500",
};

// `pending` is the proposal still awaiting a decision, and it is passed in so the two halves
// cannot contradict each other. The line used to report what the last RUN found, which on a
// morning after an approved proposal read as "updates found" with nothing anywhere to see.
export function SyncStatusLine({ health, pending = null }) {
  // Not rendered at all when the read failed or the listener never started. A line that
  // cannot say anything true should say nothing.
  if (health === null || health === undefined) return null;

  const state = syncState(health.missing ? null : health, new Date(), { pending: Boolean(pending) });
  const loud = state.level === "bad" || state.level === "warn";

  return (
    <div className={`text-xs flex items-start gap-1.5 ${TONE[state.level]}`} dir="rtl">
      {loud ? (
        <IconAlert size={14} className="mt-0.5 shrink-0" />
      ) : (
        <IconCheck size={13} className="mt-0.5 shrink-0 opacity-60" />
      )}
      <span>
        <span className={loud ? "font-semibold" : "font-medium"}>{state.title}</span>
        {state.detail && <span className="opacity-90"> · {state.detail}</span>}
      </span>
    </div>
  );
}
