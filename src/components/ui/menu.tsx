"use client";

import { DropdownMenu as M, Popover as P, Tooltip as T } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const floating =
  "z-50 rounded-lg border border-line bg-surface shadow-[var(--shadow-popover)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ className, align = "end", ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className={cn(floating, "min-w-44 p-1", className)} {...props} />
    </M.Portal>
  );
}

export function MenuItem({ className, danger, ...props }: ComponentProps<typeof M.Item> & { danger?: boolean }) {
  return (
    <M.Item
      className={cn(
        "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-subtle [&_svg]:size-4 [&_svg]:stroke-[1.75]",
        danger ? "text-danger" : "text-fg",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2 pt-1.5 pb-1 text-[11.5px] font-medium text-fg-muted">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-line" />;
}

export const MenuCheckboxItem = ({ className, children, ...props }: ComponentProps<typeof M.CheckboxItem>) => (
  <M.CheckboxItem
    className={cn(
      "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] text-fg outline-none select-none data-[highlighted]:bg-subtle",
      className,
    )}
    onSelect={(e) => e.preventDefault()}
    {...props}
  >
    <span className="flex size-4 items-center justify-center rounded border border-line-strong data-[state=checked]:bg-action">
      <M.ItemIndicator>
        <svg viewBox="0 0 12 12" className="size-3 text-fg" aria-hidden>
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      </M.ItemIndicator>
    </span>
    {children}
  </M.CheckboxItem>
);

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export function PopoverContent({ className, align = "start", ...props }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={6} className={cn(floating, "p-3", className)} {...props} />
    </P.Portal>
  );
}

/** Tooltip for icon-only controls. */
export function Tip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <T.Provider delayDuration={300}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content
            side={side}
            sideOffset={6}
            className="z-50 rounded-md bg-action px-2 py-1 text-[12px] font-medium text-action-fg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
          >
            {label}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  );
}
