import { IconChevronDown } from "./icons";

export function Select({ value, onChange, options, placeholder, className = "", disabled = false }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
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
