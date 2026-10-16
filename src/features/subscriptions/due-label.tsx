import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "Due in 3 days" / "Due today" / red "Overdue · 4d" with the date underneath. */
export function DueLabel({ date, days, inactive, compact }: { date: Date; days: number; inactive?: boolean; compact?: boolean }) {
  if (inactive) return <span className="text-fg-muted">{formatDate(date)}</span>;
  const text = days < 0 ? null : days === 0 ? "Due today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  return (
    <span className="flex flex-col">
      <span className={cn("text-fg tabular", compact && "text-[13px]")}>{formatDate(date)}</span>
      {days < 0 ? (
        <span>
          <Badge tone="danger" dot>
            Overdue · {-days}d
          </Badge>
        </span>
      ) : (
        <span className={cn("text-[12.5px]", days <= 7 ? "font-medium text-brand-text" : "text-fg-muted")}>{text}</span>
      )}
    </span>
  );
}
