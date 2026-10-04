import { useState, type FormEvent } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DemoReadOnlyNotice,
  Field,
  FormError,
  inputClass,
  Modal,
  NativeSelect,
  NotEnoughData,
  Panel,
} from "@/components/job-search-ui";
import { errorMessage } from "@/lib/job-search-api";
import { useJobSearch } from "@/lib/job-search-context";
import {
  applicationStatuses,
  companyFilters,
  companyMatchesFilter,
  formatShortDate,
  needsFollowUp,
  opportunitySources,
  pipelineStages,
  type Company,
  type CompanyFilter,
  type CompanyInput,
  type OpportunitySource,
} from "@/lib/job-search-data";

const NO_SOURCE = "";
const sourceOptions = [
  { value: NO_SOURCE, label: "Not specified" },
  ...opportunitySources.map((source) => ({ value: source, label: source })),
] as const;

const emptyCompany: CompanyInput = {
  name: "",
  targetRole: "",
  jobUrl: "",
  source: null,
  contactAvailable: false,
  referralAvailable: false,
  applicationStatus: "Not applied",
  currentStage: "Discovered",
  lastActivity: null,
  nextFollowUp: null,
  notes: "",
};

function CompanyForm({ initial, onDone }: { initial: Company | null; onDone: () => void }) {
  const { saveCompany } = useJobSearch();
  const [form, setForm] = useState<CompanyInput>(() => {
    if (!initial) return emptyCompany;
    const { id: _id, updatedAt: _updatedAt, ...rest } = initial;
    return rest;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CompanyInput>(key: K, value: CompanyInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return setError("Company name is required.");
    if (form.lastActivity && form.nextFollowUp && form.nextFollowUp < form.lastActivity)
      return setError("Next follow-up should be on or after the last activity date.");
    setBusy(true);
    setError(null);
    try {
      await saveCompany({ ...form, jobUrl: form.jobUrl.trim() }, initial?.id);
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Company name *">
        <input
          autoFocus
          required
          maxLength={120}
          value={form.name}
          onChange={(event) => set("name", event.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Target role">
        <input
          maxLength={120}
          value={form.targetRole}
          onChange={(event) => set("targetRole", event.target.value)}
          placeholder="e.g. Backend Engineer (Java)"
          className={inputClass}
        />
      </Field>
      <Field label="Job URL" className="sm:col-span-2">
        <input
          type="url"
          value={form.jobUrl}
          onChange={(event) => set("jobUrl", event.target.value)}
          placeholder="https://"
          className={inputClass}
        />
      </Field>
      <Field label="Source">
        <NativeSelect
          value={form.source ?? NO_SOURCE}
          options={sourceOptions}
          onChange={(value) =>
            set("source", value === NO_SOURCE ? null : (value as OpportunitySource))
          }
        />
      </Field>
      <Field label="Application status">
        <NativeSelect
          value={form.applicationStatus}
          options={applicationStatuses.map((value) => ({ value, label: value }))}
          onChange={(value) => set("applicationStatus", value)}
        />
      </Field>
      <Field label="Current stage">
        <NativeSelect
          value={form.currentStage}
          options={pipelineStages.map((value) => ({ value, label: value }))}
          onChange={(value) => set("currentStage", value)}
        />
      </Field>
      <div className="flex items-end gap-4 pb-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.contactAvailable}
            onChange={(event) => set("contactAvailable", event.target.checked)}
          />
          Contact available
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.referralAvailable}
            onChange={(event) => set("referralAvailable", event.target.checked)}
          />
          Referral available
        </label>
      </div>
      <Field label="Last activity">
        <input
          type="date"
          value={form.lastActivity ?? ""}
          onChange={(event) => set("lastActivity", event.target.value || null)}
          className={inputClass}
        />
      </Field>
      <Field label="Next follow-up">
        <input
          type="date"
          value={form.nextFollowUp ?? ""}
          onChange={(event) => set("nextFollowUp", event.target.value || null)}
          className={inputClass}
        />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <textarea
          maxLength={2000}
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
          className="min-h-20 w-full border border-input bg-background p-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </Field>
      <div className="sm:col-span-2">
        <FormError message={error} />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className="rounded-sm bg-ink text-paper hover:bg-ink/90"
        >
          {busy ? "Saving…" : initial ? "Save changes" : "Add company"}
        </Button>
      </div>
    </form>
  );
}

export function CompaniesPage() {
  const { companies, today, readOnly, deleteCompany } = useJobSearch();
  const [filter, setFilter] = useState<CompanyFilter>("active");
  const [editing, setEditing] = useState<Company | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = companies
    .filter((company) => companyMatchesFilter(company, filter, today))
    .sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));

  const remove = async (company: Company) => {
    if (!window.confirm(`Delete ${company.name}?`)) return;
    setError(null);
    try {
      await deleteCompany(company.id);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <div className="space-y-5">
      <DemoReadOnlyNotice what="manage your target companies" />
      <Panel
        title="Target companies"
        eyebrow={`${companies.length} companies`}
        kind="actual"
        action={
          <Button
            size="sm"
            disabled={readOnly}
            onClick={() => setEditing("new")}
            className="h-8 rounded-sm bg-ink text-paper hover:bg-ink/90"
          >
            <Plus className="size-4" />
            Add company
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter companies">
          {companyFilters.map((option) => {
            const count = companies.filter((company) =>
              companyMatchesFilter(company, option.id, today),
            ).length;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={`border px-2.5 py-1 text-xs ${filter === option.id ? "border-teal bg-teal/10" : "border-rule"} ${option.id === "followUp" && count ? "text-coral" : ""}`}
              >
                {option.label} <span className="font-mono text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
        <FormError message={error} />
        {visible.length === 0 ? (
          <NotEnoughData
            detail={
              companies.length
                ? "No companies match this filter."
                : "Add companies you're targeting to track contacts, referrals and follow-ups."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <tr className="border-b border-rule">
                  <th className="py-2 pr-3 font-normal">Company / role</th>
                  <th className="py-2 pr-3 font-normal">Source</th>
                  <th className="py-2 pr-3 font-normal">Contact / referral</th>
                  <th className="py-2 pr-3 font-normal">Status</th>
                  <th className="py-2 pr-3 font-normal">Stage</th>
                  <th className="py-2 pr-3 font-normal">Last activity</th>
                  <th className="py-2 pr-3 font-normal">Next follow-up</th>
                  <th className="py-2 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((company) => (
                  <tr key={company.id} className="border-b border-rule/60 align-top">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5 font-medium">
                        {company.name}
                        {company.jobUrl && (
                          <a
                            href={company.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open job posting for ${company.name}`}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {company.targetRole || "—"}
                      </div>
                      {company.notes && (
                        <div className="mt-0.5 line-clamp-1 max-w-[240px] text-[11px] text-muted-foreground">
                          {company.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">{company.source ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs">
                      {company.contactAvailable ? "Contact" : "—"} /{" "}
                      {company.referralAvailable ? "Referral" : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{company.applicationStatus}</td>
                    <td className="py-2 pr-3 text-xs">{company.currentStage}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {company.lastActivity ? formatShortDate(company.lastActivity) : "—"}
                    </td>
                    <td
                      className={`py-2 pr-3 font-mono text-xs ${needsFollowUp(company, today) ? "font-semibold text-coral" : ""}`}
                    >
                      {company.nextFollowUp ? formatShortDate(company.nextFollowUp) : "—"}
                      {needsFollowUp(company, today) && (
                        <div className="font-sans text-[10px] font-normal">follow-up due</div>
                      )}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        disabled={readOnly}
                        aria-label={`Edit ${company.name}`}
                        onClick={() => setEditing(company)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-coral"
                        disabled={readOnly}
                        aria-label={`Delete ${company.name}`}
                        onClick={() => remove(company)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "Add company" : "Edit company"}
      >
        {editing !== null && (
          <CompanyForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
