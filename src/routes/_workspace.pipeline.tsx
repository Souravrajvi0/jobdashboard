import { createFileRoute } from "@tanstack/react-router";
import { PipelinePage } from "@/components/pages/pipeline-page";

export const Route = createFileRoute("/_workspace/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — Job Search Analytics" },
      {
        name: "description",
        content: "Track opportunities from discovered to offer across 11 stages.",
      },
    ],
  }),
  component: PipelinePage,
});
