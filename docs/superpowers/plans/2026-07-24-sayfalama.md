# Numaralı Sayfalama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sorular ve Kullanıcılar listelerine, boş sayfaya gitmeyi önleyen numaralı (ellipsis'li) sayfalama eklemek.

**Architecture:** `components/ui/pagination.tsx` (shadcn) primitifleri üstüne kurulu, saf sunum bileşeni `DataPagination`. `page/totalCount/pageSize` alır, `onPageChange(page)` ile geri bildirir. İki liste sayfası bileşeni `onPageChange={(p) => setQueryParam("page", String(p))}` ile bağlar. Bileşen router'dan bağımsız.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, shadcn/ui (Base UI 1.6.0), TanStack Query.

**Spec:** `docs/superpowers/specs/2026-07-24-sayfalama-design.md`

## Global Constraints

- **Test framework YOK.** Doğrulama = `npx tsc --noEmit` + `npm run lint` temiz (+ kullanıcının tarayıcı kontrolü). TDD "failing test" adımı yerine tsc/lint kullanılır.
- Commit mesajları sade Türkçe, **Co-Authored-By İMZASI YOK**.
- `pageSize` her iki listede de **20** (istekte kullanılan değerle aynı).
- Bilinen tek lint uyarısı `questions/[id]/page.tsx:105` `form.watch` (dokunma). Yeni hata çıkmamalı.

---

### Task 1: DataPagination bileşeni

**Files:**
- Create: `components/shared/DataPagination.tsx`

**Interfaces:**
- Produces: `export function DataPagination(props: { page: number; totalCount: number; pageSize: number; onPageChange: (page: number) => void }): JSX.Element | null`
- Consumes: `components/ui/pagination.tsx` export'ları (`Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationEllipsis`, `PaginationPrevious`, `PaginationNext`).

- [ ] **Step 1: Bileşeni yaz**

`components/shared/DataPagination.tsx`:

```tsx
"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface DataPaginationProps {
  page: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

// Ellipsis'li pencereleme: totalPages <= 7 → hepsi; aksi halde {1, page-1, page, page+1, totalPages}.
// Ardışık olmayan iki numara arasına "ellipsis" konur.
function buildPages(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const nums = new Set<number>([1, totalPages]);
  for (let p = page - 1; p <= page + 1; p++) {
    if (p >= 1 && p <= totalPages) nums.add(p);
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("ellipsis");
    out.push(n);
    prev = n;
  }
  return out;
}

export function DataPagination({ page, totalCount, pageSize, onPageChange }: DataPaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(page, 1), totalPages);
  const pages = buildPages(current, totalPages);
  const disabledCls = "pointer-events-none opacity-50";

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text="Önceki"
            aria-disabled={current <= 1}
            className={current <= 1 ? disabledCls : "cursor-pointer"}
            onClick={() => current > 1 && onPageChange(current - 1)}
          />
        </PaginationItem>

        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <PaginationItem key={`e${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                isActive={p === current}
                className="cursor-pointer"
                onClick={() => onPageChange(p)}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          )
        )}

        <PaginationItem>
          <PaginationNext
            text="Sonraki"
            aria-disabled={current >= totalPages}
            className={current >= totalPages ? disabledCls : "cursor-pointer"}
            onClick={() => current < totalPages && onPageChange(current + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint components/shared/DataPagination.tsx`
Expected: tsc exit 0; eslint çıktısı boş, exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/shared/DataPagination.tsx
git commit -m "feat: numaralı sayfalama bileşeni (DataPagination)"
```

---

### Task 2: questions + users listelerine bağla

**Files:**
- Modify: `app/(admin)/questions/page.tsx:187-190`
- Modify: `app/(admin)/users/page.tsx:131-134`

**Interfaces:**
- Consumes: `DataPagination` (Task 1). Her iki sayfada da `page` (number), `data` (PagedResult, `data.totalCount` içerir), ve `setQueryParam(key, value)` zaten mevcut.

- [ ] **Step 1: questions/page.tsx — import ekle**

Dosyanın üst kısmındaki import bloğuna ekle:

```tsx
import { DataPagination } from "@/components/shared/DataPagination";
```

- [ ] **Step 2: questions/page.tsx — eski buton bloğunu değiştir**

Şu blok (187-190):

```tsx
      <div className="flex justify-end gap-2">
        {page > 1 && <Button variant="outline" size="sm" onClick={() => setQueryParam("page", String(page - 1))}>← Önceki</Button>}
        {data && data.items.length === 20 && <Button variant="outline" size="sm" onClick={() => setQueryParam("page", String(page + 1))}>Sonraki →</Button>}
      </div>
```

şununla değişir:

```tsx
      {data && (
        <DataPagination
          page={page}
          totalCount={data.totalCount}
          pageSize={20}
          onPageChange={(p) => setQueryParam("page", String(p))}
        />
      )}
```

- [ ] **Step 3: users/page.tsx — import ekle**

```tsx
import { DataPagination } from "@/components/shared/DataPagination";
```

- [ ] **Step 4: users/page.tsx — eski buton bloğunu değiştir**

Şu blok (131-134):

```tsx
      <div className="flex justify-end gap-2">
        {page > 1 && <Button variant="outline" size="sm" onClick={() => setQueryParam("page", String(page - 1))}>← Önceki</Button>}
        {data && data.items.length === 20 && <Button variant="outline" size="sm" onClick={() => setQueryParam("page", String(page + 1))}>Sonraki →</Button>}
      </div>
```

şununla değişir:

```tsx
      {data && (
        <DataPagination
          page={page}
          totalCount={data.totalCount}
          pageSize={20}
          onPageChange={(p) => setQueryParam("page", String(p))}
        />
      )}
```

- [ ] **Step 5: Kullanılmayan `Button` importunu kontrol et**

Her iki dosyada `Button` başka yerde de kullanılıyor mu bak (`grep -n "<Button" app/(admin)/questions/page.tsx app/(admin)/users/page.tsx`). Kullanılıyorsa import kalır; artık hiç kullanılmıyorsa import satırından `Button`'ı çıkar (aksi halde `no-unused-vars` lint hatası).

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc exit 0; lint 0 error (yalnızca bilinen `questions/[id]/page.tsx:105` `form.watch` warning kalabilir).

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)/questions/page.tsx" "app/(admin)/users/page.tsx"
git commit -m "feat: questions ve users listelerine numaralı sayfalama bağlandı"
```

---

## Tarayıcı doğrulaması (uygulama sonrası, kullanıcı)

Dev server (localhost:3000) + backend (5213) ayakta. >20 kayıtlı bir listede:
1. Numaralar + aktif vurgu görünüyor.
2. 1. sayfada **Önceki** pasif; son sayfada **Sonraki** pasif (boş sayfaya gidilemiyor).
3. Tek sayfalık sonuçta (≤20 öğe) sayfalama **hiç görünmüyor**.
4. Bir numaraya/Sonraki'ye tıklayınca doğru sayfa yükleniyor, URL `?page=N` güncelleniyor.
5. Filtre/arama değişince sayfa 1'e dönüyor (mevcut `setQueryParam` davranışı korunuyor).
