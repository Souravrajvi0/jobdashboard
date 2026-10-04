import { useEffect, useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FormError,
  inputClass,
  Panel,
  SegmentedControl,
  useTheme,
} from "@/components/job-search-ui";
import { errorMessage } from "@/lib/job-search-api";
import { useJobSearch } from "@/lib/job-search-context";
import {
  defaultDiagnosticSettings,
  diagnosticSettingFields,
  metricColumn,
  metricKeys,
  todayISO,
  type DiagnosticSettings,
} from "@/lib/job-search-data";

function toCsv(rows: (string | number | boolean | null)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = cell === null ? "" : String(cell);
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}

function download(name: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const {
    settings,
    demoAvailable,
    entries,
    opportunities,
    companies,
    setDataset,
    clearDemoData,
    reloadDemoData,
    saveDiagnostics,
  } = useJobSearch();
  const { dark, setTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<Record<keyof DiagnosticSettings, string>>(() =>
    toStrings(settings.diagnostics),
  );

  useEffect(() => setThresholds(toStrings(settings.diagnostics)), [settings.diagnostics]);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const submitThresholds = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Object.fromEntries(
      diagnosticSettingFields.map((field) => [field.key, Number(thresholds[field.key])]),
    ) as unknown as DiagnosticSettings;
    const invalid = diagnosticSettingFields.find(
      (field) =>
        !Number.isFinite(parsed[field.key]) ||
        parsed[field.key] < 0 ||
        (field.suffix === "%" && parsed[field.key] > 100),
    );
    if (invalid)
      return setError(
        `${invalid.label} must be ${invalid.suffix === "%" ? "between 0 and 100" : "0 or more"}.`,
      );
    void run(() => saveDiagnostics(parsed), "Diagnostic thresholds saved.");
  };

  const stamp = todayISO();
  const isDemo = settings.dataset === "demo";

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Appearance">
        <SegmentedControl
          label="Theme"
          value={dark ? "dark" : "light"}
          onChange={(value) => setTheme(value === "dark")}
          options={[
            { id: "light", label: "Light" },
            { id: "dark", label: "Dark" },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">Saved in this browser.</p>
      </Panel>

      <Panel
        title="Dataset"
        eyebrow={isDemo ? "Currently showing demo data" : "Currently showing your data"}
      >
        <SegmentedControl
          label="Dataset"
          value={settings.dataset}
          onChange={(dataset) =>
            run(
              () => setDataset(dataset),
              dataset === "demo" ? "Showing demo data (read-only)." : "Showing your data.",
            )
          }
          options={[
            { id: "real", label: "My data" },
            { id: "demo", label: "Demo data" },
          ]}
        />
        <p className="mt-3 text-sm text-muted-foreground">
          Demo data is stored separately from your entries and is clearly labelled. It is never
          mixed into your numbers and is read-only.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !demoAvailable}
            className="rounded-sm"
            onClick={() =>
              window.confirm("Delete all demo data? Your own data is not affected.") &&
              run(clearDemoData, "Demo data deleted.")
            }
          >
            Delete demo data
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            className="rounded-sm"
            onClick={() => run(reloadDemoData, "Demo data loaded.")}
          >
            {demoAvailable ? "Regenerate demo data" : "Load demo data"}
          </Button>
        </div>
      </Panel>

      <Panel
        title="Diagnostic thresholds"
        eyebrow="Used by “Where am I weak?” — tune to your own market"
        className="xl:col-span-2"
      >
        <form onSubmit={submitThresholds} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {diagnosticSettingFields.map((field) => (
              <label key={field.key} className="block text-xs">
                <span className="mb-1 block font-medium">
                  {field.label}
                  {field.suffix && ` (${field.suffix})`}
                </span>
                <input
                  type="number"
                  min={0}
                  max={field.suffix === "%" ? 100 : undefined}
                  value={thresholds[field.key]}
                  onChange={(event) =>
                    setThresholds({ ...thresholds, [field.key]: event.target.value })
                  }
                  className={inputClass}
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">{field.hint}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={busy}
              className="rounded-sm bg-ink text-paper hover:bg-ink/90"
            >
              Save thresholds
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setThresholds(toStrings(defaultDiagnosticSettings))}
            >
              Reset to defaults
            </Button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Export"
        eyebrow={`CSV of the ${isDemo ? "demo" : "your"} dataset`}
        className="xl:col-span-2"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-sm"
            disabled={!entries.length}
            onClick={() =>
              download(
                `daily-metrics-${stamp}.csv`,
                toCsv([
                  ["date", ...metricKeys.map(metricColumn), "notes", "created_at", "updated_at"],
                  ...entries.map((entry) => [
                    entry.date,
                    ...metricKeys.map((key) => entry.metrics[key]),
                    entry.notes,
                    entry.createdAt,
                    entry.updatedAt,
                  ]),
                ]),
              )
            }
          >
            <Download className="size-4" />
            Daily metrics ({entries.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-sm"
            disabled={!opportunities.length}
            onClick={() =>
              download(
                `opportunities-${stamp}.csv`,
                toCsv([
                  ["company", "role", "date", "source", "stage", "furthest_stage", "notes"],
                  ...opportunities.map((item) => [
                    item.company,
                    item.role,
                    item.date,
                    item.source,
                    item.stage,
                    item.furthestStage,
                    item.notes,
                  ]),
                ]),
              )
            }
          >
            <Download className="size-4" />
            Opportunities ({opportunities.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-sm"
            disabled={!companies.length}
            onClick={() =>
              download(
                `companies-${stamp}.csv`,
                toCsv([
                  [
                    "name",
                    "target_role",
                    "job_url",
                    "source",
                    "contact_available",
                    "referral_available",
                    "application_status",
                    "current_stage",
                    "last_activity",
                    "next_follow_up",
                    "notes",
                  ],
                  ...companies.map((item) => [
                    item.name,
                    item.targetRole,
                    item.jobUrl,
                    item.source,
                    item.contactAvailable,
                    item.referralAvailable,
                    item.applicationStatus,
                    item.currentStage,
                    item.lastActivity,
                    item.nextFollowUp,
                    item.notes,
                  ]),
                ]),
              )
            }
          >
            <Download className="size-4" />
            Companies ({companies.length})
          </Button>
        </div>
      </Panel>

      <div className="xl:col-span-2 space-y-2">
        <FormError message={error} />
        {message && (
          <p role="status" className="text-sm text-teal">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

function toStrings(settings: DiagnosticSettings): Record<keyof DiagnosticSettings, string> {
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [key, String(value)]),
  ) as Record<keyof DiagnosticSettings, string>;
}
