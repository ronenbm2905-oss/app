import { trustBadges } from '@shared/config/site';

export function TrustBar() {
  return (
    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted">
      {trustBadges.map((badge) => (
        <li key={badge} className="flex items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-success">
            <path d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-1-5.6 5-5L12.6 6 9 9.6 7.4 8 6 9.4l3 3z" />
          </svg>
          {badge}
        </li>
      ))}
    </ul>
  );
}
