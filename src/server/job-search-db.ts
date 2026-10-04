import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  advanceFurthest,
  applicationStatuses,
  defaultDiagnosticSettings,
  emptyMetrics,
  formatLongDate,
  metricColumn,
  metricKeys,
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
  type Opportunity,
  type OpportunityInput,
  type OpportunitySource,
  type PipelineStage,
} from "@/lib/job-search-data";
import { demoCompaniesFor, demoDailyEntries, demoOpportunitiesFor } from "@/server/demo-data";

const DB_PATH =
  process.env["JOB_SEARCH_DB_PATH"] ?? path.join(process.cwd(), "data", "job-search.db");

export class UserFacingError extends Error {}

type Row = Record<string, string | number | null>;

let database: DatabaseSync | undefined;

function db(): DatabaseSync {
  if (database) return database;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  database = new DatabaseSync(DB_PATH);
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(database);
  initialize(database);
  return database;
}

const metricColumnSql = (key: (typeof metricKeys)[number]) =>
  `${metricColumn(key)} INTEGER NOT NULL DEFAULT 0 CHECK (${metricColumn(key)} >= 0)`;

function tableExists(conn: DatabaseSync, name: string): boolean {
  return !!conn.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function columnsOf(conn: DatabaseSync, table: string): Set<string> {
  return new Set(
    (conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (row) => row.name,
    ),
  );
}

function migrate(conn: DatabaseSync) {
  conn.exec(`
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

  const existingMetricColumns = columnsOf(conn, "daily_metrics");
  for (const key of metricKeys) {
    if (!existingMetricColumns.has(metricColumn(key)))
      conn.exec(`ALTER TABLE daily_metrics ADD COLUMN ${metricColumnSql(key)}`);
  }

  // Earlier versions stored daily data in daily_entries with shorter column names.
  if (tableExists(conn, "daily_entries")) {
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
    const available = columnsOf(conn, "daily_entries");
    const pairs = Object.entries(legacy).filter(([, from]) => available.has(from));
    conn.exec(`
      INSERT OR IGNORE INTO daily_metrics (date, notes, ${pairs.map(([to]) => to).join(", ")}, created_at, updated_at)
      SELECT date, notes, ${pairs.map(([, from]) => from).join(", ")}, created_at, updated_at FROM daily_entries;
      DROP TABLE daily_entries;
    `);
  }

  const opportunityColumns = tableExists(conn, "opportunities")
    ? columnsOf(conn, "opportunities")
    : new Set<string>();
  const legacyOpportunities = opportunityColumns.has("applied_on");
  if (legacyOpportunities) conn.exec("ALTER TABLE opportunities RENAME TO opportunities_legacy");
  conn.exec(`
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
    const insert = conn.prepare(
      "INSERT INTO opportunities (company, role, date, source, stage, furthest_stage, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const row of conn.prepare("SELECT * FROM opportunities_legacy").all() as Row[]) {
      const stage = stageMap[String(row["stage"])] ?? "Applied";
      insert.run(
        String(row["company"]),
        String(row["role"]),
        String(row["applied_on"]),
        sourceMap[String(row["source"])] ?? "Other",
        stage,
        advanceFurthest(null, stage === "Rejected" ? "Applied" : stage),
        String(row["notes"] ?? ""),
      );
    }
    conn.exec("DROP TABLE opportunities_legacy");
  }
}

function hasRealData(conn: DatabaseSync): boolean {
  return ["daily_metrics", "opportunities", "companies"].some(
    (table) => !!conn.prepare(`SELECT 1 FROM ${table} WHERE is_demo = 0 LIMIT 1`).get(),
  );
}

function initialize(conn: DatabaseSync) {
  if (readSetting(conn, "initialized")) return;
  if (!hasRealData(conn)) {
    seedDemo(conn);
    writeSetting(conn, "dataset", "demo");
  }
  writeSetting(conn, "initialized", true);
}

// ---------- Settings ----------

function readSetting(conn: DatabaseSync, key: string): unknown {
  const row = conn.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    { value: string } | undefined;
  return row ? JSON.parse(row.value) : undefined;
}

function writeSetting(conn: DatabaseSync, key: string, value: unknown) {
  conn
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, JSON.stringify(value));
}

