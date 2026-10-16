"use client";

import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { useQueryFlag } from "@/components/use-query-flag";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/dialog";

/** "Edit" button + slide-over whose open state lives in ?edit=1. Children render the form. */
export function EditSheet({ title, children, label = "Edit" }: { title: string; children: (close: () => void) => ReactNode; label?: string }) {
  const [open, setOpen] = useQueryFlag("edit");
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Pencil />
        {label}
      </Button>
      <SlideOver open={open} onOpenChange={setOpen} title={title}>
        {open && children(() => setOpen(false))}
      </SlideOver>
    </>
  );
}
