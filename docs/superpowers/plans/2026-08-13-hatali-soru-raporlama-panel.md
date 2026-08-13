# Hatalı Soru Raporlama — Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panele, otomatik gizlenen (`FlaggedForReview`) soruları rapor sayısı/sebep dökümü/notlarla listeleyen ve Onayla / Reddet / Yoksay eylemleri sunan bir `/reports` sayfası eklemek.

**Architecture:** Mevcut catch-all proxy (`app/api/backend/[...path]/route.ts`) yeni admin endpoint'lerini otomatik geçirir — proxy işi YOK. Yeni bir `lib/api/reports.ts` modülü + `lib/hooks/useReports.ts` React Query query hook'u eklenir. Sayfa, `sources/page.tsx` desenini izler: query hook ile liste, mutasyonlar için doğrudan api çağrısı + `refetch()`. Düzelt/Reddet için mevcut `questions.ts` fonksiyonları (`approveQuestion`, `rejectQuestion`) yeniden kullanılır; Yoksay için yeni `dismissReport`.

**Tech Stack:** Next.js (App Router, bu repo sürümü — AGENTS.md uyarısına bak), TypeScript, TanStack React Query, axios (`apiClient`), Tailwind + shadcn/ui bileşenleri, sonner (toast), lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-12-hatali-soru-raporlama-panel-design.md`

## Global Constraints

- **Next.js bu repo sürümü training data'dan farklı olabilir.** Yeni kalıp icat etme; her dosya mevcut çalışan eşdeğerini birebir taklit etsin (sayfa deseni = `app/(admin)/sources/page.tsx`; api modülü = `lib/api/questions.ts`; hook = `lib/hooks/useSources.ts`). Yeni bir Next API'sine ihtiyaç doğarsa önce `node_modules/next/dist/docs/` içindeki ilgili kılavuzu oku.
- **API sözleşmesi (backend spec'i kaynak):** `GET /admin/reports` → `ReportedQuestion[]`; `POST /admin/reports/{questionId}/dismiss` → 200/204. Enum'lar JSON'da **string**. Tüm çağrılar `apiClient` (baseURL `/api/backend/api/v1`) üzerinden.
- **`ReportedQuestion` alan adları** (backend yanıtına birebir): `questionId`, `body`, `categoryName?`, `status`, `reportCount`, `reasonBreakdown: Record<string, number>`, `notes: string[]`.
- **Sebep Türkçe etiketleri (değişmez):** WrongAnswer=Yanlış cevap, Typo=Yazım, Nonsense=Anlamsız, Inappropriate=Uygunsuz, Other=Diğer.
- **Panelde otomatik test yok.** Her task'ın doğrulama kapısı `npx tsc --noEmit`. Son task ek olarak `npm run lint` + `npm run build` temiz + manuel akış.
- **Commit YOK — kullanıcı onayı beklenir.** Her task değişikliği commit'e hazır bırakır ama otomatik commit atmaz; tüm commit'ler son task'ta, kullanıcı onayından sonra. Commit mesajlarına **Co-Authored-By EKLEME** (kullanıcı tercihi).

---

### Task 1: Tipler + StatusBadge (`FlaggedForReview` durumu + `ReportedQuestion`)

**Files:**
- Modify: `lib/types.ts:3` (`ContentStatus`), sonuna yeni tipler
- Modify: `components/shared/StatusBadge.tsx:4-9` (exhaustive `Record<ContentStatus,…>` — yeni durum ZORUNLU entry)

**Interfaces:**
- Produces: `ContentStatus` (artık `"FlaggedForReview"` içerir), `ReportReason` union, `ReportedQuestion` interface — Task 2, 4 bunlara dayanır.

- [ ] **Step 1: `ContentStatus`'a `FlaggedForReview` ekle**

`lib/types.ts:3` satırını değiştir:

```ts
export type ContentStatus = "PendingReview" | "Active" | "Rejected" | "Archived" | "FlaggedForReview";
```

- [ ] **Step 2: `ReportReason` + `ReportedQuestion` tiplerini ekle**

`lib/types.ts` dosyasının sonuna ekle:

```ts
export type ReportReason = "WrongAnswer" | "Typo" | "Nonsense" | "Inappropriate" | "Other";

