import { isLocalMode } from "@/lib/env";
import { getCurrentUser } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export function Avatar({ name, image, className = "size-9" }: { name: string; image: string | null; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote avatar from the auth provider
    <img src={image} alt="" className={`${className} rounded-full object-cover`} />
  ) : (
    <span className={`${className} grid place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink`}>
      {initials || "?"}
    </span>
  );
}

export async function UserChip() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-3 rounded-2xl p-2">
      <Avatar name={user.name} image={user.image} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{user.name || "You"}</p>
        <p className="truncate text-xs text-muted">{isLocalMode ? "Local mode · no sign-in" : user.email}</p>
      </div>
      {!isLocalMode && <SignOutButton />}
    </div>
  );
}

/** The lite edition has no accounts and no server-side user: say where the data lives instead. */
export function LiteUserChip() {
  return (
    <div className="flex items-center gap-3 rounded-2xl p-2">
      <Avatar name="" image={null} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">You</p>
        <p className="truncate text-xs text-muted">Lite · saved in this browser</p>
      </div>
    </div>
  );
}

export function UserChipSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2">
      <span className="size-9 animate-pulse rounded-full bg-surface-3" />
      <span className="h-3 flex-1 animate-pulse rounded-full bg-surface-3" />
    </div>
  );
}
