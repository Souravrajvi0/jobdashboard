import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  axisTick,
  ChartFrame,
  ChartTip,
  EmptyState,
  FunnelBars,
  inputClass,
  KpiCard,
  Legend,
  NotEnoughData,
  Panel,
  SectionHeading,
  SegmentedControl,
} from "@/components/job-search-ui";
import { useJobSearch } from "@/lib/job-search-context";
import {
  addDays,
  buildDailySeries,
  channelPerformance,
  conversionsFor,
  derive,
  formatConversion,
  formatPct,
  formatRange,
  isValidISODate,
  periodPresets,
  previousRange,
  resolvePeriod,
  sumEntries,
  type ChannelPerformance,
  type ConversionResult,
  type DateRange,
  type DerivedKey,
  type DerivedValues,
  type PeriodPreset,
  type Polarity,
  type SeriesPoint,
} from "@/lib/job-search-data";

export interface LineDef {
  key: DerivedKey;
  label: string;
  color: string;
}

export const effortLines: LineDef[] = [
  { key: "applications", label: "Applications", color: "var(--color-teal)" },
  { key: "referralRequests", label: "Referral requests", color: "var(--color-amber)" },
  { key: "outreach", label: "Outreach", color: "var(--color-coral)" },
  { key: "followupsSent", label: "Follow-ups", color: "var(--color-muted-foreground)" },
];

export const outputLines: LineDef[] = [
  { key: "qualifiedTotal", label: "Qualified", color: "var(--color-teal)" },
  { key: "responses", label: "Responses", color: "var(--color-chart-3)" },
  { key: "screeningCalls", label: "Screens", color: "var(--color-amber)" },
  { key: "interviews", label: "Interviews", color: "var(--color-coral)" },
  { key: "finalRounds", label: "Finals", color: "var(--color-foreground)" },
  { key: "offers", label: "Offers", color: "var(--color-muted-foreground)" },
];

export const visibilityLines: LineDef[] = [
  { key: "naukriProfileViews", label: "Naukri views", color: "var(--color-teal)" },
  { key: "linkedinProfileViews", label: "LinkedIn views", color: "var(--color-coral)" },
  { key: "recruiterInbound", label: "Recruiter inbound", color: "var(--color-amber)" },
  {
    key: "relevantInboundOpportunities",
    label: "Relevant inbound",
    color: "var(--color-foreground)",
  },
];

export function TrendLines({
  series,
  lines,
  height = 220,
}: {
  series: SeriesPoint[];
  lines: LineDef[];
  height?: number;
}) {
  if (!series.some((item) => lines.some((line) => item[line.key] > 0))) return <NotEnoughData />;
  return (
    <>
      <Legend items={lines} />
      <ChartFrame height={height}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-rule)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTip />} />
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </>
  );
}

