import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "@tanstack/react-router";
import * as api from "@/lib/job-search-api";
import {
  todayISO,
  type AppSettings,
  type Company,
  type CompanyInput,
  type DailyEntry,
  type DailyEntryInput,
  type Dataset,
  type DiagnosticSettings,
  type Opportunity,
  type OpportunityInput,
} from "@/lib/job-search-data";

export interface JobSearchData {
  settings: AppSettings;
  demoAvailable: boolean;
  entries: DailyEntry[];
  opportunities: Opportunity[];
  companies: Company[];
}

interface JobSearchContextValue extends JobSearchData {
  today: string;
  readOnly: boolean;
  entriesByDate: Map<string, DailyEntry>;
  saveEntry: (input: DailyEntryInput, id?: number) => Promise<DailyEntry>;
  deleteEntry: (id: number) => Promise<void>;
  saveOpportunity: (input: OpportunityInput, id?: number) => Promise<Opportunity>;
  deleteOpportunity: (id: number) => Promise<void>;
  saveCompany: (input: CompanyInput, id?: number) => Promise<Company>;
  deleteCompany: (id: number) => Promise<void>;
  setDataset: (dataset: Dataset) => Promise<void>;
  clearDemoData: () => Promise<void>;
  reloadDemoData: () => Promise<void>;
  saveDiagnostics: (settings: DiagnosticSettings) => Promise<void>;
}

const JobSearchContext = createContext<JobSearchContextValue | null>(null);

const byDate = (a: DailyEntry, b: DailyEntry) => a.date.localeCompare(b.date);
const upsert = <T extends { id: number }>(items: T[], item: T) =>
  items.some((existing) => existing.id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [item, ...items];

export function JobSearchProvider({
  initialData,
  children,
}: {
  initialData: JobSearchData;
  children: ReactNode;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [today, setToday] = useState(todayISO);

  useEffect(() => setData(initialData), [initialData]);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayISO()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    await router.invalidate();
  }, [router]);

  const saveEntry = useCallback(async (input: DailyEntryInput, id?: number) => {
    const saved = id
      ? await api.updateDailyEntry({ data: { ...input, id } })
      : await api.createDailyEntry({ data: input });
    setData((current) => ({
      ...current,
      entries: [...current.entries.filter((entry) => entry.id !== saved.id), saved].sort(byDate),
    }));
    return saved;
  }, []);

  const deleteEntry = useCallback(async (id: number) => {
    await api.deleteDailyEntry({ data: { id } });
    setData((current) => ({
      ...current,
      entries: current.entries.filter((entry) => entry.id !== id),
    }));
  }, []);

  const saveOpportunity = useCallback(async (input: OpportunityInput, id?: number) => {
    const saved = id
      ? await api.updateOpportunity({ data: { ...input, id } })
      : await api.createOpportunity({ data: input });
    setData((current) => ({ ...current, opportunities: upsert(current.opportunities, saved) }));
    return saved;
  }, []);

  const deleteOpportunity = useCallback(async (id: number) => {
    await api.deleteOpportunity({ data: { id } });
    setData((current) => ({
      ...current,
      opportunities: current.opportunities.filter((item) => item.id !== id),
    }));
  }, []);

  const saveCompany = useCallback(async (input: CompanyInput, id?: number) => {
    const saved = id
      ? await api.updateCompany({ data: { ...input, id } })
      : await api.createCompany({ data: input });
    setData((current) => ({ ...current, companies: upsert(current.companies, saved) }));
    return saved;
  }, []);

  const deleteCompany = useCallback(async (id: number) => {
    await api.deleteCompany({ data: { id } });
    setData((current) => ({
      ...current,
      companies: current.companies.filter((item) => item.id !== id),
    }));
  }, []);

  const setDataset = useCallback(
    async (dataset: Dataset) => {
      await api.setDataset({ data: { dataset } });
      await refresh();
    },
    [refresh],
  );

  const clearDemoData = useCallback(async () => {
    await api.clearDemoData();
    await refresh();
  }, [refresh]);

  const reloadDemoData = useCallback(async () => {
    await api.reloadDemoData();
    await refresh();
  }, [refresh]);

  const saveDiagnostics = useCallback(async (settings: DiagnosticSettings) => {
    const updated = await api.saveDiagnosticSettings({ data: settings });
    setData((current) => ({ ...current, settings: updated }));
  }, []);

  const value = useMemo(
    () => ({
      ...data,
      today,
      readOnly: data.settings.dataset === "demo",
      entriesByDate: new Map(data.entries.map((entry) => [entry.date, entry])),
      saveEntry,
      deleteEntry,
      saveOpportunity,
      deleteOpportunity,
      saveCompany,
      deleteCompany,
      setDataset,
      clearDemoData,
      reloadDemoData,
      saveDiagnostics,
    }),
    [
      data,
      today,
      saveEntry,
      deleteEntry,
      saveOpportunity,
      deleteOpportunity,
      saveCompany,
      deleteCompany,
      setDataset,
      clearDemoData,
      reloadDemoData,
      saveDiagnostics,
    ],
  );

  return <JobSearchContext.Provider value={value}>{children}</JobSearchContext.Provider>;
}

export function useJobSearch() {
  const context = useContext(JobSearchContext);
  if (!context) throw new Error("useJobSearch must be used inside JobSearchProvider");
  return context;
}
