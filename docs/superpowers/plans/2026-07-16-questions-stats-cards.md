# Sorular Sayfası İstatistik Kartları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/questions` sayfasının üstüne onaylı/bekleyen soru sayıları ve konu bazlı dağılımı gösteren istatistik kartları eklemek.

**Architecture:** Mevcut `GET /admin/stats` endpoint'ini kullanan `useDashboardStats()` React Query hook'u yeniden kullanılır; yeni bir client bileşeni (`QuestionStats`) sayfa başlığının altına yerleştirilir. Sayı kartlarına tıklamak sayfanın mevcut URL-tabanlı durum filtresini günceller.

**Tech Stack:** Next.js 16 App Router (client component), React Query (`@tanstack/react-query`), shadcn/ui `Card` + `Skeleton`, Tailwind CSS.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-questions-stats-cards-design.md`
- Backend değişikliği yok; yalnızca mevcut `/admin/stats` verisi kullanılır.
- UI metinleri Türkçe: "Onaylı", "Bekleyen", "Konu Dağılımı", "Veri yok".
- İstatistik isteği hata verirse kart bloğu tamamen gizlenir (tablo etkilenmez).
- Projede test framework'ü yok; doğrulama = `npm run lint` + `npx tsc --noEmit` + çalışan uygulamada görsel kontrol.
- AGENTS.md gereği: koda dokunmadan önce `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` kontrol edildi — `"use client"` deseni bu sürümde geçerli, mevcut sayfa deseni izlenecek.

---

### Task 1: QuestionStats bileşeni + sayfaya entegrasyon

**Files:**
- Create: `app/(admin)/questions/_components/QuestionStats.tsx`
- Modify: `app/(admin)/questions/page.tsx` (import bloğu + başlık altına render, ~satır 4-18 ve 93-97 civarı)

**Interfaces:**
- Consumes: `useDashboardStats()` from `@/lib/hooks/useDashboardStats` — döner: `{ data?: AdminStats, isLoading: boolean, isError: boolean }`; `AdminStats.activeQuestions: number`, `AdminStats.pendingReview: number`, `AdminStats.categoryDistribution: { categoryName: string; count: number }[]` (bkz. `lib/types.ts:45-52`).
- Produces: `QuestionStats({ onStatusFilter }: { onStatusFilter: (status: string) => void })` — named export; `onStatusFilter` `"Active"` veya `"PendingReview"` ile çağrılır.

- [ ] **Step 1: Bileşeni oluştur**

`app/(admin)/questions/_components/QuestionStats.tsx`:

```tsx
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
```

- [ ] **Step 2: Sayfaya entegre et**

`app/(admin)/questions/page.tsx` içinde:

Import bloğuna (satır 8 `ImportSheet` import'unun altına) ekle:

```tsx
import { QuestionStats } from "./_components/QuestionStats";
```

Başlık `div`'inin kapanışından hemen sonra, durum filtresi `div`'inin üstüne ekle (mevcut satır 96-98 arası):

```tsx
      <QuestionStats onStatusFilter={(s) => setQueryParam("status", s)} />
```

Sonuç şu sırada olmalı: başlık satırı → `<QuestionStats …/>` → durum `Select` satırı.

- [ ] **Step 3: Lint ve tip kontrolü**

Run: `npm run lint && npx tsc --noEmit`
Expected: her ikisi de hatasız (exit 0).

- [ ] **Step 4: Çalışan uygulamada doğrula**

Dev server zaten `http://localhost:3000`'de çalışıyor (yoksa `npm run dev`). Tarayıcıda `/questions` açılır:
- Üstte 2 sayı kartı + Konu Dağılımı kartı görünür, sayılar dashboard'dakilerle tutarlı.
- "Onaylı" kartına tıklayınca URL `?status=Active` olur ve tablo filtrelenir; "Bekleyen" kartı `?status=PendingReview` yapar.
- Yüklenme anında skeleton'lar görünür (network throttle ile veya sayfa ilk açılışında).

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/questions/_components/QuestionStats.tsx" "app/(admin)/questions/page.tsx"
git commit -m "feat: sorular sayfasına istatistik kartları — onaylı/bekleyen sayısı, konu dağılımı"
```
