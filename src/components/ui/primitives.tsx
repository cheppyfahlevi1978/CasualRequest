import * as React from "react";
import Link from "next/link";
import type { Tone } from "@/lib/format";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// --- Tone tokens ------------------------------------------------------------

const TONE_SOFT: Record<Tone, string> = {
  neutral: "bg-bg-subtle text-text-muted border-border",
  info: "bg-info-soft text-info border-info/25",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/25",
  primary: "bg-primary-soft text-primary border-primary/25",
};

// --- Card -------------------------------------------------------------------

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("cr-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-text">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// --- Page header ------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

// --- Button -----------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-[0.625rem] font-medium transition " +
  "disabled:cursor-not-allowed disabled:opacity-55 whitespace-nowrap";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-sm",
  secondary: "bg-card text-text border border-border-strong hover:bg-bg-subtle",
  ghost: "text-text-muted hover:bg-bg-subtle hover:text-text",
  danger: "bg-danger text-white hover:opacity-90 shadow-sm",
  success: "bg-success text-white hover:opacity-90 shadow-sm",
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={buttonClass(variant, size, className)} {...rest} />;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

// --- Badge ------------------------------------------------------------------

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5",
        TONE_SOFT[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Alert ------------------------------------------------------------------

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-[0.75rem] border px-4 py-3 text-sm", TONE_SOFT[tone])}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1 opacity-90" : "opacity-90"}>{children}</div> : null}
    </div>
  );
}

// --- Avatar -----------------------------------------------------------------

export function Avatar({
  name,
  src,
  size = 36,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const label = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-xs font-semibold text-primary"
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        label || "?"
      )}
    </span>
  );
}

// --- KPI card ---------------------------------------------------------------

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
}) {
  return (
    <div className="cr-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        {icon ? (
          <span
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg border",
              TONE_SOFT[tone],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-text">{value}</p>
      {hint ? <p className="mt-1 text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

// --- Table ------------------------------------------------------------------

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="cr-card overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full min-w-[720px] border-collapse text-sm">{children}</table>;
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border-b border-border bg-card-muted px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-border px-4 py-3 align-middle text-text",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

// --- Empty & loading states -------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon ? <div className="mb-1 text-text-faint">{icon}</div> : null}
      <p className="text-sm font-semibold text-text">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("cr-skeleton", className)} style={style} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="cr-card divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cn("h-4 flex-1", c === 0 && "max-w-[8rem]")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 320 }: { height?: number }) {
  return <Skeleton className="w-full rounded-[0.875rem]" style={{ height }} />;
}

// --- Form field -------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="cr-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

// --- Pagination -------------------------------------------------------------

export function Pagination({
  page,
  pageSize,
  total,
  baseHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  baseHref: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const build = (p: number) => {
    const sep = baseHref.includes("?") ? "&" : "?";
    return `${baseHref}${sep}page=${p}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-text-muted">
      <p>
        Menampilkan <strong className="text-text">{from}</strong>–
        <strong className="text-text">{to}</strong> dari{" "}
        <strong className="text-text">{total}</strong> data
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={build(page - 1)} className={buttonClass("secondary", "sm")}>
            Sebelumnya
          </Link>
        ) : (
          <span className={cn(buttonClass("secondary", "sm"), "opacity-50")}>Sebelumnya</span>
        )}
        <span className="px-1">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={build(page + 1)} className={buttonClass("secondary", "sm")}>
            Berikutnya
          </Link>
        ) : (
          <span className={cn(buttonClass("secondary", "sm"), "opacity-50")}>Berikutnya</span>
        )}
      </div>
    </div>
  );
}
