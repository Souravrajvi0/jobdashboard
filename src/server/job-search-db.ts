import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Client, InArgs, InStatement } from "@libsql/client";
import {
  advanceFurthest,
  applicationStatuses,
  defaultDiagnosticSettings,
  emptyMetrics,
  formatLongDate,
  metricColumn,
  metricKeys,
  naukriProfileKeys,
  opportunitySources,
  pipelineStages,
  todayISO,
  type AppSettings,
  type ApplicationStatus,
  type Company,
  type CompanyInput,
  type DailyEntry,
  type DailyEntryInput,
  type Dataset,
  type DiagnosticSettings,
  type NaukriChecks,
  type NaukriProfile,
  type Opportunity,
  type OpportunityInput,
  type OpportunitySource,
  type PipelineStage,
} from "@/lib/job-search-data";
import { demoCompaniesFor, demoDailyEntries, demoOpportunitiesFor } from "@/server/demo-data";

const LOCAL_DB_PATH =
  process.env["JOB_SEARCH_DB_PATH"] ?? path.join(process.cwd(), "data", "job-search.db");
const DB_URL = process.env["TURSO_DATABASE_URL"] ?? `file:${LOCAL_DB_PATH.replace(/\\/g, "/")}`;

export class UserFacingError extends Error {}

type Row = Record<string, string | number | null>;

let database: Promise<Client> | undefined;

function db(): Promise<Client> {
  database ??= connect().catch((error: unknown) => {
    database = undefined;
    throw error;
  });
  return database;
}

async function connect(): Promise<Client> {
  const isLocal = DB_URL.startsWith("file:");
  // The web client is fetch-only, so serverless bundles never need libsql's native binary.
  const { createClient } = isLocal
    ? await import("@libsql/client")
    : await import("@libsql/client/web");
  if (isLocal) mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
  const authToken = process.env["TURSO_AUTH_TOKEN"];
  const conn = createClient({ url: DB_URL, ...(authToken ? { authToken } : {}) });
  if (isLocal) await conn.execute("PRAGMA journal_mode = WAL");
  await migrate(conn);
  await initialize(conn);
  return conn;
}

async function get(conn: Client, sql: string, args: InArgs = []): Promise<Row | undefined> {
  return (await conn.execute({ sql, args })).rows[0] as Row | undefined;
}

async function all(conn: Client, sql: string, args: InArgs = []): Promise<Row[]> {
  return (await conn.execute({ sql, args })).rows as unknown as Row[];
}

async function run(conn: Client, sql: string, args: InArgs = []): Promise<number> {
  return Number((await conn.execute({ sql, args })).lastInsertRowid ?? 0);
}

const naukriColumn = (profile: NaukriProfile) => `naukri_${profile}`;

const metricColumnSql = (key: (typeof metricKeys)[number]) =>
  `${metricColumn(key)} INTEGER NOT NULL DEFAULT 0 CHECK (${metricColumn(key)} >= 0)`;

async function tableExists(conn: Client, name: string): Promise<boolean> {
  return !!(await get(conn, "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", [
    name,
  ]));
}

async function columnsOf(conn: Client, table: string): Promise<Set<string>> {
  return new Set(
    (await all(conn, `PRAGMA table_info(${table})`)).map((row) => String(row["name"])),
  );
}

