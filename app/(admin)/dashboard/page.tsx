"use client";
import { useDashboardStats } from "@/lib/hooks/useDashboardStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function DashboardPage() {
  const { data, isLoading } = useDashboardStats();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Toplam Kullanıcı</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{data?.totalUsers ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Aktif Soru</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{data?.activeQuestions ?? 0}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Günlük Aktif</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{data?.dailyActiveUsers ?? 0}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Son 7 Günlük Cevaplar</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.dailyAnswers ?? []}>
              <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), "d MMM", { locale: tr })} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
