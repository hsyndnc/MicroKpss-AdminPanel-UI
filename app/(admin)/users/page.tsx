"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUsers } from "@/lib/hooks/useUsers";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataPagination } from "@/components/shared/DataPagination";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserDetailSheet } from "./_components/UserDetailSheet";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { AdminUser } from "@/lib/types";

const roleLabel: Record<string, string> = { Standard: "Standart", Premium: "Premium", Admin: "Admin" };
const roleColor: Record<string, string> = {
  Standard: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  Premium:  "bg-purple-100 text-purple-700 hover:bg-purple-100",
  Admin:    "bg-blue-100 text-blue-700 hover:bg-blue-100",
};
const kpssLabel: Record<string, string> = { Lisans: "Lisans", Onlisans: "Önlisans", Ortaogretim: "Ortaöğretim" };

const ROLE_OPTIONS = [
  { value: "all", label: "Tüm Roller" },
  { value: "Standard", label: "Standart" },
  { value: "Premium", label: "Premium" },
  { value: "Admin", label: "Admin" },
];
const KPSS_OPTIONS = [
  { value: "all", label: "Tüm KPSS Türleri" },
  { value: "Lisans", label: "Lisans" },
  { value: "Onlisans", label: "Önlisans" },
  { value: "Ortaogretim", label: "Ortaöğretim" },
];

function UsersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "all";
  const kpssType = searchParams.get("kpssType") ?? "all";

  const [searchInput, setSearchInput] = useState(search);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const { data, isLoading } = useUsers({
    page,
    search: search || undefined,
    role: role === "all" ? undefined : role,
    kpssType: kpssType === "all" ? undefined : kpssType,
  });

  function setQueryParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") { params.set(key, value); } else { params.delete(key); }
    if (key !== "page") params.set("page", "1");
    router.push(`/users?${params.toString()}`);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) setQueryParam("search", searchInput);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Kullanıcılar</h1>
      <p className="text-sm text-gray-500">Toplam: {data?.totalCount ?? "—"}</p>

      <div className="flex items-center gap-3">
        <Input
          placeholder="E-posta ara..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-64"
        />
        <Select value={role} items={ROLE_OPTIONS} onValueChange={(v) => v && setQueryParam("role", v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kpssType} items={KPSS_OPTIONS} onValueChange={(v) => v && setQueryParam("kpssType", v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {KPSS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı Adı</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>KPSS Türü</TableHead>
                <TableHead>Kayıt Tarihi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((u) => (
                <TableRow key={u.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedUser(u)}>
                  <TableCell className="font-medium">{u.username || "—"}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge className={roleColor[u.role]}>{roleLabel[u.role]}</Badge></TableCell>
                  <TableCell className="text-gray-600">{u.kpssType ? kpssLabel[u.kpssType] ?? u.kpssType : "—"}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {format(new Date(u.createdAt), "d MMM yyyy", { locale: tr })}
                  </TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-400">Kullanıcı bulunamadı</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {data && (
        <DataPagination
          page={page}
          totalCount={data.totalCount}
          pageSize={20}
          onPageChange={(p) => setQueryParam("page", String(p))}
        />
      )}

      <UserDetailSheet user={selectedUser} onClose={() => setSelectedUser(null)} />
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
