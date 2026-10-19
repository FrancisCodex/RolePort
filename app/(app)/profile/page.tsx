import { FileUp, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/app/user-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="The better we know you, the better your matches." />
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardContent>
            <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-surface-3" />}>
              <Identity />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import your CV</CardTitle>
            <CardDescription>
              PDF or DOCX. We pull out your skills, experience, education and languages for you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border-strong px-6 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
                <FileUp className="size-5" />
              </span>
              <p className="text-sm text-muted">Drag your CV here, or</p>
              <Button variant="secondary" size="sm" disabled>
                Choose file
              </Button>
              <Badge tone="brand">Coming in Phase 2</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function Identity() {
  const user = await getCurrentUser();
  return (
    <div className="flex flex-col items-center text-center">
      <Avatar name={user.name} image={user.image} className="size-20 text-2xl" />
      <p className="mt-4 font-display text-xl font-semibold">{user.name}</p>
      <p className="text-sm text-muted">{user.email}</p>
      <p className="mt-3 flex items-center gap-1 text-sm text-subtle">
        <MapPin className="size-4" /> Add your city
      </p>
    </div>
  );
}
