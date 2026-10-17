import { Download, FolderDown } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, PageSkeleton } from "@/components/ui/page";
import { db } from "@/lib/db";
import { formatBytes, formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Backup" };

async function Content() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <PageHeader title="Backup" description="Only admins can export data." />;
  const [last, files] = await Promise.all([
    db.auditLog.findFirst({ where: { entityType: "Backup" }, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } }),
    db.document.aggregate({ where: { deletedAt: null }, _sum: { sizeBytes: true }, _count: true }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Backup & export" description="Download everything in the app as a zip you can keep offsite." />
      <Card>
        <CardHeader
          title="Full data export"
          description={last ? `Last export ${formatDateTime(last.createdAt)} by ${last.actor?.name ?? "System"}` : "No exports yet"}
        />
        <CardBody className="flex flex-col gap-5 text-[13.5px] text-fg-secondary">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="text-fg">data.json</span> — every table, in one file.
            </li>
            <li>
              <span className="text-fg">csv/</span> — one spreadsheet per table (opens in Excel).
            </li>
            <li>Login password hashes are never exported. Encrypted credentials and license keys stay encrypted.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" asChild>
              <a href="/api/backup" download>
                <Download />
                Download data (JSON + CSV)
              </a>
            </Button>
            <Button asChild>
              <a href="/api/backup?files=1" download>
                <FolderDown />
                Data + uploaded files ({files._count} · {formatBytes(files._sum.sizeBytes ?? 0)})
              </a>
            </Button>
          </div>
          <p className="text-[12.5px] text-fg-muted">For full disaster recovery, also back up the PostgreSQL database itself (e.g. a nightly pg_dump) — this export is for keeping a readable copy.</p>
        </CardBody>
      </Card>
    </div>
  );
}

export default function BackupPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <Content />
    </Suspense>
  );
}
