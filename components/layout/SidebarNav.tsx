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
}: {
  pendingCount?: number;
  reportCount?: number;
  onNavigate?: () => void;
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
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {(badgeCount[href] ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-auto text-xs px-1.5">
                {badgeCount[href]}
              </Badge>
            )}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start gap-3 text-gray-600" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Çıkış Yap
        </Button>
      </div>
    </>
  );
}
