import { Settings } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SettingsLink() {
  return (
    <Link href="/settings" aria-label="Settings" className={buttonVariants({ variant: "ghost", size: "icon" })}>
      <Settings />
    </Link>
  );
}
