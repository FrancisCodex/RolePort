"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  CornerDownLeft,
  Download,
  FileUp,
  KanbanSquare,
  Moon,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { toggleTheme } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { GitHubMark, REPO_URL } from "./setup-guide";

type Command = { id: string; group: string; label: string; icon: LucideIcon | typeof GitHubMark; hint?: string; run: (go: (href: string) => void) => void };

const COMMANDS: Command[] = [
  { id: "open", group: "Jump into HireMe", label: "Open HireMe", icon: ArrowRight, hint: "Dashboard", run: (go) => go("/home") },
  { id: "search", group: "Jump into HireMe", label: "Search jobs", icon: Search, hint: "At home or abroad", run: (go) => go("/jobs") },
  { id: "cv", group: "Jump into HireMe", label: "Import your CV", icon: FileUp, hint: "Profile", run: (go) => go("/profile") },
  { id: "pipeline", group: "Jump into HireMe", label: "Open your pipeline", icon: KanbanSquare, run: (go) => go("/pipeline") },
  { id: "ai", group: "Jump into HireMe", label: "Set up your AI provider", icon: Sparkles, hint: "Settings", run: (go) => go("/settings") },
  { id: "guide", group: "Jump into HireMe", label: "Run the setup guide", icon: Compass, run: (go) => go("/welcome") },
  { id: "how", group: "On this page", label: "How it works", icon: BookOpen, run: (go) => go("/#how") },
  { id: "features", group: "On this page", label: "Try the features", icon: Settings, run: (go) => go("/#features") },
  { id: "install", group: "On this page", label: "Install on your computer", icon: Download, run: (go) => go("/#get-started") },
  { id: "theme", group: "General", label: "Toggle dark mode", icon: Moon, run: () => toggleTheme() },
  { id: "github", group: "General", label: "View the source on GitHub", icon: GitHubMark, run: () => window.open(REPO_URL, "_blank", "noopener") },
];

const subscribeNothing = () => () => {};
/** "⌘" on Apple devices, "Ctrl" elsewhere; "⌘" during server rendering. */
function useModKey() {
  return useSyncExternalStore(
    subscribeNothing,
    () => (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "⌘",
  );
}

/** Opens the command menu from anywhere on the page: dispatched by the hero's hint and the CTA. */
export const OPEN_COMMAND_MENU = "hireme:open-command-menu";

/**
 * Raycast-style command menu for the landing page: ⌘K / Ctrl+K (or the nav button) opens it,
 * typing filters, arrow keys move, Enter runs.
 */
export function CommandMenu() {
  const router = useRouter();
  const mod = useModKey();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_MENU, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_MENU, onOpen);
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COMMANDS.filter((c) => `${c.label} ${c.hint ?? ""} ${c.group}`.toLowerCase().includes(q)) : COMMANDS;
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  function run(cmd: Command | undefined) {
    if (!cmd) return;
    close();
    cmd.run((href) => router.push(href));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 items-center gap-2 rounded-md border border-border bg-surface pr-1.5 pl-2.5 text-[13px] text-subtle shadow-[var(--shadow-soft)] transition-colors hover:border-border-strong hover:text-muted sm:flex"
      >
        <Search className="size-3.5" />
        <span className="w-24 text-left">Jump to…</span>
        <Kbd>{mod}K</Kbd>
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
                <motion.div
                  aria-hidden
                  className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={close}
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Command menu"
                  initial={{ opacity: 0, scale: 0.97, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
                  className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lift)]"
                >
                  <div className="flex items-center gap-2.5 border-b border-border px-4">
                    <Search className="size-4 shrink-0 text-subtle" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setActive(0);
                      }}
                      onKeyDown={onKeyDown}
                      placeholder="Type a command or search…"
                      aria-label="Search commands"
                      aria-controls="command-list"
                      aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
                      className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
                    />
                    <Kbd>Esc</Kbd>
                  </div>
                  <ul ref={listRef} id="command-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
                    {results.map((cmd, i) => {
                      const header = i === 0 || results[i - 1].group !== cmd.group;
                      return (
                        <li key={cmd.id} role="presentation">
                          {header && <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-subtle">{cmd.group}</p>}
                          <div
                            id={`cmd-${cmd.id}`}
                            role="option"
                            aria-selected={i === active}
                            data-index={i}
                            onPointerMove={() => i !== active && setActive(i)}
                            onClick={() => run(cmd)}
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px]",
                              i === active ? "bg-surface-2 text-fg" : "text-muted",
                            )}
                          >
                            <cmd.icon className={cn("size-4 shrink-0", i === active ? "text-brand" : "text-subtle")} />
                            <span className="flex-1">{cmd.label}</span>
                            {cmd.hint && <span className="text-[11px] text-subtle">{cmd.hint}</span>}
                            {i === active && <CornerDownLeft className="size-3.5 text-subtle" />}
                          </div>
                        </li>
                      );
                    })}
                    {results.length === 0 && <li className="px-3 py-8 text-center text-[13px] text-subtle">No results for “{query}”</li>}
                  </ul>
                  <div className="flex items-center gap-3 border-t border-border bg-sidebar px-4 py-2 text-[11px] text-subtle">
                    <span className="flex items-center gap-1">
                      <Kbd>↑</Kbd>
                      <Kbd>↓</Kbd> to move
                    </span>
                    <span className="flex items-center gap-1">
                      <Kbd>↵</Kbd> to open
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      <Kbd>{mod}K</Kbd> anywhere
                    </span>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/** "Press ⌘K" hint for the hero and the CTA; clicking it opens the menu too. */
export function CommandHint({ className }: { className?: string }) {
  const mod = useModKey();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_MENU))}
      className={cn("inline-flex items-center gap-1.5 text-[13px] text-subtle transition-colors hover:text-fg", className)}
    >
      Press <Kbd>{mod}K</Kbd> to jump anywhere
    </button>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1 font-sans text-[10px] font-medium text-muted shadow-[0_1px_0_var(--border)]">
      {children}
    </kbd>
  );
}
