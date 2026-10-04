import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ChannelPerformanceView,
  effortLines,
  outputLines,
  TrendLines,
  visibilityLines,
} from "@/components/pages/dashboard-page";
import {
  axisTick,
  ChartFrame,
  ChartTip,
  EmptyState,
  FormError,
  FunnelBars,
  GranularityToggle,
  Legend,
  NotEnoughData,
  Panel,
} from "@/components/job-search-ui";
import { errorMessage } from "@/lib/job-search-api";
import { useJobSearch } from "@/lib/job-search-context";
import {
  buildSeries,
  channelPerformance,
  computeConversions,
  conversionDefs,
  derive,
  formatLongDate,
  granularityConfig,
  metricDefinitions,
  totalOfSeries,
  type Granularity,
} from "@/lib/job-search-data";

const rateLines = [
  { key: "appResponse", label: "Application response", color: "var(--color-teal)" },
  { key: "recruiterResponse", label: "Recruiter response", color: "var(--color-amber)" },
  { key: "networkingResponse", label: "Networking response", color: "var(--color-coral)" },
  { key: "referral", label: "Referral conversion", color: "var(--color-foreground)" },
  { key: "screenInterview", label: "Screen → interview", color: "var(--color-muted-foreground)" },
  { key: "qualifiedInterview", label: "Qualified → interview", color: "var(--color-chart-3)" },
];

const efficiencyLines = [
  { key: "appsPerResponse", label: "Applications per response", color: "var(--color-teal)" },
  {
    key: "messagesPerRecruiterReply",
    label: "Recruiter msgs per reply",
    color: "var(--color-amber)",
  },
  {
    key: "messagesPerNetworkingReply",
    label: "Networking msgs per reply",
    color: "var(--color-coral)",
  },
  { key: "requestsPerReferral", label: "Requests per referral", color: "var(--color-foreground)" },
  { key: "actionsPerQualified", label: "Actions per qualified opp", color: "var(--color-chart-3)" },
];

