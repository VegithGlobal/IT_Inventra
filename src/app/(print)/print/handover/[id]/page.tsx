import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintBar } from "@/components/print-bar";
import { IssuanceDocument } from "@/features/assignments/issuance-document";
import { getAssignmentForPrint } from "@/features/assignments/queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "IT asset issuance form" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const a = await getAssignmentForPrint(id);
  if (!a) notFound();
  return (
    <>
      <PrintBar title={`Issuance form · ${a.asset.assetTag} → ${a.employee.name}`} />
      <IssuanceDocument a={a} />
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
