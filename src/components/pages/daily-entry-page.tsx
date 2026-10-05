import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DemoReadOnlyNotice,
  FormError,
  inputClass,
  KindBadge,
  Panel,
} from "@/components/job-search-ui";
import { errorMessage } from "@/lib/job-search-api";
import { useJobSearch } from "@/lib/job-search-context";
import {
  addDays,
  derive,
  emptyNaukriChecks,
  formatLongDate,
  formatShortDate,
  isValidISODate,
  MAX_DAILY_COUNT,
  metricGroups,
  metricKeys,
  metricLabels,
  naukriProfileKeys,
  naukriProfiles,
  startOfWeek,
  type MetricKey,
  type MetricValues,
  type NaukriChecks,
  type NaukriProfile,
} from "@/lib/job-search-data";

const naukriDone = (checks?: NaukriChecks) =>
  checks ? naukriProfileKeys.filter((key) => checks[key]).length : 0;

type FormValues = Record<MetricKey, string>;

const toForm = (metrics?: MetricValues): FormValues =>
  Object.fromEntries(metricKeys.map((key) => [key, String(metrics?.[key] ?? 0)])) as FormValues;

function validateField(value: string): string | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return "Must be a number";
  if (number < 0) return "Cannot be negative";
  if (!Number.isInteger(number)) return "Whole numbers only";
  if (number > MAX_DAILY_COUNT) return "Too large";
  return null;
}

function MetricInput({
  id,
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const step = (delta: number) => onChange(String(Math.max(0, (Number(value) || 0) + delta)));
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block truncate text-xs text-muted-foreground"
        title={label}
      >
        {label}
      </label>
      <div
        className={`flex h-9 items-stretch border bg-background ${error ? "border-coral" : "border-input"}`}
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={`Decrease ${label}`}
          onClick={() => step(-1)}
          className="px-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <Minus className="size-3" />
        </button>
        <input
          id={id}
          inputMode="numeric"
          type="number"
          min={0}
          step={1}
          disabled={disabled}
          value={value}
          aria-invalid={!!error}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChange(event.target.value)}
          className="w-full min-w-0 bg-transparent text-center font-mono text-sm tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={`Increase ${label}`}
          onClick={() => step(1)}
          className="px-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <Plus className="size-3" />
        </button>
      </div>
      {error && <p className="mt-0.5 text-[10px] text-coral">{error}</p>}
    </div>
  );
}

