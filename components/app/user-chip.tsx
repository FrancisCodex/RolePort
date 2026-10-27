import { getCurrentUser } from "@/lib/session";

export function Avatar({ name, image, className = "size-7" }: { name: string; image: string | null; className?: string }) {
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
    <span className={`${className} grid place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-fg`}>
      {initials || "?"}
    </span>
  );
}

export async function UserChip() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-2.5 rounded-md p-1.5">
      <Avatar name={user.name} image={user.image} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{user.name || "You"}</p>
        <p className="truncate text-[11px] text-subtle">Self-hosted · no sign-in</p>
      </div>
    </div>
  );
}

/** The lite edition has no accounts and no server-side user: say where the data lives instead. */
export function LiteUserChip() {
  return (
    <div className="flex items-center gap-2.5 rounded-md p-1.5">
      <Avatar name="" image={null} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">You</p>
        <p className="truncate text-[11px] text-subtle">Lite · saved in this browser</p>
      </div>
    </div>
  );
}

export function UserChipSkeleton() {
  return (
    <div className="flex items-center gap-2.5 p-1.5">
      <span className="size-7 animate-pulse rounded-full bg-surface-3" />
      <span className="h-3 flex-1 animate-pulse rounded-full bg-surface-3" />
    </div>
  );
}
