"use client";

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Accessible name; the visible label usually sits next to the switch. */
  label: string;
  disabled?: boolean;
  className?: string;
}

/** `role="switch"` with a hit area of at least 44 x 44 px around a 48 x 28 track. */
export default function Switch({ checked, onChange, label, disabled = false, className = "" }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${className}`}
    >
      <span
        aria-hidden
        className={`relative block h-7 w-12 rounded-full transition-colors duration-[var(--dur)] ease-[var(--ease)] ${
          checked ? "bg-primary" : "bg-[#c5d5e8]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-[var(--dur)] ease-[var(--ease)] ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
