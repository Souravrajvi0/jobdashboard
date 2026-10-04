import { createFileRoute } from "@tanstack/react-router";
import { CompaniesPage } from "@/components/pages/companies-page";

export const Route = createFileRoute("/_workspace/companies")({
  head: () => ({
    meta: [
      { title: "Companies — Job Search Analytics" },
      { name: "description", content: "Target companies, contacts, referrals and follow-ups." },
    ],
  }),
  component: CompaniesPage,
});