export function AnalyticsPage() {
  const { entries, opportunities, today, readOnly, deleteEntry } = useJobSearch();
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [error, setError] = useState<string | null>(null);

  const view = useMemo(() => {
    const series = buildSeries(entries, granularity, today);
    const range = { start: series[0]?.start ?? today, end: series.at(-1)?.end ?? today };
    const rates = series.map((point) => {
      const results = computeConversions(point);
      return {
        label: point.label,
        ...Object.fromEntries(
          results.map((result) => [
            result.id,
            result.value === null
              ? null
              : result.kind === "ratio"
                ? Math.round(result.value * 10) / 10
                : Math.round(result.value * 1000) / 10,
          ]),
        ),
      };
    });
    return {
      series,
      rates,
      totals: derive(totalOfSeries(series)),
      channels: channelPerformance(entries, opportunities, range),
    };
  }, [entries, opportunities, granularity, today]);

  if (entries.length === 0)
    return (
      <EmptyState
        title="No analytics yet"
        body="Analytics fill in as you log days. Start with today's numbers."
      />
    );

  const hasRates = view.rates.some((point) =>
    rateLines.some((line) => (point as Record<string, unknown>)[line.key] !== null),
  );
  const hasEfficiency = view.rates.some((point) =>
    efficiencyLines.some((line) => (point as Record<string, unknown>)[line.key] !== null),
  );
  const rangeLabel = granularityConfig[granularity].rangeLabel;

  const remove = async (id: number, date: string) => {
    if (!window.confirm(`Delete the entry for ${formatLongDate(date)}?`)) return;
    setError(null);
    try {
      await deleteEntry(id);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GranularityToggle value={granularity} onChange={setGranularity} />
        <span className="font-mono text-[11px] text-muted-foreground">{rangeLabel}</span>
      </div>

      <Panel
        title="Conversion-rate trends"
        eyebrow={`${rangeLabel} · gaps mean no denominator`}
        kind="calculated"
      >
        {!hasRates ? (
          <NotEnoughData />
        ) : (
          <>
            <Legend items={rateLines} />
            <ChartFrame height={240}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={view.rates} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-rule)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip content={<ChartTip percent />} />
                  {rateLines.map((line) => (
                    <Line
                      key={line.key}
                      type="monotone"
                      dataKey={line.key}
                      name={line.label}
                      stroke={line.color}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>
          </>
        )}
      </Panel>

      <Panel
        title="Efficiency trend"
        eyebrow={`${rangeLabel} · effort needed per result · lower is better`}
        kind="calculated"
      >
        {!hasEfficiency ? (
          <NotEnoughData />
        ) : (
          <>
            <Legend items={efficiencyLines} />
            <ChartFrame height={240}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={view.rates} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-rule)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} />
                  {efficiencyLines.map((line) => (
                    <Line
                      key={line.key}
                      type="monotone"
                      dataKey={line.key}
                      name={line.label}
                      stroke={line.color}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>
          </>
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Effort" eyebrow={rangeLabel} kind="actual">
          <TrendLines series={view.series} lines={effortLines} height={200} />
        </Panel>
        <Panel title="Output" eyebrow={rangeLabel} kind="actual">
          <TrendLines series={view.series} lines={outputLines} height={200} />
        </Panel>
        <Panel title="Visibility" eyebrow={rangeLabel} kind="actual">
          <TrendLines series={view.series} lines={visibilityLines} height={200} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Funnel drop-off" eyebrow={rangeLabel} kind="calculated">
          <FunnelBars metrics={view.totals} />
        </Panel>
        <Panel title="Channel detail" eyebrow={rangeLabel} kind="calculated">
          <ChannelPerformanceView channels={view.channels} />
        </Panel>
      </div>

      <Panel
        title="Metric definitions"
        eyebrow="Every rate is derived from logged counts — never stored"
      >
        <div className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
          {conversionDefs.map((def) => (
            <div key={def.id} className="border-b border-rule/60 py-1.5">
              <span className="font-medium">{def.label}</span>
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                {def.formula}
              </span>
              {def.source !== "daily" && (
                <span className="ml-2 font-mono text-[10px] text-amber">uses opportunities</span>
              )}
            </div>
          ))}
          {metricDefinitions.map((item) => (
            <div key={item.term} className="border-b border-rule/60 py-1.5">
              <span className="font-medium">{item.term}</span>
              <span className="ml-2 text-[12px] text-muted-foreground">{item.definition}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          A rate shows "—" when its denominator is 0.
        </p>
      </Panel>

      <Panel title="History" eyebrow={`${entries.length} logged days`} kind="actual">
        <FormError message={error} />
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 bg-card font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <tr className="border-b border-rule">
                <th className="py-2 pr-3 font-normal">Date</th>
                <th className="py-2 pr-3 text-right font-normal">Apps</th>
                <th className="py-2 pr-3 text-right font-normal">Outreach</th>
                <th className="py-2 pr-3 text-right font-normal">Responses</th>
                <th className="py-2 pr-3 text-right font-normal">Screens</th>
                <th className="py-2 pr-3 text-right font-normal">Interviews</th>
                <th className="py-2 pr-3 text-right font-normal">Offers</th>
                <th className="py-2 pr-3 text-right font-normal">Views</th>
                <th className="py-2 pr-3 font-normal">Notes</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((entry) => {
                const values = derive(entry.metrics);
                return (
                  <tr key={entry.id} className="border-b border-rule/60">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{formatLongDate(entry.date)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{values.applications}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{values.outreach}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{values.responses}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{values.screeningCalls}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{values.interviews}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{values.offers}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{values.profileViews}</td>
                    <td className="max-w-[200px] truncate py-1.5 pr-3 text-xs text-muted-foreground">
                      {entry.notes || "—"}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label={`Edit ${entry.date}`}
                      >
                        <Link to="/daily-entry" search={{ date: entry.date }}>
                          <Pencil className="size-3.5" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-coral"
                        disabled={readOnly}
                        aria-label={`Delete ${entry.date}`}
                        onClick={() => remove(entry.id, entry.date)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