export function getSettings(): AppSettings {
  const conn = db();
  const dataset = readSetting(conn, "dataset") === "demo" ? "demo" : "real";
  const stored = (readSetting(conn, "diagnostics") ?? {}) as Partial<DiagnosticSettings>;
  return { dataset, diagnostics: { ...defaultDiagnosticSettings, ...stored } };
}

export function setDataset(dataset: Dataset): AppSettings {
  writeSetting(db(), "dataset", dataset);
  return getSettings();
}

export function setDiagnosticSettings(settings: DiagnosticSettings): AppSettings {
  writeSetting(db(), "diagnostics", settings);
  return getSettings();
}

const demoFlag = () => (getSettings().dataset === "demo" ? 1 : 0);

// ---------- Daily metrics ----------

function toEntry(row: Row): DailyEntry {
  const metrics = emptyMetrics();
  for (const key of metricKeys) metrics[key] = Number(row[metricColumn(key)] ?? 0);
  return {
    id: Number(row["id"]),
    date: String(row["date"]),
    notes: String(row["notes"] ?? ""),
    metrics,
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  };
}

export function listEntries(): DailyEntry[] {
  return (
    db()
      .prepare("SELECT * FROM daily_metrics WHERE is_demo = ? ORDER BY date ASC")
      .all(demoFlag()) as Row[]
  ).map(toEntry);
}

function entryById(id: number): DailyEntry {
  return toEntry(db().prepare("SELECT * FROM daily_metrics WHERE id = ?").get(id) as Row);
}

const metricValues = (input: DailyEntryInput) => metricKeys.map((key) => input.metrics[key]);

export function createEntry(input: DailyEntryInput): DailyEntry {
  const conn = db();
  const existing = conn
    .prepare("SELECT id FROM daily_metrics WHERE date = ? AND is_demo = 0")
    .get(input.date);
  if (existing)
    throw new UserFacingError(
      `An entry for ${formatLongDate(input.date)} already exists. Open it to edit instead of creating a duplicate.`,
    );
  const columns = metricKeys.map(metricColumn);
  const result = conn
    .prepare(
      `INSERT INTO daily_metrics (date, notes, ${columns.join(", ")}) VALUES (?, ?, ${columns.map(() => "?").join(", ")})`,
    )
    .run(input.date, input.notes, ...metricValues(input));
  return entryById(Number(result.lastInsertRowid));
}

