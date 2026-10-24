"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SIDEBAR_STORAGE_KEY = "hireme-sidebar";

/** Runs before first paint (see app/layout.tsx) so a hidden sidebar never flashes open. */
export const sidebarInitScript = `(function(){try{if(localStorage.getItem("${SIDEBAR_STORAGE_KEY}")==="hidden")document.documentElement.dataset.sidebar="hidden"}catch(e){}})()`;

function toggleSidebar() {
  const root = document.documentElement;
  const hide = root.dataset.sidebar !== "hidden";
  if (hide) root.dataset.sidebar = "hidden";
  else delete root.dataset.sidebar;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, hide ? "hidden" : "shown");
  } catch {}
}

/** Sits in the sidebar header and hides the sidebar. */
export function SidebarCollapseButton() {
  return (
    <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Hide sidebar" title="Hide sidebar">
      <PanelLeftClose />
    </Button>
  );
}

/** Floats at the top-left only while the sidebar is hidden (desktop), to bring it back. */
export function SidebarExpandButton() {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      aria-label="Show sidebar"
      title="Show sidebar"
      className="fixed top-3 left-3 z-40 hidden border border-border bg-bg/85 backdrop-blur-xl [[data-sidebar=hidden]_&]:lg:inline-flex"
    >
      <PanelLeftOpen />
    </Button>
  );
}
