import { Briefcase } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage() {
  return (
    <>
      <PageHeader title="Jobs" description="Roles across the Philippines, ranked by how well they fit you." />
      <EmptyState
        icon={Briefcase}
        title="Your matches will show up here"
        body="Once your profile is set up, we'll search job boards and score every role on skills, experience, culture, career fit and location."
        phase="Coming in Phase 2"
      />
    </>
  );
}
