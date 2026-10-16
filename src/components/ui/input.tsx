import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "w-full rounded-md border border-line bg-surface px-3 text-[13.5px] text-fg placeholder:text-fg-muted transition-[border-color,box-shadow] duration-150 outline-none focus:border-fg focus:ring-[3px] focus:ring-fg/[0.06] disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-muted aria-[invalid=true]:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        controlClass,
        "h-9",
        props.type === "file" &&
          "py-1 file:mr-3 file:h-6 file:rounded file:border-0 file:bg-subtle file:px-2 file:text-[12.5px] file:font-medium file:text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

/** Native select, restyled — fully keyboard accessible and form-friendly. */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlClass, "h-9 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
    </div>
  );
}
