import type { ReactNode } from "react";
import { formatDate, formatDateTime } from "@/lib/format";
import { ACCOUNT_STATUS, EMPLOYEE_STATUS, SYSTEM_CATEGORY } from "@/lib/options";
import type { CompanySettings } from "@/lib/settings";
import type { getOffboardingChecklist } from "./queries";

type Employee = NonNullable<Awaited<ReturnType<typeof getOffboardingChecklist>>>;

function Box({ done }: { done: boolean }) {
  return (
    <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[3px] border text-[11px] leading-none ${done ? "border-fg bg-fg text-surface" : "border-fg-muted"}`} aria-hidden>
      {done ? "✓" : ""}
    </span>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-baseline justify-between text-[11.5px] font-semibold tracking-[0.06em] text-fg-muted uppercase">
        {title}
        <span className="tabular">{count}</span>
      </h2>
      <ul className="rounded-lg border border-line">{children}</ul>
    </section>
  );
}

function Item({ done, title, detail, extra }: { done: boolean; title: ReactNode; detail?: ReactNode; extra?: ReactNode }) {
  return (
    <li className="flex break-inside-avoid gap-3 border-b border-line px-4 py-2.5 text-[13px] last:border-0">
      <Box done={done} />
      <div className="min-w-0 flex-1">
        <p className="text-fg">{title}</p>
        {detail && <p className="text-[12px] text-fg-secondary">{detail}</p>}
        {extra}
      </div>
    </li>
  );
}

/** A4 checklist of everything to recover or block when someone leaves. Closed items print ticked. */
export function OffboardingDocument({ e, company, printedAt }: { e: Employee; company: CompanySettings; printedAt: Date }) {
  const open = e.accounts.filter((a) => a.status === "ACTIVE").length + e.assignments.length + e.licenseSeats.length;
  return (
    <article className="mx-auto my-8 w-full max-w-[794px] bg-surface p-12 shadow-[var(--shadow-popover)] print:my-0 print:max-w-none print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b-2 border-fg pb-5">
        <div>
          <p className="text-[18px] font-semibold text-fg">{company.name}</p>
          {company.address && <p className="text-[12.5px] text-fg-secondary">{company.address}</p>}
        </div>
        <div className="text-right">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-fg">IT Offboarding Checklist</h1>
          <p className="text-[12.5px] text-fg-secondary">Printed {formatDateTime(printedAt)}</p>
          <p className={`mt-1 text-[12.5px] font-medium ${open ? "text-danger" : "text-success"}`}>{open ? `${open} item(s) still open` : "All items closed"}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1.5 text-[13px]">
        {[
          ["Employee", `${e.name} (${e.employeeCode})`],
          ["Status", EMPLOYEE_STATUS[e.status].label],
          ["Designation", e.designation ?? "—"],
          ["Last working day", e.exitDate ? formatDate(e.exitDate) : "—"],
          ["Department", e.department?.name ?? "—"],
          ["Location", e.location?.name ?? "—"],
        ].map(([k, v]) => (
          <p key={k}>
            <span className="text-fg-muted">{k}: </span>
            <span className="text-fg">{v}</span>
          </p>
        ))}
      </section>

      <Section title="Logins to block" count={e.accounts.length}>
        {e.accounts.length === 0 && <li className="px-4 py-3 text-[13px] text-fg-muted">No logins recorded.</li>}
        {e.accounts.map((a) => (
          <Item
            key={a.id}
            done={a.status !== "ACTIVE"}
            title={
              <>
                <span className="font-medium">{a.system.name}</span> <span className="font-mono text-[12px]">{a.username}</span>
                {a.personal && <span className="text-fg-muted"> · personal account — remove its access</span>}
              </>
            }
            detail={
              a.status === "ACTIVE"
                ? [SYSTEM_CATEGORY[a.system.category], a.accessLevel].filter(Boolean).join(" · ")
                : `${ACCOUNT_STATUS[a.status].label} ${formatDate(a.closedAt)}${a.closedBy ? ` by ${a.closedBy.name}` : ""}${a.closeNote ? ` — ${a.closeNote}` : ""}`
            }
            extra={a.status === "ACTIVE" && a.system.offboardingSteps && <p className="mt-0.5 text-[12px] whitespace-pre-line text-fg-muted">How: {a.system.offboardingSteps}</p>}
          />
        ))}
      </Section>

      <Section title="Assets to collect" count={e.assignments.length}>
        {e.assignments.length === 0 && <li className="px-4 py-3 text-[13px] text-fg-muted">Nothing outstanding.</li>}
        {e.assignments.map((a) => (
          <Item
            key={a.id}
            done={false}
            title={
              <>
                <span className="font-mono text-[12px] font-medium">{a.asset.assetTag}</span> {a.asset.name}
              </>
            }
            detail={`Issued ${formatDate(a.issuedAt)}${a.asset.serialNumber ? ` · S/N ${a.asset.serialNumber}` : ""}`}
          />
        ))}
      </Section>

      <Section title="License seats to revoke" count={e.licenseSeats.length}>
        {e.licenseSeats.length === 0 && <li className="px-4 py-3 text-[13px] text-fg-muted">Nothing outstanding.</li>}
        {e.licenseSeats.map((s) => (
          <Item key={s.id} done={false} title={s.license.name} detail={`Since ${formatDate(s.assignedAt)}`} />
        ))}
      </Section>

      <Section title="General" count={4}>
        {["Shared passwords they knew have been changed", "Mail forwarding / auto-reply set, files handed to manager", "Removed from WhatsApp / chat groups and shared drives", "ID card, access card and keys collected"].map((t) => (
          <Item key={t} done={false} title={t} />
        ))}
      </Section>

      <footer className="mt-14 grid grid-cols-2 gap-12 text-[12.5px]">
        {["Checked by (IT)", "Approved by (manager / HR)"].map((role) => (
          <div key={role}>
            <div className="h-12 border-b border-fg" />
            <p className="mt-2 font-medium text-fg">{role}</p>
            <p className="text-fg-secondary">Name: ____________________</p>
            <p className="text-fg-secondary">Date: ____________________</p>
          </div>
        ))}
      </footer>
    </article>
  );
}
