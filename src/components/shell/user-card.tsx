"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { Tip } from "@/components/ui/menu";
import { humanize } from "@/lib/utils";

export function UserCardView({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md p-1">
      <Avatar name={name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-fg">{name}</p>
        <p className="truncate text-[12px] text-fg-muted">{humanize(role)}</p>
      </div>
      <Tip label="Sign out">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md p-1.5 text-fg-muted hover:bg-subtle hover:text-fg"
          aria-label="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </Tip>
    </div>
  );
}
