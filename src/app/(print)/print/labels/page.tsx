import type { Metadata } from "next";
import QRCode from "qrcode";
import { Suspense } from "react";
import { PrintBar } from "@/components/print-bar";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getCompany } from "@/lib/settings";

export const metadata: Metadata = { title: "Asset labels" };

async function Labels({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw.join(",") : (raw ?? "")).split(",").filter(Boolean).slice(0, 300);
  const [assets, company] = await Promise.all([
    db.asset.findMany({ where: { id: { in: ids }, deletedAt: null }, orderBy: { assetTag: "asc" }, include: { type: true } }),
    getCompany(),
  ]);
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const labels = await Promise.all(
    assets.map(async (a) => ({
      ...a,
      // Monochrome QR, sized by CSS. Links straight to the asset page.
      svg: await QRCode.toString(`${base}/assets/${a.id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }),
    })),
  );

  return (
    <>
      <PrintBar title={`${labels.length} label${labels.length === 1 ? "" : "s"}`} hint="Sized for 62 × 30 mm label stock; on A4 they tile in a grid." />
      {labels.length === 0 ? (
        <p className="p-10 text-center text-[13.5px] text-fg-muted">No assets selected.</p>
      ) : (
        <div className="mx-auto grid max-w-[794px] grid-cols-[repeat(auto-fill,62mm)] justify-center gap-3 p-8 print:gap-[2mm] print:p-0">
          {labels.map((a) => (
            <div key={a.id} className="flex h-[30mm] w-[62mm] items-center gap-[3mm] overflow-hidden rounded-md border border-line bg-surface p-[2.5mm] break-inside-avoid print:rounded-none">
              <div className="size-[25mm] shrink-0 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: a.svg }} />
              <div className="min-w-0 leading-tight text-fg">
                <p className="truncate text-[6.5pt] tracking-[0.04em] uppercase">{company.name}</p>
                <p className="mt-[1mm] font-mono text-[12pt] font-semibold">{a.assetTag}</p>
                <p className="mt-[0.5mm] line-clamp-2 text-[7pt]">{a.name}</p>
                {a.serialNumber && <p className="mt-[0.5mm] truncate font-mono text-[6pt]">S/N {a.serialNumber}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function LabelsPage(props: PageProps<"/print/labels">) {
  return (
    <Suspense>
      <Labels searchParams={props.searchParams} />
    </Suspense>
  );
}
