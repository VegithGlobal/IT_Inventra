"use client";

import { FormError, InputField, SelectField, TextareaField, useActionForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { FormGrid } from "@/components/ui/field";
import { EMPLOYEE_STATUS, toOptions } from "@/lib/options";
import { createEmployee, updateEmployee } from "./actions";
import type { Lookups } from "./queries";
import { employeeSchema, type EmployeeInput } from "./schema";

export const emptyEmployee: EmployeeInput = {
  employeeCode: "",
  name: "",
  email: "",
  phone: "",
  designation: "",
  departmentId: "",
  locationId: "",
  joiningDate: "",
  exitDate: "",
  status: "ACTIVE",
  notes: "",
};

export function EmployeeForm({
  id,
  initial = emptyEmployee,
  lookups,
  onDone,
}: {
  id?: string;
  initial?: EmployeeInput;
  lookups: Pick<Lookups, "departments" | "locations">;
  onDone: (id: string) => void;
}) {
  const { form, submit, pending, errors, formError } = useActionForm(
    employeeSchema,
    (values) => (id ? updateEmployee({ id, data: values }) : createEmployee(values)),
    { defaultValues: initial, successMessage: id ? "Employee updated" : "Employee added", onSuccess: (r) => onDone(r.id) },
  );
  const r = form.register;
  const opts = (list: { id: string; name: string }[]) => list.map((x) => ({ value: x.id, label: x.name }));

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      <FormGrid>
        <InputField label="Employee ID" required placeholder="NW1025" error={errors.employeeCode?.message} {...r("employeeCode")} />
        <InputField label="Full name" required error={errors.name?.message} {...r("name")} />
        <InputField label="Email" type="email" error={errors.email?.message} {...r("email")} />
        <InputField label="Phone" type="tel" placeholder="+91 98xxxxxxxx" error={errors.phone?.message} {...r("phone")} />
        <InputField label="Designation" error={errors.designation?.message} {...r("designation")} />
        <SelectField label="Department" placeholder="—" options={opts(lookups.departments)} {...r("departmentId")} />
        <SelectField label="Location" placeholder="—" options={opts(lookups.locations)} {...r("locationId")} />
        <SelectField label="Status" options={toOptions(EMPLOYEE_STATUS)} {...r("status")} />
        <InputField label="Joining date" type="date" error={errors.joiningDate?.message} {...r("joiningDate")} />
        <InputField label="Exit date" type="date" error={errors.exitDate?.message} hint="Required when leaving or exited" {...r("exitDate")} />
      </FormGrid>
      <TextareaField label="Notes" error={errors.notes?.message} {...r("notes")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Add employee"}
        </Button>
      </div>
    </form>
  );
}
