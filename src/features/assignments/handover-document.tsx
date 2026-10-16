import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";
import { ASSET_CONDITION } from "@/lib/options";
import type { CompanySettings } from "@/lib/settings";
import type { getAssignmentForPrint } from "./queries";

type Assignment = NonNullable<Awaited<ReturnType<typeof getAssignmentForPrint>>>;

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-line py-2 text-[13px] last:border-0">
      <span className="text-fg-muted">{label}</span>
      <span className="text-fg">{value || "—"}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 text-[11.5px] font-semibold tracking-[0.06em] text-fg-muted uppercase">{title}</h2>
      <div className="rounded-lg border border-line px-4">{children}</div>
    </section>
  );
}

/** A4 printable handover / return form. */
export function HandoverDocument({ kind, a, company }: { kind: "handover" | "return"; a: Assignment; company: CompanySettings }) {
  const isReturn = kind === "return";
  const specs = Object.entries((a.asset.specs ?? {}) as Record<string, string>)
    .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
    .join(" · ");
  const accessories = Array.isArray(a.accessories) ? (a.accessories as string[]).join(", ") : "";
  const docNo = `${isReturn ? "RET" : "HO"}-${a.asset.assetTag}-${(isReturn ? a.returnedAt : a.issuedAt)?.toISOString().slice(0, 10).replace(/-/g, "")}`;

  return (
    <article className="mx-auto my-8 w-full max-w-[794px] bg-surface p-12 shadow-[var(--shadow-popover)] print:my-0 print:max-w-none print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b-2 border-fg pb-5">
        <div>
          <p className="text-[18px] font-semibold text-fg">{company.name}</p>
          {company.address && <p className="text-[12.5px] text-fg-secondary">{company.address}</p>}
          {company.gstin && <p className="text-[12.5px] text-fg-secondary">GSTIN {company.gstin}</p>}
        </div>
        <div className="text-right">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-fg">{isReturn ? "Asset Return Form" : "Asset Handover Form"}</h1>
          <p className="mt-1 font-mono text-[12px] text-fg-secondary">{docNo}</p>
          <p className="text-[12.5px] text-fg-secondary">Date: {formatDate(isReturn ? a.returnedAt : a.issuedAt)}</p>
        </div>
      </header>

      <Section title="Employee">
        <Row label="Name" value={a.employee.name} />
        <Row label="Employee ID" value={a.employee.employeeCode} />
        <Row label="Designation" value={a.employee.designation} />
        <Row label="Department" value={a.employee.department?.name} />
        <Row label="Location" value={a.employee.location?.name} />
      </Section>

      <Section title="Asset">
        <Row label="Asset tag" value={<span className="font-mono">{a.asset.assetTag}</span>} />
        <Row label="Description" value={`${a.asset.name} (${a.asset.type.name})`} />
        <Row label="Serial number" value={a.asset.serialNumber} />
        <Row label="Specifications" value={specs} />
        <Row label="Accessories" value={accessories || "None"} />
        <Row label="Issued on" value={formatDate(a.issuedAt)} />
        <Row label="Condition at issue" value={ASSET_CONDITION[a.conditionAtIssue].label} />
        {!isReturn && a.expectedReturnAt && <Row label="Expected return" value={formatDate(a.expectedReturnAt)} />}
        {isReturn && (
          <>
            <Row label="Returned on" value={formatDate(a.returnedAt)} />
            <Row label="Condition at return" value={a.conditionAtReturn ? ASSET_CONDITION[a.conditionAtReturn].label : "—"} />
            <Row label="Damage notes" value={a.damageNotes ?? "None reported"} />
          </>
        )}
        {(isReturn ? a.returnNotes : a.issueNotes) && <Row label="Notes" value={isReturn ? a.returnNotes : a.issueNotes} />}
      </Section>

      <section className="mt-6 text-[12.5px] leading-relaxed text-fg-secondary">
        {isReturn ? (
          <p>
            The IT department confirms receipt of the asset listed above in the condition noted. Any damage beyond normal wear has been recorded
            above and may be handled as per company policy.
          </p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5">
            <li>The asset and accessories listed above remain the property of {company.name}.</li>
            <li>I will use the asset for official purposes, keep it secure and report loss, theft or damage to IT immediately.</li>
            <li>I will not install unlicensed software or remove company security tools.</li>
            <li>I will return the asset and all accessories in working condition when asked or on leaving the company.</li>
          </ol>
        )}
      </section>

      <footer className="mt-16 grid grid-cols-2 gap-12 text-[12.5px]">
        {[
          { role: isReturn ? "Returned by (employee)" : "Received by (employee)", name: a.employee.name },
          { role: isReturn ? "Received by (IT)" : "Issued by (IT)", name: (isReturn ? a.receivedBy?.name : a.issuedBy?.name) ?? "" },
        ].map((s) => (
          <div key={s.role}>
            <div className="h-12 border-b border-fg" />
            <p className="mt-2 font-medium text-fg">{s.role}</p>
            <p className="text-fg-secondary">Name: {s.name}</p>
            <p className="text-fg-secondary">Date: ____________________</p>
          </div>
        ))}
      </footer>
    </article>
  );
}
