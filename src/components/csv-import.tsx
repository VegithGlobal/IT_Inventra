"use client";

import { FileUp } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";

type ImportResult = { created: number; skipped: number; errors: string[] };

/** Generic CSV import modal: template download → pick file → server action → summary. */
export function CsvImport({
  entity,
  headers,
  example,
  action,
  disabled,
}: {
  entity: string;
  headers: readonly string[];
  example: string[];
  action: (input: { rows: string[][] }) => Promise<ActionResult<ImportResult>>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    setResult(null);
    if (!file) return setRows(null);
    setRows(parseCsv(await file.text()));
  }

  function run() {
    if (!rows) return;
    start(async () => {
      const res = await action({ rows });
      if (!res.ok) return void toast.error(res.error);
      setResult(res.data);
      toast.success(`Imported ${res.data.created} ${entity.toLowerCase()}(s)`);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        <FileUp />
        Import CSV
      </Button>
      <Modal
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setRows(null);
            setResult(null);
          }
        }}
        title={`Import ${entity.toLowerCase()}s`}
        description="Upload a CSV file. Existing records (same ID) are skipped."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Close</Button>
            <Button variant="primary" onClick={run} disabled={!rows || rows.length < 2 || pending}>
              {pending ? "Importing…" : rows ? `Import ${Math.max(rows.length - 1, 0)} row(s)` : "Import"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-[13.5px]">
          <p className="text-fg-secondary">
            Columns: <code className="rounded bg-subtle px-1 py-0.5 text-[12px]">{headers.join(", ")}</code>
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => downloadCsv(`${entity.toLowerCase()}-import-template`, toCsv([...headers], [example]))}
          >
            Download template
          </Button>
          <Input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => onFile(e.target.files?.[0])} />
          {result && (
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="font-medium text-fg">
                {result.created} created · {result.skipped} skipped (already exist)
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-danger">
                  {result.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
