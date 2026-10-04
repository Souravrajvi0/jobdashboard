import { createFileRoute } from "@tanstack/react-router";
import { DailyEntryPage } from "@/components/pages/daily-entry-page";

export const Route = createFileRoute("/_workspace/daily-entry")({
  validateSearch: (search: Record<string, unknown>): { date?: string } => {
    const date = search["date"];
    return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {};
  },
  head: () => ({
    meta: [
      { title: "Daily Entry — Job Search Analytics" },
      {
        name: "description",
        content:
          "Log applications, outreach, recruiter conversations, interviews and profile views in under two minutes.",
      },
    ],
  }),
  component: DailyEntryRoute,
});

function DailyEntryRoute() {
  const { date } = Route.useSearch();
  return <DailyEntryPage key={date ?? "today"} initialDate={date} />;
}
