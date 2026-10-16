import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintBar } from "@/components/print-bar";
import { HandoverDocument } from "@/features/assignments/handover-document";
import { getAssignmentForPrint } from "@/features/assignments/queries";
import { requireUser } from "@/lib/session";
import { getCompany } from "@/lib/settings";

export const metadata: Metadata = { title: "Asset handover form" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const [a, company] = await Promise.all([getAssignmentForPrint(id), getCompany()]);
  if (!a) notFound();
  return (
    <>
      <PrintBar title={`Handover form · ${a.asset.assetTag} → ${a.employee.name}`} />
      <HandoverDocument kind="handover" a={a} company={company} />
    </>
  );
}

export default function HandoverPrintPage(props: PageProps<"/print/handover/[id]">) {
  return (
    <Suspense>
      <Content params={props.params} />
    </Suspense>
  );
}
