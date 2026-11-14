"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ArrowClockwiseIcon, CircleNotchIcon, CopyIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { toast } from "sonner";

/* The Slovey product kit. Thin wrappers that give Radix primitives our look (ui.css) and keep
   every screen's loading, empty and error states consistent. */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ───────── brand ───────── */

/** The real logo: white tile with the S cut out, plus the red "caught bug" dot layer. */
export function Mark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span className={cx("ui-mark", className)} style={{ width: size, height: size }} aria-hidden>
      <img src="/brand/tile-white.png" alt="" width={size} height={size} />
      <img src="/brand/dot-red.png" alt="" width={size} height={size} />
    </span>
  );
}

/* ───────── buttons ───────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "light" | "blue" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  wide?: boolean;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", wide, loading, icon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "ui-btn",
        variant !== "default" && `ui-btn--${variant}`,
        size !== "md" && `ui-btn--${size}`,
        wide && "ui-btn--wide",
        className,
      )}
      {...rest}
    >
      {loading ? <CircleNotchIcon size={16} className="ui-spin" /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; small?: boolean }
>(function IconButton({ label, small, className, children, type = "button", ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx("ui-icon-btn", small && "ui-icon-btn--sm", className)}
      {...rest}
    >
      {children}
    </button>
  );
});

/* ───────── small pieces ───────── */

export function Chip({
  on,
  count,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; count?: number }) {
  return (
    <button type="button" className="ui-chip" data-on={on ? "true" : "false"} aria-pressed={on} {...rest}>
      {children}
      {count != null && <span className="count">{count}</span>}
    </button>
  );
}

/** A reference to a PR, incident or ADR: mono, ice-blue; red for incidents. */
export function Ref({ children, href, red }: { children: ReactNode; href?: string; red?: boolean }) {
  const cls = cx("ui-ref", red && "ui-ref--red");
  return href ? (
    <a className={cls} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
      {children}
    </a>
  ) : (
    <span className={cls}>{children}</span>
  );
}

export function Badge({
  tone,
  dot,
  children,
}: {
  tone?: "blue" | "red" | "green" | "amber";
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cx("ui-badge", tone && `ui-badge--${tone}`)}>
      {dot && <span className="ui-dot" />}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}

export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="ui-portal ui-tip" sideOffset={6}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <SwitchPrimitive.Root
      className="ui-switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      disabled={disabled}
    >
      <SwitchPrimitive.Thumb className="ui-switch-thumb" />
    </SwitchPrimitive.Root>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <div className="ui-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ n, label, tone }: { n: ReactNode; label: string; tone?: "red" | "blue" }) {
  return (
    <div className="ui-stat">
      <div className="n" data-tone={tone}>
        {n}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}

/* ───────── states ───────── */

export function Skeleton({ h = 18, w = "100%", r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="ui-skel" style={{ height: h, width: w, borderRadius: r }} aria-hidden />;
}

/** Rows of skeleton that match the feed layout, so nothing jumps when data lands. */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="ui-rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ui-row" style={{ cursor: "default" }}>
          <Skeleton h={34} w={34} r={10} />
          <div style={{ display: "grid", gap: 8 }}>
            <Skeleton h={16} w={`${70 - (i % 3) * 12}%`} />
            <Skeleton h={12} w={`${42 + (i % 2) * 14}%`} />
          </div>
          <Skeleton h={12} w={44} />
        </div>
      ))}
    </div>
  );
}

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty">
      <div className="ico">{icon}</div>
      <div className="ui-h3">{title}</div>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="ui-error" role="alert">
      <WarningCircleIcon size={22} weight="fill" />
      <div className="msg">
        <strong>{title ?? "This didn't load"}</strong>
        <span>{errorMessage(error)}</span>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry} icon={<ArrowClockwiseIcon size={14} />}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Turn an API error into one readable sentence (server errors arrive as JSON {error}). */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const json = raw.match(/\{.*\}$/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as { error?: string; message?: string };
      if (parsed.error || parsed.message) return String(parsed.error ?? parsed.message);
    } catch {
      /* fall through */
    }
  }
  if (/\b401\b/.test(raw)) return "Your session ended. Sign in again.";
  if (/\b403\b/.test(raw)) return "You don't have access to this.";
  if (/\b404\b/.test(raw)) return "We couldn't find that.";
  if (/\b(500|502|503|504)\b/.test(raw)) return "Slovey hit a problem on our side. Try again in a moment.";
  if (/Failed to fetch|NetworkError/i.test(raw)) return "You look offline. Check your connection.";
  return raw && raw.length < 160 ? raw : "Something went wrong. Try again.";
}

