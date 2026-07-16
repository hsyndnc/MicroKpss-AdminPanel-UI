"use client";
import { useDashboardStats } from "@/lib/hooks/useDashboardStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface QuestionStatsProps {
  onStatusFilter: (status: string) => void;
}

export function QuestionStats({ onStatusFilter }: QuestionStatsProps) {
  const { data, isLoading, isError } = useDashboardStats();

  if (isError) return null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg sm:col-span-2" />
      </div>
    );
  }

  const distribution = [...(data?.categoryDistribution ?? [])].sort((a, b) => b.count - a.count);
  const topCategories = distribution.slice(0, 6);
  const remainingCount = distribution.length - topCategories.length;
  const maxCount = topCategories[0]?.count ?? 1;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        className="border-green-300 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onStatusFilter("Active")}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-green-700">Onaylı</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-green-600">{(data?.activeQuestions ?? 0).toLocaleString("tr-TR")}</p>
        </CardContent>
      </Card>
      <Card
        className="border-yellow-300 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onStatusFilter("PendingReview")}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-yellow-700">Bekleyen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-yellow-600">{(data?.pendingReview ?? 0).toLocaleString("tr-TR")}</p>
        </CardContent>
      </Card>
      <Card className="sm:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">Konu Dağılımı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {topCategories.map((c) => (
              <div key={c.categoryName} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-gray-700">{c.categoryName}</span>
                  <span className="font-semibold tabular-nums">{c.count.toLocaleString("tr-TR")}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${Math.max((c.count / maxCount) * 100, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {remainingCount > 0 && (
            <p className="mt-3 text-xs text-gray-400">+{remainingCount} konu daha</p>
          )}
          {topCategories.length === 0 && <p className="text-sm text-gray-400">Veri yok</p>}
        </CardContent>
      </Card>
    </div>
  );
}
