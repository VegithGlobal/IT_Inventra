"use client";

import { Archive, Download, ExternalLink, FileImage, FileText, Pencil, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormError, InputField, SelectField, TextareaField, useActionForm, useActionRunner, type Option } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, SlideOver } from "@/components/ui/dialog";
import { DetailList } from "@/components/ui/card";
import { Field, FormGrid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatBytes, formatDate, formatMoney } from "@/lib/format";
import { DOCUMENT_TYPE, toOptions } from "@/lib/options";
import { archiveDocument, updateDocument, uploadDocument } from "./actions";
import type { DocumentLinkOptions, DocumentRow } from "./queries";
import { ACCEPTED_UPLOADS, documentMetaSchema, type DocumentMetaInput } from "./schema";

export type DocLink = Partial<Pick<DocumentMetaInput, "assetId" | "subscriptionId" | "expenseId" | "ticketId">>;

const emptyMeta = (link: DocLink, defaults?: Partial<DocumentMetaInput>): DocumentMetaInput => ({
  type: "INVOICE",
  title: "",
  invoiceNumber: "",
  invoiceDate: "",
  vendorId: "",
  amount: "",
  notes: "",
  assetId: "",
  subscriptionId: "",
  expenseId: "",
  ticketId: "",
  ...defaults,
  ...link,
});

export function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const Icon = mime.startsWith("image/") ? FileImage : FileText;
  return <Icon className={className ?? "size-4 text-fg-muted"} strokeWidth={1.75} aria-hidden />;
}

