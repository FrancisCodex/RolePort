import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function CvHeader({ applicationId, role, company }: { applicationId: string; role: string; company: string }) {
  return (
    <>
      <Link href={`/applied/${applicationId}`} className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Back to the application
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Tailored CV</h1>
        <p className="mt-1 text-[13px] text-muted">
          For {role} at {company}
        </p>
      </div>
    </>
  );
}
