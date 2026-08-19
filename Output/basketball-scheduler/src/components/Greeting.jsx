import { greetingName } from "../utils/greeting";

// The first line of the home screen. A coach opens the app once or twice a week, and
// being greeted by name is how the screen says "this is yours" before it says anything
// else. Home only — on a working screen it would be furniture.
//
// Renders nothing when there is no name to use (local mode, or a signed-out state that
// cannot reach here anyway), so the tiles simply move up.
export function Greeting({ user, canEdit }) {
  const name = greetingName(user);
  if (!name) return null;

  return (
    <div className="no-print mb-4">
      <h2 className="text-xl sm:text-2xl font-bold text-stone-800 leading-tight">
        שלום, {name}
      </h2>
      <p className="text-sm text-stone-500 mt-0.5">
        {canEdit ? "מה פותחים היום?" : "הנה מה שפתוח לך היום"}
      </p>
    </div>
  );
}
