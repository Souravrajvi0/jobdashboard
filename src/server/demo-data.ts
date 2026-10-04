import {
  addDays,
  advanceFurthest,
  emptyMetrics,
  progressStages,
  type ApplicationStatus,
  type CompanyInput,
  type DailyEntryInput,
  type OpportunityInput,
  type OpportunitySource,
  type PipelineStage,
} from "@/lib/job-search-data";

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_NOTES = [
  "Applied heavily to Java/Spring Boot roles today.",
  "Got 2 referrals from previous colleagues.",
  "Mostly received irrelevant recruiter calls.",
  "Focused on backend roles at product companies.",
  "Prepared for system design round.",
  "",
  "",
  "",
];

export function demoDailyEntries(today: string, days = 42): DailyEntryInput[] {
  const random = seededRandom(42);
  const between = (min: number, max: number) => Math.floor(min + random() * (max - min + 1));
  const entries: DailyEntryInput[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    if (weekend && random() < 0.4) continue;
    const ramp = 1 + (days - offset) / days / 2;
    const metrics = emptyMetrics();
    metrics.applications = weekend ? between(0, 4) : Math.round(between(8, 18) * ramp);
    metrics.referralRequests = weekend ? between(0, 2) : between(2, 6);
    metrics.referralsReceived = Math.min(metrics.referralRequests, between(0, 2));
    metrics.recruiterMessagesSent = weekend ? between(0, 2) : between(3, 8);
    metrics.hiringManagerMessagesSent = between(0, 3);
    metrics.employeeNetworkingMessagesSent = between(0, 4);
    metrics.followupsSent = between(0, 4);
    metrics.recruiterReplies = Math.min(metrics.recruiterMessagesSent + 2, between(0, 3));
    metrics.networkingReplies = Math.min(
      metrics.hiringManagerMessagesSent + metrics.employeeNetworkingMessagesSent,
      between(0, 2),
    );
    metrics.recruiterCalls = between(0, 2);
    metrics.screeningCalls = random() < 0.45 ? between(1, 2) : 0;
    metrics.qualifiedOpportunities = Math.min(
      metrics.referralsReceived + metrics.screeningCalls,
      between(0, 2),
    );
    metrics.interviews = random() < 0.3 ? 1 : 0;
    metrics.finalRounds = random() < 0.08 ? 1 : 0;
    metrics.offers = offset === 3 ? 1 : 0;
    metrics.naukriProfileViews = Math.round(between(15, 45) * ramp);
    metrics.linkedinProfileViews = Math.round(between(10, 35) * ramp);
    metrics.recruiterInboundMessages = between(0, 3);
    metrics.recruiterInboundCalls = between(0, 2);
    metrics.relevantInboundOpportunities = between(0, 1);
    metrics.platformActivity = between(0, 2);
    entries.push({
      date,
      notes: `[Demo] ${DEMO_NOTES[between(0, DEMO_NOTES.length - 1)]}`.trim(),
      metrics,
    });
  }
  return entries;
}

const demoCompanies: {
  name: string;
  role: string;
  source: OpportunitySource;
  stage: PipelineStage;
  status: ApplicationStatus;
  contact: boolean;
  referral: boolean;
}[] = [
  {
    name: "Atlas Payments",
    role: "Senior Backend Engineer (Java)",
    source: "Referral",
    stage: "Technical Interview",
    status: "Interviewing",
    contact: true,
    referral: true,
  },
  {
    name: "Nimbus Cloud",
    role: "SDE II — Platform",
    source: "Direct Application",
    stage: "Applied",
    status: "Applied",
    contact: false,
    referral: false,
  },
  {
    name: "Brightcart",
    role: "Backend Engineer — Spring Boot",
    source: "Recruiter",
    stage: "Recruiter Screen",
    status: "Waiting",
    contact: true,
    referral: false,
  },
  {
    name: "Quanta Health",
    role: "Software Engineer III",
    source: "Hiring Manager",
    stage: "Final Round",
    status: "Interviewing",
    contact: true,
    referral: false,
  },
  {
    name: "Orbit Logistics",
    role: "Senior Software Engineer",
    source: "Direct Application",
    stage: "Rejected",
    status: "Rejected",
    contact: false,
    referral: false,
  },
  {
    name: "Lumen Fintech",
    role: "Lead Java Developer",
    source: "LinkedIn Inbound",
    stage: "Recruiter Contact",
    status: "Waiting",
    contact: true,
    referral: false,
  },
  {
    name: "Cobalt Systems",
    role: "SDE II",
    source: "Employee Networking",
    stage: "Referral Requested",
    status: "Not applied",
    contact: true,
    referral: true,
  },
  {
    name: "Helix Retail",
    role: "Backend Engineer",
    source: "Naukri Inbound",
    stage: "Offer",
    status: "Offer",
    contact: true,
    referral: false,
  },
];

export function demoCompaniesFor(today: string): CompanyInput[] {
  return demoCompanies.map((company, index) => ({
    name: company.name,
    targetRole: company.role,
    jobUrl: `https://example.com/jobs/demo-${index + 1}`,
    source: company.source,
    contactAvailable: company.contact,
    referralAvailable: company.referral,
    applicationStatus: company.status,
    currentStage: company.stage,
    lastActivity: addDays(today, -(index % 6)),
    nextFollowUp: ["Rejected", "Offer"].includes(company.status)
      ? null
      : addDays(today, (index % 5) - 2),
    notes: "[Demo] Sample company",
  }));
}

export function demoOpportunitiesFor(
  today: string,
): (OpportunityInput & { furthestStage: PipelineStage })[] {
  const random = seededRandom(7);
  const sources: OpportunitySource[] = [
    "Direct Application",
    "Direct Application",
    "Direct Application",
    "Referral",
    "Referral",
    "Recruiter",
    "Hiring Manager",
    "Employee Networking",
    "LinkedIn Inbound",
    "Naukri Inbound",
  ];
  const companies = [
    "Atlas Payments",
    "Nimbus Cloud",
    "Brightcart",
    "Quanta Health",
    "Orbit Logistics",
    "Lumen Fintech",
    "Cobalt Systems",
    "Helix Retail",
    "Vertex Labs",
    "Polar Data",
    "Sable Security",
    "Kite Mobility",
    "Ember AI",
    "Fjord Media",
    "Granite Bank",
    "Ion Energy",
    "Juno Travel",
    "Kepler Games",
  ];
  const roles = [
    "Backend Engineer (Java)",
    "SDE II",
    "Senior Software Engineer",
    "Spring Boot Developer",
    "Platform Engineer",
  ];
  return companies.map((company, index) => {
    const source = sources[index % sources.length] ?? "Other";
    const boost = source === "Referral" ? 3 : source === "Direct Application" ? 0 : 1.5;
    const reach = Math.min(8, Math.floor(random() * 5 + boost + (random() < 0.15 ? 2 : 0)));
    const furthest = progressStages[Math.max(1, reach)] ?? "Applied";
    const closed = furthest !== "Offer" && random() < 0.3;
    return {
      company,
      role: roles[index % roles.length] ?? "Software Engineer",
      date: addDays(today, -Math.floor(random() * 35)),
      source,
      stage: closed ? "Rejected" : furthest,
      furthestStage: advanceFurthest(null, furthest),
      notes: "[Demo] Sample opportunity",
    };
  });
}
