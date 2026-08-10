// Which screens a user may open, and which one to actually render.
//
// Kept out of the component because the second function is the one that decides whether
// somebody lands on a blank screen: the stored default tab is a manager screen, so the
// very first render for a coach asks for a tab they are not allowed to see. Admin status
// can also be withdrawn mid-session by another manager, arriving through onSnapshot while
// that screen is open.
//
// Both are pure and resolve during render, so there is never a frame showing a screen the
// user should not see — an effect that corrected it afterwards would flash one.

export function visibleTabsFor(tabs, adminOnlyIds, canEdit) {
  const list = tabs || [];
  if (canEdit) return list;
  const hidden = adminOnlyIds || new Set();
  return list.filter((t) => !hidden.has(t.id));
}

// The requested tab when it is allowed, otherwise the first one that is. Returns "" only
// when there are no tabs at all, which the caller should treat as nothing to render.
export function resolveActiveTab(visible, requested) {
  const list = visible || [];
  if (!list.length) return "";
  return list.some((t) => t.id === requested) ? requested : list[0].id;
}