async function migrate(conn: Client) {
  await conn.executeMultiple(`
    CREATE TABLE IF NOT EXISTS daily_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      ${metricKeys.map(metricColumnSql).join(",\n      ")},
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (date, is_demo)
    );
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_role TEXT NOT NULL DEFAULT '',
      job_url TEXT NOT NULL DEFAULT '',
      source TEXT,
      contact_available INTEGER NOT NULL DEFAULT 0,
      referral_available INTEGER NOT NULL DEFAULT 0,
      application_status TEXT NOT NULL DEFAULT 'Not applied',
      current_stage TEXT NOT NULL DEFAULT 'Discovered',
      last_activity TEXT,
      next_follow_up TEXT,
      notes TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const existingMetricColumns = await columnsOf(conn, "daily_metrics");
  for (const key of metricKeys) {
    if (!existingMetricColumns.has(metricColumn(key)))
      await conn.execute(`ALTER TABLE daily_metrics ADD COLUMN ${metricColumnSql(key)}`);
  }
  for (const profile of naukriProfileKeys) {
    if (!existingMetricColumns.has(naukriColumn(profile)))
      await conn.execute(
        `ALTER TABLE daily_metrics ADD COLUMN ${naukriColumn(profile)} INTEGER NOT NULL DEFAULT 0`,
      );
  }

  // Earlier versions stored daily data in daily_entries with shorter column names.
  if (await tableExists(conn, "daily_entries")) {
    const legacy: Record<string, string> = {
      applications: "applications",
      referral_requests: "referral_requests",
      referrals_received: "referrals_received",
      recruiter_messages_sent: "recruiter_messages",
      hiring_manager_messages_sent: "hiring_manager_messages",
      followups_sent: "follow_ups",
      recruiter_replies: "recruiter_replies",
      recruiter_calls: "recruiter_calls",
      screening_calls: "screening_calls",
      interviews: "interviews",
      final_rounds: "final_rounds",
      offers: "offers",
      naukri_profile_views: "naukri_views",
      linkedin_profile_views: "linkedin_views",
      recruiter_inbound_messages: "inbound_messages",
      recruiter_inbound_calls: "inbound_calls",
      relevant_inbound_opportunities: "inbound_opportunities",
    };
    const available = await columnsOf(conn, "daily_entries");
    const pairs = Object.entries(legacy).filter(([, from]) => available.has(from));
    await conn.executeMultiple(`
      INSERT OR IGNORE INTO daily_metrics (date, notes, ${pairs.map(([to]) => to).join(", ")}, created_at, updated_at)
      SELECT date, notes, ${pairs.map(([, from]) => from).join(", ")}, created_at, updated_at FROM daily_entries;
      DROP TABLE daily_entries;
    `);
  }

  const opportunityColumns = (await tableExists(conn, "opportunities"))
    ? await columnsOf(conn, "opportunities")
    : new Set<string>();
  const legacyOpportunities = opportunityColumns.has("applied_on");
  if (legacyOpportunities)
    await conn.execute("ALTER TABLE opportunities RENAME TO opportunities_legacy");
  await conn.executeMultiple(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      role TEXT NOT NULL,
      date TEXT NOT NULL,
      source TEXT,
      stage TEXT NOT NULL,
      furthest_stage TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS opportunities_dataset_idx ON opportunities (is_demo, date);
  `);
  if (legacyOpportunities) {
    const stageMap: Record<string, PipelineStage> = {
      Applied: "Applied",
      "Recruiter Screen": "Recruiter Screen",
      Interview: "Technical Interview",
      "Final Round": "Final Round",
      Offer: "Offer",
      Closed: "Rejected",
    };
    const sourceMap: Record<string, OpportunitySource> = {
      Direct: "Direct Application",
      Referral: "Referral",
      "Recruiter outreach": "Recruiter",
      Networking: "Employee Networking",
      Naukri: "Naukri Inbound",
      LinkedIn: "LinkedIn Inbound",
    };
    const inserts: InStatement[] = (await all(conn, "SELECT * FROM opportunities_legacy")).map(
      (row) => {
        const stage = stageMap[String(row["stage"])] ?? "Applied";
        return {
          sql: "INSERT INTO opportunities (company, role, date, source, stage, furthest_stage, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [
            String(row["company"]),
            String(row["role"]),
            String(row["applied_on"]),
            sourceMap[String(row["source"])] ?? "Other",
            stage,
            advanceFurthest(null, stage === "Rejected" ? "Applied" : stage),
            String(row["notes"] ?? ""),
          ],
        };
      },
    );
    await conn.batch([...inserts, "DROP TABLE opportunities_legacy"], "write");
  }
}

async function hasRealData(conn: Client): Promise<boolean> {
  for (const table of ["daily_metrics", "opportunities", "companies"])
    if (await get(conn, `SELECT 1 FROM ${table} WHERE is_demo = 0 LIMIT 1`)) return true;
  return false;
}

