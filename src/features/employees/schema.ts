import { z } from "zod";
import { optionalDate, optionalEmail, optionalId, requiredText, text } from "@/lib/validation";

export const employeeSchema = z
  .object({
    employeeCode: requiredText("Employee ID", 30),
    name: requiredText("Name", 120),
    email: optionalEmail,
    phone: text(30),
    designation: text(120),
    departmentId: optionalId,
    locationId: optionalId,
    joiningDate: optionalDate,
    exitDate: optionalDate,
    status: z.enum(["ACTIVE", "LEAVING", "EXITED"]),
    notes: text(2000),
  })
  .refine((v) => !v.exitDate || !v.joiningDate || v.exitDate >= v.joiningDate, {
    path: ["exitDate"],
    message: "Exit date can't be before the joining date",
  })
  .refine((v) => v.status === "ACTIVE" || v.exitDate !== "", {
    path: ["exitDate"],
    message: "Set the exit date for leaving/exited employees",
  });

export type EmployeeInput = z.infer<typeof employeeSchema>;

export const employeeUpdateSchema = z.object({ id: z.string().min(1), data: employeeSchema });

export const EMPLOYEE_CSV_HEADERS = [
  "employee_id",
  "name",
  "email",
  "phone",
  "designation",
  "department",
  "location",
  "joining_date",
] as const;

export const employeeImportSchema = z.object({
  rows: z.array(z.array(z.string())).min(1, "The file has no rows").max(2000, "Import up to 2,000 rows at a time"),
});
