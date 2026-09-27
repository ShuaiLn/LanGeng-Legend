import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "large" | "compact";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };
type ButtonAsLink = CommonProps & Omit<ComponentProps<typeof Link>, keyof CommonProps | "href"> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const BASE =
  "inline-flex select-none items-center justify-center gap-2 border font-bold no-underline " +
  "transition-[background-color,color,transform,box-shadow] duration-[var(--dur)] ease-[var(--ease)] " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const VARIANT: Record<ButtonVariant, string> = {
  // every variant has a 1px border (transparent when it should not show), so all share one box
  primary: "border-transparent bg-primary text-on-primary shadow-sm hover:bg-primary-hover active:bg-primary-press",
  secondary: "border-line bg-panel text-ink hover:bg-well active:bg-well",
  ghost: "border-transparent bg-transparent text-ink-2 hover:bg-well hover:text-ink",
};

// 52px large (menu) and 44px compact (the touch-target minimum); labels are large-text sized
const SIZE: Record<ButtonSize, string> = {
  large: "h-[52px] rounded-btn px-6 text-[18px]",
  compact: "h-11 rounded-btn-sm px-4 text-[15px]",
};

export function buttonClasses(variant: ButtonVariant, size: ButtonSize, fullWidth: boolean, extra?: string): string {
  return [BASE, VARIANT[variant], SIZE[size], fullWidth ? "w-full" : "", extra ?? ""].filter(Boolean).join(" ");
}

/** Primary / secondary / ghost, large / compact. Renders a `<Link>` when given an `href`. */
export default function Button(props: ButtonProps) {
  const { variant = "primary", size = "large", fullWidth = false, className, children, ...rest } = props;
  const classes = buttonClasses(variant, size, fullWidth, className);

  if (typeof rest.href === "string") {
    return (
      <Link {...(rest as Omit<ButtonAsLink, keyof CommonProps>)} className={classes}>
        {children}
      </Link>
    );
  }
  const { type = "button", ...buttonProps } = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button type={type} {...buttonProps} className={classes}>
      {children}
    </button>
  );
}
