"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, FolderOpen, Users, Calendar, Upload, Scale, LogOut, Library, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/authStore";
import { logout } from "@/lib/api/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/questions", label: "Sorular", icon: FileText },
  { href: "/reports", label: "Raporlar", icon: Flag },
  { href: "/categories", label: "Kategoriler", icon: FolderOpen },
  { href: "/users", label: "Kullanıcılar", icon: Users },
  { href: "/exam-dates", label: "Sınav Tarihleri", icon: Calendar },
  { href: "/content", label: "İçerik Üretimi", icon: Upload },
  { href: "/sources", label: "Kaynaklar", icon: Library },
  { href: "/legal", label: "Yasal Metinler", icon: Scale },
];

export function SidebarNav({
  pendingCount = 0,
  reportCount = 0,
  onNavigate,
  collapsed = false,
}: {
  pendingCount?: number;
  reportCount?: number;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const badgeCount: Record<string, number> = { "/questions": pendingCount, "/reports": reportCount };
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  async function handleLogout() {
    await logout();
    clearAuth();
    onNavigate?.();
    router.push("/login");
  }

  return (
    <>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
              collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
              pathname.startsWith(href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && label}
            {!collapsed && (badgeCount[href] ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-auto text-xs px-1.5">
                {badgeCount[href]}
              </Badge>
            )}
            {collapsed && (badgeCount[href] ?? 0) > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className={cn("text-gray-600", collapsed ? "w-full justify-center p-0" : "w-full justify-start gap-3")}
          onClick={handleLogout}
          title={collapsed ? "Çıkış Yap" : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Çıkış Yap"}
        </Button>
      </div>
    </>
  );
}
