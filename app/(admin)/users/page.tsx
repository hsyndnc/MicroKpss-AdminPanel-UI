"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useUsers } from "@/lib/hooks/useUsers";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Suspense } from "react";

const roleLabel: Record<string, string> = { Standard: "Standart", Premium: "Premium", Admin: "Admin" };
const roleColor: Record<string, string> = {
  Standard: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  Premium:  "bg-purple-100 text-purple-700 hover:bg-purple-100",
  Admin:    "bg-blue-100 text-blue-700 hover:bg-blue-100",
};

function UsersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = Number(searchParams.get("page") ?? "1");
  const { data, isLoading } = useUsers(page);

  function setPage(p: number) {
    router.push(`/users?page=${p}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Kullanıcılar</h1>
      <p className="text-sm text-gray-500">Toplam: {data?.totalCount ?? "—"}</p>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-posta</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>KPSS Türü</TableHead>
                <TableHead>Kayıt Tarihi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge className={roleColor[u.role]}>{roleLabel[u.role]}</Badge></TableCell>
                  <TableCell className="text-gray-600">{u.kpssType ?? "—"}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {format(new Date(u.createdAt), "d MMM yyyy", { locale: tr })}
                  </TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-400">Kullanıcı bulunamadı</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {page > 1 && <Button variant="outline" size="sm" onClick={() => setPage(page - 1)}>← Önceki</Button>}
        {data && data.items.length === 20 && <Button variant="outline" size="sm" onClick={() => setPage(page + 1)}>Sonraki →</Button>}
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}>
      <UsersContent />
    </Suspense>
  );
}
