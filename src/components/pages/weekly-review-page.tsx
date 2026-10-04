import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConversionGrid } from "@/components/pages/dashboard-page";
import { Change, EmptyState, NotEnoughData, Panel, Sparkline } from "@/components/job-search-ui";
import { useJobSearch } from "@/lib/job-search-context";
import {
  addDays,
  computeConversions,
  formatChange,
  formatConversion,
  formatDelta,
  formatPointChange,
  formatWeekRange,
  metricGroups,
  referralInterviewsIn,
  scoreRows,
  startOfWeek,
  sumEntries,
  weeklyInsights,
  type Observation,
} from "@/lib/job-search-data";

const basisLabel: Record<Observation["basis"], string> = {
  threshold: "vs your threshold",
  baseline: "compared with previous weeks",
  "week-over-week": "week over week",
};

function ObservationCard({ observation }: { observation: Observation }) {
  const bottleneck = observation.severity === "bottleneck";
  return (
    <article
      className={`border-l-2 bg-background p-4 ${bottleneck ? "border-coral" : "border-amber"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.12em] ${bottleneck ? "text-coral" : "text-amber"}`}
        >
          {bottleneck ? "Potential bottleneck" : "Worth watching"}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          · {basisLabel[observation.basis]}
        </span>
      </div>
      <h3 className="mt-1 font-medium">{observation.title}</h3>
      <p className="mt-1.5 text-sm">
        <span className="text-muted-foreground">Data: </span>
        {observation.evidence}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{observation.interpretation}</p>
      <p className="mt-1 text-sm">
        <span className="text-muted-foreground">Worth investigating: </span>
        {observation.investigate}
      </p>
    </article>
  );
}