async function initialize(conn: Client) {
  if (await readSetting(conn, "initialized")) return;
  const statements: InStatement[] = [];
  if (!(await hasRealData(conn)))
    statements.push(...demoSeedStatements(), writeSettingStatement("dataset", "demo"));
  statements.push(writeSettingStatement("initialized", true));
  await conn.batch(statements, "write");
}

// ---------- Settings ----------

async function readSetting(conn: Client, key: string): Promise<unknown> {
  const row = await get(conn, "SELECT value FROM settings WHERE key = ?", [key]);
  return row ? JSON.parse(String(row["value"])) : undefined;
}

const writeSettingStatement = (key: string, value: unknown): InStatement => ({
  sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  args: [key, JSON.stringify(value)],
});

async function writeSetting(conn: Client, key: string, value: unknown) {
  await conn.execute(writeSettingStatement(key, value));
}

export async function getSettings(): Promise<AppSettings> {
  const conn = await db();
  const dataset = (await readSetting(conn, "dataset")) === "demo" ? "demo" : "real";
  const stored = ((await readSetting(conn, "diagnostics")) ?? {}) as Partial<DiagnosticSettings>;
  return { dataset, diagnostics: { ...defaultDiagnosticSettings, ...stored } };
}

export async function setDataset(dataset: Dataset): Promise<AppSettings> {
  await writeSetting(await db(), "dataset", dataset);
  return getSettings();
}

export async function setDiagnosticSettings(settings: DiagnosticSettings): Promise<AppSettings> {
  await writeSetting(await db(), "diagnostics", settings);
  return getSettings();
}

const demoFlag = async () => ((await getSettings()).dataset === "demo" ? 1 : 0);

// ---------- Daily metrics ----------

function toEntry(row: Row): DailyEntry {
  const metrics = emptyMetrics();
  for (const key of metricKeys) metrics[key] = Number(row[metricColumn(key)] ?? 0);
  const naukri = Object.fromEntries(
    naukriProfileKeys.map((profile) => [profile, Number(row[naukriColumn(profile)] ?? 0) === 1]),
  ) as NaukriChecks;
  return {
    id: Number(row["id"]),
    date: String(row["date"]),
    notes: String(row["notes"] ?? ""),
    metrics,
    naukri,
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  };
}

export async function listEntries(): Promise<DailyEntry[]> {
  return (
    await all(await db(), "SELECT * FROM daily_metrics WHERE is_demo = ? ORDER BY date ASC", [
      await demoFlag(),
    ])
  ).map(toEntry);
}

async function entryById(id: number): Promise<DailyEntry> {
  return toEntry((await get(await db(), "SELECT * FROM daily_metrics WHERE id = ?", [id]))!);
}

const metricValues = (input: DailyEntryInput) => metricKeys.map((key) => input.metrics[key]);
const naukriColumns = naukriProfileKeys.map(naukriColumn);
const naukriValues = (input: DailyEntryInput) =>
  naukriProfileKeys.map((profile) => (input.naukri?.[profile] ? 1 : 0));

export async function createEntry(input: DailyEntryInput): Promise<DailyEntry> {
  const conn = await db();
  const existing = await get(conn, "SELECT id FROM daily_metrics WHERE date = ? AND is_demo = 0", [
    input.date,
  ]);
  if (existing)
    throw new UserFacingError(
      `An entry for ${formatLongDate(input.date)} already exists. Open it to edit instead of creating a duplicate.`,
    );
  const columns = [...metricKeys.map(metricColumn), ...naukriColumns];
  const id = await run(
    conn,
    `INSERT INTO daily_metrics (date, notes, ${columns.join(", ")}) VALUES (?, ?, ${columns.map(() => "?").join(", ")})`,
    [input.date, input.notes, ...metricValues(input), ...naukriValues(input)],
  );
  return entryById(id);
}

