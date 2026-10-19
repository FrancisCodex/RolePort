import { Briefcase, Home, KanbanSquare, MessagesSquare, Settings, UserRound } from "lucide-react";

export const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/coach", label: "Coach", icon: MessagesSquare },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

/** Sidebar only; on mobile Settings lives in the header so the tab bar keeps five items. */
export const settingsItem = { href: "/settings", label: "Settings", icon: Settings } as const;