/** Metadata form. With `file` mode it uploads; otherwise it edits an existing document. */
function DocumentForm({
  mode,
  id,
  initial,
  vendors,
  linkOptions,
  lockedLink,
  onDone,
}: {
  mode: "upload" | "edit";
  id?: string;
  initial: DocumentMetaInput;
  vendors: Option[];
  linkOptions?: DocumentLinkOptions;
  lockedLink: boolean;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const { form, submit, pending, errors, formError } = useActionForm(
    documentMetaSchema,
    async (values) => {
      if (mode === "edit" && id) return updateDocument({ id, data: values });
      const fd = new FormData();
      for (const [k, v] of Object.entries(values)) fd.set(k, v);
      if (file) fd.set("file", file);
      return uploadDocument(fd);
    },
    { defaultValues: initial, successMessage: mode === "edit" ? "Document updated" : "Document uploaded", onSuccess: onDone },
  );
  const r = form.register;

  return (
    <form
      onSubmit={(e) => {
        if (mode === "upload" && !file) {
          e.preventDefault();
          setFileError("Choose a file to upload");
          return;
        }
        void submit(e);
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      <FormError message={formError} />
      {mode === "upload" && (
        <Field label="File" required error={fileError ?? undefined} hint="PDF, JPG, PNG or WEBP · up to 10 MB">
          <Input
            type="file"
            accept={ACCEPTED_UPLOADS}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setFileError(f && f.size > 10 * 1024 * 1024 ? "Files must be 10 MB or smaller" : null);
              if (f && !form.getValues("title")) form.setValue("title", f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
            }}
          />
        </Field>
      )}
      <FormGrid>
        <InputField label="Title" required className="sm:col-span-2" error={errors.title?.message} {...r("title")} />
        <SelectField label="Type" options={toOptions(DOCUMENT_TYPE)} {...r("type")} />
        <SelectField label="Vendor" placeholder="—" options={vendors} {...r("vendorId")} />
        <InputField label="Invoice number" error={errors.invoiceNumber?.message} {...r("invoiceNumber")} />
        <InputField label="Invoice date" type="date" error={errors.invoiceDate?.message} {...r("invoiceDate")} />
        <InputField label="Amount (₹)" inputMode="decimal" error={errors.amount?.message} {...r("amount")} />
      </FormGrid>
      {!lockedLink && linkOptions && (
        <FormGrid>
          <SelectField label="Linked asset" placeholder="—" options={linkOptions.assets} {...r("assetId")} />
          <SelectField label="Linked subscription" placeholder="—" options={linkOptions.subscriptions} {...r("subscriptionId")} />
          <SelectField label="Linked expense" placeholder="—" className="sm:col-span-2" options={linkOptions.expenses} {...r("expenseId")} />
        </FormGrid>
      )}
      <TextareaField label="Notes" rows={2} error={errors.notes?.message} {...r("notes")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? (mode === "upload" ? "Uploading…" : "Saving…") : mode === "upload" ? "Upload" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function UploadDialog({
  open,
  onOpenChange,
  vendors,
  link = {},
  linkOptions,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vendors: Option[];
  link?: DocLink;
  linkOptions?: DocumentLinkOptions;
  defaults?: Partial<DocumentMetaInput>;
}) {
  const locked = Object.values(link).some(Boolean);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Upload document" description="Invoices, receipts, warranty cards, contracts…" size="lg">
      {open && (
        <DocumentForm
          mode="upload"
          initial={emptyMeta(link, defaults)}
          vendors={vendors}
          linkOptions={linkOptions}
          lockedLink={locked}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Modal>
  );
}

/** Slide-over with inline preview (PDF/image), metadata, download, edit and archive. */
export function DocumentPreview({
  doc,
  onOpenChange,
  vendors,
  linkOptions,
  canWrite,
}: {
  doc: DocumentRow | null;
  onOpenChange: (o: boolean) => void;
  vendors: Option[];
  linkOptions?: DocumentLinkOptions;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, run } = useActionRunner();
  const src = doc ? `/api/files/${doc.id}` : "";
  return (
    <SlideOver
      open={!!doc}
      onOpenChange={(o) => {
        if (!o) setEditing(false);
        onOpenChange(o);
      }}
      title={doc?.title ?? ""}
      description={doc ? `${DOCUMENT_TYPE[doc.type]} · ${formatBytes(doc.sizeBytes)}` : undefined}
      headerAction={
        doc && (
          <Button size="icon-sm" variant="ghost" asChild aria-label="Open in new tab">
            <a href={src} target="_blank" rel="noopener noreferrer">
              <ExternalLink />
            </a>
          </Button>
        )
      }
      footer={
        doc &&
        !editing && (
          <>
            {canWrite && (
              <>
                <Button variant="ghost" className="mr-auto text-danger" disabled={pending} onClick={() => run(() => archiveDocument({ id: doc.id }), "Document archived", () => onOpenChange(false))}>
                  <Archive />
                  Archive
                </Button>
                <Button onClick={() => setEditing(true)}>
                  <Pencil />
                  Edit details
                </Button>
              </>
            )}
            <Button variant="primary" asChild>
              <a href={`${src}?download=1`}>
                <Download />
                Download
              </a>
            </Button>
          </>
        )
      }
    >
      {doc &&
        (editing ? (
          <DocumentForm mode="edit" id={doc.id} initial={doc.form} vendors={vendors} linkOptions={linkOptions} lockedLink={!linkOptions} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="overflow-hidden rounded-lg border border-line bg-subtle">
              {doc.mimeType === "application/pdf" ? (
                <iframe src={src} title={doc.title} className="h-[52vh] w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated file route, not a static asset
                <img src={src} alt={doc.title} className="max-h-[52vh] w-full object-contain" />
              )}
            </div>
            <DetailList
              items={[
                { label: "Invoice number", value: doc.invoiceNumber },
                { label: "Invoice date", value: doc.invoiceDate ? formatDate(doc.invoiceDate) : null },
                { label: "Vendor", value: doc.vendor },
                { label: "Amount", value: doc.amount === null ? null : formatMoney(doc.amount) },
                {
                  label: "Linked to",
                  value: doc.links.length ? (
                    <span className="flex flex-wrap gap-x-3">
                      {doc.links.map((l) => (
                        <Link key={l.href} href={l.href} className="truncate hover:underline">
                          {l.label}
                        </Link>
                      ))}
                    </span>
                  ) : null,
                },
                { label: "Uploaded", value: `${formatDate(doc.createdAt)}${doc.uploadedBy ? ` by ${doc.uploadedBy}` : ""}` },
                { label: "File", value: doc.fileName },
                { label: "Notes", value: doc.notes },
              ]}
            />
          </div>
        ))}
    </SlideOver>
  );
}

/** Compact document list for entity pages (asset, subscription…). */
export function DocumentList({
  docs,
  vendors,
  link,
  canWrite,
  defaults,
}: {
  docs: DocumentRow[];
  vendors: Option[];
  link: DocLink;
  canWrite: boolean;
  defaults?: Partial<DocumentMetaInput>;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = docs.find((d) => d.id === previewId) ?? null;
  return (
    <div className="flex flex-col gap-3">
      {canWrite && (
        <Button size="sm" className="self-end" onClick={() => setUploadOpen(true)}>
          <Upload />
          Upload document
        </Button>
      )}
      {docs.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-5 py-10 text-center text-[13.5px] text-fg-muted">No documents yet.</div>
      ) : (
        <ul className="rounded-xl border border-line bg-surface">
          {docs.map((d) => (
            <li key={d.id} className="border-b border-line last:border-0">
              <button type="button" onClick={() => setPreviewId(d.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle">
                <FileIcon mime={d.mimeType} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-fg">{d.title}</span>
                  <span className="block truncate text-[12.5px] text-fg-muted">
                    {[d.invoiceNumber, d.invoiceDate && formatDate(d.invoiceDate), d.vendor].filter(Boolean).join(" · ") || d.fileName}
                  </span>
                </span>
                <Badge>{DOCUMENT_TYPE[d.type]}</Badge>
                {d.amount !== null && <span className="text-[13px] text-fg-secondary tabular">{formatMoney(d.amount)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} vendors={vendors} link={link} defaults={defaults} />
      <DocumentPreview doc={preview} onOpenChange={(o) => !o && setPreviewId(null)} vendors={vendors} canWrite={canWrite} />
    </div>
  );
}
