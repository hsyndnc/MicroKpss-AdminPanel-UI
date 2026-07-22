"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, FolderOpen, Users, Calendar, Upload, Scale, LogOut, Library } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/authStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/questions", label: "Sorular", icon: FileText },
  { href: "/categories", label: "Kategoriler", icon: FolderOpen },
  { href: "/users", label: "Kullanıcılar", icon: Users },
  { href: "/exam-dates", label: "Sınav Tarihleri", icon: Calendar },
  { href: "/content", label: "İçerik Üretimi", icon: Upload },
  { href: "/sources", label: "Kaynaklar", icon: Library },
  { href: "/legal", label: "Yasal Metinler", icon: Scale },
];

export function Sidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  function handleLogout() {
    clearAuth();
    localStorage.removeItem("token");
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <aside className="w-64 bg-white border-r h-screen flex flex-col shrink-0">
      <div className="p-6 border-b">
        <h1 className="font-bold text-lg">KPSS Admin</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {href === "/questions" && pendingCount > 0 && (
              <Badge variant="destructive" className="ml-auto text-xs px-1.5">
                {pendingCount}
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
    </aside>
  );
}
