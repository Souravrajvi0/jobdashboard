// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { emptyMetrics } from "@/lib/job-search-data";

type Store = typeof import("@/server/job-search-db");
let store: Store;

beforeAll(async () => {
  delete process.env["TURSO_DATABASE_URL"];
  process.env["JOB_SEARCH_DB_PATH"] = path.join(
    mkdtempSync(path.join(tmpdir(), "job-search-")),
    "test.db",
  );
  store = await import("@/server/job-search-db");
  await store.getSettings();
}, 60_000);

describe("job search database", () => {
  it("starts on clearly separated demo data", async () => {
    expect((await store.getSettings()).dataset).toBe("demo");
    expect(await store.demoDataExists()).toBe(true);
    expect((await store.listEntries()).every((entry) => entry.notes.startsWith("[Demo]"))).toBe(
      true,
    );
  });

  it("keeps real entries separate and rejects duplicate dates", async () => {
    await store.setDataset("real");
    expect(await store.listEntries()).toHaveLength(0);
    const created = await store.createEntry({
      date: "2026-10-01",
      notes: "",
      metrics: { ...emptyMetrics(), applications: 5 },
    });
    await expect(
      store.createEntry({ date: "2026-10-01", notes: "", metrics: emptyMetrics() }),
    ).rejects.toThrow(store.UserFacingError);
    const updated = await store.updateEntry(created.id, {
      date: "2026-10-01",
      notes: "edited",
      metrics: { ...emptyMetrics(), applications: 7 },
    });
    expect(updated.metrics.applications).toBe(7);
    expect(updated.naukri).toEqual({ python: false, java: false, node: false });
    const checked = await store.updateEntry(created.id, {
      date: "2026-10-01",
      notes: "edited",
      metrics: { ...emptyMetrics(), applications: 7 },
      naukri: { python: true, java: false, node: true },
    });
    expect(checked.naukri).toEqual({ python: true, java: false, node: true });
    expect(await store.listEntries()).toHaveLength(1);
  });

  it("tracks the furthest opportunity stage", async () => {
    const opportunity = await store.createOpportunity({
      company: "Acme",
      role: "SDE",
      date: "2026-10-01",
      source: "Referral",
      stage: "Technical Interview",
      notes: "",
    });
    const rejected = await store.updateOpportunity(opportunity.id, {
      company: "Acme",
      role: "SDE",
      date: "2026-10-01",
      source: "Referral",
      stage: "Rejected",
      notes: "",
    });
    expect(rejected).toMatchObject({ stage: "Rejected", furthestStage: "Technical Interview" });
  });

  it("supports company CRUD", async () => {
    const company = await store.createCompany({
      name: "Globex",
      targetRole: "Backend",
      jobUrl: "",
      source: null,
      contactAvailable: true,
      referralAvailable: false,
      applicationStatus: "Applied",
      currentStage: "Applied",
      lastActivity: "2026-10-01",
      nextFollowUp: null,
      notes: "",
    });
    expect(company.name).toBe("Globex");
    await store.deleteCompany(company.id);
    expect(await store.listCompanies()).toHaveLength(0);
  });

  it("deletes demo data without touching real data", async () => {
    await store.clearDemoData();
    expect(await store.demoDataExists()).toBe(false);
    expect((await store.getSettings()).dataset).toBe("real");
    expect(await store.listEntries()).toHaveLength(1);
  });
});
