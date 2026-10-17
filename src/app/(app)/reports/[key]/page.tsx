import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page";
import { getReportDef, resolveParams } from "@/features/reports/definitions";
import { ReportView } from "@/features/reports/report-view";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Report" };

async function Content({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  await requireUser();
  const def = getReportDef(key);
  if (!def) notFound();
  const p = resolveParams(def, sp);
  const result = await def.run(p);
  const meta = { key: def.key, title: def.title, description: def.description, section: def.section, params: def.params };
  return <ReportView meta={meta} params={p} result={result} />;
}

export default function ReportPage(props: PageProps<"/reports/[key]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={12} />}>
      <Content params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
