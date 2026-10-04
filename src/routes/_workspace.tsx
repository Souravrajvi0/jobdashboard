import { createFileRoute, Outlet } from "@tanstack/react-router";
import { JobSearchProvider } from "@/lib/job-search-context";
import { fetchJobSearchData } from "@/lib/job-search-api";
import { WorkspaceLayout } from "@/components/job-search-ui";

export const Route = createFileRoute("/_workspace")({
  loader: () => fetchJobSearchData(),
  staleTime: 30_000,
  component: Workspace,
});

function Workspace() {
  const data = Route.useLoaderData();
  return (
    <JobSearchProvider initialData={data}>
      <WorkspaceLayout>
        <Outlet />
      </WorkspaceLayout>
    </JobSearchProvider>
  );
}
