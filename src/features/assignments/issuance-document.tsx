import type { ReactNode } from "react";
import { ASSET_CONDITION } from "@/lib/options";
import type { getAssignmentForPrint } from "./queries";

type Assignment = NonNullable<Awaited<ReturnType<typeof getAssignmentForPrint>>>;

// Calendar dates are stored as UTC midnight, so read the day straight off the ISO string.
const ddmmyyyy = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

function Table({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-1 text-[15px] font-semibold text-[#4472c4]">{title}</h2>
      <table className="w-full border-collapse text-[13px] text-fg">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="w-1/2 border border-fg px-2 py-0.5">{label}:</td>
              <td className="w-1/2 border border-fg px-2 py-0.5">{value || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** A4 "IT Asset Issuance Form" — the company's paper format, signed when an asset is handed to an employee. */
export function IssuanceDocument({ a }: { a: Assignment }) {
  const { asset, employee } = a;
  const capacity = Object.values((asset.specs ?? {}) as Record<string, string>)
    .filter(Boolean)
    .join(" / ");
  // Imported models often repeat the brand ("HP" + "HP 250 G8"), so don't print it twice.
  const brandModel =
    asset.brand && asset.model?.toLowerCase().startsWith(asset.brand.toLowerCase())
      ? asset.model
      : [asset.brand, asset.model].filter(Boolean).join(" ") || asset.name;
  const accessories = Array.isArray(a.accessories) ? (a.accessories as string[]).filter(Boolean) : [];
  const item = `${asset.type.name}${accessories.length ? ` with ${accessories.join(", ")}` : ""}`;

  return (
    <article className="mx-auto my-8 w-full max-w-[794px] bg-surface p-12 font-serif shadow-[var(--shadow-popover)] print:my-0 print:max-w-none print:p-0 print:shadow-none">
      <h1 className="font-sans text-[20px] font-semibold text-[#2f5496]">IT Asset Issuance Form</h1>

      <div className="font-sans">
        <Table
          title="Employee Details"
          rows={[
            ["Name of Employee", employee.name],
            ["Employee ID", employee.employeeCode],
            ["Department", employee.department?.name],
            ["Designation", employee.designation],
            ["Contact No.", employee.phone],
          ]}
        />
        <Table
          title="Asset Details"
          rows={[
            ["Asset Type", asset.type.name],
            ["Capacity", capacity],
            ["Brand / Model", brandModel],
            ["Serial Number", asset.serialNumber],
            ["Date of Issue", ddmmyyyy(a.issuedAt)],
            ["Condition", ASSET_CONDITION[a.conditionAtIssue].label],
          ]}
        />
      </div>

      <ul className="mt-8 list-disc space-y-4 pl-12 text-[13.5px] leading-relaxed text-fg">
        <li>Kindly acknowledge receipt of the above-mentioned {item}, accept responsibilities for its proper use and safekeeping.</li>
        <li>You are requested to refrain from saving any personal software or data that may alter the efficiency of the asset and it is not authorized by company.</li>
        <li>In case of theft or any damages, you will be liable to pay for the expenses incurred for mending the same.</li>
        <li>Kindly understand that the asset remains the property of the company and must be returned upon request or when leaving the organization.</li>
      </ul>

      <footer className="mt-14 grid grid-cols-2 gap-12 text-[13.5px] text-fg break-inside-avoid">
        <p>Authorized Signatory: {a.issuedBy?.name ?? "____________________"}</p>
        <p>Employee Name: {employee.name}</p>
        <p className="mt-12">Signature: ____________________</p>
        <p className="mt-12">Signature: ____________________</p>
      </footer>
    </article>
  );
}
