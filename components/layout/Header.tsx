"use client";
import { useAuthStore } from "@/lib/store/authStore";

export function Header() {
  const user = useAuthStore((s) => s.user);
  return (
    <header className="h-14 border-b bg-white flex items-center px-6 shrink-0">
      <span className="ml-auto text-sm text-gray-600">{user?.email}</span>
    </header>
  );
}
