// ---------- Daily metrics ----------

export const metricGroups = [
  {
    id: "effort",
    title: "Effort",
    subtitle: "Application pipeline · outbound",
    metrics: [
      { key: "applications", label: "Applications sent" },
      { key: "referralRequests", label: "Referral requests sent" },
      { key: "referralsReceived", label: "Referrals received" },
      { key: "recruiterMessagesSent", label: "Recruiter messages sent" },
      { key: "hiringManagerMessagesSent", label: "Hiring manager messages sent" },
      { key: "employeeNetworkingMessagesSent", label: "Employee / networking messages" },
      { key: "followupsSent", label: "Follow-ups sent" },
    ],
  },
  {
    id: "output",
    title: "Output",
    subtitle: "Application pipeline · results",
    metrics: [
      { key: "qualifiedOpportunities", label: "Qualified opportunities created" },
      { key: "recruiterReplies", label: "Recruiter replies" },
      { key: "networkingReplies", label: "Networking replies" },
      { key: "recruiterCalls", label: "Recruiter calls" },
      { key: "screeningCalls", label: "Screening calls" },
      { key: "interviews", label: "Interviews" },
      { key: "finalRounds", label: "Final rounds" },
      { key: "offers", label: "Offers" },
    ],
  },
  {
    id: "visibility",
    title: "Visibility",
    subtitle: "Inbound pipeline",
    metrics: [
      { key: "naukriProfileViews", label: "Naukri profile views" },
      { key: "linkedinProfileViews", label: "LinkedIn profile views" },
      { key: "recruiterInboundMessages", label: "Recruiter inbound messages" },
      { key: "recruiterInboundCalls", label: "Recruiter inbound calls" },
      { key: "relevantInboundOpportunities", label: "Relevant inbound opportunities" },
      { key: "platformActivity", label: "HireAssist / other platform activity" },
    ],
  },
] as const;

export type MetricKey = (typeof metricGroups)[number]["metrics"][number]["key"];
export type MetricValues = Record<MetricKey, number>;

export const metricKeys = metricGroups.flatMap((group) =>
  group.metrics.map((metric) => metric.key),
) as MetricKey[];

export const metricLabels = Object.fromEntries(
  metricGroups.flatMap((group) => group.metrics.map((metric) => [metric.key, metric.label])),
) as Record<MetricKey, string>;

/** snake_case database column for a metric key, e.g. followupsSent → followups_sent. */
export const metricColumn = (key: MetricKey) =>
  key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);

export const MAX_DAILY_COUNT = 100_000;

export function emptyMetrics(): MetricValues {
  return Object.fromEntries(metricKeys.map((key) => [key, 0])) as MetricValues;
}

export interface DailyEntry {
  id: number;
  date: string;
  notes: string;
  metrics: MetricValues;
  createdAt: string;
  updatedAt: string;
}

export interface DailyEntryInput {
  date: string;
  notes: string;
  metrics: MetricValues;
}

// ---------- Derived values ----------

export interface DerivedValues extends MetricValues {
  outreach: number;
  networkingOutreach: number;
  responses: number;
  recruiterInbound: number;
  effortTotal: number;
  profileViews: number;
  qualifiedTotal: number;
}

export type DerivedKey = keyof DerivedValues;

export function derive(metrics: MetricValues): DerivedValues {
  const networkingOutreach =
    metrics.hiringManagerMessagesSent + metrics.employeeNetworkingMessagesSent;
  const outreach = metrics.recruiterMessagesSent + networkingOutreach;
  return {
    ...metrics,
    outreach,
    networkingOutreach,
    responses: metrics.recruiterReplies + metrics.networkingReplies,
    recruiterInbound: metrics.recruiterInboundMessages + metrics.recruiterInboundCalls,
    effortTotal: metrics.applications + metrics.referralRequests + outreach + metrics.followupsSent,
    profileViews: metrics.naukriProfileViews + metrics.linkedinProfileViews,
    qualifiedTotal: metrics.qualifiedOpportunities + metrics.relevantInboundOpportunities,
  };
}

export const derivedLabels: Record<DerivedKey, string> = {
  ...metricLabels,
  outreach: "Outreach messages",
  networkingOutreach: "Networking outreach",
  responses: "Responses",
  recruiterInbound: "Inbound recruiter contacts",
  effortTotal: "Total effort actions",
  profileViews: "Profile views",
  qualifiedTotal: "Qualified opportunities (outbound + inbound)",
};

export const metricDefinitions: { term: string; definition: string }[] = [
  {
    term: "Qualified opportunity",
    definition:
      "A real, role-specific opening that moved forward: a referral submitted for a role, a screen scheduled, or a hiring manager/recruiter engaging about a specific role. Messages sent and generic replies don't count.",
  },
  {
    term: "Qualified opportunities (all)",
    definition: "Qualified opportunities created + relevant inbound opportunities.",
  },
  { term: "Responses", definition: "Recruiter replies + networking replies." },
  {
    term: "Outreach messages",
    definition: "Recruiter + hiring manager + employee/networking messages sent.",
  },
  {
    term: "Networking outreach",
    definition: "Hiring manager + employee/networking messages sent.",
  },
  {
    term: "Inbound recruiter contacts",
    definition: "Recruiter inbound messages + recruiter inbound calls.",
  },
  {
    term: "Total effort actions",
    definition: "Applications + referral requests + outreach messages + follow-ups.",
  },
  {
    term: "Opportunity response",
    definition: "A tracked opportunity whose furthest stage reached Referral Received or later.",
  },
  {
    term: "Opportunity interview",
    definition: "A tracked opportunity whose furthest stage reached Technical Interview or later.",
  },
];

// ---------- Opportunities & companies ----------

export const pipelineStages = [
  "Discovered",
  "Applied",
  "Referral Requested",
  "Referral Received",
  "Recruiter Contact",
  "Recruiter Screen",
  "Technical Interview",
  "Final Round",
  "Offer",
  "Rejected",
  "Withdrawn",
] as const;
export type PipelineStage = (typeof pipelineStages)[number];

export const progressStages = pipelineStages.slice(0, 9) as PipelineStage[];
export const closedStages: PipelineStage[] = ["Rejected", "Withdrawn"];

export function stageIndex(stage: PipelineStage): number {
  return progressStages.indexOf(stage);
}

/** Furthest progress stage after moving to `next`; Rejected/Withdrawn never count as progress. */
export function advanceFurthest(current: PipelineStage | null, next: PipelineStage): PipelineStage {
  if (stageIndex(next) === -1) return current ?? "Discovered";
  if (!current || stageIndex(next) > stageIndex(current)) return next;
  return current;
}

export const opportunitySources = [
  "Direct Application",
  "Referral",
  "Recruiter",
  "Hiring Manager",
  "Employee Networking",
  "LinkedIn Inbound",
  "Naukri Inbound",
  "Other",
] as const;
export type OpportunitySource = (typeof opportunitySources)[number];

