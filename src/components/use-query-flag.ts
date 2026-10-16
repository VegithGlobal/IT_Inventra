"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Open/close state mirrored in the URL (?new=1, ?edit=1 …) so "+ New" links and the
 * command palette can open a module's create panel, and Back closes it.
 */
export function useQueryFlag(key: string): [boolean, (open: boolean) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const open = params.get(key) === "1";

  const setOpen = useCallback(
    (next: boolean) => {
      const sp = new URLSearchParams(params.toString());
      if (next) sp.set(key, "1");
      else sp.delete(key);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [key, params, pathname, router],
  );

  return [open, setOpen];
}
