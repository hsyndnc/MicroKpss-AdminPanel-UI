"use client";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { navItems } from "./SidebarNav";
import { MobileNav } from "./MobileNav";

export function Header({ pendingCount = 0, reportCount = 0 }: { pendingCount?: number; reportCount?: number }) {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const title = navItems.find((item) => pathname.startsWith(item.href))?.label;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 lg:px-6">
      <MobileNav pendingCount={pendingCount} reportCount={reportCount} />
      {title && <span className="font-semibold lg:hidden">{title}</span>}
      <span className="ml-auto hidden text-sm text-gray-600 sm:inline">{user?.email}</span>
    </header>
  );
}
