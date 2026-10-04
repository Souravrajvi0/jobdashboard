import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/pages/settings-page";

export const Route = createFileRoute("/_workspace/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Job Search Analytics" },
      {
        name: "description",
        content: "Theme, dataset, demo data, diagnostic thresholds and CSV export.",
      },
    ],
  }),
  component: SettingsPage,
});
