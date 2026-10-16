"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useActionRunner } from "@/components/forms";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/action";

/** Button → confirmation modal → server action. Works with actions passed from Server Components. */
export function ConfirmAction<I>({
  action,
  input,
  label,
  title,
  description,
  confirmLabel = "Confirm",
  successMessage,
  redirectTo,
  variant = "secondary",
  size = "sm",
  danger,
  icon,
}: {
  action: (input: I) => Promise<ActionResult<unknown>>;
  input: I;
  label: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  successMessage?: string;
  redirectTo?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  danger?: boolean;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useActionRunner();
  const router = useRouter();
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={title}
        size="sm"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant={danger ? "danger" : "primary"}
              disabled={pending}
              onClick={() =>
                run(() => action(input), successMessage, () => {
                  setOpen(false);
                  if (redirectTo) router.push(redirectTo);
                })
              }
            >
              {pending ? "Working…" : confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-fg-secondary">{description}</p>
      </Modal>
    </>
  );
}
