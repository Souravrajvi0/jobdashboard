// @vitest-environment node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { emptyMetrics } from "@/lib/job-search-data";

type Store = typeof import("@/server/job-search-db");
let store: Store;

beforeAll(async () => {
  process.env["JOB_SEARCH_DB_PATH"] = path.join(
    mkdtempSync(path.join(tmpdir(), "job-search-")),
    "test.db",
  );
  store = await import("@/server/job-search-db");
});

describe("job search database", () => {
  it("starts on clearly separated demo data", () => {
    expect(store.getSettings().dataset).toBe("demo");
    expect(store.demoDataExists()).toBe(true);
    expect(store.listEntries().every((entry) => entry.notes.startsWith("[Demo]"))).toBe(true);
  });

  it("keeps real entries separate and rejects duplicate dates", () => {
    store.setDataset("real");
    expect(store.listEntries()).toHaveLength(0);
    const created = store.createEntry({
      date: "2026-10-01",
      notes: "",
      metrics: { ...emptyMetrics(), applications: 5 },
    });
    expect(() =>
      store.createEntry({ date: "2026-10-01", notes: "", metrics: emptyMetrics() }),
    ).toThrow(store.UserFacingError);
    const updated = store.updateEntry(created.id, {
      date: "2026-10-01",
      notes: "edited",
      metrics: { ...emptyMetrics(), applications: 7 },
    });
    expect(updated.metrics.applications).toBe(7);
    expect(store.listEntries()).toHaveLength(1);
  });

  it("tracks the furthest opportunity stage", () => {
    const opportunity = store.createOpportunity({
      company: "Acme",
      role: "SDE",
      date: "2026-10-01",
      source: "Referral",
      stage: "Technical Interview",
      notes: "",
    });
    const rejected = store.updateOpportunity(opportunity.id, {
      company: "Acme",
      role: "SDE",
      date: "2026-10-01",
      source: "Referral",
      stage: "Rejected",
      notes: "",
    });
    expect(rejected).toMatchObject({ stage: "Rejected", furthestStage: "Technical Interview" });
  });

  it("supports company CRUD", () => {
    const company = store.createCompany({
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
    expect(company?.name).toBe("Globex");
    store.deleteCompany(company!.id);
    expect(store.listCompanies()).toHaveLength(0);
  });

  it("deletes demo data without touching real data", () => {
    store.clearDemoData();
    expect(store.demoDataExists()).toBe(false);
    expect(store.getSettings().dataset).toBe("real");
    expect(store.listEntries()).toHaveLength(1);
  });
});
