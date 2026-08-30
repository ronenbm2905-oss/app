const VARIANTS = {
  primary: "bg-slate-900 text-white hover:bg-slate-700 border-slate-900",
  secondary: "bg-white text-slate-700 hover:bg-slate-50 border-slate-300",
  danger: "bg-red-600 text-white hover:bg-red-700 border-red-600",
};

export function Button({ variant = "secondary", className = "", ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium
        transition disabled:opacity-40 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1
        ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
