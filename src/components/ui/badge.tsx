import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

const tones: Record<Tone, { pill: string; dot: string }> = {
  success: { pill: "bg-success-soft text-success", dot: "bg-success" },
  warning: { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  danger: { pill: "bg-danger-soft text-danger", dot: "bg-danger" },
  info: { pill: "bg-info-soft text-info", dot: "bg-info" },
  neutral: { pill: "bg-neutral-soft text-neutral", dot: "bg-neutral" },
  brand: { pill: "bg-brand-soft text-brand-text", dot: "bg-brand" },
};

export function Badge({
  tone = "neutral",
  dot,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[12px] font-medium whitespace-nowrap",
        tones[tone].pill,
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", tones[tone].dot)} aria-hidden />}
      {children}
    </span>
  );
}

const priorityDot = {
  LOW: "bg-priority-low",
  MEDIUM: "bg-priority-medium",
  HIGH: "bg-priority-high",
  CRITICAL: "bg-priority-critical",
} as const;

export function PriorityDot({ priority, className }: { priority: keyof typeof priorityDot; className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full", priorityDot[priority], className)} aria-hidden />;
}