export interface ReportedQuestion {
  questionId: string;
  body: string;
  categoryName?: string;
  status: ContentStatus;
  reportCount: number;
  reasonBreakdown: Record<string, number>;
  notes: string[];
}
```

- [ ] **Step 3: `StatusBadge` config'ine `FlaggedForReview` entry ekle**

`components/shared/StatusBadge.tsx` içindeki `config` objesine (`Archived` satırından sonra) ekle — yoksa `Record<ContentStatus,…>` derleme hatası verir:

```ts
  FlaggedForReview: { label: "İncelemede", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
```

- [ ] **Step 4: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: PASS (hata yok). Özellikle `StatusBadge.tsx`'te "Property 'FlaggedForReview' is missing" hatası GÖRÜNMEMELİ.

---

### Task 2: API modülü `lib/api/reports.ts`

**Files:**
- Create: `lib/api/reports.ts`

**Interfaces:**
- Consumes: `apiClient` (`lib/api/client.ts`), `ReportedQuestion` (Task 1)
- Produces: `listReports(): Promise<ReportedQuestion[]>`, `dismissReport(questionId: string): Promise<void>` — Task 3 ve Task 4 kullanır.

- [ ] **Step 1: Modülü oluştur**

`lib/api/reports.ts` (`questions.ts` desenini birebir izler):

```ts
import { apiClient } from "./client";
import type { ReportedQuestion } from "@/lib/types";

export async function listReports(): Promise<ReportedQuestion[]> {
  const { data } = await apiClient.get<ReportedQuestion[]>("/admin/reports");
  return data;
}

export async function dismissReport(questionId: string): Promise<void> {
  await apiClient.post(`/admin/reports/${questionId}/dismiss`);
}
```

- [ ] **Step 2: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: PASS.

---

### Task 3: Query hook `lib/hooks/useReports.ts`

**Files:**
- Create: `lib/hooks/useReports.ts`

**Interfaces:**
- Consumes: `listReports` (Task 2)
- Produces: `useReports()` → `useQuery` sonucu (`data: ReportedQuestion[] | undefined`, `isLoading`, `isError`, `refetch`). queryKey: `["admin-reports"]`. Task 4 kullanır.

- [ ] **Step 1: Hook'u oluştur**

`lib/hooks/useReports.ts` (`useSources.ts` desenini birebir izler):

```ts
import { useQuery } from "@tanstack/react-query";
import { listReports } from "@/lib/api/reports";

export function useReports() {
  return useQuery({ queryKey: ["admin-reports"], queryFn: listReports });
}
```

- [ ] **Step 2: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: PASS.

---

### Task 4: Rapor sayfası `app/(admin)/reports/page.tsx`

**Files:**
- Create: `app/(admin)/reports/page.tsx`

**Interfaces:**
- Consumes: `useReports` (Task 3), `dismissReport` (Task 2), `approveQuestion`/`rejectQuestion` (`lib/api/questions.ts` — mevcut), `ReportReason` (Task 1), `RejectDialog` (`components/shared/RejectDialog.tsx` — `onConfirm(reason)`/`onCancel`/`loading` props), `ConfirmDialog` (`components/shared/ConfirmDialog.tsx` — `open/title/description/confirmLabel/onConfirm/onCancel` props), `Table*`, `Badge`, `Button`, `Skeleton`, `toast`.

- [ ] **Step 1: Sayfayı oluştur**

`app/(admin)/reports/page.tsx` (default export sayfa, `sources/page.tsx` deseni: query hook + isLoading/isError/empty durumları; mutasyon = doğrudan api çağrısı + `refetch()`):

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RejectDialog } from "@/components/shared/RejectDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useReports } from "@/lib/hooks/useReports";
import { dismissReport } from "@/lib/api/reports";
import { approveQuestion, rejectQuestion } from "@/lib/api/questions";
import type { ReportReason } from "@/lib/types";

const REASON_LABELS: Record<ReportReason, string> = {
  WrongAnswer: "Yanlış cevap",
  Typo: "Yazım",
  Nonsense: "Anlamsız",
  Inappropriate: "Uygunsuz",
  Other: "Diğer",
};

export default function ReportsPage() {
  const router = useRouter();
  const { data: reports = [], isLoading, isError, refetch } = useReports();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [dismissTarget, setDismissTarget] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggleNotes(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function handleApprove(id: string) {
    setBusy(true);
    try {
      await approveQuestion(id);
      toast.success("Soru onaylandı, rapor kapandı.");
      await refetch();
    } catch {
      toast.error("Onaylama başarısız.");
    } finally { setBusy(false); }
  }

  async function handleReject(id: string, reason: string) {
    setBusy(true);
    try {
      await rejectQuestion(id, reason);
      setRejectTarget(null);
      toast.error("Soru reddedildi.");
      await refetch();
    } catch {
      toast.error("Reddetme başarısız.");
    } finally { setBusy(false); }
  }

  async function handleDismiss(id: string) {
    setBusy(true);
    try {
      await dismissReport(id);
      setDismissTarget(null);
      toast.success("Rapor yoksayıldı, soru tekrar yayında.");
      await refetch();
    } catch {
      toast.error("Yoksayma başarısız.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Raporlar</h1>
        <p className="text-gray-500 text-sm">
          Kullanıcı raporları eşiği aşınca otomatik gizlenen sorular. Düzelt, reddet ya da raporu yoksay.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : isError ? (
        <div className="space-y-3">
          <p className="text-red-600 text-sm">Raporlar yüklenemedi — backend&apos;e ulaşılamıyor.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tekrar dene</Button>
        </div>
      ) : reports.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">İncelenecek rapor yok.</p>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Soru</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-center">Rapor</TableHead>
                <TableHead>Sebepler</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.questionId} className="align-top">
                  <TableCell className="max-w-md">
                    <button
                      className="text-left hover:underline line-clamp-2"
                      onClick={() => router.push(`/questions/${r.questionId}`)}
                    >
                      {r.body}
                    </button>
                    {r.notes.length > 0 && (
                      <button
                        className="mt-1 block text-xs text-blue-600"
                        onClick={() => toggleNotes(r.questionId)}
                      >
                        {expanded.has(r.questionId) ? "Notları gizle" : `${r.notes.length} not`}
                      </button>
                    )}
                    {expanded.has(r.questionId) && (
                      <ul className="mt-2 space-y-1 text-xs text-gray-600 list-disc pl-4">
                        {r.notes.map((n, i) => <li key={i}>{n}</li>)}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{r.categoryName ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="destructive">{r.reportCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(r.reasonBreakdown).map(([reason, count]) => (
                        <Badge key={reason} variant="secondary" className="text-xs">
                          {(REASON_LABELS[reason as ReportReason] ?? reason)} · {count}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="outline" className="text-green-700 border-green-300"
                            disabled={busy} onClick={() => handleApprove(r.questionId)}>
                      Onayla
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-700 border-red-300"
                            disabled={busy} onClick={() => setRejectTarget(r.questionId)}>
                      Reddet
                    </Button>
                    <Button size="sm" variant="ghost"
                            disabled={busy} onClick={() => setDismissTarget(r.questionId)}>
                      Yoksay
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RejectDialog
        open={!!rejectTarget}
        onConfirm={(reason) => rejectTarget && handleReject(rejectTarget, reason)}
        onCancel={() => setRejectTarget(null)}
        loading={busy}
      />

      <ConfirmDialog
        open={!!dismissTarget}
        title="Raporu yoksay"
        description="Bu sorunun açık raporları kapatılacak ve soru tekrar yayına alınacak. Emin misin?"
        confirmLabel="Yoksay"
        onConfirm={() => dismissTarget && handleDismiss(dismissTarget)}
        onCancel={() => setDismissTarget(null)}
      />
    </div>
  );
}
```

Notlar:
- **Düzelt/Onayla:** soru gövdesine tıklama `/questions/{id}` detay/düzenleme sayfasına götürür (mevcut düzenle akışı orada). Hızlı yol için ayrıca doğrudan **Onayla** butonu (`approveQuestion`).
- **Reddet:** mevcut `RejectDialog` → `rejectQuestion(id, reason)`.
- **Yoksay:** `ConfirmDialog` onayı → `dismissReport(id)`.
- Her eylemden sonra `refetch()` ile liste tazelenir (çözülen/kapanan satır düşer).

- [ ] **Step 2: Tip kontrolü + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS (kullanılmayan import / `'` kaçırma uyarısı olmamalı).

---

### Task 5: Sidebar'a "Raporlar" linki

**Files:**
- Modify: `components/layout/Sidebar.tsx:4` (lucide import), `components/layout/Sidebar.tsx:11-20` (`navItems`)

- [ ] **Step 1: `Flag` ikonunu import et**

`components/layout/Sidebar.tsx:4` — lucide-react import listesine `Flag` ekle:

```ts
import { LayoutDashboard, FileText, FolderOpen, Users, Calendar, Upload, Scale, LogOut, Library, Flag } from "lucide-react";
```

- [ ] **Step 2: Nav item ekle**

`navItems` dizisinde `/questions` satırından hemen sonra ekle:

```ts
  { href: "/reports", label: "Raporlar", icon: Flag },
```

- [ ] **Step 3: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: PASS.

---

### Task 6: Uçtan uca doğrulama + commit (kullanıcı onayı sonrası)

**Files:** yok (doğrulama + commit)

- [ ] **Step 1: Tam build + lint**

Run: `npm run lint && npm run build`
Expected: İkisi de temiz (hata yok). Build `/reports` route'unu üretmeli.

- [ ] **Step 2: Manuel akış (backend lokal ayaktayken)**

Backend `GET /admin/reports` + `POST /admin/reports/{id}/dismiss` canlıyken:
1. `/reports` sayfasını aç → FlaggedForReview sorular listeleniyor; her satırda rapor sayısı rozeti + sebep çipleri (Türkçe) + "N not" açılır.
2. **Onayla** → toast yeşil, satır listeden düşer.
3. **Reddet** → dialog'da sebep → toast, satır düşer.
4. **Yoksay** → onay dialog'u → toast, satır düşer (soru Active'e döner; mobilde geri gelmeli).
5. Boş durum: rapor yokken "İncelenecek rapor yok." görünür.
6. Backend kapalıyken: "Raporlar yüklenemedi" + "Tekrar dene".
7. Sidebar'da "Raporlar" linki görünür ve aktifken vurgulanır.