export interface Opportunity {
  id: number;
  company: string;
  role: string;
  date: string;
  source: OpportunitySource | null;
  stage: PipelineStage;
  furthestStage: PipelineStage;
  notes: string;
  updatedAt: string;
}

export type OpportunityInput = Pick<
  Opportunity,
  "company" | "role" | "date" | "source" | "stage" | "notes"
>;

export const applicationStatuses = [
  "Not applied",
  "Applied",
  "Interviewing",
  "Waiting",
  "Rejected",
  "Offer",
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export interface Company {
  id: number;
  name: string;
  targetRole: string;
  jobUrl: string;
  source: OpportunitySource | null;
  contactAvailable: boolean;
  referralAvailable: boolean;
  applicationStatus: ApplicationStatus;
  currentStage: PipelineStage;
  lastActivity: string | null;
  nextFollowUp: string | null;
  notes: string;
  updatedAt: string;
}

export type CompanyInput = Omit<Company, "id" | "updatedAt">;

export const companyFilters = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "applied", label: "Applied" },
  { id: "interviewing", label: "Interviewing" },
  { id: "waiting", label: "Waiting" },
  { id: "rejected", label: "Rejected" },
  { id: "offer", label: "Offer" },
  { id: "followUp", label: "Follow-up required" },
] as const;
export type CompanyFilter = (typeof companyFilters)[number]["id"];

export function needsFollowUp(company: Company, today: string): boolean {
  return (
    !!company.nextFollowUp &&
    company.nextFollowUp <= today &&
    !["Rejected", "Offer"].includes(company.applicationStatus)
  );
}

export function companyMatchesFilter(
  company: Company,
  filter: CompanyFilter,
  today: string,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "active":
      return (
        company.applicationStatus !== "Rejected" && !closedStages.includes(company.currentStage)
      );
    case "applied":
      return company.applicationStatus === "Applied";
    case "interviewing":
      return company.applicationStatus === "Interviewing";
    case "waiting":
      return company.applicationStatus === "Waiting";
    case "rejected":
      return company.applicationStatus === "Rejected";
    case "offer":
      return company.applicationStatus === "Offer";
    case "followUp":
      return needsFollowUp(company, today);
  }
}

// ---------- Settings ----------

export interface DiagnosticSettings {
  minSample: number;
  lateStageMinSample: number;
  baselineDropPct: number;
  lowResponseRatePct: number;
  lowReferralRatePct: number;
  lowResponseToInterviewPct: number;
  lowScreenToInterviewPct: number;
  lowInterviewToFinalPct: number;
  lowFinalToOfferPct: number;
  lowQualifiedPer100: number;
}

export const defaultDiagnosticSettings: DiagnosticSettings = {
  minSample: 5,
  lateStageMinSample: 2,
  baselineDropPct: 30,
  lowResponseRatePct: 10,
  lowReferralRatePct: 25,
  lowResponseToInterviewPct: 20,
  lowScreenToInterviewPct: 40,
  lowInterviewToFinalPct: 30,
  lowFinalToOfferPct: 30,
  lowQualifiedPer100: 3,
};

export const diagnosticSettingFields: {
  key: keyof DiagnosticSettings;
  label: string;
  hint: string;
  suffix: string;
}[] = [
  {
    key: "minSample",
    label: "Minimum sample size",
    hint: "Smallest denominator before a top-of-funnel rate is judged",
    suffix: "",
  },
  {
    key: "lateStageMinSample",
    label: "Late-stage minimum sample",
    hint: "Smallest number of interviews/finals before those rates are judged",
    suffix: "",
  },
  {
    key: "baselineDropPct",
    label: "Drop vs your baseline",
    hint: "Flag when a value falls this far below your previous weeks",
    suffix: "%",
  },
  {
    key: "lowResponseRatePct",
    label: "Low application response rate",
    hint: "Responses ÷ applications below this is flagged",
    suffix: "%",
  },
  {
    key: "lowReferralRatePct",
    label: "Low referral conversion",
    hint: "Referrals received ÷ requests below this is flagged",
    suffix: "%",
  },
  {
    key: "lowResponseToInterviewPct",
    label: "Low response → interview",
    hint: "Interviews ÷ responses below this is flagged",
    suffix: "%",
  },
  {
    key: "lowScreenToInterviewPct",
    label: "Low screen → interview",
    hint: "Interviews ÷ screening calls below this is flagged",
    suffix: "%",
  },
  {
    key: "lowInterviewToFinalPct",
    label: "Low interview → final",
    hint: "Final rounds ÷ interviews below this is flagged",
    suffix: "%",
  },
  {
    key: "lowFinalToOfferPct",
    label: "Low final → offer",
    hint: "Offers ÷ final rounds below this is flagged",
    suffix: "%",
  },
  {
    key: "lowQualifiedPer100",
    label: "Low qualified opportunities per 100 actions",
    hint: "Qualified opportunities ÷ effort actions × 100 below this is flagged",
    suffix: "",
  },
];

export type Dataset = "demo" | "real";

export interface AppSettings {
  dataset: Dataset;
  diagnostics: DiagnosticSettings;
}

// ---------- Formatting ----------

export const NOT_ENOUGH_DATA = "Not enough data yet.";

