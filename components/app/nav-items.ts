import { Briefcase, Home, KanbanSquare, MessagesSquare, UserRound } from "lucide-react";

export const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/coach", label: "Coach", icon: MessagesSquare },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;
