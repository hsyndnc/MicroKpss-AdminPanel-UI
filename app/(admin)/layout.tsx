"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useDashboardStats } from "@/lib/hooks/useDashboardStats";
import { useReports } from "@/lib/hooks/useReports";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data } = useDashboardStats();
  const { data: reports } = useReports();
  return (
    <div className="flex h-screen">
      <Sidebar pendingCount={data?.pendingReview ?? 0} reportCount={reports?.length ?? 0} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}
