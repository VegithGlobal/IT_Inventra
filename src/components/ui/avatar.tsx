import { cn, initials } from "@/lib/utils";

const tints = [
  "bg-[var(--avatar-1-bg)] text-[var(--avatar-1-fg)]",
  "bg-[var(--avatar-2-bg)] text-[var(--avatar-2-fg)]",
  "bg-[var(--avatar-3-bg)] text-[var(--avatar-3-fg)]",
  "bg-[var(--avatar-4-bg)] text-[var(--avatar-4-fg)]",
  "bg-[var(--avatar-5-bg)] text-[var(--avatar-5-fg)]",
  "bg-[var(--avatar-6-bg)] text-[var(--avatar-6-fg)]",
];

function tintFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return tints[Math.abs(h) % tints.length];
}

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-7 text-[11px]",
  md: "size-8 text-[12px]",
  lg: "size-12 text-[15px]",
  xl: "size-16 text-[18px]",
};

export function Avatar({ name, size = "md", className }: { name: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        sizes[size],
        tintFor(name),
        className,
      )}
      aria-hidden
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 3, size = "sm" }: { names: string[]; max?: number; size?: keyof typeof sizes }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="flex -space-x-2">
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} className="ring-2 ring-surface" />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-subtle font-medium text-fg-secondary ring-2 ring-surface",
            sizes[size],
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