export async function updateEntry(id: number, input: DailyEntryInput): Promise<DailyEntry> {
  const conn = await db();
  const current = await get(conn, "SELECT id FROM daily_metrics WHERE id = ? AND is_demo = 0", [
    id,
  ]);
  if (!current) throw new UserFacingError("That entry no longer exists.");
  const clash = await get(
    conn,
    "SELECT id FROM daily_metrics WHERE date = ? AND is_demo = 0 AND id <> ?",
    [input.date, id],
  );
  if (clash)
    throw new UserFacingError(`Another entry already exists for ${formatLongDate(input.date)}.`);
  const columns = [...metricKeys.map(metricColumn), ...naukriColumns];
  await run(
    conn,
    `UPDATE daily_metrics SET date = ?, notes = ?, ${columns.map((name) => `${name} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    [input.date, input.notes, ...metricValues(input), ...naukriValues(input), id],
  );
  return entryById(id);
}

export async function deleteEntry(id: number): Promise<void> {
  await run(await db(), "DELETE FROM daily_metrics WHERE id = ? AND is_demo = 0", [id]);
}

// ---------- Opportunities ----------

const asStage = (value: unknown, fallback: PipelineStage): PipelineStage =>
  (pipelineStages as readonly string[]).includes(String(value))
    ? (String(value) as PipelineStage)
    : fallback;
const asSource = (value: unknown): OpportunitySource | null =>
  (opportunitySources as readonly string[]).includes(String(value))
    ? (String(value) as OpportunitySource)
    : null;

function toOpportunity(row: Row): Opportunity {
  return {
    id: Number(row["id"]),
    company: String(row["company"]),
    role: String(row["role"]),
    date: String(row["date"]),
    source: asSource(row["source"]),
    stage: asStage(row["stage"], "Discovered"),
    furthestStage: asStage(row["furthest_stage"], "Discovered"),
    notes: String(row["notes"] ?? ""),
    updatedAt: String(row["updated_at"]),
  };
}

export async function listOpportunities(): Promise<Opportunity[]> {
  return (
    await all(
      await db(),
      "SELECT * FROM opportunities WHERE is_demo = ? ORDER BY date DESC, id DESC",
      [await demoFlag()],
    )
  ).map(toOpportunity);
}

async function opportunityById(id: number): Promise<Opportunity | null> {
  const row = await get(await db(), "SELECT * FROM opportunities WHERE id = ? AND is_demo = 0", [
    id,
  ]);
  return row ? toOpportunity(row) : null;
}

export async function createOpportunity(input: OpportunityInput): Promise<Opportunity> {
  const id = await run(
    await db(),
    "INSERT INTO opportunities (company, role, date, source, stage, furthest_stage, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      input.company,
      input.role,
      input.date,
      input.source,
      input.stage,
      advanceFurthest(null, input.stage),
      input.notes,
    ],
  );
  return (await opportunityById(id))!;
}

export async function updateOpportunity(id: number, input: OpportunityInput): Promise<Opportunity> {
  const existing = await opportunityById(id);
  if (!existing) throw new UserFacingError("That opportunity no longer exists.");
  await run(
    await db(),
    "UPDATE opportunities SET company = ?, role = ?, date = ?, source = ?, stage = ?, furthest_stage = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
    [
      input.company,
      input.role,
      input.date,
      input.source,
      input.stage,
      advanceFurthest(existing.furthestStage, input.stage),
      input.notes,
      id,
    ],
  );
  return (await opportunityById(id))!;
}

export async function deleteOpportunity(id: number): Promise<void> {
  await run(await db(), "DELETE FROM opportunities WHERE id = ? AND is_demo = 0", [id]);
}

// ---------- Companies ----------

function toCompany(row: Row): Company {
  const status = String(row["application_status"]);
  return {
    id: Number(row["id"]),
    name: String(row["name"]),
    targetRole: String(row["target_role"] ?? ""),
    jobUrl: String(row["job_url"] ?? ""),
    source: asSource(row["source"]),
    contactAvailable: Number(row["contact_available"]) === 1,
    referralAvailable: Number(row["referral_available"]) === 1,
    applicationStatus: (applicationStatuses as readonly string[]).includes(status)
      ? (status as ApplicationStatus)
      : "Not applied",
    currentStage: asStage(row["current_stage"], "Discovered"),
    lastActivity: row["last_activity"] ? String(row["last_activity"]) : null,
    nextFollowUp: row["next_follow_up"] ? String(row["next_follow_up"]) : null,
    notes: String(row["notes"] ?? ""),
    updatedAt: String(row["updated_at"]),
  };
}