- [ ] **Step 3: Kullanıcı onayını al, sonra commit et**

Kullanıcıya diff'i özetle ve onay iste. Onay gelince (Co-Authored-By EKLEMEDEN):

```bash
git add lib/types.ts components/shared/StatusBadge.tsx lib/api/reports.ts \
        lib/hooks/useReports.ts "app/(admin)/reports/page.tsx" components/layout/Sidebar.tsx
git commit -m "feat: hatalı soru raporlama paneli (/reports) — liste + onayla/reddet/yoksay"
```

---

## Self-Review

**Spec coverage:**
- `lib/types.ts` (`FlaggedForReview` + `ReportedQuestion`) → Task 1 ✅
- `lib/api/reports.ts` (`listReports`, `dismissReport`) → Task 2 ✅
- `app/(admin)/reports/page.tsx` (liste + rapor sayısı + sebep dökümü + notlar + Düzelt/Onayla/Reddet/Yoksay) → Task 4 ✅
- Sidebar "Raporlar" linki → Task 5 ✅
- Mevcut `approveQuestion`/`rejectQuestion` yeniden kullanımı → Task 4 ✅
- Test/doğrulama (build+lint+manuel) → Task 6 ✅
- Kapsam dışı (rapor başına ekran, kullanıcı listeleme, gerçek zamanlı) → dahil edilmedi ✅
- Opsiyonel "N rapor rozeti /questions listesinde" → spec "ilk sürümde YAPMA" dedi → dahil edilmedi ✅

**Ek zorunlu değişiklik (spec'te ima, planda yakalandı):** `StatusBadge`'in exhaustive `Record<ContentStatus,…>`'u yeni durum için entry gerektiriyor → Task 1 Step 3.

**Placeholder taraması:** Yok — tüm kod blokları tam.

**Tip tutarlılığı:** `ReportedQuestion` alanları (`questionId`, `body`, `categoryName?`, `reportCount`, `reasonBreakdown`, `notes`) Task 1'de tanımlandığı gibi Task 4'te kullanılıyor. `listReports`/`dismissReport`/`useReports` imzaları tasklar arası tutarlı. `REASON_LABELS` `Record<ReportReason,string>`; bilinmeyen sebep için `?? reason` fallback var.

**Sözleşme riski (executor'a not):** `ReportedQuestion` alan adları backend `GET /admin/reports` yanıtına dayanır; backend farklı adlandırırsa (ör. `id` vs `questionId`) Task 1 tipini ve Task 4 erişimlerini backend spec'ine göre hizala.