function ChangeList({ items, tone, empty }: { items: string[]; tone: string; empty: string }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className={tone}>{tone === "text-teal" ? "↑" : "↓"}</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function WeeklyReviewPage() {
  const { entries, opportunities, today, settings } = useJobSearch();
  const thisWeek = startOfWeek(today);
  const [weekStart, setWeekStart] = useState(thisWeek);

  const view = useMemo(() => {
    const insights = weeklyInsights(entries, weekStart, today, settings.diagnostics);
    const weekRange = { start: weekStart, end: addDays(weekStart, 6) };
    const previousStart = addDays(weekStart, -7);
    const previousRangeValue = { start: previousStart, end: addDays(previousStart, 6) };
    return {
      insights,
      totals: sumEntries(entries, weekRange.start, weekRange.end),
      conversions: computeConversions(
        insights.context.current,
        referralInterviewsIn(opportunities, weekRange),
      ),
      previousConversions: computeConversions(
        insights.context.previous,
        referralInterviewsIn(opportunities, previousRangeValue),
      ),
      scorecard: scoreRows(entries, weekStart),
    };
  }, [entries, opportunities, weekStart, today, settings.diagnostics]);

  if (entries.length === 0)
    return (
      <EmptyState
        title="No weeks to review yet"
        body="Log a few days of activity and your weekly review, diagnostics and scorecard will appear here."
      />
    );

  const { insights } = view;
  const { context } = insights;
  const hasData = context.daysLogged > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-sm"
            aria-label="Previous week"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft />
          </Button>
          <div className="min-w-[170px] text-center font-display text-lg tracking-wide">
            {formatWeekRange(weekStart)}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-sm"
            aria-label="Next week"
            disabled={weekStart >= thisWeek}
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight />
          </Button>
          {weekStart !== thisWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(thisWeek)}>
              This week
            </Button>
          )}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {context.daysLogged} of 7 days logged · previous week {context.previousDaysLogged}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Weekly insights"
          eyebrow="Generated from your logged data only"
          kind="diagnostic"
        >
          <ul className="space-y-2 text-sm">
            {insights.summary.map((line) => (
              <li
                key={line}
                className={line.startsWith("Potential bottleneck") ? "font-medium text-coral" : ""}
              >
                {line}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel
          title="What to change next week"
          eyebrow="Suggested focus, based on your data"
          kind="diagnostic"
        >
          {insights.focus.length ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {insights.focus.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              {hasData
                ? "No specific focus areas stand out from this week's data."
                : "Not enough data yet."}
            </p>
          )}
        </Panel>
      </div>

      {hasData && (
        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="What improved" eyebrow="vs previous week" kind="calculated">
            <ChangeList
              items={insights.improved}
              tone="text-teal"
              empty={
                context.previousDaysLogged
                  ? "No rate or outcome improved compared with last week."
                  : "Not enough data yet."
              }
            />
          </Panel>
          <Panel title="What is weak" eyebrow="vs previous week" kind="calculated">
            <ChangeList
              items={insights.weak}
              tone="text-coral"
              empty={
                context.previousDaysLogged
                  ? "No rate or outcome fell compared with last week."
                  : "Not enough data yet."
              }
            />
          </Panel>
        </div>
      )}

      <Panel title="Where am I weak?" eyebrow="Observations, not verdicts" kind="diagnostic">
        {!hasData ? (
          <NotEnoughData />
        ) : insights.observations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No potential bottlenecks were flagged with your current thresholds (Settings →
            Diagnostics). Small samples are skipped rather than judged.
          </p>
        ) : (
          <div className="space-y-3">
            {insights.observations.map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Weekly totals" kind="actual">
        {!hasData ? (
          <NotEnoughData />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {metricGroups.map((group) => (
              <div key={group.id}>
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {group.title}
                </div>
                <dl className="divide-y divide-rule/60 text-sm">
                  {group.metrics.map((metric) => (
                    <div key={metric.key} className="flex justify-between py-1.5">
                      <dt className="text-muted-foreground">{metric.label}</dt>
                      <dd className="font-mono tabular-nums">{view.totals[metric.key]}</dd>
                    </div>
                  ))}
                  {group.id === "visibility" && (
                    <>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-muted-foreground">Avg daily Naukri views</dt>
                        <dd className="font-mono">
                          {insights.visibilityAverages.naukri?.toFixed(1) ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <dt className="text-muted-foreground">Avg daily LinkedIn views</dt>
                        <dd className="font-mono">
                          {insights.visibilityAverages.linkedin?.toFixed(1) ?? "—"}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Daily averages divide by days logged, not 7.
        </p>
      </Panel>

      <Panel
        title="Weekly conversions"
        eyebrow="This week, with previous week below each"
        kind="calculated"
      >
        <ConversionGrid results={view.conversions} previous={view.previousConversions} />
      </Panel>

      <Panel
        title="Weekly scorecard"
        eyebrow="Current vs previous week · 6-week trend · no overall score"
        kind="calculated"
      >
        <div className="grid gap-5 lg:grid-cols-3">
          {view.scorecard.map((group) => (
            <div key={group.id}>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {group.title}
              </div>
              <div className="divide-y divide-rule/60">
                {group.rows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-1.5 text-sm"
                  >
                    <span className="truncate">{row.label}</span>
                    <Sparkline values={row.trend} />
                    <span className="w-16 text-right font-mono tabular-nums">
                      {row.previous} → {row.current}
                    </span>
                    <span className="w-14 text-right">
                      <Change
                        value={formatChange(row.current, row.previous)}
                        polarity={row.polarity}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Week-over-week comparison" kind="calculated">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <tr className="border-b border-rule">
                <th className="py-2 pr-3 font-normal">Metric</th>
                <th className="py-2 pr-3 text-right font-normal">Current</th>
                <th className="py-2 pr-3 text-right font-normal">Previous</th>
                <th className="py-2 pr-3 text-right font-normal">Change</th>
                <th className="py-2 text-right font-normal">% change</th>
              </tr>
            </thead>
            <tbody>
              {view.scorecard
                .flatMap((group) => group.rows)
                .map((row) => (
                  <tr key={row.key} className="border-b border-rule/60">
                    <td className="py-1.5 pr-3">
                      {row.label}
                      {row.polarity === "neutral" && (
                        <span className="ml-1.5 font-mono text-[9px] uppercase text-muted-foreground">
                          effort
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">{row.current}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">{row.previous}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">
                      {formatDelta(row.current, row.previous)}
                    </td>
                    <td className="py-1.5 text-right">
                      <Change
                        value={formatChange(row.current, row.previous)}
                        polarity={row.polarity}
                      />
                    </td>
                  </tr>
                ))}
              {view.conversions.map((result) => {
                const before = view.previousConversions.find((item) => item.id === result.id);
                return (
                  <tr key={result.id} className="border-b border-rule/60">
                    <td className="py-1.5 pr-3">{result.label}</td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {formatConversion(result, 1)}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono">
                      {before ? formatConversion(before, 1) : "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono text-muted-foreground">
                      {result.kind === "percent"
                        ? formatPointChange(result.value, before?.value ?? null)
                        : "—"}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[11px] text-muted-foreground">
                      —
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Effort rows are shown in grey: an increase in activity is not automatically an
          improvement. Rate changes are in percentage points.
        </p>
      </Panel>
    </div>
  );
}
