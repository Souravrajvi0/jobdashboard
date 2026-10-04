import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/pages/dashboard-page";

export const Route = createFileRoute("/_workspace/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Job Search Analytics" },
      {
        name: "description",
        content: "Effort, output and visibility pipelines for your job search.",
      },
    ],
  }),
  component: DashboardPage,
});