export async function listCompanies(): Promise<Company[]> {
  return (
    await all(
      await db(),
      "SELECT * FROM companies WHERE is_demo = ? ORDER BY name COLLATE NOCASE",
      [await demoFlag()],
    )
  ).map(toCompany);
}

async function companyById(id: number): Promise<Company | null> {
  const row = await get(await db(), "SELECT * FROM companies WHERE id = ? AND is_demo = 0", [id]);
  return row ? toCompany(row) : null;
}

const companyValues = (input: CompanyInput) => [
  input.name,
  input.targetRole,
  input.jobUrl,
  input.source,
  input.contactAvailable ? 1 : 0,
  input.referralAvailable ? 1 : 0,
  input.applicationStatus,
  input.currentStage,
  input.lastActivity,
  input.nextFollowUp,
  input.notes,
];

const insertCompanyStatement = (input: CompanyInput, isDemo: boolean): InStatement => ({
  sql: "INSERT INTO companies (name, target_role, job_url, source, contact_available, referral_available, application_status, current_stage, last_activity, next_follow_up, notes, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  args: [...companyValues(input), isDemo ? 1 : 0],
});

export async function createCompany(input: CompanyInput): Promise<Company> {
  const result = await (await db()).execute(insertCompanyStatement(input, false));
  return (await companyById(Number(result.lastInsertRowid)))!;
}

export async function updateCompany(id: number, input: CompanyInput): Promise<Company> {
  if (!(await companyById(id))) throw new UserFacingError("That company no longer exists.");
  await run(
    await db(),
    "UPDATE companies SET name = ?, target_role = ?, job_url = ?, source = ?, contact_available = ?, referral_available = ?, application_status = ?, current_stage = ?, last_activity = ?, next_follow_up = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
    [...companyValues(input), id],
  );
  return (await companyById(id))!;
}

export async function deleteCompany(id: number): Promise<void> {
  await run(await db(), "DELETE FROM companies WHERE id = ? AND is_demo = 0", [id]);
}

// ---------- Demo data ----------

const deleteDemoStatements = [
  "DELETE FROM daily_metrics WHERE is_demo = 1",
  "DELETE FROM opportunities WHERE is_demo = 1",
  "DELETE FROM companies WHERE is_demo = 1",
];

function demoSeedStatements(): InStatement[] {
  const today = todayISO();
  const columns = metricKeys.map(metricColumn);
  const entrySql = `INSERT OR REPLACE INTO daily_metrics (date, notes, is_demo, ${columns.join(", ")}) VALUES (?, ?, 1, ${columns.map(() => "?").join(", ")})`;
  const opportunitySql =
    "INSERT INTO opportunities (company, role, date, source, stage, furthest_stage, notes, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)";
  return [
    ...demoDailyEntries(today).map((entry) => ({
      sql: entrySql,
      args: [entry.date, entry.notes, ...metricValues(entry)],
    })),
    ...demoOpportunitiesFor(today).map((item) => ({
      sql: opportunitySql,
      args: [
        item.company,
        item.role,
        item.date,
        item.source,
        item.stage,
        item.furthestStage,
        item.notes,
      ],
    })),
    ...demoCompaniesFor(today).map((company) => insertCompanyStatement(company, true)),
  ];
}

export async function clearDemoData(): Promise<AppSettings> {
  await (
    await db()
  ).batch([...deleteDemoStatements, writeSettingStatement("dataset", "real")], "write");
  return getSettings();
}

export async function reloadDemoData(): Promise<AppSettings> {
  await (
    await db()
  ).batch(
    [...deleteDemoStatements, ...demoSeedStatements(), writeSettingStatement("dataset", "demo")],
    "write",
  );
  return getSettings();
}

export async function demoDataExists(): Promise<boolean> {
  const conn = await db();
  for (const table of ["daily_metrics", "opportunities", "companies"])
    if (await get(conn, `SELECT 1 FROM ${table} WHERE is_demo = 1 LIMIT 1`)) return true;
  return false;
}
