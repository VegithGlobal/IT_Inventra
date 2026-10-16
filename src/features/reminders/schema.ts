import { z } from "zod";
import { dateStr, optionalId, requiredText, text } from "@/lib/validation";

export const REPEAT_RULES = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM_DAYS"] as const;
export const REMINDER_TYPES = ["CUSTOM", "RECURRING_TASK", "PREVENTIVE_MAINTENANCE"] as const;

export const reminderSchema = z
  .object({
    title: requiredText("Title", 200),
    type: z.enum(REMINDER_TYPES),
    date: dateStr,
    time: z.string().regex(/^\d{2}:\d{2}$/, "Enter a time like 09:00"),
    repeatRule: z.enum(REPEAT_RULES),
    repeatEveryDays: z.string().trim(),
    notes: text(2000),
    assetId: optionalId,
    subscriptionId: optionalId,
    active: z.boolean(),
    /** RECURRING_TASK only: the ticket opened each time it fires. */
    ticketRequesterId: optionalId,
    ticketCategoryId: optionalId,
    ticketPriority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  })
  .refine((v) => v.repeatRule !== "CUSTOM_DAYS" || (/^\d+$/.test(v.repeatEveryDays) && Number(v.repeatEveryDays) >= 1 && Number(v.repeatEveryDays) <= 3650), {
    path: ["repeatEveryDays"],
    message: "Enter how many days between repeats (1–3650)",
  })
  .refine((v) => v.type !== "PREVENTIVE_MAINTENANCE" || v.assetId !== "", { path: ["assetId"], message: "Choose the asset to service" })
  .refine((v) => v.type !== "RECURRING_TASK" || v.ticketRequesterId !== "", { path: ["ticketRequesterId"], message: "Choose who the ticket is for" });

export type TicketTemplate = { requesterId: string; categoryId: string | null; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" };

export type ReminderInput = z.infer<typeof reminderSchema>;
export const reminderSaveSchema = z.object({ id: z.string().optional(), data: reminderSchema });
