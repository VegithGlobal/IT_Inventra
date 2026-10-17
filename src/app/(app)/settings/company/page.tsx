import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { CompanyView } from "@/features/settings/views";
import { requireUser } from "@/lib/session";
import { getCompany, getDepreciationDefaults } from "@/lib/settings";

export const metadata: Metadata = { title: "Company profile" };

async function Content() {
  const user = await requireUser();
  const [company, dep] = await Promise.all([getCompany(), getDepreciationDefaults()]);
  return (
    <CompanyView
      isAdmin={user.role === "ADMIN"}
      hasLogo={!!company.logoKey}
      initial={{ name: company.name, gstin: company.gstin ?? "", address: company.address ?? "", defaultSalvagePercent: String(dep.defaultSalvagePercent) }}
    />
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <Content />
    </Suspense>
  );
}