export function updateEntry(id: number, input: DailyEntryInput): DailyEntry {
  const conn = db();
  const current = conn.prepare("SELECT id FROM daily_metrics WHERE id = ? AND is_demo = 0").get(id);
  if (!current) throw new UserFacingError("That entry no longer exists.");
  const clash = conn
    .prepare("SELECT id FROM daily_metrics WHERE date = ? AND is_demo = 0 AND id <> ?")
    .get(input.date, id);
  if (clash)
    throw new UserFacingError(`Another entry already exists for ${formatLongDate(input.date)}.`);
  const columns = metricKeys.map(metricColumn);
  conn
    .prepare(
      `UPDATE daily_metrics SET date = ?, notes = ?, ${columns.map((name) => `${name} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(input.date, input.notes, ...metricValues(input), id);
  return entryById(id);
}

export function deleteEntry(id: number): void {
  db().prepare("DELETE FROM daily_metrics WHERE id = ? AND is_demo = 0").run(id);
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

export function listOpportunities(): Opportunity[] {
  return (
    db()
      .prepare("SELECT * FROM opportunities WHERE is_demo = ? ORDER BY date DESC, id DESC")
      .all(demoFlag()) as Row[]
  ).map(toOpportunity);
}

function opportunityById(id: number): Opportunity | null {
  const row = db().prepare("SELECT * FROM opportunities WHERE id = ? AND is_demo = 0").get(id) as
    Row | undefined;
  return row ? toOpportunity(row) : null;
}

export function createOpportunity(input: OpportunityInput): Opportunity {
  const result = db()
    .prepare(
      "INSERT INTO opportunities (company, role, date, source, stage, furthest_stage, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.company,
      input.role,
      input.date,
      input.source,
      input.stage,
      advanceFurthest(null, input.stage),
      input.notes,
    );
  return opportunityById(Number(result.lastInsertRowid))!;
}

export function updateOpportunity(id: number, input: OpportunityInput): Opportunity {
  const existing = opportunityById(id);
  if (!existing) throw new UserFacingError("That opportunity no longer exists.");
  db()
    .prepare(
      "UPDATE opportunities SET company = ?, role = ?, date = ?, source = ?, stage = ?, furthest_stage = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(
      input.company,
      input.role,
      input.date,
      input.source,
      input.stage,
      advanceFurthest(existing.furthestStage, input.stage),
      input.notes,
      id,
    );
  return opportunityById(id)!;
}

export function deleteOpportunity(id: number): void {
  db().prepare("DELETE FROM opportunities WHERE id = ? AND is_demo = 0").run(id);
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

export function listCompanies(): Company[] {
  return (
    db()
      .prepare("SELECT * FROM companies WHERE is_demo = ? ORDER BY name COLLATE NOCASE")
      .all(demoFlag()) as Row[]
  ).map(toCompany);
}

function companyById(id: number): Company | null {
  const row = db().prepare("SELECT * FROM companies WHERE id = ? AND is_demo = 0").get(id) as
    Row | undefined;
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

export function createCompany(input: CompanyInput, isDemo = false, conn = db()): Company | null {
  const result = conn
    .prepare(
      "INSERT INTO companies (name, target_role, job_url, source, contact_available, referral_available, application_status, current_stage, last_activity, next_follow_up, notes, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(...companyValues(input), isDemo ? 1 : 0);
  return isDemo ? null : companyById(Number(result.lastInsertRowid));
}

export function updateCompany(id: number, input: CompanyInput): Company {
  if (!companyById(id)) throw new UserFacingError("That company no longer exists.");
  db()
    .prepare(
      "UPDATE companies SET name = ?, target_role = ?, job_url = ?, source = ?, contact_available = ?, referral_available = ?, application_status = ?, current_stage = ?, last_activity = ?, next_follow_up = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .run(...companyValues(input), id);
  return companyById(id)!;
}

export function deleteCompany(id: number): void {
  db().prepare("DELETE FROM companies WHERE id = ? AND is_demo = 0").run(id);
}

// ---------- Demo data ----------

function seedDemo(conn: DatabaseSync) {
  const today = todayISO();
  const columns = metricKeys.map(metricColumn);
  const insertEntry = conn.prepare(
    `INSERT OR REPLACE INTO daily_metrics (date, notes, is_demo, ${columns.join(", ")}) VALUES (?, ?, 1, ${columns.map(() => "?").join(", ")})`,
  );
  for (const entry of demoDailyEntries(today))
    insertEntry.run(entry.date, entry.notes, ...metricValues(entry));
  const insertOpportunity = conn.prepare(
    "INSERT INTO opportunities (company, role, date, source, stage, furthest_stage, notes, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
  );
  for (const item of demoOpportunitiesFor(today))
    insertOpportunity.run(
      item.company,
      item.role,
      item.date,
      item.source,
      item.stage,
      item.furthestStage,
      item.notes,
    );
  for (const company of demoCompaniesFor(today)) createCompany(company, true, conn);
}

export function clearDemoData(): AppSettings {
  const conn = db();
  conn.exec(
    "DELETE FROM daily_metrics WHERE is_demo = 1; DELETE FROM opportunities WHERE is_demo = 1; DELETE FROM companies WHERE is_demo = 1;",
  );
  writeSetting(conn, "dataset", "real");
  return getSettings();
}

export function reloadDemoData(): AppSettings {
  const conn = db();
  conn.exec(
    "DELETE FROM daily_metrics WHERE is_demo = 1; DELETE FROM opportunities WHERE is_demo = 1; DELETE FROM companies WHERE is_demo = 1;",
  );
  seedDemo(conn);
  writeSetting(conn, "dataset", "demo");
  return getSettings();
}

export function demoDataExists(): boolean {
  return ["daily_metrics", "opportunities", "companies"].some(
    (table) => !!db().prepare(`SELECT 1 FROM ${table} WHERE is_demo = 1 LIMIT 1`).get(),
  );
}
