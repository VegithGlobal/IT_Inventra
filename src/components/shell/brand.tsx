import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { getCompany } from "@/lib/settings";

function Initials() {
  return <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-action text-[13px] font-semibold text-action-fg">IT</span>;
}

async function Mark() {
  const user = await getCurrentUser();
  const company = user ? await getCompany() : null;
  if (!company?.logoKey) return <Initials />;
  return (
    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset */}
      <img src="/api/branding/logo" alt={company.name} className="size-full object-contain" />
    </span>
  );
}

/** 32px brand mark for the shell: the company logo if one is uploaded, else "IT". */
export function BrandMark() {
  return (
    <Suspense fallback={<Initials />}>
      <Mark />
    </Suspense>
  );
}