export function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function formatPct(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

export function formatChange(current: number, previous: number): string {
  const change = pctChange(current, previous);
  if (change === null) return current > 0 ? "new" : "—";
  const value = Math.round(change * 1000) / 10;
  return `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

export function formatDelta(current: number, previous: number): string {
  const delta = current - previous;
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;
}

export function formatPointChange(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return "—";
  const points = Math.round((current - previous) * 1000) / 10;
  return `${points > 0 ? "+" : ""}${points} pts`;
}

// ---------- Dates (ISO yyyy-mm-dd, calendar math in UTC) ----------

const DAY_MS = 86_400_000;

function parseISO(iso: string): number {
  const [year = 1970, month = 1, day = 1] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatISO(parseISO(value)) === value;
}

export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  return formatISO(parseISO(iso) + days * DAY_MS);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((parseISO(end) - parseISO(start)) / DAY_MS) + 1;
}

export function startOfWeek(iso: string): string {
  const ms = parseISO(iso);
  const mondayOffset = (new Date(ms).getUTCDay() + 6) % 7;
  return formatISO(ms - mondayOffset * DAY_MS);
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function addMonths(monthStart: string, months: number): string {
  const [year = 1970, month = 1] = monthStart.split("-").map(Number);
  return formatISO(Date.UTC(year, month - 1 + months, 1));
}

export function formatShortDate(iso: string): string {
  return new Date(parseISO(iso)).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

export function formatLongDate(iso: string): string {
  return new Date(parseISO(iso)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMonth(iso: string): string {
  return new Date(parseISO(iso)).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function formatRange(start: string, end: string): string {
  return start === end
    ? formatLongDate(start)
    : `${formatShortDate(start)} — ${formatShortDate(end)}`;
}

export function formatWeekRange(weekStart: string): string {
  return formatRange(weekStart, addDays(weekStart, 6));
}

// ---------- Periods ----------

export type PeriodPreset = "today" | "thisWeek" | "lastWeek" | "thisMonth" | "custom";

export const periodPresets: { id: PeriodPreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "thisWeek", label: "This week" },
  { id: "lastWeek", label: "Last week" },
  { id: "thisMonth", label: "This month" },
  { id: "custom", label: "Custom range" },
];

export interface DateRange {
  start: string;
  end: string;
}

export function resolvePeriod(preset: PeriodPreset, today: string, custom?: DateRange): DateRange {
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "thisWeek": {
      const start = startOfWeek(today);
      return { start, end: addDays(start, 6) };
    }
    case "lastWeek": {
      const start = addDays(startOfWeek(today), -7);
      return { start, end: addDays(start, 6) };
    }
    case "thisMonth": {
      const start = startOfMonth(today);
      return { start, end: addDays(addMonths(start, 1), -1) };
    }
    case "custom":
      return custom && custom.start <= custom.end ? custom : { start: today, end: today };
  }
}

/** The equal-length window immediately before `range`. */
export function previousRange(range: DateRange): DateRange {
  const length = daysBetween(range.start, range.end);
  const end = addDays(range.start, -1);
  return { start: addDays(end, -(length - 1)), end };
}

// ---------- Aggregation ----------

export function sumEntries(entries: DailyEntry[], from: string, to: string): MetricValues {
  const totals = emptyMetrics();
  for (const entry of entries) {
    if (entry.date < from || entry.date > to) continue;
    for (const key of metricKeys) totals[key] += entry.metrics[key];
  }
  return totals;
}

export function countLoggedDays(entries: DailyEntry[], from: string, to: string): number {
  return entries.filter((entry) => entry.date >= from && entry.date <= to).length;
}

export interface SeriesPoint extends DerivedValues {
  label: string;
  start: string;
  end: string;
  daysLogged: number;
}

function point(entries: DailyEntry[], start: string, end: string, label: string): SeriesPoint {
  return {
    ...derive(sumEntries(entries, start, end)),
    label,
    start,
    end,
    daysLogged: countLoggedDays(entries, start, end),
  };
}

/** One point per day across the range; ranges shorter than `minDays` are extended backwards. */
export function buildDailySeries(
  entries: DailyEntry[],
  range: DateRange,
  minDays = 7,
): SeriesPoint[] {
  const length = Math.max(daysBetween(range.start, range.end), minDays);
  const start = addDays(range.end, -(length - 1));
  return Array.from({ length }, (_, index) => {
    const day = addDays(start, index);
    return point(entries, day, day, formatShortDate(day));
  });
}

export type Granularity = "daily" | "weekly" | "monthly";

export const granularityConfig: Record<
  Granularity,
  { label: string; buckets: number; rangeLabel: string }
> = {
  daily: { label: "Daily", buckets: 30, rangeLabel: "Last 30 days" },
  weekly: { label: "Weekly", buckets: 12, rangeLabel: "Last 12 weeks" },
  monthly: { label: "Monthly", buckets: 6, rangeLabel: "Last 6 months" },
};

export function buildSeries(
  entries: DailyEntry[],
  granularity: Granularity,
  today: string,
): SeriesPoint[] {
  const { buckets } = granularityConfig[granularity];
  const points: SeriesPoint[] = [];
  for (let offset = buckets - 1; offset >= 0; offset -= 1) {
    if (granularity === "daily") {
      const day = addDays(today, -offset);
      points.push(point(entries, day, day, formatShortDate(day)));
    } else if (granularity === "weekly") {
      const start = addDays(startOfWeek(today), -7 * offset);
      points.push(point(entries, start, addDays(start, 6), formatShortDate(start)));
    } else {
      const start = addMonths(startOfMonth(today), -offset);
      points.push(point(entries, start, addDays(addMonths(start, 1), -1), formatMonth(start)));
    }
  }
  return points;
}

export function totalOfSeries(series: SeriesPoint[]): MetricValues {
  const totals = emptyMetrics();
  for (const item of series) for (const key of metricKeys) totals[key] += item[key];
  return totals;
}

// ---------- Opportunity / channel analytics ----------

const RESPONSE_STAGE = stageIndex("Referral Received");
const INTERVIEW_STAGE = stageIndex("Technical Interview");
const OFFER_STAGE = stageIndex("Offer");

export function reachedStage(opportunity: Opportunity, stage: number): boolean {
  return stageIndex(opportunity.furthestStage) >= stage;
}

export function opportunitiesInRange(
  opportunities: Opportunity[],
  range: DateRange,
): Opportunity[] {
  return opportunities.filter((item) => item.date >= range.start && item.date <= range.end);
}

export const channelDefs = [
  {
    id: "direct",
    label: "Direct applications",
    sources: ["Direct Application"],
    activity: "applications",
    dailyResponses: null,
    inbound: false,
  },
  {
    id: "referral",
    label: "Referrals",
    sources: ["Referral"],
    activity: "referralRequests",
    dailyResponses: "referralsReceived",
    inbound: false,
  },
  {
    id: "recruiter",
    label: "Recruiter outreach",
    sources: ["Recruiter"],
    activity: "recruiterMessagesSent",
    dailyResponses: "recruiterReplies",
    inbound: false,
  },
  {
    id: "hiringManager",
    label: "Hiring manager outreach",
    sources: ["Hiring Manager"],
    activity: "hiringManagerMessagesSent",
    dailyResponses: null,
    inbound: false,
  },
  {
    id: "networking",
    label: "Networking",
    sources: ["Employee Networking"],
    activity: "employeeNetworkingMessagesSent",
    dailyResponses: "networkingReplies",
    inbound: false,
  },
  {
    id: "inbound",
    label: "Inbound (LinkedIn / Naukri)",
    sources: ["LinkedIn Inbound", "Naukri Inbound"],
    activity: "recruiterInbound",
    dailyResponses: null,
    inbound: true,
  },
] as const satisfies readonly {
  id: string;
  label: string;
  sources: readonly OpportunitySource[];
  activity: DerivedKey;
  dailyResponses: MetricKey | null;
  inbound: boolean;
}[];

export type ChannelId = (typeof channelDefs)[number]["id"];

export interface ChannelPerformance {
  id: ChannelId;
  label: string;
  inbound: boolean;
  activity: number;
  activityLabel: string;
  dailyResponses: number | null;
  dailyResponsesLabel: string | null;
  tracked: number;
  responded: number;
  interviews: number;
  offers: number;
  responseRate: number | null;
  interviewRate: number | null;
  /** Interviews from this channel per 10 outreach actions — quality over volume. */
  interviewsPer10: number | null;
}

export function channelPerformance(
  entries: DailyEntry[],
  opportunities: Opportunity[],
  range: DateRange,
): ChannelPerformance[] {
  const totals = derive(sumEntries(entries, range.start, range.end));
  const inRange = opportunitiesInRange(opportunities, range);
  return channelDefs.map((def) => {
    const items = inRange.filter(
      (item) => item.source !== null && (def.sources as readonly string[]).includes(item.source),
    );
    const responded = items.filter((item) => reachedStage(item, RESPONSE_STAGE)).length;
    const interviews = items.filter((item) => reachedStage(item, INTERVIEW_STAGE)).length;
    return {
      id: def.id,
      label: def.label,
      inbound: def.inbound,
      activity: totals[def.activity],
      activityLabel: derivedLabels[def.activity].toLowerCase(),
      dailyResponses: def.dailyResponses ? totals[def.dailyResponses] : null,
      dailyResponsesLabel: def.dailyResponses
        ? metricLabels[def.dailyResponses].toLowerCase()
        : null,
      tracked: items.length,
      responded,
      interviews,
      offers: items.filter((item) => reachedStage(item, OFFER_STAGE)).length,
      responseRate: rate(responded, items.length),
      interviewRate: rate(interviews, items.length),
      interviewsPer10: totals[def.activity] > 0 ? (interviews / totals[def.activity]) * 10 : null,
    };
  });
}

// ---------- Conversion metrics ----------

export interface ConversionResult {
  id: string;
  group:
    | "Application"
    | "Referral"
    | "Recruiter"
    | "Networking"
    | "Interview"
    | "Efficiency"
    | "Quality";
  label: string;
  phrase: string;
  formula: string;
  kind: "percent" | "ratio";
  source: "daily" | "daily + opportunities";
  numerator: number;
  denominator: number;
  numeratorLabel: string;
  denominatorLabel: string;
  value: number | null;
}

type ConversionDef = Omit<ConversionResult, "numerator" | "denominator" | "value"> & {
  numeratorOf: (m: DerivedValues, referralInterviews: number) => number;
  denominatorOf: (m: DerivedValues) => number;
};

export const conversionDefs: ConversionDef[] = [
  {
    id: "appResponse",
    group: "Application",
    label: "Application response rate",
    phrase: "application response rate",
    formula: "responses ÷ applications × 100",
    kind: "percent",
    source: "daily",
    numeratorLabel: "responses",
    denominatorLabel: "applications",
    numeratorOf: (m) => m.responses,
    denominatorOf: (m) => m.applications,
  },
  {
    id: "appsPerResponse",
    group: "Application",
    label: "Applications per response",
    phrase: "applications per response",
    formula: "applications ÷ responses",
    kind: "ratio",
    source: "daily",
    numeratorLabel: "applications",
    denominatorLabel: "responses",
    numeratorOf: (m) => m.applications,
    denominatorOf: (m) => m.responses,
  },
  {
    id: "referral",
    group: "Referral",
    label: "Referral conversion",
    phrase: "referral conversion",
    formula: "referrals received ÷ referral requests × 100",
    kind: "percent",
    source: "daily",
    numeratorLabel: "referrals",
    denominatorLabel: "requests",
    numeratorOf: (m) => m.referralsReceived,
    denominatorOf: (m) => m.referralRequests,
  },
  {
    id: "referralInterview",
    group: "Referral",
    label: "Referral interview conversion",
    phrase: "referral interview conversion",
    formula: "interviews from referral opportunities ÷ referrals received × 100",
    kind: "percent",
    source: "daily + opportunities",
    numeratorLabel: "referral interviews",
    denominatorLabel: "referrals",
    numeratorOf: (_m, referralInterviews) => referralInterviews,
    denominatorOf: (m) => m.referralsReceived,
  },
  {
    id: "recruiterResponse",
    group: "Recruiter",
    label: "Recruiter response rate",
    phrase: "recruiter response rate",
    formula: "recruiter replies ÷ recruiter messages × 100",
    kind: "percent",
    source: "daily",
    numeratorLabel: "replies",
    denominatorLabel: "recruiter messages",
    numeratorOf: (m) => m.recruiterReplies,
    denominatorOf: (m) => m.recruiterMessagesSent,
  },
  {
    id: "recruiterCall",
    group: "Recruiter",
    label: "Recruiter call rate",
    phrase: "recruiter call rate",
    formula: "recruiter calls ÷ recruiter messages × 100",
    kind: "percent",
    source: "daily",
    numeratorLabel: "calls",
    denominatorLabel: "recruiter messages",
    numeratorOf: (m) => m.recruiterCalls,
    denominatorOf: (m) => m.recruiterMessagesSent,
  },
  {
    id: "networkingResponse",
    group: "Networking",
    label: "Networking response rate",
    phrase: "networking response rate",
    formula: "networking replies ÷ networking messages × 100",
    kind: "percent",
    source: "daily",
    numeratorLabel: "replies",
    denominatorLabel: "networking messages",
    numeratorOf: (m) => m.networkingReplies,
    denominatorOf: (m) => m.networkingOutreach,
  },
  {
    id: "screenInterview",
    group: "Interview",
    label: "Screen → interview",
    phrase: "screen-to-interview rate",
    formula: "interviews ÷ screening calls × 100",
    kind: "percent",
    source: "daily",
    numeratorLabel: "interviews",
    denominatorLabel: "screens",
    numeratorOf: (m) => m.interviews,
    denominatorOf: (m) => m.screeningCalls,
  },
  {
    id: "interviewFinal",
    group: "Interview",
    label: "Interview → final",
    phrase: "interview-to-final rate",
    formula: "final rounds ÷ interviews × 100",
    kind: "percent",
    source: "daily",
    numeratorLabel: "finals",
    denominatorLabel: "interviews",
    numeratorOf: (m) => m.finalRounds,
    denominatorOf: (m) => m.interviews,
  },
  {
    id: "finalOffer",
    group: "Interview",
    label: "Final → offer",
    phrase: "final-to-offer rate",
    formula: "offers ÷ final rounds × 100",
    kind: "percent",
    source: "daily",
    numeratorLabel: "offers",
    denominatorLabel: "finals",
    numeratorOf: (m) => m.offers,
    denominatorOf: (m) => m.finalRounds,
  },
  {
    id: "qualifiedInterview",
    group: "Quality",
    label: "Qualified → interview",
    phrase: "qualified-to-interview rate",
    formula: "interviews ÷ qualified opportunities (all) × 100",
    kind: "percent",
    source: "daily",
    numeratorLabel: "interviews",
    denominatorLabel: "qualified",
    numeratorOf: (m) => m.interviews,
    denominatorOf: (m) => m.qualifiedTotal,
  },
  {
    id: "actionsPerQualified",
    group: "Efficiency",
    label: "Actions per qualified opportunity",
    phrase: "actions per qualified opportunity",
    formula: "total effort actions ÷ qualified opportunities created",
    kind: "ratio",
    source: "daily",
    numeratorLabel: "actions",
    denominatorLabel: "qualified",
    numeratorOf: (m) => m.effortTotal,
    denominatorOf: (m) => m.qualifiedOpportunities,
  },
  {
    id: "requestsPerReferral",
    group: "Efficiency",
    label: "Requests per referral",
    phrase: "referral requests per referral",
    formula: "referral requests ÷ referrals received",
    kind: "ratio",
    source: "daily",
    numeratorLabel: "requests",
    denominatorLabel: "referrals",
    numeratorOf: (m) => m.referralRequests,
    denominatorOf: (m) => m.referralsReceived,
  },
  {
    id: "messagesPerRecruiterReply",
    group: "Efficiency",
    label: "Recruiter messages per reply",
    phrase: "recruiter messages per reply",
    formula: "recruiter messages ÷ recruiter replies",
    kind: "ratio",
    source: "daily",
    numeratorLabel: "messages",
    denominatorLabel: "replies",
    numeratorOf: (m) => m.recruiterMessagesSent,
    denominatorOf: (m) => m.recruiterReplies,
  },
  {
    id: "messagesPerNetworkingReply",
    group: "Efficiency",
    label: "Networking messages per reply",
    phrase: "networking messages per reply",
    formula: "networking messages ÷ networking replies",
    kind: "ratio",
    source: "daily",
    numeratorLabel: "messages",
    denominatorLabel: "replies",
    numeratorOf: (m) => m.networkingOutreach,
    denominatorOf: (m) => m.networkingReplies,
  },
];

export function referralInterviewsIn(opportunities: Opportunity[], range: DateRange): number {
  return opportunitiesInRange(opportunities, range).filter(
    (item) => item.source === "Referral" && reachedStage(item, INTERVIEW_STAGE),
  ).length;
}

export function computeConversions(
  metrics: MetricValues,
  referralInterviews = 0,
): ConversionResult[] {
  const derived = derive(metrics);
  return conversionDefs.map(({ numeratorOf, denominatorOf, ...def }) => {
    const numerator = numeratorOf(derived, referralInterviews);
    const denominator = denominatorOf(derived);
    return { ...def, numerator, denominator, value: rate(numerator, denominator) };
  });
}

export function conversionsFor(
  entries: DailyEntry[],
  opportunities: Opportunity[],
  range: DateRange,
): ConversionResult[] {
  return computeConversions(
    sumEntries(entries, range.start, range.end),
    referralInterviewsIn(opportunities, range),
  );
}

export function formatConversion(
  result: Pick<ConversionResult, "kind" | "value">,
  digits = 0,
): string {
  return result.kind === "ratio" ? formatRatio(result.value) : formatPct(result.value, digits);
}

export const funnelSteps: { key: DerivedKey; label: string }[] = [
  { key: "applications", label: "Applications" },
  { key: "responses", label: "Responses" },
  { key: "screeningCalls", label: "Screening calls" },
  { key: "interviews", label: "Interviews" },
  { key: "finalRounds", label: "Final rounds" },
  { key: "offers", label: "Offers" },
];

// ---------- Scorecard & week-over-week ----------

export type Polarity = "neutral" | "higher-better";

export interface ScoreRowDef {
  key: DerivedKey;
  label: string;
  polarity: Polarity;
}

export const scorecardGroups: { id: string; title: string; rows: ScoreRowDef[] }[] = [
  {
    id: "effort",
    title: "Effort",
    rows: [
      { key: "applications", label: "Applications", polarity: "neutral" },
      { key: "referralRequests", label: "Referral requests", polarity: "neutral" },
      { key: "referralsReceived", label: "Referrals received", polarity: "higher-better" },
      { key: "recruiterMessagesSent", label: "Recruiter outreach", polarity: "neutral" },
      { key: "networkingOutreach", label: "Networking outreach", polarity: "neutral" },
      { key: "followupsSent", label: "Follow-ups", polarity: "neutral" },
    ],
  },
  {
    id: "pipeline",
    title: "Pipeline",
    rows: [
      { key: "qualifiedTotal", label: "Qualified opportunities", polarity: "higher-better" },
      { key: "responses", label: "Responses", polarity: "higher-better" },
      { key: "recruiterCalls", label: "Recruiter calls", polarity: "higher-better" },
      { key: "screeningCalls", label: "Screens", polarity: "higher-better" },
      { key: "interviews", label: "Interviews", polarity: "higher-better" },
      { key: "finalRounds", label: "Finals", polarity: "higher-better" },
      { key: "offers", label: "Offers", polarity: "higher-better" },
    ],
  },
  {
    id: "visibility",
    title: "Visibility",
    rows: [
      { key: "naukriProfileViews", label: "Naukri views", polarity: "higher-better" },
      { key: "linkedinProfileViews", label: "LinkedIn views", polarity: "higher-better" },
      { key: "recruiterInbound", label: "Recruiter inbound", polarity: "higher-better" },
      { key: "relevantInboundOpportunities", label: "Relevant inbound", polarity: "higher-better" },
    ],
  },
];

export interface ScoreRow extends ScoreRowDef {
  current: number;
  previous: number;
  trend: number[];
}

export function scoreRows(
  entries: DailyEntry[],
  weekStart: string,
  weeks = 6,
): { id: string; title: string; rows: ScoreRow[] }[] {
  const weekly = Array.from({ length: weeks }, (_, index) => {
    const start = addDays(weekStart, -7 * (weeks - 1 - index));
    return derive(sumEntries(entries, start, addDays(start, 6)));
  });
  const current = weekly[weeks - 1] ?? derive(emptyMetrics());
  const previous = weekly[weeks - 2] ?? derive(emptyMetrics());
  return scorecardGroups.map((group) => ({
    ...group,
    rows: group.rows.map((row) => ({
      ...row,
      current: current[row.key],
      previous: previous[row.key],
      trend: weekly.map((week) => week[row.key]),
    })),
  }));
}

// ---------- Diagnostics ("Where am I weak?") ----------

export type ObservationArea =
  | "effort"
  | "visibility"
  | "response"
  | "referral"
  | "recruiter"
  | "screening"
  | "interview"
  | "final"
  | "efficiency"
  | "quality"
  | "followup";

export interface Observation {
  id: string;
  area: ObservationArea;
  severity: "bottleneck" | "watch";
  title: string;
  evidence: string;
  interpretation: string;
  investigate: string;
  basis: "threshold" | "baseline" | "week-over-week";
  bottleneckPhrase?: string;
  gap: number;
}

export interface WeekContext {
  weekStart: string;
  weekEnd: string;
  current: DerivedValues;
  previous: DerivedValues;
  daysLogged: number;
  previousDaysLogged: number;
  baseline: DerivedValues | null;
  baselineWeeks: number;
}

function baselineFor(
  entries: DailyEntry[],
  weekStart: string,
  weeks = 4,
): { baseline: DerivedValues | null; baselineWeeks: number } {
  const totals = emptyMetrics();
  let baselineWeeks = 0;
  for (let index = 1; index <= weeks; index += 1) {
    const start = addDays(weekStart, -7 * index);
    const end = addDays(start, 6);
    if (countLoggedDays(entries, start, end) === 0) continue;
    baselineWeeks += 1;
    const week = sumEntries(entries, start, end);
    for (const key of metricKeys) totals[key] += week[key];
  }
  if (!baselineWeeks) return { baseline: null, baselineWeeks };
  const average = Object.fromEntries(
    metricKeys.map((key) => [key, totals[key] / baselineWeeks]),
  ) as MetricValues;
  return { baseline: derive(average), baselineWeeks };
}

export function weekContext(entries: DailyEntry[], weekStart: string): WeekContext {
  const weekEnd = addDays(weekStart, 6);
  const previousStart = addDays(weekStart, -7);
  return {
    weekStart,
    weekEnd,
    current: derive(sumEntries(entries, weekStart, weekEnd)),
    previous: derive(sumEntries(entries, previousStart, addDays(previousStart, 6))),
    daysLogged: countLoggedDays(entries, weekStart, weekEnd),
    previousDaysLogged: countLoggedDays(entries, previousStart, addDays(previousStart, 6)),
    ...baselineFor(entries, weekStart),
  };
}

const pct = (value: number | null) => formatPct(value);

export function diagnose(
  context: WeekContext,
  settings: DiagnosticSettings = defaultDiagnosticSettings,
): Observation[] {
  const { current, previous, baseline, baselineWeeks, previousDaysLogged } = context;
  const observations: Observation[] = [];
  const drop = settings.baselineDropPct / 100;
  const vsBaseline = baselineWeeks ? `your ${baselineWeeks}-week average` : "";

  const rateCheck = (options: {
    id: string;
    area: ObservationArea;
    numerator: number;
    denominator: number;
    baselineNumerator?: number | undefined;
    baselineDenominator?: number | undefined;
    thresholdPct: number;
    minSample: number;
    title: string;
    interpretation: string;
    investigate: string;
    bottleneckPhrase: string;
    numeratorLabel: string;
    denominatorLabel: string;
  }) => {
    if (options.denominator < options.minSample) return;
    const value = options.numerator / options.denominator;
    const threshold = options.thresholdPct / 100;
    const baseRate =
      baseline && options.baselineDenominator && options.baselineDenominator > 0
        ? (options.baselineNumerator ?? 0) / options.baselineDenominator
        : null;
    const belowThreshold = value < threshold;
    const belowBaseline = baseRate !== null && baseRate > 0 && value < baseRate * (1 - drop);
    if (!belowThreshold && !belowBaseline) return;
    const evidence = `${options.numerator} ${options.numeratorLabel} from ${options.denominator} ${options.denominatorLabel} (${pct(value)})${
      belowBaseline ? `, compared with ${pct(baseRate)} over ${vsBaseline}` : ""
    }${belowThreshold ? ` — below your ${options.thresholdPct}% threshold` : ""}.`;
    observations.push({
      id: options.id,
      area: options.area,
      severity: "bottleneck",
      title: options.title,
      evidence,
      interpretation: options.interpretation,
      investigate: options.investigate,
      basis: belowBaseline ? "baseline" : "threshold",
      bottleneckPhrase: options.bottleneckPhrase,
      gap: Math.max(
        belowThreshold ? 1 - value / threshold : 0,
        belowBaseline && baseRate ? 1 - value / baseRate : 0,
      ),
    });
  };

  if (
    baseline &&
    baseline.effortTotal > 0 &&
    current.effortTotal < baseline.effortTotal * (1 - drop)
  ) {
    observations.push({
      id: "effort-low",
      area: "effort",
      severity: "watch",
      title: "Effort is below your recent average",
      evidence: `${current.effortTotal} effort actions this week, compared with ${Math.round(baseline.effortTotal)} on average over ${vsBaseline}.`,
      interpretation:
        "This may indicate that lower volume, rather than conversion, is limiting output this week.",
      investigate:
        "Worth checking whether the drop is deliberate (fewer, better-targeted applications) or due to time constraints.",
      basis: "baseline",
      bottleneckPhrase: "overall effort volume",
      gap: 1 - current.effortTotal / baseline.effortTotal,
    });
  }

  const visibilityNow = current.profileViews + current.recruiterInbound;
  const visibilityBase = baseline ? baseline.profileViews + baseline.recruiterInbound : 0;
  if (baseline && visibilityBase > 0 && visibilityNow < visibilityBase * (1 - drop)) {
    observations.push({
      id: "visibility-low",
      area: "visibility",
      severity: "watch",
      title: "Profile visibility dropped compared with previous weeks",
      evidence: `${current.profileViews} profile views and ${current.recruiterInbound} inbound recruiter contacts, compared with ${Math.round(baseline.profileViews)} and ${Math.round(baseline.recruiterInbound)} on average.`,
      interpretation: "This may indicate that recruiters are discovering your profile less often.",
      investigate:
        "Worth testing a refresh of your Naukri/LinkedIn headline, skills keywords (e.g. Java, Spring Boot, AWS) and recent activity.",
      basis: "baseline",
      bottleneckPhrase: "profile visibility",
      gap: 1 - visibilityNow / visibilityBase,
    });
  }

  // Skipped entirely when qualified opportunities aren't being tracked yet.
  if (current.qualifiedTotal + (baseline?.qualifiedTotal ?? 0) > 0)
    rateCheck({
      id: "volume-not-qualifying",
      area: "quality",
      numerator: current.qualifiedTotal,
      denominator: current.effortTotal,
      baselineNumerator: baseline?.qualifiedTotal,
      baselineDenominator: baseline?.effortTotal,
      thresholdPct: settings.lowQualifiedPer100,
      minSample: settings.minSample * 4,
      title: "Lots of activity, few qualified opportunities",
      interpretation:
        "This may indicate that volume (cold applications and messages) is standing in for targeted, warm outreach.",
      investigate:
        "Worth checking which channel your qualified opportunities came from — one referral that leads to an interview is worth more than thirty cold messages.",
      bottleneckPhrase: "turning activity into qualified opportunities",
      numeratorLabel: "qualified opportunities",
      denominatorLabel: "effort actions",
    });

  const highVolume = baseline
    ? current.applications >= baseline.applications
    : current.applications >= settings.minSample * 2;
  rateCheck({
    id: "app-response-low",
    area: "response",
    numerator: current.responses,
    denominator: current.applications,
    baselineNumerator: baseline?.responses,
    baselineDenominator: baseline?.applications,
    thresholdPct: settings.lowResponseRatePct,
    minSample: settings.minSample,
    title: highVolume
      ? "Application volume is high, but response generation is low"
      : "Application response generation is low",
    interpretation:
      "This may indicate a mismatch between your resume and the roles you are applying to.",
    investigate: "Review resume targeting, keywords, role selection, and application quality.",
    bottleneckPhrase: "turning applications into responses",
    numeratorLabel: "responses",
    denominatorLabel: "applications",
  });

  rateCheck({
    id: "referral-low",
    area: "referral",
    numerator: current.referralsReceived,
    denominator: current.referralRequests,
    baselineNumerator: baseline?.referralsReceived,
    baselineDenominator: baseline?.referralRequests,
    thresholdPct: settings.lowReferralRatePct,
    minSample: settings.minSample,
    title: "Referral-request conversion is low",
    interpretation:
      "This may indicate that requests are going to weak ties or are not specific enough.",
    investigate:
      "Review who you're approaching and personalize referral requests (role link, why you fit, short resume summary).",
    bottleneckPhrase: "converting referral requests into referrals",
    numeratorLabel: "referrals",
    denominatorLabel: "requests",
  });

  rateCheck({
    id: "engaged-low-interview",
    area: "recruiter",
    numerator: current.interviews,
    denominator: current.responses,
    baselineNumerator: baseline?.interviews,
    baselineDenominator: baseline?.responses,
    thresholdPct: settings.lowResponseToInterviewPct,
    minSample: settings.minSample,
    title: "Recruiter engagement is happening, but interview conversion is lower",
    interpretation:
      "This may indicate a role-fit gap or that screening conversations are not progressing.",
    investigate:
      "Review role fit (level, stack, location, compensation expectations) and screening performance.",
    bottleneckPhrase: "turning recruiter engagement into interviews",
    numeratorLabel: "interviews",
    denominatorLabel: "responses",
  });

  rateCheck({
    id: "screen-low",
    area: "screening",
    numerator: current.interviews,
    denominator: current.screeningCalls,
    baselineNumerator: baseline?.interviews,
    baselineDenominator: baseline?.screeningCalls,
    thresholdPct: settings.lowScreenToInterviewPct,
    minSample: settings.lateStageMinSample,
    title: "Screening calls are not converting into interviews as often",
    interpretation:
      "This may indicate gaps in how experience is pitched during screens, or a mismatch on basics (notice period, CTC, location).",
    investigate: "Worth reviewing your screening pitch and the reasons screens did not progress.",
    bottleneckPhrase: "progression from screening calls to interviews",
    numeratorLabel: "interviews",
    denominatorLabel: "screening calls",
  });

  rateCheck({
    id: "interview-final-low",
    area: "interview",
    numerator: current.finalRounds,
    denominator: current.interviews,
    baselineNumerator: baseline?.finalRounds,
    baselineDenominator: baseline?.interviews,
    thresholdPct: settings.lowInterviewToFinalPct,
    minSample: settings.lateStageMinSample,
    title: "Interview volume is healthy, but progression to final rounds is low",
    interpretation: "This may indicate gaps in technical interview performance.",
    investigate:
      "Focus on interview preparation — e.g. DSA practice, system design, and project deep-dives.",
    bottleneckPhrase: "progression from interviews to final rounds",
    numeratorLabel: "final rounds",
    denominatorLabel: "interviews",
  });

  rateCheck({
    id: "final-offer-low",
    area: "final",
    numerator: current.offers,
    denominator: current.finalRounds,
    baselineNumerator: baseline?.offers,
    baselineDenominator: baseline?.finalRounds,
    thresholdPct: settings.lowFinalToOfferPct,
    minSample: settings.lateStageMinSample,
    title: "Final-round conversion is currently low",
    interpretation:
      "This may indicate recurring gaps late in the process (bar-raiser, culture fit, or negotiation).",
    investigate: "Review interview feedback and identify recurring gaps.",
    bottleneckPhrase: "converting final rounds into offers",
    numeratorLabel: "offers",
    denominatorLabel: "final rounds",
  });

  if (previousDaysLogged > 0) {
    const appChange = pctChange(current.applications, previous.applications);
    const nowRate = rate(current.responses, current.applications);
    const prevRate = rate(previous.responses, previous.applications);
    if (
      appChange !== null &&
      appChange >= 0.1 &&
      nowRate !== null &&
      prevRate !== null &&
      nowRate < prevRate - 0.03
    ) {
      observations.push({
        id: "efficiency-down",
        area: "efficiency",
        severity: "watch",
        title: "More applications, lower efficiency",
        evidence: `Applications rose ${formatChange(current.applications, previous.applications)} (${previous.applications} → ${current.applications}) while the response rate fell from ${pct(prevRate)} to ${pct(nowRate)}.`,
        interpretation:
          "Compared with last week, this may indicate that extra volume is coming at the cost of targeting.",
        investigate:
          "Worth comparing the roles applied to this week against those that produced responses last week.",
        basis: "week-over-week",
        gap: prevRate - nowRate,
      });
    }
  }

  if (
    current.outreach >= settings.minSample * 2 &&
    current.followupsSent < current.outreach * 0.2
  ) {
    observations.push({
      id: "followup-gap",
      area: "followup",
      severity: "watch",
      title: "Few follow-ups relative to outreach",
      evidence: `${current.followupsSent} follow-ups against ${current.outreach} outreach messages.`,
      interpretation: "This may indicate that unanswered messages are not being revisited.",
      investigate: "Worth checking which outreach from 4–7 days ago is still unanswered.",
      basis: "threshold",
      gap: 1 - current.followupsSent / (current.outreach * 0.2),
    });
  }

  return observations.sort((a, b) =>
    a.severity === b.severity ? b.gap - a.gap : a.severity === "bottleneck" ? -1 : 1,
  );
}

// ---------- Weekly insights ----------

export interface WeeklyInsights {
  context: WeekContext;
  summary: string[];
  /** Week-over-week changes that moved in a good direction. */
  improved: string[];
  /** Week-over-week changes that moved in a bad direction. */
  weak: string[];
  strongestChannel: { label: string; value: number } | null;
  observations: Observation[];
  primaryBottleneck: Observation | null;
  focus: string[];
  visibilityAverages: { naukri: number | null; linkedin: number | null };
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function weeklyInsights(
  entries: DailyEntry[],
  weekStart: string,
  today: string,
  settings: DiagnosticSettings = defaultDiagnosticSettings,
): WeeklyInsights {
  const context = weekContext(entries, weekStart);
  const { current, previous, daysLogged, previousDaysLogged, baseline } = context;
  const observations = diagnose(context, settings);
  const primaryBottleneck =
    observations.find((item) => item.severity === "bottleneck") ?? observations[0] ?? null;
  const visibilityAverages = {
    naukri: daysLogged ? current.naukriProfileViews / daysLogged : null,
    linkedin: daysLogged ? current.linkedinProfileViews / daysLogged : null,
  };
  const insights: WeeklyInsights = {
    context,
    summary: [],
    improved: [],
    weak: [],
    strongestChannel: null,
    observations,
    primaryBottleneck,
    focus: [],
    visibilityAverages,
  };

  if (daysLogged === 0) {
    insights.summary.push(`No activity has been logged for ${formatWeekRange(weekStart)}.`);
    return insights;
  }

  const thisWeek = startOfWeek(today);
  const when =
    weekStart === thisWeek
      ? "This week"
      : weekStart === addDays(thisWeek, -7)
        ? "Last week"
        : `In the week of ${formatShortDate(weekStart)}`;
  insights.summary.push(
    `${when} you submitted ${plural(current.applications, "application")} and sent ${plural(current.outreach, "outreach message")}, plus ${plural(current.referralRequests, "referral request")} and ${plural(current.followupsSent, "follow-up")}.`,
  );
  const outputs = [
    plural(current.qualifiedTotal, "qualified opportunity", "qualified opportunities"),
    plural(current.responses, "response"),
    plural(current.screeningCalls, "screening call"),
    plural(current.interviews, "interview"),
  ];
  if (current.finalRounds) outputs.push(plural(current.finalRounds, "final round"));
  if (current.offers) outputs.push(plural(current.offers, "offer"));
  insights.summary.push(`This generated ${joinList(outputs)}.`);

  const efficiency = computeConversions(current)
    .filter((result) => result.group === "Efficiency" || result.id === "appsPerResponse")
    .filter((result) => result.value !== null)
    .map((result) => `${formatRatio(result.value)} ${result.phrase}`);
  if (efficiency.length) insights.summary.push(`Efficiency: ${joinList(efficiency)}.`);

  const channelRates = [
    {
      label: "direct applications",
      value: rate(current.responses, current.applications),
      denominator: current.applications,
    },
    {
      label: "referrals",
      value: rate(current.referralsReceived, current.referralRequests),
      denominator: current.referralRequests,
    },
    {
      label: "recruiter outreach",
      value: rate(current.recruiterReplies, current.recruiterMessagesSent),
      denominator: current.recruiterMessagesSent,
    },
    {
      label: "networking",
      value: rate(current.networkingReplies, current.networkingOutreach),
      denominator: current.networkingOutreach,
    },
  ].filter(
    (item): item is { label: string; value: number; denominator: number } =>
      item.value !== null && item.denominator >= 3,
  );
  const strongest = [...channelRates].sort((a, b) => b.value - a.value)[0];
  if (strongest && channelRates.length > 1) {
    insights.strongestChannel = { label: strongest.label, value: strongest.value };
    insights.summary.push(
      `Your strongest conversion came from ${strongest.label} (${pct(strongest.value)}).`,
    );
  }

  if (previousDaysLogged > 0) {
    const nowRates = computeConversions(current);
    const prevRates = computeConversions(previous);
    for (const result of nowRates) {
      if (result.kind !== "percent" || result.id === "referralInterview") continue;
      const before = prevRates.find((item) => item.id === result.id);
      if (!before || result.value === null || before.value === null) continue;
      if (result.denominator < 3 && before.denominator < 3) continue;
      if (Math.round(result.value * 100) === Math.round(before.value * 100)) continue;
      const phrase =
        result.id === "appResponse" ? "direct-application response rate" : result.phrase;
      const up = result.value > before.value;
      (up ? insights.improved : insights.weak).push(
        `Your ${phrase} ${up ? "increased" : "decreased"} compared with the previous week (${pct(before.value)} → ${pct(result.value)}).`,
      );
    }
    for (const [key, noun] of [
      ["qualifiedTotal", "qualified opportunities"],
      ["interviews", "interview volume"],
      ["finalRounds", "final-round volume"],
      ["offers", "offers"],
    ] as const) {
      if (current[key] === previous[key]) continue;
      const up = current[key] > previous[key];
      (up ? insights.improved : insights.weak).push(
        `Your ${noun} ${up ? "increased" : "decreased"} from ${previous[key]} to ${current[key]}.`,
      );
    }
  } else {
    insights.summary.push(
      "Nothing was logged the previous week, so week-over-week comparisons aren't available yet.",
    );
  }

  if (primaryBottleneck?.bottleneckPhrase)
    insights.summary.push(`Potential bottleneck: ${primaryBottleneck.bottleneckPhrase}.`);

  const focus = new Set<string>();
  for (const observation of observations) {
    switch (observation.area) {
      case "effort":
        if (baseline)
          focus.add(
            `Increase volume back toward your average (~${Math.round(baseline.applications)} applications and ~${Math.round(baseline.outreach)} outreach messages per week).`,
          );
        break;
      case "visibility":
        focus.add(
          "Refresh Naukri/LinkedIn profiles — visibility fell compared with previous weeks.",
        );
        break;
      case "response":
      case "efficiency":
        focus.add(
          `Improve application targeting — ${pct(rate(current.responses, current.applications))} of applications produced a response.`,
        );
        break;
      case "referral":
        focus.add("Personalize referral requests and approach closer contacts.");
        break;
      case "quality":
        focus.add(
          `Shift effort from volume to warm outreach and referrals — ${current.effortTotal} actions produced ${plural(current.qualifiedTotal, "qualified opportunity", "qualified opportunities")}.`,
        );
        break;
      case "recruiter":
      case "screening":
        focus.add("Review role fit and screening performance before adding more volume.");
        break;
      case "interview":
        focus.add("Focus on interview preparation (DSA, system design, project deep-dives).");
        break;
      case "final":
        focus.add("Review final-round feedback for recurring gaps.");
        break;
      case "followup":
        focus.add(
          `Increase recruiter follow-ups — ${current.followupsSent} follow-ups for ${current.outreach} outreach messages.`,
        );
        break;
    }
  }
  if (insights.strongestChannel?.label === "referrals")
    focus.add(
      `Increase referral activity — referrals converted at ${pct(insights.strongestChannel.value)}, your best channel this week.`,
    );
  if (current.interviews > 0 && current.interviews >= previous.interviews && previousDaysLogged > 0)
    focus.add(`Maintain interview volume (${previous.interviews} → ${current.interviews}).`);
  if (daysLogged < 5 && context.weekEnd < today)
    focus.add(
      `Log every day — only ${plural(daysLogged, "day")} were recorded, so rates may be incomplete.`,
    );
  insights.focus = [...focus].slice(0, 5);
  return insights;
}
