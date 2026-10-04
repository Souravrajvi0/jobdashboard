import { describe, expect, it } from "vitest";
import {
  addDays,
  advanceFurthest,
  buildSeries,
  channelPerformance,
  companyMatchesFilter,
  computeConversions,
  diagnose,
  emptyMetrics,
  formatConversion,
  metricColumn,
  previousRange,
  resolvePeriod,
  startOfWeek,
  sumEntries,
  weekContext,
  weeklyInsights,
  type Company,
  type DailyEntry,
  type MetricValues,
  type Opportunity,
} from "@/lib/job-search-data";

let nextId = 1;
function entry(date: string, metrics: Partial<MetricValues>): DailyEntry {
  return {
    id: nextId++,
    date,
    notes: "",
    metrics: { ...emptyMetrics(), ...metrics },
    createdAt: date,
    updatedAt: date,
  };
}

function opportunity(partial: Partial<Opportunity>): Opportunity {
  return {
    id: nextId++,
    company: "Acme",
    role: "Backend Engineer",
    date: "2026-09-29",
    source: null,
    stage: "Applied",
    furthestStage: "Applied",
    notes: "",
    updatedAt: "",
    ...partial,
  };
}

describe("dates and periods", () => {
  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28");
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("resolves presets and the equal-length previous window", () => {
    expect(resolvePeriod("thisWeek", "2026-10-04")).toEqual({
      start: "2026-09-28",
      end: "2026-10-04",
    });
    expect(resolvePeriod("lastWeek", "2026-10-04")).toEqual({
      start: "2026-09-21",
      end: "2026-09-27",
    });
    expect(resolvePeriod("thisMonth", "2026-02-10")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
    expect(previousRange({ start: "2026-10-01", end: "2026-10-10" })).toEqual({
      start: "2026-09-21",
      end: "2026-09-30",
    });
  });

  it("maps metric keys to spec column names", () => {
    expect(metricColumn("followupsSent")).toBe("followups_sent");
    expect(metricColumn("naukriProfileViews")).toBe("naukri_profile_views");
  });
});

describe("conversion metrics", () => {
  it("derive from counts and show — without a denominator", () => {
    const results = computeConversions({
      ...emptyMetrics(),
      applications: 100,
      recruiterReplies: 8,
      networkingReplies: 4,
    });
    const byId = new Map(results.map((result) => [result.id, result]));
    expect(byId.get("appResponse")?.value).toBeCloseTo(0.12);
    expect(formatConversion(byId.get("appsPerResponse")!)).toBe("8.3");
    expect(byId.get("referral")?.value).toBeNull();
    expect(formatConversion(byId.get("referral")!)).toBe("—");
  });
});

describe("aggregation", () => {
  const entries = [
    entry("2026-09-28", { applications: 10, naukriProfileViews: 50 }),
    entry("2026-09-30", { applications: 5 }),
    entry("2026-10-06", { applications: 7 }),
  ];

  it("sums entries inside an inclusive range", () => {
    expect(sumEntries(entries, "2026-09-28", "2026-10-04").applications).toBe(15);
  });

  it("buckets weekly series and fills empty weeks with zeros", () => {
    const series = buildSeries(entries, "weekly", "2026-10-06");
    expect(series).toHaveLength(12);
    expect(series.at(-1)?.applications).toBe(7);
    expect(series.at(-2)?.applications).toBe(15);
    expect(series.at(-3)?.applications).toBe(0);
  });
});

describe("opportunities", () => {
  it("keeps the furthest progress stage when rejected", () => {
    expect(advanceFurthest("Technical Interview", "Rejected")).toBe("Technical Interview");
    expect(advanceFurthest("Applied", "Final Round")).toBe("Final Round");
    expect(advanceFurthest("Final Round", "Applied")).toBe("Final Round");
  });

  it("attributes interviews and offers to channels by source", () => {
    const range = { start: "2026-09-28", end: "2026-10-04" };
    const channels = channelPerformance(
      [entry("2026-09-29", { referralRequests: 10, referralsReceived: 4, applications: 20 })],
      [
        opportunity({
          source: "Referral",
          stage: "Rejected",
          furthestStage: "Technical Interview",
        }),
        opportunity({ source: "Referral", stage: "Offer", furthestStage: "Offer" }),
        opportunity({ source: "Direct Application" }),
      ],
      range,
    );
    const referral = channels.find((channel) => channel.id === "referral")!;
    expect(referral).toMatchObject({
      activity: 10,
      dailyResponses: 4,
      tracked: 2,
      interviews: 2,
      offers: 1,
    });
    expect(channels.find((channel) => channel.id === "direct")).toMatchObject({
      activity: 20,
      tracked: 1,
      interviews: 0,
    });
  });
});

describe("diagnostics", () => {
  it("flags low effort against the user's own baseline in hedged language", () => {
    const entries = [
      entry("2026-09-14", { applications: 40, recruiterMessagesSent: 20 }),
      entry("2026-09-21", { applications: 40, recruiterMessagesSent: 20 }),
      entry("2026-09-28", { applications: 5, recruiterMessagesSent: 2 }),
    ];
    const effort = diagnose(weekContext(entries, "2026-09-28")).find(
      (item) => item.id === "effort-low",
    );
    expect(effort?.basis).toBe("baseline");
    expect(effort?.interpretation).toMatch(/^This may indicate/);
  });

  it("flags low application response but skips small samples", () => {
    const low = diagnose(
      weekContext([entry("2026-09-28", { applications: 50, recruiterReplies: 1 })], "2026-09-28"),
    );
    expect(low.map((item) => item.id)).toContain("app-response-low");
    const small = diagnose(weekContext([entry("2026-09-28", { applications: 3 })], "2026-09-28"));
    expect(small.map((item) => item.id)).not.toContain("app-response-low");
  });

  it("produces data-only insights and handles an empty week", () => {
    const entries = [
      entry("2026-09-22", { applications: 100, recruiterReplies: 15 }),
      entry("2026-09-29", { applications: 100, recruiterReplies: 12, interviews: 5 }),
    ];
    const insights = weeklyInsights(entries, "2026-09-28", "2026-10-04");
    expect(insights.summary[0]).toContain("This week you submitted 100 applications");
    expect(insights.weak).toContain(
      "Your direct-application response rate decreased compared with the previous week (15% → 12%).",
    );
    expect(insights.improved).toContain("Your interview volume increased from 0 to 5.");
    const empty = weeklyInsights([], "2026-09-28", "2026-10-04");
    expect(empty.context.daysLogged).toBe(0);
    expect(empty.observations).toHaveLength(0);
  });
});

describe("qualified opportunities", () => {
  it("flags lots of activity with few qualified opportunities, only once tracking starts", () => {
    const busy = {
      applications: 60,
      recruiterMessagesSent: 30,
      employeeNetworkingMessagesSent: 10,
    };
    const flagged = diagnose(
      weekContext([entry("2026-09-28", { ...busy, qualifiedOpportunities: 1 })], "2026-09-28"),
    );
    expect(flagged.map((item) => item.id)).toContain("volume-not-qualifying");
    const untracked = diagnose(weekContext([entry("2026-09-28", busy)], "2026-09-28"));
    expect(untracked.map((item) => item.id)).not.toContain("volume-not-qualifying");
  });

  it("computes efficiency ratios and channel yield", () => {
    const byId = new Map(
      computeConversions({
        ...emptyMetrics(),
        recruiterMessagesSent: 30,
        recruiterReplies: 3,
        referralRequests: 4,
        referralsReceived: 2,
      }).map((result) => [result.id, result]),
    );
    expect(byId.get("messagesPerRecruiterReply")?.value).toBe(10);
    expect(byId.get("requestsPerReferral")?.value).toBe(2);
    const channels = channelPerformance(
      [entry("2026-09-29", { referralRequests: 1, recruiterMessagesSent: 30 })],
      [
        opportunity({
          source: "Referral",
          stage: "Technical Interview",
          furthestStage: "Technical Interview",
        }),
      ],
      { start: "2026-09-28", end: "2026-10-04" },
    );
    expect(channels.find((channel) => channel.id === "referral")?.interviewsPer10).toBe(10);
    expect(channels.find((channel) => channel.id === "recruiter")?.interviewsPer10).toBe(0);
  });
});

describe("companies", () => {
  it("filters follow-ups that are due", () => {
    const company: Company = {
      id: 1,
      name: "Acme",
      targetRole: "",
      jobUrl: "",
      source: null,
      contactAvailable: true,
      referralAvailable: false,
      applicationStatus: "Waiting",
      currentStage: "Applied",
      lastActivity: "2026-09-25",
      nextFollowUp: "2026-10-03",
      notes: "",
      updatedAt: "",
    };
    expect(companyMatchesFilter(company, "followUp", "2026-10-04")).toBe(true);
    expect(companyMatchesFilter(company, "followUp", "2026-10-02")).toBe(false);
    expect(
      companyMatchesFilter({ ...company, applicationStatus: "Offer" }, "followUp", "2026-10-04"),
    ).toBe(false);
  });
});
