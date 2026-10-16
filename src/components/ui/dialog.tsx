"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Next.js keeps previous pages mounted but hidden (React Activity). Dialogs portal into <body>,
 * outside the hidden subtree, so they must close themselves while their page is hidden.
 * Layout-effect cleanup runs when Activity hides the page; the effect re-runs when it's shown.
 */
function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useLayoutEffect(() => {
    // Re-show is only observable as the effect re-running; this syncs with Activity, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    return () => setVisible(false);
  }, []);
  return visible;
}

const overlay =
  "fixed inset-0 z-50 bg-fg/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

/** Centred modal: title, optional description, body, footer. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const visible = usePageVisible();
  return (
    <D.Root open={open && visible} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-line bg-surface shadow-[var(--shadow-overlay)] outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            size === "sm" && "max-w-md",
            size === "md" && "max-w-xl",
            size === "lg" && "max-w-3xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <D.Title className="text-[16px] font-semibold text-fg">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-[13px] text-fg-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close className="-mr-2 rounded-md p-1.5 text-fg-muted hover:bg-subtle hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-3.5">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Right-side slide-over (560px); full-screen sheet on mobile. */
export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  headerAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
}) {
  const visible = usePageVisible();
  return (
    <D.Root open={open && visible} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-[var(--shadow-overlay)] outline-none sm:inset-y-2 sm:right-2 sm:w-[560px] sm:rounded-2xl sm:border sm:border-line",
            "duration-250 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <D.Title className="truncate text-[16px] font-semibold text-fg">{title}</D.Title>
              <D.Description className={description ? "mt-0.5 text-[13px] text-fg-muted" : "sr-only"}>
                {description ?? "Details"}
              </D.Description>
            </div>
            <div className="flex items-center gap-1">
              {headerAction}
              <D.Close className="rounded-md p-1.5 text-fg-muted hover:bg-subtle hover:text-fg" aria-label="Close">
                <X className="size-4" />
              </D.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-3.5">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
