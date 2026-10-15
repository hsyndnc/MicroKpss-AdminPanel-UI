"use client";
import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./SidebarNav";

export function Sidebar({ pendingCount = 0, reportCount = 0 }: { pendingCount?: number; reportCount?: number }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r bg-white transition-[width] duration-200 lg:flex lg:sticky lg:top-0 lg:h-dvh",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center gap-2 p-4 border-b">
        {!collapsed && <h1 className="flex-1 truncate font-bold text-lg">KPSS Admin</h1>}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0", collapsed && "mx-auto")}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <SidebarNav pendingCount={pendingCount} reportCount={reportCount} collapsed={collapsed} />
    </aside>
  );
}
