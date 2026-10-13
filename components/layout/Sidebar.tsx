"use client";
import { SidebarNav } from "./SidebarNav";

export function Sidebar({ pendingCount = 0, reportCount = 0 }: { pendingCount?: number; reportCount?: number }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-white lg:flex lg:sticky lg:top-0 lg:h-dvh">
      <div className="p-6 border-b">
        <h1 className="font-bold text-lg">KPSS Admin</h1>
      </div>
      <SidebarNav pendingCount={pendingCount} reportCount={reportCount} />
    </aside>
  );
}