export function ConversionGrid({
  results,
  previous,
}: {
  results: ConversionResult[];
  previous?: ConversionResult[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {results.map((result) => {
        const before = previous?.find((item) => item.id === result.id);
        return (
          <div
            key={result.id}
            className="border border-rule bg-background p-3"
            title={result.formula}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              {result.group}
            </div>
            <div className="mt-0.5 text-[13px] font-medium">{result.label}</div>
            <div className="mt-1.5 font-display text-2xl tabular-nums">
              {formatConversion(result, 1)}
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {result.denominator === 0
                ? `no ${result.denominatorLabel} yet`
                : `${result.numerator} ${result.numeratorLabel} / ${result.denominator} ${result.denominatorLabel}`}
            </div>
            {before && (
              <div className="font-mono text-[10px] text-muted-foreground">
                prev: {formatConversion(before, 1)}
              </div>
            )}
            {result.kind === "ratio" && (
              <div className="font-mono text-[10px] text-muted-foreground">
                lower = more efficient
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const channelBars = [
  { key: "activity", label: "Activity", color: "var(--color-muted-foreground)" },
  { key: "responses", label: "Responses", color: "var(--color-teal)" },
  { key: "interviews", label: "Interviews", color: "var(--color-amber)" },
  { key: "offers", label: "Offers", color: "var(--color-coral)" },
] as const;

const channelResponses = (channel: ChannelPerformance) =>
  channel.dailyResponses ?? channel.responded;

export function ChannelPerformanceView({ channels }: { channels: ChannelPerformance[] }) {
  const data = channels.map((channel) => ({
    label: channel.label.replace(/ \(.*\)/, ""),
    activity: channel.activity,
    responses: channelResponses(channel),
    interviews: channel.interviews,
    offers: channel.offers,
  }));
  if (!data.some((item) => item.activity + item.responses + item.interviews > 0))
    return (
      <NotEnoughData detail="Log outreach and add opportunities with a source to compare channels." />
    );
  return (
    <div className="space-y-4">
      <Legend items={[...channelBars]} />
      <ChartFrame height={240}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-rule)" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTip />} />
            {channelBars.map((bar) => (
              <Bar
                key={bar.key}
                dataKey={bar.key}
                name={bar.label}
                fill={bar.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr className="border-b border-rule">
              <th className="py-2 pr-3 font-normal">Channel</th>
              <th className="py-2 pr-3 text-right font-normal">Activity</th>
              <th className="py-2 pr-3 text-right font-normal">Responses</th>
              <th className="py-2 pr-3 text-right font-normal">Tracked opps</th>
              <th className="py-2 pr-3 text-right font-normal">Interviews</th>
              <th className="py-2 pr-3 text-right font-normal">Offers</th>
              <th className="py-2 pr-3 text-right font-normal">Opp → interview</th>
              <th className="py-2 text-right font-normal">Interviews / 10 actions</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((channel) => (
              <tr key={channel.id} className="border-b border-rule/60">
                <td className="py-2 pr-3">{channel.label}</td>
                <td className="py-2 pr-3 text-right font-mono">
                  {channel.activity}{" "}
                  <span className="text-muted-foreground">{channel.activityLabel}</span>
                </td>
                <td className="py-2 pr-3 text-right font-mono">{channelResponses(channel)}</td>
                <td className="py-2 pr-3 text-right font-mono">{channel.tracked}</td>
                <td className="py-2 pr-3 text-right font-mono">{channel.interviews}</td>
                <td className="py-2 pr-3 text-right font-mono">{channel.offers}</td>
                <td className="py-2 pr-3 text-right font-mono">
                  {formatPct(channel.interviewRate)}
                </td>
                <td className="py-2 text-right font-mono">
                  {channel.interviewsPer10 === null ? "—" : channel.interviewsPer10.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Activity and responses come from daily logs where a matching field exists (e.g. referrals
        received, recruiter replies); otherwise responses count tracked opportunities that
        progressed. Interviews and offers count tracked opportunities by source that reached that
        stage. Interviews per 10 actions compares channel quality: one referral that turns into an
        interview beats thirty cold messages that don't.
      </p>
    </div>
  );
}

type KpiDef = { key: DerivedKey; label: string; polarity: Polarity };

const effortKpis: KpiDef[] = [
  { key: "applications", label: "Applications", polarity: "neutral" },
  { key: "referralRequests", label: "Referral requests", polarity: "neutral" },
  { key: "referralsReceived", label: "Referrals received", polarity: "higher-better" },
  { key: "outreach", label: "Outreach messages", polarity: "neutral" },
  { key: "followupsSent", label: "Follow-ups", polarity: "neutral" },
];
const outputKpis: KpiDef[] = [
  { key: "qualifiedTotal", label: "Qualified opps", polarity: "higher-better" },
  { key: "responses", label: "Responses", polarity: "higher-better" },
  { key: "recruiterCalls", label: "Recruiter calls", polarity: "higher-better" },
  { key: "screeningCalls", label: "Screening calls", polarity: "higher-better" },
  { key: "interviews", label: "Interviews", polarity: "higher-better" },
  { key: "finalRounds", label: "Final rounds", polarity: "higher-better" },
  { key: "offers", label: "Offers", polarity: "higher-better" },
];
const visibilityKpis: KpiDef[] = [
  { key: "naukriProfileViews", label: "Naukri views", polarity: "higher-better" },
  { key: "linkedinProfileViews", label: "LinkedIn views", polarity: "higher-better" },
  { key: "recruiterInboundMessages", label: "Inbound messages", polarity: "higher-better" },
  { key: "recruiterInboundCalls", label: "Inbound calls", polarity: "higher-better" },
  { key: "relevantInboundOpportunities", label: "Relevant inbound", polarity: "higher-better" },
  { key: "platformActivity", label: "Platform activity", polarity: "neutral" },
];

function KpiRow({
  title,
  defs,
  current,
  previous,
}: {
  title: string;
  defs: KpiDef[];
  current: DerivedValues;
  previous: DerivedValues;
}) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {defs.map((def) => (
          <KpiCard
            key={def.key}
            label={def.label}
            value={current[def.key]}
            previous={previous[def.key]}
            polarity={def.polarity}
            compareLabel="previous period"
          />
        ))}
      </div>
    </div>
  );
}

function TodayCard() {
  const { today, entriesByDate } = useJobSearch();
  const entry = entriesByDate.get(today);
  const values = entry ? derive(entry.metrics) : null;
  const chips: [string, number][] = values
    ? [
        ["Applications", values.applications],
        ["Outreach", values.outreach],
        ["Responses", values.responses],
        ["Interviews", values.interviews],
        ["Profile views", values.profileViews],
        ["Inbound", values.recruiterInbound],
      ]
    : [];
  return (
    <Panel
      title="Today"
      eyebrow={formatRange(today, today)}
      kind="actual"
      action={
        <Button asChild size="sm" variant="outline" className="h-7 rounded-sm">
          <Link to="/daily-entry">{entry ? "Edit today" : "Log today"}</Link>
        </Button>
      }
    >
      {values ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {chips.map(([label, value]) => (
            <div key={label} className="border border-rule bg-background px-3 py-2">
              <div className="font-mono text-[10px] uppercase text-muted-foreground">{label}</div>
              <div className="font-display text-xl tabular-nums">{value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nothing logged today yet — the daily form takes under two minutes.
        </p>
      )}
    </Panel>
  );
}

export function DashboardPage() {
  const { entries, opportunities, today } = useJobSearch();
  const [preset, setPreset] = useState<PeriodPreset>("thisWeek");
  const [custom, setCustom] = useState<DateRange>({ start: addDays(today, -13), end: today });

  const customError =
    preset === "custom" &&
    (!isValidISODate(custom.start) || !isValidISODate(custom.end)
      ? "Enter valid start and end dates."
      : custom.start > custom.end
        ? "Start date must be on or before the end date."
        : null);
  const resolved = resolvePeriod(preset, today, customError ? undefined : custom);
  const range = useMemo(
    () => ({ start: resolved.start, end: resolved.end }),
    [resolved.start, resolved.end],
  );
  const prior = useMemo(() => previousRange(range), [range]);

  const view = useMemo(() => {
    const current = derive(sumEntries(entries, range.start, range.end));
    const previous = derive(sumEntries(entries, prior.start, prior.end));
    return {
      current,
      previous,
      conversions: conversionsFor(entries, opportunities, range),
      previousConversions: conversionsFor(entries, opportunities, prior),
      series: buildDailySeries(entries, range),
      channels: channelPerformance(entries, opportunities, range),
    };
  }, [entries, opportunities, range, prior]);

  if (entries.length === 0)
    return (
      <EmptyState
        title="Start your job-search log"
        body="Log one day of activity to see your effort, output and visibility pipelines."
      />
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Date range"
            value={preset}
            onChange={setPreset}
            options={periodPresets}
          />
          {preset === "custom" && (
            <span className="flex items-center gap-1.5">
              <input
                type="date"
                aria-label="Start date"
                max={today}
                value={custom.start}
                onChange={(event) => setCustom({ ...custom, start: event.target.value })}
                className={`${inputClass} h-8 w-[150px]`}
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                aria-label="End date"
                max={today}
                value={custom.end}
                onChange={(event) => setCustom({ ...custom, end: event.target.value })}
                className={`${inputClass} h-8 w-[150px]`}
              />
            </span>
          )}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {formatRange(range.start, range.end)}{" "}
          <span className="opacity-70">vs {formatRange(prior.start, prior.end)}</span>
        </div>
      </div>
      {customError && (
        <p role="alert" className="text-xs text-coral">
          {customError}
        </p>
      )}

      <TodayCard />

      <SectionHeading
        eyebrow="Pipeline 1 · outbound"
        title="Application pipeline — effort & output"
      />
      <Panel title="Effort and output" kind="actual">
        <div className="space-y-4">
          <KpiRow
            title="Effort (what you did)"
            defs={effortKpis}
            current={view.current}
            previous={view.previous}
          />
          <KpiRow
            title="Output (what came back)"
            defs={outputKpis}
            current={view.current}
            previous={view.previous}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Effort changes are shown in grey — more activity isn't automatically better. Qualified
          opportunities are the success measure; messages and replies alone are not.
        </p>
      </Panel>
      <Panel title="Conversion metrics" eyebrow="Selected period" kind="calculated">
        <ConversionGrid results={view.conversions} previous={view.previousConversions} />
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Effort trend" eyebrow="Daily" kind="actual">
          <TrendLines series={view.series} lines={effortLines} />
        </Panel>
        <Panel title="Output trend" eyebrow="Daily" kind="actual">
          <TrendLines series={view.series} lines={outputLines} />
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Funnel" eyebrow="Selected period" kind="calculated">
          <FunnelBars metrics={view.current} />
        </Panel>
        <Panel
          title="Channel performance"
          eyebrow="Activity → responses → interviews → offers"
          kind="calculated"
        >
          <ChannelPerformanceView channels={view.channels} />
        </Panel>
      </div>

      <SectionHeading
        eyebrow="Pipeline 2 · inbound"
        title="Visibility pipeline — how recruiters find you"
      />
      <Panel title="Visibility" kind="actual">
        <KpiRow
          title="Profile views & inbound"
          defs={visibilityKpis}
          current={view.current}
          previous={view.previous}
        />
      </Panel>
      <Panel title="Visibility trend" eyebrow="Daily" kind="actual">
        <TrendLines series={view.series} lines={visibilityLines} />
      </Panel>
    </div>
  );
}
