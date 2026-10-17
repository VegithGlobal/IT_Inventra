"use client";

import { Archive, PackageMinus, PackagePlus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { EditSheet } from "@/components/edit-sheet";
import { Button } from "@/components/ui/button";
import { archiveItem } from "./actions";
import { EditItemForm, StockDialog, type StockMode, type StockTarget } from "./dialogs";
import type { InventoryLookups } from "./queries";
import type { ItemInput } from "./schema";

export function ItemActions({ target, initial, lookups }: { target: StockTarget; initial: ItemInput; lookups: InventoryLookups }) {
  const [mode, setMode] = useState<StockMode | null>(null);
  return (
    <>
      <ConfirmAction
        action={archiveItem}
        input={{ id: target.id }}
        label="Archive"
        icon={<Archive />}
        variant="ghost"
        title="Archive item?"
        description="It's hidden from inventory. Its movement history and expenses are kept."
        confirmLabel="Archive"
        successMessage="Item archived"
        redirectTo="/inventory"
        danger
      />
      <EditSheet title="Edit item">{(close) => <EditItemForm id={target.id} initial={initial} lookups={lookups} onDone={close} />}</EditSheet>
      <Button size="sm" onClick={() => setMode("adjust")}>
        <SlidersHorizontal />
        Adjust
      </Button>
      <Button size="sm" onClick={() => setMode("in")}>
        <PackagePlus />
        Stock in
      </Button>
      <Button size="sm" variant="primary" disabled={target.quantity === 0} onClick={() => setMode("out")}>
        <PackageMinus />
        Issue
      </Button>
      <StockDialog target={mode ? target : null} mode={mode ?? "out"} lookups={lookups} onOpenChange={(o) => !o && setMode(null)} />
    </>
  );
}
