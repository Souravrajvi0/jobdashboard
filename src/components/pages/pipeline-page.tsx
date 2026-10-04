import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  closedStages,
  formatShortDate,
  isValidISODate,
  opportunitySources,
  pipelineStages,
  type Opportunity,
  type OpportunityInput,
  type OpportunitySource,
  type PipelineStage,
} from "@/lib/job-search-data";

const NO_SOURCE = "";
const sourceOptions = [
  { value: NO_SOURCE, label: "Not specified" },
  ...opportunitySources.map((source) => ({ value: source, label: source })),
] as const;
const stageOptions = pipelineStages.map((stage) => ({ value: stage, label: stage }));

function stageTone(stage: PipelineStage) {
  if (stage === "Offer") return "border-teal/50 bg-teal/10 text-teal";
  if (closedStages.includes(stage)) return "border-rule text-muted-foreground";
  if (["Technical Interview", "Final Round"].includes(stage))
    return "border-amber/50 bg-amber/10 text-amber";
  return "border-rule";
}

function OpportunityForm({ initial, onDone }: { initial: Opportunity | null; onDone: () => void }) {
  const { today, saveOpportunity } = useJobSearch();
  const [form, setForm] = useState<OpportunityInput>(
    initial
      ? {
          company: initial.company,
          role: initial.role,
          date: initial.date,
          source: initial.source,
          stage: initial.stage,
          notes: initial.notes,
        }
      : { company: "", role: "", date: today, source: null, stage: "Applied", notes: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim())
      return setError("Company and role are required.");
    if (!isValidISODate(form.date)) return setError("Enter a valid date.");
    setBusy(true);
    setError(null);
    try {
      await saveOpportunity(form, initial?.id);
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Company *">
        <input
          autoFocus
          required
          maxLength={120}
          value={form.company}
          onChange={(event) => setForm({ ...form, company: event.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Role *">
        <input
          required
          maxLength={120}
          value={form.role}
          onChange={(event) => setForm({ ...form, role: event.target.value })}
          placeholder="e.g. Senior Java Developer"
          className={inputClass}
        />
      </Field>
      <Field label="Date">
        <input
          type="date"
          required
          value={form.date}
          onChange={(event) => setForm({ ...form, date: event.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Source (optional)">
        <NativeSelect
          value={form.source ?? NO_SOURCE}
          options={sourceOptions}
          onChange={(value) =>
            setForm({ ...form, source: value === NO_SOURCE ? null : (value as OpportunitySource) })
          }
        />
      </Field>
      <Field label="Stage" className="sm:col-span-2">
        <NativeSelect
          value={form.stage}
          options={stageOptions}
          onChange={(stage) => setForm({ ...form, stage })}
        />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <textarea
          maxLength={2000}
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
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
          {busy ? "Saving…" : initial ? "Save changes" : "Add opportunity"}
        </Button>
      </div>
    </form>
  );
}

export function PipelinePage() {
  const { opportunities, readOnly, saveOpportunity, deleteOpportunity } = useJobSearch();
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Opportunity | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () =>
      new Map(
        pipelineStages.map((stage) => [
          stage,
          opportunities.filter((item) => item.stage === stage).length,
        ]),
      ),
    [opportunities],
  );
  const visible = opportunities
    .filter((item) => stageFilter === "all" || item.stage === stageFilter)
    .filter(
      (item) =>
        !query ||
        `${item.company} ${item.role} ${item.notes}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const active = opportunities.filter(
    (item) => !closedStages.includes(item.stage) && item.stage !== "Offer",
  ).length;

  return (
    <div className="space-y-5">
      <DemoReadOnlyNotice what="track your own opportunities" />

      <Panel
        title="Stage summary"
        eyebrow={`${opportunities.length} tracked · ${active} active`}
        kind="actual"
      >
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setStageFilter("all")}
            className={`border px-2.5 py-1 text-xs ${stageFilter === "all" ? "border-teal bg-teal/10" : "border-rule"}`}
          >
            All <span className="font-mono text-muted-foreground">{opportunities.length}</span>
          </button>
          {pipelineStages.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setStageFilter(stage)}
              className={`border px-2.5 py-1 text-xs ${stageFilter === stage ? "border-teal bg-teal/10" : "border-rule"}`}
            >
              {stage} <span className="font-mono text-muted-foreground">{counts.get(stage)}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel
        title="Opportunities"
        action={
          <div className="flex gap-2">
            <input
              aria-label="Search opportunities"
              placeholder="Search…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClass} h-8 w-40`}
            />
            <Button
              size="sm"
              disabled={readOnly}
              onClick={() => setEditing("new")}
              className="h-8 rounded-sm bg-ink text-paper hover:bg-ink/90"
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        }
      >
        <FormError message={error} />
        {visible.length === 0 ? (
          <NotEnoughData
            detail={
              opportunities.length
                ? "No opportunities match this filter."
                : "Add companies and roles you're pursuing to track them through each stage."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <tr className="border-b border-rule">
                  <th className="py-2 pr-3 font-normal">Company / role</th>
                  <th className="py-2 pr-3 font-normal">Date</th>
                  <th className="py-2 pr-3 font-normal">Source</th>
                  <th className="py-2 pr-3 font-normal">Stage</th>
                  <th className="py-2 pr-3 font-normal">Furthest</th>
                  <th className="py-2 pr-3 font-normal">Notes</th>
                  <th className="py-2 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr key={item.id} className="border-b border-rule/60 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{item.company}</div>
                      <div className="text-xs text-muted-foreground">{item.role}</div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{formatShortDate(item.date)}</td>
                    <td className="py-2 pr-3 text-xs">
                      {item.source ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        aria-label={`Stage for ${item.company}`}
                        disabled={readOnly}
                        value={item.stage}
                        onChange={(event) =>
                          run(() =>
                            saveOpportunity(
                              {
                                company: item.company,
                                role: item.role,
                                date: item.date,
                                source: item.source,
                                notes: item.notes,
                                stage: event.target.value as PipelineStage,
                              },
                              item.id,
                            ),
                          )
                        }
                        className={`h-7 border px-1.5 text-xs ${stageTone(item.stage)} bg-transparent`}
                      >
                        {pipelineStages.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {item.furthestStage}
                    </td>
                    <td className="max-w-[220px] py-2 pr-3 text-xs text-muted-foreground">
                      <span className="line-clamp-2">{item.notes || "—"}</span>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        disabled={readOnly}
                        aria-label={`Edit ${item.company}`}
                        onClick={() => setEditing(item)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-coral"
                        disabled={readOnly}
                        aria-label={`Delete ${item.company}`}
                        onClick={() =>
                          window.confirm(`Delete ${item.company} — ${item.role}?`) &&
                          run(() => deleteOpportunity(item.id))
                        }
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
        <p className="mt-2 text-[11px] text-muted-foreground">
          "Furthest" keeps the most advanced stage reached, so a later rejection still counts the
          interview in channel analytics.
        </p>
      </Panel>

      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "Add opportunity" : "Edit opportunity"}
      >
        {editing !== null && (
          <OpportunityForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