export function DailyEntryPage({ initialDate }: { initialDate?: string | undefined }) {
  const { today, entries, entriesByDate, saveEntry, deleteEntry, readOnly } = useJobSearch();
  const navigate = useNavigate();
  const [date, setDate] = useState(
    initialDate && isValidISODate(initialDate) && initialDate <= today ? initialDate : today,
  );
  const existing = entriesByDate.get(date);
  const [values, setValues] = useState<FormValues>(() => toForm(existing?.metrics));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [naukri, setNaukri] = useState<NaukriChecks>(existing?.naukri ?? emptyNaukriChecks());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setValues(toForm(existing?.metrics));
    setNotes(existing?.notes ?? "");
    setNaukri(existing?.naukri ?? emptyNaukriChecks());
    setDirty(false);
    setError(null);
    // reset only when switching to a different saved row or date
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.id]);

  const fieldErrors = useMemo(
    () =>
      Object.fromEntries(metricKeys.map((key) => [key, validateField(values[key])])) as Record<
        MetricKey,
        string | null
      >,
    [values],
  );
  const dateError = !isValidISODate(date)
    ? "Enter a valid date."
    : date > today
      ? "You can't log a future date."
      : null;
  const hasErrors = !!dateError || metricKeys.some((key) => fieldErrors[key]);
  const metrics = Object.fromEntries(
    metricKeys.map((key) => [key, Number(values[key]) || 0]),
  ) as MetricValues;
  const derived = derive(metrics);

  const changeDate = (next: string) => {
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    setSaved(null);
    setDate(next);
    void navigate({ to: "/daily-entry", search: { date: next }, replace: true });
  };

  const update = (key: MetricKey, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(null);
  };

  const toggleNaukri = (profile: NaukriProfile, checked: boolean) => {
    setNaukri((current) => ({ ...current, [profile]: checked }));
    setDirty(true);
    setSaved(null);
  };

  const save = async () => {
    if (hasErrors || busy || readOnly) {
      if (hasErrors) setError(dateError ?? "Fix the highlighted fields before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveEntry({ date, notes: notes.trim(), metrics, naukri }, existing?.id);
      setDirty(false);
      setSaved(existing ? "Changes saved." : "Entry saved.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing || !window.confirm(`Delete the entry for ${formatLongDate(date)}?`)) return;
    setBusy(true);
    try {
      await deleteEntry(existing.id);
      setSaved("Entry deleted.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void save();
    }
  };

  const weekStart = startOfWeek(date);
  const recent = [...entries].reverse().slice(0, 10);

  return (
    <div className="space-y-5" onKeyDown={onKeyDown}>
      <DemoReadOnlyNotice what="log your own days" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-sm"
            aria-label="Previous day"
            onClick={() => changeDate(addDays(date, -1))}
          >
            <ChevronLeft />
          </Button>
          <input
            type="date"
            aria-label="Entry date"
            max={today}
            value={date}
            onChange={(event) => event.target.value && changeDate(event.target.value)}
            className={`${inputClass} w-[160px]`}
          />
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-sm"
            aria-label="Next day"
            disabled={date >= today}
            onClick={() => changeDate(addDays(date, 1))}
          >
            <ChevronRight />
          </Button>
          {date !== today && (
            <Button variant="ghost" size="sm" onClick={() => changeDate(today)}>
              Today
            </Button>
          )}
        </div>
        <div className="flex gap-1" aria-label="This week">
          {Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)).map((day) => (
            <button
              key={day}
              type="button"
              disabled={day > today}
              onClick={() => changeDate(day)}
              className={`flex w-10 flex-col items-center border py-1 text-[10px] disabled:opacity-30 ${day === date ? "border-teal bg-teal/10" : "border-rule"}`}
            >
              <span className="font-mono text-muted-foreground">
                {formatShortDate(day).slice(4)}
              </span>
              <i
                className={`mt-0.5 size-1.5 rounded-full ${entriesByDate.has(day) ? "bg-teal" : "bg-rule"}`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-display text-lg tracking-wide">{formatLongDate(date)}</span>
        <span
          className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase ${existing ? "border-amber/50 text-amber" : "border-teal/40 text-teal"}`}
        >
          {existing ? "Editing saved entry" : "New entry"}
        </span>
        {dirty && (
          <span className="font-mono text-[10px] text-muted-foreground">unsaved changes</span>
        )}
      </div>
      {dateError && (
        <p role="alert" className="text-xs text-coral">
          {dateError}
        </p>
      )}

      <Panel title="Naukri" eyebrow={`Applied today · ${naukriDone(naukri)}/3`}>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {naukriProfiles.map((profile) => (
            <label
              key={profile.key}
              htmlFor={`naukri-${profile.key}`}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <Checkbox
                id={`naukri-${profile.key}`}
                checked={naukri[profile.key]}
                disabled={readOnly}
                onCheckedChange={(checked) => toggleNaukri(profile.key, checked === true)}
              />
              {profile.label}
            </label>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        {metricGroups.map((group) => (
          <Panel key={group.id} title={group.title} eyebrow={group.subtitle}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {group.metrics.map((metric) => (
                <MetricInput
                  key={metric.key}
                  id={`metric-${metric.key}`}
                  label={metric.label}
                  value={values[metric.key]}
                  error={fieldErrors[metric.key]}
                  disabled={readOnly}
                  onChange={(value) => update(metric.key, value)}
                />
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <Panel title="Notes" eyebrow="Optional">
        <textarea
          aria-label="Notes"
          disabled={readOnly}
          value={notes}
          maxLength={1000}
          onChange={(event) => {
            setNotes(event.target.value);
            setDirty(true);
          }}
          placeholder="e.g. Applied to 3 backend roles via referrals, Spring Boot screen with Acme went well"
          className="min-h-20 w-full border border-input bg-background p-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </Panel>

      <div className="sticky bottom-16 z-10 flex flex-wrap items-center justify-between gap-3 border border-rule bg-card/95 p-3 backdrop-blur md:bottom-0">
        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <KindBadge kind="calculated" />
          <span>{derived.effortTotal} effort actions</span>
          <span>{derived.responses} responses</span>
          <span>{derived.profileViews} profile views</span>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <FormError message={error} />
          {saved && (
            <span role="status" className="text-xs text-teal">
              {saved}
            </span>
          )}
          {existing && !readOnly && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={remove}
              className="text-coral"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
          <Button
            disabled={busy || readOnly}
            onClick={save}
            className="rounded-sm bg-ink px-5 text-paper hover:bg-ink/90"
            title="Ctrl+Enter"
          >
            {busy ? "Saving…" : existing ? "Save changes" : "Save entry"}
          </Button>
        </div>
      </div>

      <Panel title="Recent entries" kind="actual">
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <div className="divide-y divide-rule/60">
            {recent.map((entry) => {
              const totals = derive(entry.metrics);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => changeDate(entry.date)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left text-sm hover:text-primary"
                >
                  <span>{formatLongDate(entry.date)}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {totals.applications} apps · {totals.outreach} outreach · {totals.responses}{" "}
                    responses · {totals.interviews} interviews · {totals.profileViews} views ·
                    Naukri {naukriDone(entry.naukri)}/3
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          {metricLabels.applications} and every other field default to 0. One entry per date —
          picking a logged date edits it.
        </p>
      </Panel>
    </div>
  );
}
