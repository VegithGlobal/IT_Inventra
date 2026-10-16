"use client";

import { Check, Minus } from "lucide-react";
import { Checkbox as C } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, checked, ...props }: ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      checked={checked}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-line-strong bg-surface outline-none focus-visible:ring-[3px] focus-visible:ring-fg/15 data-[state=checked]:border-action data-[state=checked]:bg-action data-[state=indeterminate]:border-action data-[state=indeterminate]:bg-action",
        className,
      )}
      {...props}
    >
      <C.Indicator className="text-action-fg">
        {checked === "indeterminate" ? <Minus className="size-3" strokeWidth={2.5} /> : <Check className="size-3" strokeWidth={2.5} />}
      </C.Indicator>
    </C.Root>
  );
}
