import type { ElementType, ReactNode } from "react";

interface CardProps {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/** White panel: 1px border, 16px radius, the one light shadow. */
export default function Card({ as: Tag = "section", className = "", children }: CardProps) {
  return <Tag className={`rounded-card border border-line bg-panel shadow-md ${className}`}>{children}</Tag>;
}