/* ───────── overlays ───────── */

/** Right-hand detail sheet (Today, Memory, Reviews). Esc and the X both close it. */
export function Sheet({
  open,
  onOpenChange,
  title,
  head,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  head?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay ui-overlay--sheet" />
        <Dialog.Content className="ui-portal ui-sheet" aria-describedby={undefined}>
          <div className="ui-sheet-head">
            <Dialog.Title className="ui-sr">{title}</Dialog.Title>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>{head}</div>
            <Dialog.Close asChild>
              <IconButton label="Close" small>
                <XIcon size={15} />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="ui-sheet-body">{children}</div>
          {footer && <div className="ui-sheet-foot">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-overlay" />
        <Dialog.Content className="ui-portal ui-dialog" aria-describedby={description ? undefined : undefined}>
          <div style={{ display: "grid", gap: 8 }}>
            <Dialog.Title className="ui-title ui-title--sm">{title}</Dialog.Title>
            {description && <Dialog.Description className="ui-body ui-muted">{description}</Dialog.Description>}
          </div>
          {children}
          {actions && <div className="ui-dialog-actions">{actions}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ───────── menu ───────── */

export const MenuRoot = Menu.Root;
export const MenuTrigger = Menu.Trigger;

export function MenuContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "center" | "end" }) {
  return (
    <Menu.Portal>
      <Menu.Content className="ui-portal ui-menu" align={align} sideOffset={8}>
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function MenuItem({
  icon,
  children,
  end,
  onSelect,
  href,
}: {
  icon?: ReactNode;
  children: ReactNode;
  end?: ReactNode;
  onSelect?: () => void;
  href?: string;
}) {
  if (href) {
    return (
      <Menu.Item asChild className="ui-menu-item">
        <a href={href}>
          {icon}
          {children}
          {end && <span className="end">{end}</span>}
        </a>
      </Menu.Item>
    );
  }
  return (
    <Menu.Item className="ui-menu-item" onSelect={onSelect}>
      {icon}
      {children}
      {end && <span className="end">{end}</span>}
    </Menu.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <Menu.Label className="ui-menu-label">{children}</Menu.Label>;
}

export function MenuSep() {
  return <Menu.Separator className="ui-menu-sep" />;
}

/* ───────── code ───────── */

/** A one-file diff: a path line and -/+ lines. Plain text, never HTML. */
export function Diff({ file, lines }: { file?: string; lines: Array<{ kind: "add" | "del" | "ctx"; text: string }> }) {
  return (
    <div className="ui-diff">
      {file && <div className="ui-diff-file">{file}</div>}
      {lines.map((l, i) => (
        <div key={i} className="ui-diff-line" data-kind={l.kind}>
          {l.kind === "add" ? "+ " : l.kind === "del" ? "- " : "  "}
          {l.text}
        </div>
      ))}
    </div>
  );
}

/* ───────── time ───────── */

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Clock time for today, otherwise a short relative day: matches the mock's right-hand column. */
export function feedTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return timeAgo(iso);
}

/* ───────────── copy ───────────── */

export function copyText(text: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Couldn't copy. Select the text and copy it instead."),
  );
}

/** One command or value on a line, with a copy button. */
export function CopyLine({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <div className="ui-copy">
      <code>{text}</code>
      <button type="button" aria-label={label} onClick={() => copyText(text)}>
        <CopyIcon size={15} />
      </button>
    </div>
  );
}

/** A multi-line snippet (a config file, a script) with a copy button. */
export function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div className="ui-codeblock">
      <div className="ui-codeblock-head">
        <span>{title ?? ""}</span>
        <button type="button" onClick={() => copyText(code)}>
          <CopyIcon size={14} /> Copy
        </button>
      </div>
      <pre className="ui-code">{code}</pre>
    </div>
  );
}
