import { Briefcase, ClipboardCheck, Home, KanbanSquare, MessagesSquare, Settings, UserRound } from "lucide-react";

/** `tab: false` keeps an item out of the mobile tab bar, which has room for five. */
export const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/applied", label: "Applied", icon: ClipboardCheck },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/coach", label: "Coach", icon: MessagesSquare, tab: false },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

/** Sidebar only; on mobile Settings lives in the header so the tab bar keeps five items. */
export const settingsItem = { href: "/settings", label: "Settings", icon: Settings } as const;
