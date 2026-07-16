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
          <p className="text-3xl font-bold text-green-600">{data?.activeQuestions ?? 0}</p>
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
          <p className="text-3xl font-bold text-yellow-600">{data?.pendingReview ?? 0}</p>
        </CardContent>
      </Card>
      <Card className="sm:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-gray-600">Konu Dağılımı</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="max-h-20 overflow-y-auto space-y-1 pr-2">
            {distribution.map((c) => (
              <li key={c.categoryName} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 truncate">{c.categoryName}</span>
                <span className="font-semibold tabular-nums">{c.count}</span>
              </li>
            ))}
            {distribution.length === 0 && <li className="text-sm text-gray-400">Veri yok</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
