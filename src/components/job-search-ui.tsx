import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ClipboardPenLine,
  FlaskConical,
  LayoutDashboard,
  Moon,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useJobSearch } from "@/lib/job-search-context";
import {
  formatChange,
  formatLongDate,
  formatPct,
  granularityConfig,
  NOT_ENOUGH_DATA,
  rate,
  type DerivedValues,
  type Granularity,
  type Polarity,
  funnelSteps,
} from "@/lib/job-search-data";

const navigation = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Daily Entry", to: "/daily-entry", icon: ClipboardPenLine },
  { label: "Pipeline", to: "/pipeline", icon: BriefcaseBusiness },
  { label: "Weekly Review", to: "/weekly-review", icon: CalendarDays },
  { label: "Companies", to: "/companies", icon: Building2 },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

export const axisTick = { fill: "var(--color-muted-foreground)", fontSize: 10 };

// ---------- Theme ----------

const THEME_KEY = "job-search-theme";
const THEME_EVENT = "job-search-theme-change";

function readTheme(): boolean {
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => {
      const next = readTheme();
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
    };
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  const setTheme = (next: boolean) => {
    window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_EVENT));
  };
  return { dark, setTheme, toggle: () => setTheme(!dark) };
}

// ---------- Shell ----------

function DemoBanner() {
  const { settings, setDataset, clearDemoData } = useJobSearch();
  const [busy, setBusy] = useState(false);
  if (settings.dataset !== "demo") return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber/40 bg-amber/15 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
      <span className="flex items-center gap-2">
        <FlaskConical className="size-4 text-amber" />
        <span>
          <strong>Demo data</strong> — sample numbers for exploring the dashboard. Not your data;
          read-only.
        </span>
      </span>
      <span className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          className="h-7 rounded-sm"
          onClick={() => run(() => setDataset("real"))}
        >
          Switch to my data
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          className="h-7 rounded-sm"
          onClick={() =>
            window.confirm("Delete all demo data? Your real data is not affected.") &&
            run(clearDemoData)
          }
        >
          Delete demo data
        </Button>
      </span>
    </div>
  );
}

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { dark, toggle } = useTheme();
  const { entries, today, settings } = useJobSearch();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = navigation.find((item) => item.to === pathname) ?? navigation[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-rule bg-card md:flex">
          <Link
            to="/"
            className="flex items-center gap-3 border-b border-rule px-5 py-5"
            aria-label="Dashboard"
          >
            <span className="size-2.5 rotate-45 bg-coral" />
            <span className="font-display text-lg leading-none tracking-wide">JOB SEARCH</span>
          </Link>
          <nav aria-label="Main navigation" className="flex flex-col gap-0.5 px-3 pt-4">
            {navigation.map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true, includeSearch: false }}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "!bg-accent !text-primary font-medium" }}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="px-3 pt-6">
            <Button
              asChild
              variant="outline"
              className="w-full justify-start border-coral/30 bg-coral/5 text-coral hover:bg-coral/10"
            >
              <Link to="/daily-entry">
                <Plus className="size-4" />
                Log today
              </Link>
            </Button>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-rule px-4 py-4">
            <div className="leading-tight">
              <div className="text-[13px] font-medium">{entries.length} days logged</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {settings.dataset === "demo" ? "demo dataset" : "your data"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggle}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-20 md:pb-0">
          <DemoBanner />
          <header className="flex min-h-[68px] items-end justify-between gap-4 border-b border-rule bg-background px-4 py-3.5 sm:px-6 lg:px-8">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Job-change analytics
              </div>
              <h1 className="mt-1 font-display text-[26px] leading-none tracking-wide">
                {active.label.toUpperCase()}
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden font-mono text-[11px] text-muted-foreground sm:block">
                {formatLongDate(today)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Toggle dark mode"
                onClick={toggle}
              >
                {dark ? <Sun /> : <Moon />}
              </Button>
              <Button
                asChild
                className="h-8 rounded-sm bg-ink px-3 text-[13px] text-paper hover:bg-ink/90"
              >
                <Link to="/daily-entry">Log today</Link>
              </Button>
            </div>
          </header>
          <div className="page-enter px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</div>
        </main>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-rule bg-card/95 px-1 py-1.5 backdrop-blur-md md:hidden"
      >
        {navigation.map(({ label, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-label={label}
            aria-current={active.to === to ? "page" : undefined}
            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 text-[9px] ${active.to === to ? "text-primary" : "text-muted-foreground"}`}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span className="truncate">{label.split(" ")[0]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

// ---------- Primitives ----------

export type DataKind = "actual" | "calculated" | "diagnostic";

const kindStyles: Record<DataKind, { label: string; className: string }> = {
  actual: { label: "Actual data", className: "border-teal/40 text-teal" },
  calculated: { label: "Calculated", className: "border-amber/50 text-amber" },
  diagnostic: { label: "Diagnostic", className: "border-coral/40 text-coral" },
};

export function KindBadge({ kind }: { kind: DataKind }) {
  const style = kindStyles[kind];
  return (
    <span
      className={`inline-flex shrink-0 items-center border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export function Panel({
  title,
  eyebrow,
  kind,
  action,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  kind?: DataKind;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 border border-rule bg-card p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <h2 className="font-display text-[16px] tracking-wide">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {kind && <KindBadge kind={kind} />}
        </div>
      </div>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pt-2">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="mt-1 font-display text-lg tracking-wide">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Direction arrow + change. Neutral metrics (effort volume) are never colored as good or bad. */
export function Change({
  value,
  polarity = "higher-better",
}: {
  value: string;
  polarity?: Polarity;
}) {
  if (value === "—") return <span className="font-mono text-[11px] text-muted-foreground">—</span>;
  const negative = value.startsWith("-");
  const flat = /^[+]?0(\.0)?(%| pts)?$/.test(value);
  const tone =
    flat || polarity === "neutral"
      ? "text-muted-foreground"
      : negative
        ? "text-coral"
        : "text-teal";
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-[11px] ${tone}`}>
      {!flat &&
        (negative ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />)}
      {value}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  previous,
  polarity = "higher-better",
  compareLabel,
}: {
  label: string;
  value: number;
  previous: number;
  polarity?: Polarity;
  compareLabel: string;
}) {
  return (
    <div className="min-w-0 border border-rule bg-card p-3.5">
      <div className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="font-display text-[28px] leading-none tabular-nums">
          {value.toLocaleString()}
        </span>
        <Change value={formatChange(value, previous)} polarity={polarity} />
      </div>
      <div className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">
        {previous.toLocaleString()} {compareLabel}
      </div>
    </div>
  );
}

export function NotEnoughData({ detail }: { detail?: string }) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-1 border border-dashed border-rule px-4 py-6 text-center">
      <div className="text-sm text-muted-foreground">{NOT_ENOUGH_DATA}</div>
      {detail && <div className="max-w-sm text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-rule bg-card px-6 py-14 text-center">
      <ClipboardPenLine className="size-6 text-muted-foreground" />
      <div className="font-display text-lg tracking-wide">{title}</div>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild className="rounded-sm bg-ink text-paper hover:bg-ink/90">
          <Link to="/daily-entry">
            <Plus className="size-4" />
            Log your first day
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-sm">
          <Link to="/settings">Load demo data</Link>
        </Button>
      </div>
    </div>
  );
}

export function GranularityToggle({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (value: Granularity) => void;
}) {
  return (
    <SegmentedControl
      label="Time granularity"
      value={value}
      onChange={onChange}
      options={(Object.keys(granularityConfig) as Granularity[]).map((id) => ({
        id,
        label: granularityConfig[id].label,
      }))}
    />
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-sm border border-rule bg-background p-1"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <Button
          key={option.id}
          size="sm"
          variant="ghost"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`h-7 rounded-sm px-2.5 text-[11px] ${value === option.id ? "bg-teal text-primary-foreground hover:bg-teal/90 hover:text-primary-foreground" : "text-muted-foreground"}`}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function ChartTip({
  active,
  payload,
  label,
  percent,
}: {
  active?: boolean;
  payload?: { name: string; value: number | null; color?: string }[];
  label?: string;
  percent?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-rule bg-popover px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-mono text-muted-foreground">{label}</div>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <i className="size-2" style={{ background: item.color }} />
            {item.name}
          </span>
          <span className="font-mono">
            {item.value === null || item.value === undefined
              ? "—"
              : percent
                ? `${Math.round(item.value)}%`
                : item.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChartFrame({ children, height = 220 }: { children: ReactNode; height?: number }) {
  return (
    <div className="w-full min-w-0" style={{ height }}>
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <i className="size-2" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-5 items-end gap-0.5" aria-hidden="true">
      {values.map((value, index) => (
        <i
          key={index}
          className={`w-1.5 ${index === values.length - 1 ? "bg-teal" : "bg-rule"}`}
          style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function FunnelBars({ metrics }: { metrics: DerivedValues }) {
  if (metrics.applications === 0 && metrics.responses === 0)
    return <NotEnoughData detail="Log applications and responses to see the funnel." />;
  const top = Math.max(1, ...funnelSteps.map((step) => metrics[step.key]));
  return (
    <div className="space-y-2">
      {funnelSteps.map((step, index) => {
        const value = metrics[step.key];
        const previousKey = funnelSteps[index - 1]?.key;
        const stepRate = previousKey ? rate(value, metrics[previousKey]) : null;
        return (
          <div key={step.key}>
            {previousKey && (
              <div className="flex justify-center py-0.5 font-mono text-[10px] text-muted-foreground">
                <ArrowRight className="mr-1 size-3 rotate-90" />
                {formatPct(stepRate)} convert
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <span className="w-[92px] shrink-0 text-[11px] text-muted-foreground">
                {step.label}
              </span>
              <div className="flex h-7 flex-1 justify-center bg-muted/60">
                <div
                  className="h-full bg-teal transition-[width] duration-500"
                  style={{
                    width: `${value === 0 ? 0 : Math.max(3, (value / top) * 100)}%`,
                    opacity: 1 - index * 0.1,
                  }}
                />
              </div>
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {value.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DemoReadOnlyNotice({ what }: { what: string }) {
  const { readOnly, setDataset } = useJobSearch();
  if (!readOnly) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-amber/40 bg-amber/10 px-4 py-3 text-sm">
      <span>You're viewing demo data, which is read-only. Switch to your own data to {what}.</span>
      <Button
        size="sm"
        className="h-8 rounded-sm bg-ink text-paper hover:bg-ink/90"
        onClick={() => setDataset("real")}
      >
        Switch to my data
      </Button>
    </div>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export const inputClass =
  "h-9 w-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs text-muted-foreground ${className}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function NativeSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={`${inputClass} pr-8`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">
      {message}
    </p>
  ) : null;
}
