"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, type ComponentProps } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action";

/**
 * react-hook-form + zod (same schema as the server action) + server action call.
 * Maps server-side field errors back onto the form and shows a toast.
 */
export function useActionForm<I extends FieldValues, O extends FieldValues, R>(
  schema: z.ZodType<O, I>,
  action: (input: O) => Promise<ActionResult<R>>,
  opts: { defaultValues: DefaultValues<I>; successMessage?: string; onSuccess?: (data: R) => void },
) {
  const form = useForm<I, unknown, O>({ resolver: zodResolver(schema), defaultValues: opts.defaultValues });
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const submit = form.handleSubmit((values) =>
    new Promise<void>((resolve) => {
      startTransition(async () => {
        setFormError(null);
        const res = await action(values);
        if (res.ok) {
          if (opts.successMessage) toast.success(opts.successMessage);
          opts.onSuccess?.(res.data);
        } else {
          const fields = form.getValues();
          const unmatched: string[] = [];
          for (const [key, message] of Object.entries(res.fieldErrors ?? {})) {
            // Update actions wrap values as { id, data }; map "data.x" back onto field "x".
            const name = key.replace(/^data\./, "");
            if (name in fields) form.setError(name as Path<I>, { message });
            else unmatched.push(message);
          }
          // Errors on things the form doesn't render as fields (e.g. an upload) must still be visible.
          const message = unmatched.length ? unmatched.join(" ") : res.error;
          setFormError(message);
          toast.error(message);
        }
        resolve();
      });
    }),
  );

  return { form, submit, pending: pending || form.formState.isSubmitting, formError, errors: form.formState.errors };
}

/** Runs a server action from a button (archive, mark paid…) with toasts. */
export function useActionRunner() {
  const [pending, startTransition] = useTransition();
  function run<R>(promise: () => Promise<ActionResult<R>>, success?: string, onSuccess?: (data: R) => void) {
    startTransition(async () => {
      const res = await promise();
      if (res.ok) {
        if (success) toast.success(success);
        onSuccess?.(res.data);
      } else toast.error(res.error);
    });
  }
  return { pending, run };
}

type Labelled = { label: string; error?: string; hint?: string; required?: boolean; className?: string };

export function InputField({ label, error, hint, required, className, ...props }: Labelled & ComponentProps<"input"> & { name: string }) {
  const id = `f-${props.name}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <Input id={id} aria-invalid={error ? true : undefined} {...props} />
    </Field>
  );
}

export function TextareaField({ label, error, hint, required, className, ...props }: Labelled & ComponentProps<"textarea"> & { name: string }) {
  const id = `f-${props.name}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <Textarea id={id} aria-invalid={error ? true : undefined} {...props} />
    </Field>
  );
}

export type Option = { value: string; label: string };

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  options,
  placeholder,
  ...props
}: Labelled & ComponentProps<"select"> & { name: string; options: Option[]; placeholder?: string }) {
  const id = `f-${props.name}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <NativeSelect id={id} aria-invalid={error ? true : undefined} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger" role="alert">
      {message}
    </p>
  );
}
