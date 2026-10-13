"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useDashboardStats } from "@/lib/hooks/useDashboardStats";
import { useReports } from "@/lib/hooks/useReports";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data } = useDashboardStats();
  const { data: reports } = useReports();
  const pendingCount = data?.pendingReview ?? 0;
  const reportCount = reports?.length ?? 0;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar pendingCount={pendingCount} reportCount={reportCount} />
      <div className="flex flex-1 flex-col">
        <Header pendingCount={pendingCount} reportCount={reportCount} />
        <main className="flex-1 bg-gray-50 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
