import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

/** Title + muted description on the left, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-[24px] leading-tight font-semibold tracking-[-0.01em] text-fg">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-fg-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-subtle">
        <Icon className="size-5 text-fg-muted" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="text-[14px] font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Muted label, big tabular number, optional trend/sub line. */
export function StatCard({
  label,
  value,
  sub,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  trend?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5", className)}>
      <p className="text-[13px] text-fg-muted">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[28px] leading-none font-semibold tracking-[-0.01em] text-fg tabular">{value}</span>
        {trend}
      </div>
      {sub && <p className="mt-2 text-[12.5px] text-fg-muted">{sub}</p>}
    </div>
  );
}

export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex gap-3 border-b border-line p-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
        </div>
      ))}
    </div>
  );
}
