# Kullanıcılar: Arama/Filtre + Detay Drawer — Frontend Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/users` sayfasına e-posta araması + rol/KPSS türü filtreleri ve satıra tıklayınca açılan, istatistik + rol değiştirme içeren detay drawer'ı eklemek.

**Architecture:** Filtreler URL query paramlarında yaşar (sorular sayfası deseni). Drawer temel bilgileri satır verisinden anında gösterir; istatistikleri `GET /admin/users/{id}`'den tamamlar — backend hazır değilse istatistik bölümü hata durumuna düşer, sayfa bozulmaz. Rol değişikliği `PUT /admin/users/{id}/role`.

**Tech Stack:** Next.js 16 (App Router, client component'ler), React Query, shadcn/ui (Sheet, Select, Input), axios (`lib/api/client`), sonner toast.

**Spec:** `docs/superpowers/specs/2026-07-18-users-search-detail-design.md`

## Global Constraints

- Test framework'ü YOK. Her task'in doğrulaması: `npx eslint <değişen dosyalar>` + `npx tsc --noEmit` temiz çıkacak; görsel kontrol kullanıcıya bırakılır (sayfalar login arkasında).
- Commit mesajları Türkçe, `feat:`/`fix:` önekli. **`Co-Authored-By` imzası EKLENMEZ** (kullanıcı tercihi).
- Backend paralel geliştiriliyor (`KpssSoru-backend/docs/2026-07-18-admin-users-search-detail-plan.md`). Frontend hiçbir task'te backend'in hazır olmasını BEKLEMEZ.
- Var olan desenlere uy: URL param yönetimi ve select yapısı `app/(admin)/questions/page.tsx`'teki gibi, Sheet kullanımı `app/(admin)/questions/_components/ImportSheet.tsx`'teki gibi.
- Rol/KPSS türü API değerleri enum adlarıdır (`Standard|Premium|Admin`, `Lisans|Onlisans|Ortaogretim`); UI etiketleri Türkçe.

---

### Task 1: Tipler + API katmanı

**Files:**
- Modify: `lib/types.ts` (AdminUser interface'inin yakınına ekle)
- Modify: `lib/api/users.ts` (tamamen aşağıdaki hale getir)

**Interfaces:**
- Produces: `AdminUserDetail` tipi; `getAdminUsers(params: GetUsersParams)`, `getAdminUserById(id)`, `updateUserRole(id, role)` fonksiyonları. Task 2'deki hook'lar bunları çağırır.

- [ ] **Step 1: `lib/types.ts`'e detay tipini ekle**

`AdminUser` interface'inin hemen altına:

```ts
export interface AdminUserDetail {
  id: string;
  email: string;
  role: string;
  kpssType: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  solvedCount: number;
  correctCount: number;
}
```

- [ ] **Step 2: `lib/api/users.ts`'i genişlet**

Dosyanın tam yeni içeriği:

```ts
import { apiClient } from "./client";
import type { AdminUser, AdminUserDetail, PagedResult } from "@/lib/types";

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  kpssType?: string;
}

export async function getAdminUsers(params: GetUsersParams = {}): Promise<PagedResult<AdminUser>> {
  const { page = 1, pageSize = 20, search, role, kpssType } = params;
  const { data } = await apiClient.get<PagedResult<AdminUser>>("/admin/users", {
    params: {
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(role ? { role } : {}),
      ...(kpssType ? { kpssType } : {}),
    },
  });
  return data;
}

export async function getAdminUserById(id: string): Promise<AdminUserDetail> {
  const { data } = await apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
  return data;
}

export async function updateUserRole(id: string, role: string): Promise<void> {
  await apiClient.put(`/admin/users/${id}/role`, { role });
}
```

- [ ] **Step 3: Doğrula**

Run: `npx eslint lib/types.ts lib/api/users.ts && npx tsc --noEmit`
Expected: hata yok (uyarı kabul; mevcut `form.watch` uyarısı bilinen durum).

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/api/users.ts
git commit -m "feat: kullanıcı API katmanına arama parametreleri, detay ve rol güncelleme çağrıları"
```

---

### Task 2: Hook'lar

**Files:**
- Modify: `lib/hooks/useUsers.ts` (tamamen aşağıdaki hale getir)

**Interfaces:**
- Consumes: Task 1'deki `getAdminUsers`, `getAdminUserById`, `updateUserRole`, `GetUsersParams`.
- Produces: `useUsers(params: GetUsersParams)`, `useUserDetail(id: string | null)`, `useUpdateUserRole()` — Task 3-5'teki sayfa/bileşen bunları kullanır. Query anahtarları: `["admin-users", params]`, `["admin-user", id]`.

- [ ] **Step 1: `lib/hooks/useUsers.ts`'i yeniden yaz**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminUsers, getAdminUserById, updateUserRole, type GetUsersParams } from "@/lib/api/users";

export function useUsers(params: GetUsersParams = {}) {
  return useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => getAdminUsers(params),
  });
}

export function useUserDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => getAdminUserById(id!),
    enabled: !!id,
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateUserRole(id, role),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", id] });
    },
  });
}
```

Not: `useUsers`'ın tek çağrıcısı `app/(admin)/users/page.tsx`; imza değişti, o dosya Task 3'te güncellenene kadar `tsc` HATA VERİR — Task 3'le birlikte tek commit ATMA, bunun yerine bu task'in doğrulamasını Task 3 sonunda yap. (`useUsers(page)` çağrısı `useUsers({ page })` olacak.)

- [ ] **Step 2: Commit'i erteleme kararı**

Bu task Task 3 ile birlikte commit'lenir (tsc ancak o zaman temiz olur). Devam et.

---

### Task 3: Liste araç çubuğu (arama + filtreler)

**Files:**
- Modify: `app/(admin)/users/page.tsx`

**Interfaces:**
- Consumes: Task 2'deki `useUsers({ page, search, role, kpssType })`.
- Produces: URL şeması `?search=&role=&kpssType=&page=` — drawer task'leri aynı sayfada çalışacak.

- [ ] **Step 1: `UsersContent`'i araç çubuğuyla yeniden yaz**

`app/(admin)/users/page.tsx` dosyasının tam yeni içeriği:

```tsx
"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUsers } from "@/lib/hooks/useUsers";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

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
        <Select value={role} onValueChange={(v) => v && setQueryParam("role", v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kpssType} onValueChange={(v) => v && setQueryParam("kpssType", v)}>
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
                  <TableCell className="text-gray-600">{u.kpssType ? kpssLabel[u.kpssType] ?? u.kpssType : "—"}</TableCell>
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
        {page > 1 && <Button variant="outline" size="sm" onClick={() => setQueryParam("page", String(page - 1))}>← Önceki</Button>}
        {data && data.items.length === 20 && <Button variant="outline" size="sm" onClick={() => setQueryParam("page", String(page + 1))}>Sonraki →</Button>}
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
```

- [ ] **Step 2: Doğrula**

Run: `npx eslint lib/hooks/useUsers.ts "app/(admin)/users/page.tsx" && npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 3: Görsel kontrol notu**

Dev server zaten çalışıyorsa `/users`'ı aç: arama kutusuna yazınca ~400ms sonra URL'e `?search=` düşmeli, select'ler URL'i güncellemeli. Backend arama paramlarını henüz desteklemiyorsa liste filtrelenmeden döner — bu beklenen durumdur, hata değildir.

- [ ] **Step 4: Commit (Task 2 + 3 birlikte)**

```bash
git add lib/hooks/useUsers.ts "app/(admin)/users/page.tsx"
git commit -m "feat: kullanıcılar listesine e-posta araması, rol ve KPSS türü filtreleri"
```

---

### Task 4: UserDetailSheet — temel bilgiler + istatistikler

**Files:**
- Create: `app/(admin)/users/_components/UserDetailSheet.tsx`
- Modify: `app/(admin)/users/page.tsx` (satır tıklaması + sheet render)

**Interfaces:**
- Consumes: Task 2'deki `useUserDetail(id)`; `AdminUser` tipi (satır verisi prop'u).
- Produces: `<UserDetailSheet user={AdminUser | null} onClose={() => void} />` — Task 5 bu bileşene rol bölümünü ekler.

- [ ] **Step 1: Bileşeni oluştur**

`app/(admin)/users/_components/UserDetailSheet.tsx`:

```tsx
"use client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserDetail } from "@/lib/hooks/useUsers";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { AdminUser } from "@/lib/types";

const roleLabel: Record<string, string> = { Standard: "Standart", Premium: "Premium", Admin: "Admin" };
const kpssLabel: Record<string, string> = { Lisans: "Lisans", Onlisans: "Önlisans", Ortaogretim: "Ortaöğretim" };

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function UserDetailSheet({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const { data: detail, isLoading, isError } = useUserDetail(user?.id ?? null);

  const accuracy =
    detail && detail.solvedCount > 0
      ? `%${Math.round((detail.correctCount / detail.solvedCount) * 100)}`
      : "—";

  return (
    <Sheet open={!!user} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] sm:max-w-[400px]">
        {user && (
          <>
            <SheetHeader>
              <SheetTitle className="break-all">{user.email}</SheetTitle>
              <div className="flex gap-2">
                <Badge variant="secondary">{roleLabel[user.role] ?? user.role}</Badge>
                {user.kpssType && <Badge variant="outline">{kpssLabel[user.kpssType] ?? user.kpssType}</Badge>}
              </div>
            </SheetHeader>

            <div className="mt-4 divide-y px-1">
              <InfoRow
                label="Kayıt tarihi"
                value={format(new Date(user.createdAt), "d MMM yyyy", { locale: tr })}
              />
              {isLoading ? (
                <div className="space-y-2 py-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5" />)}
                </div>
              ) : isError ? (
                <p className="py-3 text-sm text-gray-400">İstatistikler yüklenemedi.</p>
              ) : detail ? (
                <>
                  <InfoRow
                    label="Son giriş"
                    value={detail.lastLoginAt
                      ? format(new Date(detail.lastLoginAt), "d MMM yyyy HH:mm", { locale: tr })
                      : "—"}
                  />
                  <InfoRow label="Çözülen soru" value={detail.solvedCount} />
                  <InfoRow label="Doğruluk oranı" value={accuracy} />
                </>
              ) : null}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Sayfaya bağla**

`app/(admin)/users/page.tsx` içinde:

1. Import'lara ekle:
```tsx
import { UserDetailSheet } from "./_components/UserDetailSheet";
import type { AdminUser } from "@/lib/types";
```
2. `UsersContent` içine state ekle (mevcut `const [searchInput...]` satırının altına):
```tsx
const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
```
3. Tablo satırını tıklanabilir yap — mevcut `<TableRow key={u.id}>` şu hale gelir:
```tsx
<TableRow key={u.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedUser(u)}>
```
4. Sayfa kökündeki kapanış `</div>`'in hemen öncesine (pagination div'inden sonra) ekle:
```tsx
<UserDetailSheet user={selectedUser} onClose={() => setSelectedUser(null)} />
```

- [ ] **Step 3: Doğrula**

Run: `npx eslint "app/(admin)/users/page.tsx" "app/(admin)/users/_components/UserDetailSheet.tsx" && npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 4: Görsel kontrol notu**

Satıra tıkla → sağdan panel açılmalı; e-posta, rozetler ve kayıt tarihi anında görünmeli. Backend detay endpoint'i hazır değilse "İstatistikler yüklenemedi." yazmalı — sayfa bozulmamalı.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/users/page.tsx" "app/(admin)/users/_components/UserDetailSheet.tsx"
git commit -m "feat: kullanıcı detay drawer'ı — temel bilgiler ve istatistikler"
```

---

### Task 5: Drawer'a rol değiştirme bölümü

**Files:**
- Modify: `app/(admin)/users/_components/UserDetailSheet.tsx`

**Interfaces:**
- Consumes: Task 2'deki `useUpdateUserRole()`.

- [ ] **Step 1: Rol bölümünü ekle**

`UserDetailSheet.tsx`'te:

1. Import'lara ekle:
```tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserDetail, useUpdateUserRole } from "@/lib/hooks/useUsers";
import { toast } from "sonner";
```
(`useUserDetail` import satırı mevcut olanla birleşir.)

2. Bileşen gövdesine, `useUserDetail` satırının altına:
```tsx
const roleMutation = useUpdateUserRole();
const [pendingRole, setPendingRole] = useState<string>(user?.role ?? "Standard");

useEffect(() => {
  if (user) setPendingRole(user.role);
}, [user]);

function handleRoleSave() {
  if (!user) return;
  roleMutation.mutate(
    { id: user.id, role: pendingRole },
    {
      onSuccess: () => toast.success("Rol güncellendi."),
      onError: () => {
        setPendingRole(user.role);
        toast.error("Rol güncellenemedi.");
      },
    }
  );
}
```

3. JSX'te bilgi listesi `</div>`'inin (divide-y kapanışı) hemen ardına:
```tsx
<div className="mt-6 border-t pt-4 px-1 space-y-2">
  <p className="text-sm font-medium">Rol</p>
  <div className="flex gap-2">
    <Select value={pendingRole} onValueChange={(v) => v && setPendingRole(v)}>
      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="Standard">Standart</SelectItem>
        <SelectItem value="Premium">Premium</SelectItem>
        <SelectItem value="Admin">Admin</SelectItem>
      </SelectContent>
    </Select>
    <Button
      onClick={handleRoleSave}
      disabled={pendingRole === user.role || roleMutation.isPending}
    >
      {roleMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
    </Button>
  </div>
</div>
```

- [ ] **Step 2: Doğrula**

Run: `npx eslint "app/(admin)/users/_components/UserDetailSheet.tsx" && npx tsc --noEmit`
Expected: hata yok. (`react-hooks/set-state-in-effect` uyarısına dikkat: `useEffect` içindeki `setPendingRole` koşullu olduğu için lint hatası vermemeli; verirse effect yerine `key={user?.id}` ile bileşeni sıfırlama yaklaşımına geç: `Sheet` içeriğini `user.id` key'li bir alt bileşene taşı.)

- [ ] **Step 3: Görsel kontrol notu**

Rol select'inde farklı değer seç → Kaydet aktifleşmeli; mevcut değerde pasif. Backend endpoint'i hazır değilse Kaydet hata toast'ı göstermeli ve select eski değere dönmeli.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/users/_components/UserDetailSheet.tsx"
git commit -m "feat: kullanıcı drawer'ına rol değiştirme bölümü"
```

---

### Task 6: Son doğrulama

- [ ] **Step 1: Tam doğrulama**

Run: `npx eslint "app/(admin)/users" lib/api/users.ts lib/hooks/useUsers.ts lib/types.ts && npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 2: Kullanıcıya bildir**

Backend hazır olduğunda uçtan uca test edilecekler: arama/filtrelerin gerçekten filtrelemesi, istatistiklerin dolması, rol değişikliğinin listeye yansıması, admin'in kendi rolünü düşürmeye çalışınca hata toast'ı.
