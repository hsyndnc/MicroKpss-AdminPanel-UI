"use client";
import { useDashboardStats } from "@/lib/hooks/useDashboardStats";
import { useReports } from "@/lib/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function DashboardPage() {
  const { data, isLoading } = useDashboardStats();
  const { data: reports } = useReports();
  const router = useRouter();

  const reportedCount = reports?.length ?? 0;
  const categoryData = [...(data?.categoryDistribution ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          className="border-yellow-300 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/questions?status=PendingReview")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-700">Bekleyen Onay</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{data?.pendingReview ?? 0}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/questions?status=Active")}
        >
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Aktif Soru</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600">{data?.activeQuestions ?? 0}</p></CardContent>
        </Card>

        <Card
          className="border-red-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/questions?status=Rejected")}
        >
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">Reddedilen Soru</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-red-600">{data?.rejectedQuestions ?? 0}</p></CardContent>
        </Card>

        <Card
          className="border-orange-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/reports")}
        >
          <CardHeader className="pb-2"><CardTitle className="text-sm text-orange-700">Raporlanan Sorular</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-orange-600">{reportedCount}</p></CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/users")}
        >
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Toplam Kullanıcı</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{data?.totalUsers ?? 0}</p></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Günlük Aktif Kullanıcı</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{data?.dailyActiveUsers ?? 0}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Kategoriye Göre Soru Dağılımı</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">
                Kategori verisi yok
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="categoryName" width={130} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Son 7 Günlük Cevaplar</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.dailyAnswers ?? []}>
                <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "d MMM", { locale: tr })} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
