import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintBar } from "@/components/print-bar";
import { OffboardingDocument } from "@/features/accounts/offboarding-document";
import { getOffboardingChecklist } from "@/features/accounts/queries";
import { requireUser } from "@/lib/session";
import { getCompany } from "@/lib/settings";

export const metadata: Metadata = { title: "Offboarding checklist" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  await connection();
  const [e, company] = await Promise.all([getOffboardingChecklist(id), getCompany()]);
  if (!e) notFound();
  return (
    <>
      <PrintBar title={`Offboarding checklist · ${e.name}`} hint="Ticked items are already closed in IT Ops Hub. Print it for sign-off, or save as PDF." />
      <OffboardingDocument e={e} company={company} printedAt={new Date()} />
    </>
  );
}

export default function OffboardingPrintPage(props: PageProps<"/print/offboarding/[id]">) {
  return (
    <Suspense>
      <Content params={props.params} />
    </Suspense>
  );
}
