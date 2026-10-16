import { ArrowRight, FileText, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, PriorityDot } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, DetailList } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page";
import { SendToRepairButton } from "@/features/maintenance/dialogs";
import { getMaintenanceLookups } from "@/features/maintenance/queries";
import { CommentBox, TicketActions, TimeLogger } from "@/features/tickets/ticket-detail";
import { getTicket, getTicketLookups, ticketFormValues } from "@/features/tickets/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { TICKET_PRIORITY, TICKET_SOURCE, TICKET_STATUS, formatMinutes } from "@/lib/options";
import { canWrite, requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ticket" };

type Status = keyof typeof TICKET_STATUS;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, data] = await Promise.all([requireUser(), getTicket(id)]);
  if (!data) notFound();
  const { ticket: t, related } = data;
  const writable = canWrite(user.role);
  const [lookups, repairLookups] = writable ? await Promise.all([getTicketLookups(), getMaintenanceLookups()]) : [null, null];
  const done = t.status === "RESOLVED" || t.status === "CLOSED";
  const overdue = !done && t.dueDate && t.dueDate < new Date();
  const openRepair = t.maintenance.find((m) => m.status === "OPEN");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
            <PriorityDot priority={t.priority} />
            <span className="font-mono">{t.ticketNumber}</span>
            <Badge tone={TICKET_STATUS[t.status].tone} dot>
              {TICKET_STATUS[t.status].label}
            </Badge>
            {overdue && <Badge tone="danger">Overdue</Badge>}
          </p>
          <h1 className="mt-1.5 text-[24px] leading-tight font-semibold tracking-[-0.01em] text-fg">{t.title}</h1>
        </div>
        {writable && lookups && repairLookups && (
          <div className="flex flex-wrap items-center gap-2">
            <TicketActions
              id={t.id}
              status={t.status}
              initial={ticketFormValues(t)}
              lookups={lookups}
              hasAsset={!!t.assetId && !openRepair}
              onSendToRepair={t.assetId ? <SendToRepairButton lookups={repairLookups} preset={{ assetId: t.assetId, ticketId: t.id, issue: t.title }} /> : null}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {t.description && (
            <Card>
              <CardBody className="pt-5 text-[14px] leading-relaxed whitespace-pre-line text-fg">{t.description}</CardBody>
            </Card>
          )}
          {t.resolutionNotes && (
            <Card className="border-success/30 bg-success-soft/50">
              <CardHeader title="Resolution" />
              <CardBody className="text-[14px] whitespace-pre-line text-fg">{t.resolutionNotes}</CardBody>
            </Card>
          )}

          <section aria-label="Activity" className="flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-fg">Activity</h2>
            <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-line">
              {t.comments.map((c) => {
                const meta = (c.meta ?? {}) as { from?: Status; to?: Status; documentId?: string };
                const who = c.author?.name ?? "System";
                return (
                  <li key={c.id} className="relative flex gap-3">
                    {c.kind === "COMMENT" ? (
                      <Avatar name={who} size="sm" className="relative ring-4 ring-app" />
                    ) : (
                      <span className="relative mt-1.5 ml-[9px] size-2.5 shrink-0 rounded-full bg-line-strong ring-4 ring-app" aria-hidden />
                    )}
                    <div className={cn("min-w-0 flex-1", c.kind !== "COMMENT" && "ml-[7px]")}>
                      {c.kind === "COMMENT" ? (
                        <div className="rounded-xl border border-line bg-surface px-4 py-3">
                          <p className="text-[12.5px] text-fg-muted">
                            <span className="font-medium text-fg">{who}</span> · {formatDateTime(c.createdAt)}
                          </p>
                          <p className="mt-1 text-[14px] whitespace-pre-line text-fg">{c.body}</p>
                        </div>
                      ) : (
                        <p className="text-[13px] text-fg-secondary">
                          {c.kind === "STATUS_CHANGE" && meta.from && meta.to ? (
                            <>
                              <span className="font-medium text-fg">{who}</span> moved it{" "}
                              <span className="inline-flex items-center gap-1">
                                {TICKET_STATUS[meta.from].label} <ArrowRight className="size-3" /> {TICKET_STATUS[meta.to].label}
                              </span>
                            </>
                          ) : c.kind === "ATTACHMENT" && meta.documentId ? (
                            <>
                              <span className="font-medium text-fg">{who}</span> attached{" "}
                              <a href={`/api/files/${meta.documentId}`} target="_blank" className="inline-flex items-center gap-1 font-medium text-fg underline-offset-2 hover:underline">
                                <FileText className="size-3.5" />
                                {c.body}
                              </a>
                            </>
                          ) : (
                            <>
                              {c.author && <span className="font-medium text-fg">{who} · </span>}
                              {c.body}
                            </>
                          )}
                          <span className="text-fg-muted"> · {formatDateTime(c.createdAt)}</span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {writable && <CommentBox ticketId={t.id} />}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Requester" />
            <CardBody>
              <Link href={`/employees/${t.requester.id}`} className="flex items-center gap-3 hover:underline">
                <Avatar name={t.requester.name} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-fg">{t.requester.name}</span>
                  <span className="block truncate text-[12.5px] text-fg-muted">{[t.requester.designation, t.requester.department?.name].filter(Boolean).join(" · ")}</span>
                </span>
              </Link>
              {t.requester.phone && (
                <a href={`tel:${t.requester.phone}`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg">
                  <Phone className="size-3.5" /> {t.requester.phone}
                </a>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <DetailList
                className="sm:grid-cols-2"
                items={[
                  { label: "Priority", value: TICKET_PRIORITY[t.priority] },
                  { label: "Category", value: t.category?.name },
                  { label: "Source", value: TICKET_SOURCE[t.source] },
                  { label: "Due", value: t.dueDate ? <span className={cn(overdue && "font-medium text-danger")}>{formatDateTime(t.dueDate)}</span> : null },
                  { label: "Opened", value: formatDateTime(t.createdAt) },
                  { label: "Resolved", value: t.resolvedAt ? formatDateTime(t.resolvedAt) : null },
                  {
                    label: "Asset",
                    value: t.asset && (
                      <Link href={`/assets/${t.asset.id}`} className="hover:underline">
                        <span className="font-mono text-[12.5px]">{t.asset.assetTag}</span> {t.asset.name}
                      </Link>
                    ),
                  },
                  { label: "Logged by", value: t.createdBy?.name ?? (t.reminder ? "Recurring task" : null) },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Time spent" />
            <CardBody>{writable ? <TimeLogger id={t.id} minutes={t.timeSpentMinutes} /> : <p className="text-[14px]">{formatMinutes(t.timeSpentMinutes)}</p>}</CardBody>
          </Card>
          {t.maintenance.length > 0 && (
            <Card>
              <CardHeader title="Repairs" action={<Link href="/maintenance" className="text-[13px] font-medium text-fg-secondary hover:text-fg">Maintenance</Link>} />
              <ul className="pb-2">
                {t.maintenance.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 px-5 py-2 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">{m.issue}</span>
                    <Badge tone={m.status === "OPEN" ? "warning" : "success"}>{m.status === "OPEN" ? `Since ${formatDate(m.sentAt)}` : "Returned"}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {related.length > 0 && (
            <Card>
              <CardHeader title="Related tickets" description="Same requester or asset" />
              <ul className="pb-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/tickets/${r.id}`} className="flex items-center gap-2 px-5 py-2 text-[13px] hover:bg-subtle">
                      <PriorityDot priority={r.priority} />
                      <span className="font-mono text-[12px] text-fg-muted">{r.ticketNumber}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      <Badge tone={TICKET_STATUS[r.status].tone}>{TICKET_STATUS[r.status].label}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TicketPage(props: PageProps<"/tickets/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content params={props.params} />
    </Suspense>
  );
}
