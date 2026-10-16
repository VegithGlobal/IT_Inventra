// Display labels + badge tones for enums, shared across modules.
import type { Tone } from "@/components/ui/badge";
import type {
  AssetCondition,
  AssetStatus,
  BillingCycle,
  DocumentType,
  EmployeeStatus,
  ExpenseSource,
  PaymentMode,
  SubscriptionCategory,
  SubscriptionStatus,
  TicketPriority,
  TicketSource,
  TicketStatus,
  VendorCategory,
} from "@/generated/prisma/enums";

type Meta = { label: string; tone: Tone };
const opts = <K extends string>(m: Record<K, Meta>) => m;
export const toOptions = <K extends string>(m: Record<K, Meta | string>) =>
  (Object.entries(m) as [K, Meta | string][]).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));

export const ASSET_STATUS = opts<AssetStatus>({
  IN_STOCK: { label: "In stock", tone: "info" },
  ASSIGNED: { label: "Assigned", tone: "success" },
  UNDER_REPAIR: { label: "Under repair", tone: "warning" },
  IN_TRANSIT: { label: "In transit", tone: "neutral" },
  LOST_STOLEN: { label: "Lost / stolen", tone: "danger" },
  RETIRED: { label: "Retired", tone: "neutral" },
  DISPOSED: { label: "Disposed", tone: "neutral" },
});

export const ASSET_CONDITION = opts<AssetCondition>({
  NEW: { label: "New", tone: "success" },
  GOOD: { label: "Good", tone: "success" },
  FAIR: { label: "Fair", tone: "warning" },
  POOR: { label: "Poor", tone: "danger" },
});

export const EMPLOYEE_STATUS = opts<EmployeeStatus>({
  ACTIVE: { label: "Active", tone: "success" },
  LEAVING: { label: "Leaving", tone: "warning" },
  EXITED: { label: "Exited", tone: "neutral" },
});

export const VENDOR_CATEGORY: Record<VendorCategory, string> = {
  ISP: "ISP",
  HARDWARE: "Hardware",
  CLOUD: "Cloud",
  SERVICE_CENTER: "Service center",
  SOFTWARE: "Software",
  OTHER: "Other",
};

export const SUBSCRIPTION_CATEGORY: Record<SubscriptionCategory, string> = {
  ISP: "WiFi / ISP",
  CLOUD: "Cloud server",
  DOMAIN: "Domain",
  SSL: "SSL certificate",
  SOFTWARE: "Software",
  AMC: "AMC contract",
  PHONE: "Phone / SIM",
  OTHER: "Other",
};

export const SUBSCRIPTION_STATUS = opts<SubscriptionStatus>({
  ACTIVE: { label: "Active", tone: "success" },
  PAUSED: { label: "Paused", tone: "warning" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
});

export const BILLING_CYCLE: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
  CUSTOM: "Custom (days)",
};

export const PAYMENT_MODE: Record<PaymentMode, string> = {
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CHEQUE: "Cheque",
};

export const EXPENSE_SOURCE: Record<ExpenseSource, string> = {
  MANUAL: "Manual",
  SUBSCRIPTION: "Subscription payment",
  ASSET_PURCHASE: "Asset purchase",
  STOCK_IN: "Stock in",
  MAINTENANCE: "Maintenance",
  LICENSE: "License",
};

export const DOCUMENT_TYPE: Record<DocumentType, string> = {
  INVOICE: "Invoice",
  RECEIPT: "Receipt",
  WARRANTY_CARD: "Warranty card",
  QUOTATION: "Quotation",
  HANDOVER_FORM: "Handover form",
  RETURN_FORM: "Return form",
  CONTRACT: "Contract",
  PHOTO: "Photo",
  OTHER: "Other",
};

/** Expense category colorKey ("chart-1"…"chart-7") → CSS var. Unknown keys fall back to the last slot. */
export const categoryColor = (key: string) => (/^chart-[1-7]$/.test(key) ? `var(--${key})` : "var(--chart-7)");
/** Stack/legend order follows the validated palette order, so adjacent series stay distinguishable. */
export const categorySlot = (key: string) => (/^chart-([1-7])$/.test(key) ? Number(key.slice(6)) : 7);

export const TICKET_STATUS = opts<TicketStatus>({
  OPEN: { label: "Open", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  WAITING_ON_USER: { label: "Waiting on user", tone: "warning" },
  WAITING_ON_VENDOR: { label: "Waiting on vendor", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
});

export const TICKET_PRIORITY: Record<TicketPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Critical" };

export const TICKET_SOURCE: Record<TicketSource, string> = {
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  SELF_IDENTIFIED: "Self-identified",
};

/** "45m", "2h 10m" */
export function formatMinutes(min: number) {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

/** "3h", "2d" — compact age for cards. */
export function formatAge(from: Date | string, to: Date = new Date()) {
  const hours = Math.max(0, (to.getTime() - new Date(from).getTime()) / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
