import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintBar } from "@/components/print-bar";
import { HandoverDocument } from "@/features/assignments/handover-document";
import { getAssignmentForPrint } from "@/features/assignments/queries";
import { requireUser } from "@/lib/session";
import { getCompany } from "@/lib/settings";

export const metadata: Metadata = { title: "Asset return form" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const [a, company] = await Promise.all([getAssignmentForPrint(id), getCompany()]);
  if (!a || !a.returnedAt) notFound();
  return (
    <>
      <PrintBar title={`Return form · ${a.asset.assetTag} ← ${a.employee.name}`} />
      <HandoverDocument kind="return" a={a} company={company} />
    </>
  );
}

export default function ReturnPrintPage(props: PageProps<"/print/return/[id]">) {
  return (
    <Suspense>
      <Content params={props.params} />
    </Suspense>
  );
}
