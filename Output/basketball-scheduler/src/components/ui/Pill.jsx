export function Pill({ children, color }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {children}
    </span>
  );
}
