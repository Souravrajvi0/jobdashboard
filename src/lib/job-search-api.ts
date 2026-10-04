import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  addDays,
  applicationStatuses,
  diagnosticSettingFields,
  isValidISODate,
  MAX_DAILY_COUNT,
  metricKeys,
  metricLabels,
  opportunitySources,
  pipelineStages,
  todayISO,
  type DiagnosticSettings,
  type MetricKey,
} from "@/lib/job-search-data";

// Loaded lazily so the database client never enters a client bundle or jsdom test.
const store = () => import("@/server/job-search-db");

const isoDate = (label: string) =>
  z.string().refine(isValidISODate, `${label} must be a real calendar date (yyyy-mm-dd).`);
const pastOrToday = (label: string) =>
  isoDate(label).refine(
    (value) => value <= addDays(todayISO(), 1),
    `${label} cannot be in the future.`,
  );
const optionalDate = (label: string) => z.union([isoDate(label), z.null()]);

const count = (label: string) =>
  z
    .number({ invalid_type_error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(0, `${label} cannot be negative.`)
    .max(MAX_DAILY_COUNT, `${label} looks too large.`);

const metricsSchema = z.object(
  Object.fromEntries(metricKeys.map((key) => [key, count(metricLabels[key])])) as Record<
    MetricKey,
    ReturnType<typeof count>
  >,
);
const stage = z.enum(pipelineStages);
const source = z.union([z.enum(opportunitySources), z.null()]);
const id = z.number().int().positive();

const entrySchema = z.object({
  date: pastOrToday("Date"),
  notes: z.string().trim().max(1000, "Notes must be under 1000 characters."),
  metrics: metricsSchema,
});

const opportunitySchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(120),
  role: z.string().trim().min(1, "Role is required.").max(120),
  date: isoDate("Date"),
  source,
  stage,
  notes: z.string().trim().max(2000),
});

const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required.").max(120),
  targetRole: z.string().trim().max(120),
  jobUrl: z.union([
    z.literal(""),
    z.string().trim().url("Job URL must be a valid URL (https://…)."),
  ]),
  source,
  contactAvailable: z.boolean(),
  referralAvailable: z.boolean(),
  applicationStatus: z.enum(applicationStatuses),
  currentStage: stage,
  lastActivity: optionalDate("Last activity"),
  nextFollowUp: optionalDate("Next follow-up"),
  notes: z.string().trim().max(2000),
});

const diagnosticsSchema = z.object(
  Object.fromEntries(
    diagnosticSettingFields.map((field) => [
      field.key,
      z
        .number()
        .min(0)
        .max(field.suffix === "%" ? 100 : 1000),
    ]),
  ) as Record<keyof DiagnosticSettings, z.ZodNumber>,
);

async function guard<T>(run: () => T | Promise<T>): Promise<T> {
  const db = await store();
  try {
    return await run();
  } catch (error) {
    if (error instanceof db.UserFacingError) throw new Error(error.message);
    throw error;
  }
}

export const fetchJobSearchData = createServerFn({ method: "GET" }).handler(async () => {
  const db = await store();
  const [settings, demoAvailable, entries, opportunities, companies] = await Promise.all([
    db.getSettings(),
    db.demoDataExists(),
    db.listEntries(),
    db.listOpportunities(),
    db.listCompanies(),
  ]);
  return { settings, demoAvailable, entries, opportunities, companies };
});

// Daily metrics
export const createDailyEntry = createServerFn({ method: "POST" })
  .inputValidator(entrySchema)
  .handler(async ({ data }) => guard(async () => (await store()).createEntry(data)));

export const updateDailyEntry = createServerFn({ method: "POST" })
  .inputValidator(entrySchema.extend({ id }))
  .handler(async ({ data: { id: entryId, ...input } }) =>
    guard(async () => (await store()).updateEntry(entryId, input)),
  );

export const deleteDailyEntry = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id }))
  .handler(async ({ data }) => {
    await (await store()).deleteEntry(data.id);
    return data;
  });

// Opportunities
export const createOpportunity = createServerFn({ method: "POST" })
  .inputValidator(opportunitySchema)
  .handler(async ({ data }) => guard(async () => (await store()).createOpportunity(data)));

export const updateOpportunity = createServerFn({ method: "POST" })
  .inputValidator(opportunitySchema.extend({ id }))
  .handler(async ({ data: { id: opportunityId, ...input } }) =>
    guard(async () => (await store()).updateOpportunity(opportunityId, input)),
  );

export const deleteOpportunity = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id }))
  .handler(async ({ data }) => {
    await (await store()).deleteOpportunity(data.id);
    return data;
  });

// Companies
export const createCompany = createServerFn({ method: "POST" })
  .inputValidator(companySchema)
  .handler(async ({ data }) => guard(async () => (await store()).createCompany(data)!));

export const updateCompany = createServerFn({ method: "POST" })
  .inputValidator(companySchema.extend({ id }))
  .handler(async ({ data: { id: companyId, ...input } }) =>
    guard(async () => (await store()).updateCompany(companyId, input)),
  );

export const deleteCompany = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id }))
  .handler(async ({ data }) => {
    await (await store()).deleteCompany(data.id);
    return data;
  });

// Settings & demo data
export const setDataset = createServerFn({ method: "POST" })
  .inputValidator(z.object({ dataset: z.enum(["demo", "real"]) }))
  .handler(async ({ data }) => (await store()).setDataset(data.dataset));

export const saveDiagnosticSettings = createServerFn({ method: "POST" })
  .inputValidator(diagnosticsSchema)
  .handler(async ({ data }) => (await store()).setDiagnosticSettings(data));

export const clearDemoData = createServerFn({ method: "POST" }).handler(async () =>
  (await store()).clearDemoData(),
);

export const reloadDemoData = createServerFn({ method: "POST" }).handler(async () =>
  (await store()).reloadDemoData(),
);

/** Turns server/validation errors into a readable sentence. */
export function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const issues = JSON.parse(raw) as { message?: string }[];
    if (Array.isArray(issues))
      return [...new Set(issues.map((issue) => issue.message).filter(Boolean))].join(" ");
  } catch {
    // not a JSON list of validation issues
  }
  return raw || "Something went wrong.";
}
