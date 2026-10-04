import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "@/components/pages/analytics-page";

export const Route = createFileRoute("/_workspace/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Job Search Analytics" },
      {
        name: "description",
        content: "Conversion-rate trends, funnel drop-off, channel detail and full history.",
      },
    ],
  }),
  component: AnalyticsPage,
});
