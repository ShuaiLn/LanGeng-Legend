"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Set when the label is in a different language from the page (a screen reader switches voice). */
  lang?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Accessible name of the whole group. */
  label: string;
  className?: string;
}

/**
 * A row of mutually exclusive choices: a `radiogroup` with a roving tabindex (Tab lands on the
 * selected one, the arrow keys move and select). 44px tall, a 1px border, the compact button radius;
 * the selected segment is filled with the primary colour. Used for the language switch.
 */
export default function Segmented<T extends string>({ value, options, onChange, label, className = "" }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const current = options.findIndex((option) => option.value === value);
    const next = (current + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={`inline-flex h-11 overflow-hidden rounded-btn-sm border border-line bg-panel ${className}`}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            lang={option.lang}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`min-w-[3.5rem] flex-1 px-4 text-[15px] font-bold transition-colors duration-[var(--dur)] ease-[var(--ease)] ${
              index > 0 ? "border-l border-line" : ""
            } ${selected ? "bg-primary text-on-primary" : "text-ink hover:bg-well"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
