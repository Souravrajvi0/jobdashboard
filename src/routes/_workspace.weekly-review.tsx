import { createFileRoute } from "@tanstack/react-router";
import { WeeklyReviewPage } from "@/components/pages/weekly-review-page";

export const Route = createFileRoute("/_workspace/weekly-review")({
  head: () => ({
    meta: [
      { title: "Weekly Review — Job Search Analytics" },
      {
        name: "description",
        content: "Weekly insights, potential bottlenecks, scorecard and week-over-week comparison.",
      },
    ],
  }),
  component: WeeklyReviewPage,
});
