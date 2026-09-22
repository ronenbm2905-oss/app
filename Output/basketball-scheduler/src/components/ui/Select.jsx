import { IconChevronDown } from "./icons";

// `label` is the accessible name. A `<option value="">בחר מאמן</option>` is the placeholder
// TEXT, not a name: a screen reader announces the control as an unnamed combo box and the
// person is asked to choose from something they were never told the purpose of (WCAG 4.1.2,
// Level A). It falls back to the placeholder so every existing call site gains a name
// without being touched, and a caller whose label should differ from the placeholder — or
// who has no placeholder at all — passes one.
export function Select({ value, onChange, options, placeholder, label, className = "", disabled = false }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={label || placeholder || undefined}
        className="w-full appearance-none bg-white border border-stone-300 rounded-lg px-3 py-2 pr-8 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-stone-100 disabled:text-stone-600"
        dir="rtl"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={16}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-600 pointer-events-none"
      />
    </div>
  );
}
