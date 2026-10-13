# Panel Mobil Uyum + UX Turu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three phone-critical flows (soru onay/red, rapor işleme, dashboard durum bakma) usable on a 390px screen with no horizontal scroll and no mis-taps, while leaving the 1280px desktop layout pixel-for-pixel unchanged.

**Architecture:** Keep every list as a `<table>` (user's explicit choice over a card-list redesign). Add a responsive shell (drawer nav + sticky header) above everything, then make each table's columns responsive via Tailwind `hidden sm:/md:/lg:table-cell` on existing cells (no column reordering needed — hiding the right columns already leaves the right ones visible in DOM order), freeze the first column with `sticky left-0`, and collapse row actions into icon-first buttons that hit a 44px touch target below `md`.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19.2.4, Tailwind CSS v4, shadcn/ui (base-ui primitives) + `lucide-react`, TanStack Query, Recharts.

**Spec:** `docs/superpowers/specs/2026-10-13-panel-mobil-uyum-ux-design.md` (commit `8f1b047`) — read it alongside this plan; this plan implements it section by section (§4→Tasks 1-2, §5→Tasks 3-5/7-9, §6→Tasks 6/10).

## Global Constraints

- Tailwind breakpoints are the project default: `sm` 640px, `md` 768px, `lg` 1024px. Every responsive class below uses these three only.
- Touch targets for icon-only mobile buttons are 44px: `h-11 w-11 p-0` below `md`, reverting to the existing `size="sm"` look (`md:h-8 md:w-auto md:px-3`) at `md` and above.
- **No test runner exists in this repo** (confirmed, not re-litigated). Every task's verification is: `npx tsc --noEmit` (0 errors) → `npm run lint` (no new errors beyond the existing baseline of 0 errors / 3 warnings) → `npm run build` (succeeds) → a manual browser check at **390px / 768px / 1280px**. Start the dev server with `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill && npm run dev`. Task steps below say "Verify" where the plan template would normally say "write/run test" — this is that adaptation, not a skipped step.
- Acceptance bar (spec §1): at 390px the three mandatory flows — question approve/reject, report handling, dashboard status check — complete with no horizontal scroll and no accidental taps; at 1280px the desktop layout must look exactly as it did before this work.
- `cn()` in `lib/utils.ts` wraps `tailwind-merge`. A later conflicting utility in a `className` prop overrides an earlier one from the same utility group (e.g. a `className="h-11"` passed into `<Button size="sm">` overrides that size's own `h-7`). Every Button override below relies on this — don't hand-roll conditional class strings instead.
- Out of scope (spec §7) — do not touch: card-list redesign, a separate mobile review queue, the page-title/empty-state "consistency tour", mobile layout for Yasal Metinler / İçerik Üretimi / Sınav Tarihleri, dark mode, column-preference persistence, virtualization, adding a test runner.
- The branch also carries an **unrelated, uncommitted change** in `app/(admin)/legal/page.tsx` (a `ReferenceHint` box from a different work item). Never `git add` that file from any commit in this plan — stage exact paths, never `git add -A`.
- AGENTS.md requires reading the relevant guide under `node_modules/next/dist/docs/` before writing Next-specific code. This plan only touches client components, existing shadcn primitives, and Tailwind classes already used elsewhere in the repo — no new Next API. It was already confirmed during spec research that Next prints `<meta viewport>` by default (`01-app/01-getting-started/14-metadata-and-og-images.md`, "Default fields"), so `app/layout.tsx` needs no change.

## Review Focus

1. **Mobile logout reachability** — Task 1 makes the desktop `Sidebar` `hidden lg:flex`, so Task 2's drawer becomes the *only* way to reach "Çıkış Yap" on a phone. Verify tapping it inside `MobileNav` actually clears auth and redirects to `/login` (not just that the button is visible).
2. **Sticky-column background correctness** — the frozen first column (`bg-inherit`) must visually track the row's hover/selected background while the table is scrolled horizontally; a plain unset background would let scrolled-under cells show through the sticky one. Verified in Tasks 3, 5, 7, 8, 9.
3. **Badge-count regression** — `pendingCount`/`reportCount` must reach both the desktop sidebar and the mobile drawer with matching numbers after Task 2 re-routes them through `Header`. A silent prop-drilling mistake here would show "0" badges with no visible error.
4. **Keyboard access to row navigation** — the old whole-row `onClick` was never keyboard-reachable. The new `<button type="button">` wrapping the first cell (Tasks 3, 7, 8) must be reachable by Tab and activate on Enter/Space — the spec requires this explicitly ("klavyeyle de erişilebilir").
5. **`useMediaQuery` hydration mismatch** — Task 10's hook returns `false` on the server and on first client render by design (SSR-safe). Verify the browser console shows no hydration-mismatch warning at 390px, and that the dashboard chart doesn't visibly "pop" from a wide to a narrow layout right after mount.

---

## Task 1: `SidebarNav` extraction + desktop `Sidebar` refactor

**Files:**
- Create: `components/layout/SidebarNav.tsx`
- Modify: `components/layout/Sidebar.tsx` (full rewrite, currently 71 lines)

**Interfaces:**
- Produces: `navItems` (exported array of `{ href, label, icon }>`), `SidebarNav({ pendingCount?, reportCount?, onNavigate? }: { pendingCount?: number; reportCount?: number; onNavigate?: () => void })` — renders the nav list, badges, and the logout button. `onNavigate` fires after a link click or logout (Task 2's drawer uses it to close itself; the desktop `Sidebar` omits it).

Today `Sidebar.tsx` holds the nav list, badge logic, and the logout button all in one component with a fixed `w-64 h-screen` shell. We need that content reusable from a mobile drawer too, so it moves into `SidebarNav`, and `Sidebar` becomes a thin desktop-only shell around it.

- [ ] **Step 1: Create `components/layout/SidebarNav.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, FolderOpen, Users, Calendar, Upload, Scale, LogOut, Library, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/authStore";
import { logout } from "@/lib/api/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/questions", label: "Sorular", icon: FileText },
  { href: "/reports", label: "Raporlar", icon: Flag },
  { href: "/categories", label: "Kategoriler", icon: FolderOpen },
  { href: "/users", label: "Kullanıcılar", icon: Users },
  { href: "/exam-dates", label: "Sınav Tarihleri", icon: Calendar },
  { href: "/content", label: "İçerik Üretimi", icon: Upload },
  { href: "/sources", label: "Kaynaklar", icon: Library },
  { href: "/legal", label: "Yasal Metinler", icon: Scale },
];

export function SidebarNav({
  pendingCount = 0,
  reportCount = 0,
  onNavigate,
}: {
  pendingCount?: number;
  reportCount?: number;
  onNavigate?: () => void;
}) {
  const badgeCount: Record<string, number> = { "/questions": pendingCount, "/reports": reportCount };
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  async function handleLogout() {
    await logout();
    clearAuth();
    onNavigate?.();
    router.push("/login");
  }

  return (
    <>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {(badgeCount[href] ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-auto text-xs px-1.5">
                {badgeCount[href]}
              </Badge>
            )}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t">
        <Button variant="ghost" className="w-full justify-start gap-3 text-gray-600" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Çıkış Yap
        </Button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Rewrite `components/layout/Sidebar.tsx`**

```tsx
"use client";
import { SidebarNav } from "./SidebarNav";

export function Sidebar({ pendingCount = 0, reportCount = 0 }: { pendingCount?: number; reportCount?: number }) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-white lg:flex lg:sticky lg:top-0 lg:h-dvh">
      <div className="p-6 border-b">
        <h1 className="font-bold text-lg">KPSS Admin</h1>
      </div>
      <SidebarNav pendingCount={pendingCount} reportCount={reportCount} />
    </aside>
  );
}
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit` and `npm run lint` — both must be clean (0 new errors). Then `npm run dev` and check at **1280px**: sidebar looks pixel-identical to before (same width, same items, same badges, logout still works). At **390px**: the sidebar must now be completely gone (no `w-64` column eating screen width) — this will look broken until Task 2 adds the drawer; that's expected at this point.

- [ ] **Step 4: Commit**

```bash
git add components/layout/SidebarNav.tsx components/layout/Sidebar.tsx
git commit -m "refactor: nav list'i SidebarNav'a çıkar, Sidebar masaüstüne özel kalsın"
```

---

## Task 2: `MobileNav` drawer + `Header` + `layout.tsx` single-scroll shell

**Files:**
- Create: `components/layout/MobileNav.tsx`
- Modify: `components/layout/Header.tsx` (full rewrite, currently 11 lines)
- Modify: `app/(admin)/layout.tsx` (full rewrite, currently 19 lines)

**Interfaces:**
- Consumes: `SidebarNav`, `navItems` from Task 1 (`components/layout/SidebarNav.tsx`).
- Produces: `MobileNav({ pendingCount?, reportCount? }: { pendingCount?: number; reportCount?: number })` — the ☰ trigger + `Sheet` drawer. `Header({ pendingCount?, reportCount? }: { pendingCount?: number; reportCount?: number })` — now needs these two props (previously took none) because it renders `MobileNav`.

This task also removes the double-scroll-container bug: today `app/(admin)/layout.tsx` uses `flex h-screen` + `main` with its own `overflow-auto`, so the page scrolls inside a fixed-height box. On mobile, the browser's own address-bar-collapse behavior fights that fixed height. The fix is `min-h-dvh` on the outer flex and no `overflow-auto` on `main` — the whole page becomes one natural, document-level scroll region.

- [ ] **Step 1: Create `components/layout/MobileNav.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "./SidebarNav";

export function MobileNav({ pendingCount = 0, reportCount = 0 }: { pendingCount?: number; reportCount?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-11 w-11 p-0 lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>KPSS Admin</SheetTitle>
          </SheetHeader>
          <SidebarNav
            pendingCount={pendingCount}
            reportCount={reportCount}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
```

(`open`/`onOpenChange` on `Sheet`, controlled from plain `useState`, matches the existing convention in `app/(admin)/questions/_components/ImportSheet.tsx:117`.)

- [ ] **Step 2: Rewrite `components/layout/Header.tsx`**

```tsx
"use client";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { navItems } from "./SidebarNav";
import { MobileNav } from "./MobileNav";

export function Header({ pendingCount = 0, reportCount = 0 }: { pendingCount?: number; reportCount?: number }) {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const title = navItems.find((item) => pathname.startsWith(item.href))?.label;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 lg:px-6">
      <MobileNav pendingCount={pendingCount} reportCount={reportCount} />
      {title && <span className="font-semibold">{title}</span>}
      <span className="ml-auto hidden text-sm text-gray-600 sm:inline">{user?.email}</span>
    </header>
  );
}
```

- [ ] **Step 3: Rewrite `app/(admin)/layout.tsx`**

```tsx
"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useDashboardStats } from "@/lib/hooks/useDashboardStats";
import { useReports } from "@/lib/hooks/useReports";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data } = useDashboardStats();
  const { data: reports } = useReports();
  const pendingCount = data?.pendingReview ?? 0;
  const reportCount = reports?.length ?? 0;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar pendingCount={pendingCount} reportCount={reportCount} />
      <div className="flex flex-1 flex-col">
        <Header pendingCount={pendingCount} reportCount={reportCount} />
        <main className="flex-1 bg-gray-50 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

`npx tsc --noEmit` + `npm run lint` clean, then `npm run dev`.
- **390px:** tap ☰ → drawer slides in from the left, shows all 9 nav items with correct badge numbers (compare against the pending/report counts shown elsewhere), tapping a link navigates and closes the drawer, tapping "Çıkış Yap" logs out and lands on `/login` (Review Focus #1). Header title changes per page. Page scrolls as one region (no inner scrollbar).
- **768px:** same drawer behavior (still below `lg`).
- **1280px:** sidebar is back, ☰ button and mobile title are gone (`lg:hidden`/desktop breakpoint), header still shows the email on the right. Layout looks identical to before Task 1.
- Open the browser console at 390px — no hydration warnings.

- [ ] **Step 5: Commit**

```bash
git add components/layout/MobileNav.tsx components/layout/Header.tsx "app/(admin)/layout.tsx"
git commit -m "feat: mobil çekmece menü + sabit başlık + tek kaydırma katmanı"
```

---

## Task 3: Sorular tablosu — kolon öncelikleri, sabit kolon, ikon aksiyonlar, satır tıklaması

**Files:**
- Modify: `app/(admin)/questions/page.tsx:286-353` (the table block only; filters at :210-273 are Task 6's job, leave them alone here)

**Interfaces:**
- Consumes: nothing new.
- Produces: the sticky-first-column + icon-action-button pattern that Tasks 5, 7, 8, 9 repeat on their own tables (each task re-states its own full code — this is the first instance, not a shared component).

Column visibility per spec §5.1 (checkbox hidden `<sm`, Kategori hidden `<sm`, Zorluk+AI Doğrulama hidden `<md`, Kaynak+Tarih hidden `<lg`; Soru/Durum/Aksiyonlar always visible). Because the hidden columns are exactly the ones between Soru and Durum/Aksiyonlar in the existing DOM order, no column reordering is needed — hiding them already leaves `Soru · Durum · Aksiyonlar` visible at 390px in that order.

The existing `TableRow onClick={() => navigateToDetail(q.id)}` plus per-cell `onClick={(e) => e.stopPropagation()}` is today's only way the question row navigates, and it isn't keyboard-reachable. Replace it with a `<button type="button">` wrapping the question body in the (now sticky) first cell; drop the row `onClick` and the `stopPropagation` wrappers entirely (nothing left needs them).

- [ ] **Step 1: Replace the table block (lines 286-353)**

```tsx
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead className="hidden w-10 sm:table-cell">
                  <Checkbox
                    checked={selected.size > 0 && selected.size === (data?.items.length ?? 0)}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="sticky left-0 z-10 bg-inherit">Soru</TableHead>
                <TableHead className="hidden sm:table-cell">Kategori</TableHead>
                <TableHead className="hidden md:table-cell">Zorluk</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="hidden md:table-cell">AI Doğrulama</TableHead>
                <TableHead className="hidden lg:table-cell">Kaynak</TableHead>
                <TableHead className="hidden lg:table-cell">Tarih</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((q) => (
                <TableRow key={q.id} className="bg-white hover:bg-gray-50">
                  <TableCell className="hidden sm:table-cell">
                    <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} />
                  </TableCell>
                  <TableCell className="sticky left-0 z-10 max-w-md bg-inherit">
                    <button type="button" className="line-clamp-2 text-left" onClick={() => navigateToDetail(q.id)}>
                      {q.body}
                    </button>
                  </TableCell>
                  <TableCell className="hidden text-sm text-gray-600 sm:table-cell">{q.categoryName}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{q.difficulty}</TableCell>
                  <TableCell><StatusBadge status={q.status as ContentStatus} /></TableCell>
                  <TableCell className="hidden md:table-cell"><VerificationBadge status={q.verificationStatus} /></TableCell>
                  <TableCell className="hidden lg:table-cell"><SourceBadge source={q.source} /></TableCell>
                  <TableCell className="hidden text-sm text-gray-600 lg:table-cell">
                    {format(new Date(q.createdAt), "d MMM yyyy", { locale: tr })}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {q.status === "PendingReview" && (
                      <>
                        <Button size="sm" variant="outline" className="h-11 w-11 p-0 text-green-700 border-green-300 md:h-8 md:w-auto md:px-3" onClick={() => handleApprove(q.id)}>
                          <Check className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Onayla</span>
                        </Button>
                        <Button size="sm" variant="outline" className="h-11 w-11 p-0 text-red-700 border-red-300 md:h-8 md:w-auto md:px-3" onClick={() => setRejectTarget(q.id)}>
                          <X className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Reddet</span>
                        </Button>
                      </>
                    )}
                    {q.status === "Active" && (
                      <Button size="sm" variant="outline" className="h-11 w-11 p-0 text-red-700 border-red-300 md:h-8 md:w-auto md:px-3" onClick={() => setDeleteTarget(q.id)}>
                        <Trash2 className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Sil</span>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-11 w-11 p-0 md:h-8 md:w-auto md:px-3" onClick={() => router.push(`/questions/${q.id}`)}>
                      <Pencil className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Düzenle</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-400">Soru bulunamadı</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
```

- [ ] **Step 2: Add the icon imports**

In the existing `lucide-react`... there is no existing lucide-react import in this file — add one:

```tsx
import { Check, X, Pencil, Trash2 } from "lucide-react";
```

Add it near the top with the other imports (after the `type ContentStatus` import, before `Suspense`).

- [ ] **Step 3: Verify**

`npx tsc --noEmit` + `npm run lint` clean, `npm run build` succeeds.
- **390px:** no horizontal scroll; visible columns are Soru, Durum, Aksiyonlar; action buttons are square icon buttons you can tap without mis-hitting a neighbor; tapping the question text navigates to its detail page; scroll the table sideways (there shouldn't be any, but if content is long, confirm the Soru column would stay pinned) and confirm the sticky cell's background matches the row (no white seam) on both default and `hover:bg-gray-50` rows.
- **Keyboard check (Review Focus #4):** Tab to a question's text button and press Enter — it must navigate, same as a click.
- **768px:** Kategori, Zorluk, AI Doğrulama, checkbox now visible too.
- **1280px:** all 9 columns, text-labeled buttons — must look identical to before this task.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/questions/page.tsx"
git commit -m "feat: Sorular tablosunda kolon öncelikleri, sabit kolon, ikon aksiyonlar"
```

---

## Task 4: Soru detay sayfası mobil düzeni

**Files:**
- Modify: `app/(admin)/questions/[id]/page.tsx:139-140, 326-349` (the outer wrapper and the bottom action bar)

**Interfaces:**
- Consumes: nothing new.

Today this page escapes `main`'s padding with `-m-6 flex h-[calc(100%+3rem)] flex-col` specifically because the old layout gave `main` a fixed height and its own `overflow-auto` (so this page built its *own* inner scroll region to get a pinned bottom action bar). Task 2 removed that fixed height and inner scroll from `main` — the whole page now scrolls at the document level — so this escape-hatch no longer has a box to measure itself against and must be replaced with a normal-flow layout. A `position: sticky; bottom: 0` element pinned to a *document-level* scroll works the same way visually (stays at the bottom of the viewport while its container is still scrolling), so the pinned-bar look is kept on both mobile and desktop without the old trick.

- [ ] **Step 1: Replace the outer wrapper's opening (lines 138-140)**

Old:
```tsx
  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col">
      <div className="flex-1 space-y-6 overflow-auto p-6">
      <div className="flex items-center justify-between">
```

New:
```tsx
  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
```

(The `flex-wrap` lets "← Geri"/title and the AI-fix/badges group wrap onto two lines at narrow widths instead of squeezing.)

- [ ] **Step 2: Replace the bottom action bar (lines 326-349)**

Old:
```tsx
      <div className="shrink-0 border-t bg-white px-6 py-4">
        <div className="flex max-w-2xl items-center justify-between">
          <Button type="submit" form="question-form" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          <div className="flex gap-2">
            {question.status === "PendingReview" && (
              <>
                <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Onayla
                </Button>
                <Button type="button" variant="outline" className="text-red-700 border-red-300" onClick={() => setRejectOpen(true)}>
                  Reddet
                </Button>
              </>
            )}
            {question.status === "Active" && (
              <Button type="button" variant="outline" className="text-red-700 border-red-300" onClick={() => setDeleteOpen(true)}>
                Sil
              </Button>
            )}
          </div>
        </div>
      </div>
```

New:
```tsx
      <div className="sticky bottom-0 border-t bg-white p-4 lg:px-6 lg:py-4">
        <div className="flex max-w-2xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <Button type="submit" form="question-form" className="w-full md:w-auto" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          <div className="flex flex-col gap-2 md:flex-row">
            {question.status === "PendingReview" && (
              <>
                <Button type="button" className="w-full bg-green-600 hover:bg-green-700 md:w-auto" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Onayla
                </Button>
                <Button type="button" variant="outline" className="w-full text-red-700 border-red-300 md:w-auto" onClick={() => setRejectOpen(true)}>
                  Reddet
                </Button>
              </>
            )}
            {question.status === "Active" && (
              <Button type="button" variant="outline" className="w-full text-red-700 border-red-300 md:w-auto" onClick={() => setDeleteOpen(true)}>
                Sil
              </Button>
            )}
          </div>
        </div>
      </div>
```

Note the closing `</div></div>` that followed the old inner-scroll wrapper (originally after the `aside`/grid block, before this bottom bar) stays exactly where it is relative to the grid block — only the two regions above changed; don't touch the grid/form/aside JSX in between.

- [ ] **Step 3: Verify**

`npx tsc --noEmit` + `npm run lint` clean, `npm run build` succeeds.
- **390px:** open a `PendingReview` question. Scroll the form — the bottom bar (Kaydet / Onayla / Reddet) stays pinned to the bottom of the screen the whole time, each button full-width and stacked, all comfortably tappable. The top bar wraps instead of clipping.
- **768px/1280px:** bottom bar reverts to the original single-row layout (Kaydet left, Onayla/Reddet/Sil right) and still stays pinned while scrolling — compare side-by-side with `main`/other pages at 1280px to confirm nothing else shifted.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/questions/[id]/page.tsx"
git commit -m "feat: soru detayında mobil düzen ve sabit kalan aksiyon çubuğu"
```

---

## Task 5: Raporlar tablosu — kolon öncelikleri, sabit kolon, ikon aksiyonlar

**Files:**
- Modify: `app/(admin)/reports/page.tsx:1-17, 89-155`

**Interfaces:**
- Consumes: nothing new.

Reports already uses a `<button>` in its first cell (no row-level `onClick` to remove) — only column visibility, the sticky first column, and the icon-action-button treatment are needed here. This is the second of the three mandatory phone flows.

- [ ] **Step 1: Add icon imports (top of file, after the existing `lucide-react`... there is none yet — add one)**

```tsx
import { Check, X, Undo2 } from "lucide-react";
```

- [ ] **Step 2: Replace the table block (lines 89-155)**

```tsx
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead className="sticky left-0 z-10 bg-inherit">Soru</TableHead>
                <TableHead className="hidden md:table-cell">Kategori</TableHead>
                <TableHead className="text-center">Rapor</TableHead>
                <TableHead className="hidden sm:table-cell">Sebepler</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.questionId} className="bg-white align-top">
                  <TableCell className="sticky left-0 z-10 max-w-md bg-inherit">
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
                  <TableCell className="hidden text-sm text-gray-600 md:table-cell">{r.categoryName ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="destructive">{r.reportCount}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(r.reasonBreakdown).map(([reason, count]) => (
                        <Badge key={reason} variant="secondary" className="text-xs">
                          {(REASON_LABELS[reason as ReportReason] ?? reason)} · {count}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="outline" className="h-11 w-11 p-0 text-green-700 border-green-300 md:h-8 md:w-auto md:px-3"
                            disabled={busy} onClick={() => handleApprove(r.questionId)}>
                      <Check className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Onayla</span>
                    </Button>
                    <Button size="sm" variant="outline" className="h-11 w-11 p-0 text-red-700 border-red-300 md:h-8 md:w-auto md:px-3"
                            disabled={busy} onClick={() => setRejectTarget(r.questionId)}>
                      <X className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Reddet</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-11 w-11 p-0 md:h-8 md:w-auto md:px-3"
                            disabled={busy} onClick={() => setDismissTarget(r.questionId)}>
                      <Undo2 className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Yoksay</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
```

- [ ] **Step 3: Verify**

`npx tsc --noEmit` + `npm run lint` clean, `npm run build` succeeds.
- **390px:** no horizontal scroll; visible columns Soru, Rapor, Aksiyonlar; the three icon action buttons fit comfortably without overlapping; sticky Soru column keeps its white background correctly.
- **640px (sm):** Sebepler column appears.
- **768px (md):** Kategori column appears too — full set matches 1280px minus nothing.
- **1280px:** identical to before this task (text-labeled buttons, all 5 columns).

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/reports/page.tsx"
git commit -m "feat: Raporlar tablosunda kolon öncelikleri, sabit kolon, ikon aksiyonlar"
```

---

## Task 6: Filtre çekmecesi — `QuestionFilters.tsx` + Sorular sayfasında Sheet

**Files:**
- Create: `app/(admin)/questions/_components/QuestionFilters.tsx`
- Modify: `app/(admin)/questions/page.tsx:1-30, 188-273` (imports + the header/filter region; the table edited in Task 3 is untouched here)

**Interfaces:**
- Produces: `QuestionFilters({ layout, status, source, categoryId, aiPassed, categories, hasActiveFilters, onStatusChange, onSourceChange, onCategoryChange, onAiPassedChange, onClear }: QuestionFiltersProps)` where `layout: "row" | "stack"` picks select widths and stacking without duplicating markup.

- [ ] **Step 1: Create `app/(admin)/questions/_components/QuestionFilters.tsx`**

```tsx
"use client";
import type { AdminCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const STATUS_OPTIONS = [
  { value: "PendingReview", label: "Bekliyor" },
  { value: "Active", label: "Aktif" },
  { value: "Rejected", label: "Reddedildi" },
  { value: "all", label: "Tümü" },
];

export const SOURCE_OPTIONS = [
  { value: "all", label: "Tümü" },
  { value: "Service", label: "Servis" },
  { value: "Import", label: "İmport" },
];

type QuestionFiltersProps = {
  layout: "row" | "stack";
  status: string;
  source: string;
  categoryId: string;
  aiPassed: boolean;
  categories: AdminCategory[];
  hasActiveFilters: boolean;
  onStatusChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAiPassedChange: (checked: boolean) => void;
  onClear: () => void;
};

export function QuestionFilters({
  layout, status, source, categoryId, aiPassed, categories, hasActiveFilters,
  onStatusChange, onSourceChange, onCategoryChange, onAiPassedChange, onClear,
}: QuestionFiltersProps) {
  const subjectOptions = [
    { value: "all", label: "Tüm Dersler" },
    ...categories.filter((c) => c.parentCategoryId).map((c) => ({ value: c.id, label: c.name })),
  ];
  const triggerWidth = layout === "row" ? "w-40" : "w-full";

  return (
    <div className={cn("flex gap-3", layout === "row" ? "flex-wrap items-center" : "flex-col items-stretch")}>
      <Select value={status} items={STATUS_OPTIONS} onValueChange={(v) => v && onStatusChange(v)}>
        <SelectTrigger className={triggerWidth}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={source} items={SOURCE_OPTIONS} onValueChange={(v) => v && onSourceChange(v)}>
        <SelectTrigger className={triggerWidth}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={categoryId} items={subjectOptions} onValueChange={(v) => v && onCategoryChange(v)}>
        <SelectTrigger className={triggerWidth}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {subjectOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <label className="flex items-center gap-2 p-2 text-sm text-gray-600 cursor-pointer select-none">
        <Checkbox checked={aiPassed} onCheckedChange={(c) => onAiPassedChange(!!c)} />
        Yalnızca AI&apos;dan geçenler
      </label>

      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className={layout === "row" ? "ml-auto" : "w-full"}
        >
          Filtreleri Temizle
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update imports in `app/(admin)/questions/page.tsx`**

Remove the now-duplicated local `STATUS_OPTIONS`/`SOURCE_OPTIONS` constants (lines 31-42) and the `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` imports — Task 3's table has no `Select` usage, so after this change they'd be unused (keep the `Checkbox` import; Task 3 still uses it for the row checkboxes). **`STATUS_OPTIONS` is also read later in this file** at `const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label;` (used in the page title) — that line stays, but its `STATUS_OPTIONS` now has to come from the import below instead of the deleted local constant:

```tsx
import { QuestionFilters, STATUS_OPTIONS } from "./_components/QuestionFilters";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal } from "lucide-react";
```

Add one state hook next to the other `useState` calls:

```tsx
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
```

Replace `hasActiveFilters` (currently a boolean) with a count so the Sheet trigger can show a `Badge`:

```tsx
  const activeFilterCount =
    (status !== "PendingReview" ? 1 : 0) +
    (source !== "all" ? 1 : 0) +
    (categoryId !== "all" ? 1 : 0) +
    (aiPassed ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;
```

- [ ] **Step 3: Replace the filter row (lines 210-273) with the responsive filter block**

```tsx
      <div className="hidden md:block">
        <QuestionFilters
          layout="row"
          status={status}
          source={source}
          categoryId={categoryId}
          aiPassed={aiPassed}
          categories={categories}
          hasActiveFilters={hasActiveFilters}
          onStatusChange={(v) => setQueryParam("status", v)}
          onSourceChange={(v) => setQueryParam("source", v)}
          onCategoryChange={(v) => setQueryParam("categoryId", v)}
          onAiPassedChange={toggleAiPassed}
          onClear={clearAllFilters}
        />
      </div>

      <Button
        variant="outline"
        className="gap-2 md:hidden"
        onClick={() => setFilterSheetOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtreler
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="px-1.5">{activeFilterCount}</Badge>
        )}
      </Button>

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="left" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Filtreler</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto px-4">
            <QuestionFilters
              layout="stack"
              status={status}
              source={source}
              categoryId={categoryId}
              aiPassed={aiPassed}
              categories={categories}
              hasActiveFilters={hasActiveFilters}
              onStatusChange={(v) => setQueryParam("status", v)}
              onSourceChange={(v) => setQueryParam("source", v)}
              onCategoryChange={(v) => setQueryParam("categoryId", v)}
              onAiPassedChange={toggleAiPassed}
              onClear={() => { clearAllFilters(); setFilterSheetOpen(false); }}
            />
          </div>
        </SheetContent>
      </Sheet>
```

- [ ] **Step 4: Verify**

`npx tsc --noEmit` + `npm run lint` clean (check specifically for now-unused imports — this is the most common mistake in this task), `npm run build` succeeds.
- **390px:** filter row is gone, a "Filtreler" button with a badge (when filters are active) is visible instead; tapping it opens a left-side Sheet with the three selects full-width, the AI checkbox, and "Filtreleri Temizle"; changing a filter inside the Sheet updates the URL and list same as before; "Filtreleri Temizle" both clears and closes the Sheet.
- **768px (md) and 1280px:** filter row looks identical to before this task (row of 3 selects + checkbox + clear button), the mobile button/Sheet are gone (`md:hidden`).

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/questions/page.tsx" "app/(admin)/questions/_components/QuestionFilters.tsx"
git commit -m "feat: Sorular filtrelerini mobilde çekmeceye al"
```

---

## Task 7: Kullanıcılar tablosu — kolon öncelikleri, sabit kolon, satır tıklaması

**Files:**
- Modify: `app/(admin)/users/page.tsx:136-168`

**Interfaces:**
- Consumes: nothing new.

Same row-click defect as Sorular (Task 3): `TableRow onClick={() => setSelectedUser(u)}` isn't keyboard-reachable and risks mis-taps on a narrow screen. Fix identically — wrap the username in a `<button type="button">`, drop the row `onClick`.

- [ ] **Step 1: Replace the table block (lines 136-168)**

```tsx
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead className="sticky left-0 z-10 bg-inherit">Kullanıcı Adı</TableHead>
                <TableHead className="hidden sm:table-cell">E-posta</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="hidden md:table-cell">KPSS Türü</TableHead>
                <TableHead className="hidden md:table-cell">Giriş Yöntemi</TableHead>
                <TableHead className="hidden lg:table-cell">Kayıt Tarihi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((u) => (
                <TableRow key={u.id} className="bg-white hover:bg-gray-50">
                  <TableCell className="sticky left-0 z-10 bg-inherit font-medium">
                    <button type="button" className="text-left hover:underline" onClick={() => setSelectedUser(u)}>
                      {u.username || "—"}
                    </button>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{u.email}</TableCell>
                  <TableCell><Badge className={roleColor[u.role]}>{roleLabel[u.role]}</Badge></TableCell>
                  <TableCell className="hidden text-gray-600 md:table-cell">{u.kpssType ? kpssLabel[u.kpssType] ?? u.kpssType : "—"}</TableCell>
                  <TableCell className="hidden md:table-cell"><AuthProviderBadge provider={u.authProvider} /></TableCell>
                  <TableCell className="hidden text-sm text-gray-600 lg:table-cell">
                    {format(new Date(u.createdAt), "d MMM yyyy", { locale: tr })}
                  </TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400">Kullanıcı bulunamadı</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
```

- [ ] **Step 2: Verify**

`npx tsc --noEmit` + `npm run lint` clean, `npm run build` succeeds.
- **390px:** no horizontal scroll; visible columns Kullanıcı Adı, Rol; tapping the username opens the `UserDetailSheet` (unchanged behavior, new trigger).
- **Keyboard check (Review Focus #4):** Tab to a username button, press Enter — the detail sheet opens.
- **640px/768px:** E-posta, then KPSS Türü + Giriş Yöntemi appear.
- **1280px:** all 6 columns, identical to before this task.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/users/page.tsx"
git commit -m "feat: Kullanıcılar tablosunda kolon öncelikleri, sabit kolon, erişilebilir satır"
```

---

## Task 8: Kaynaklar tablosu — kolon öncelikleri, sabit kolon, satır tıklaması düzeltmesi

**Files:**
- Modify: `app/(admin)/sources/page.tsx:82-119`

**Interfaces:**
- Consumes: nothing new.

**Correction to spec §2/§5.4:** while implementing, re-checking `app/(admin)/sources/page.tsx` shows it actually has the *same* row-click pattern as Sorular/Kullanıcılar (`TableRow onClick={() => router.push(...)}` plus a `stopPropagation` wrapper on the action cell) — the spec's note that Kaynaklar "already uses a button in its first cell" was wrong for this page (it's correct for Raporlar and Kategoriler, which this plan leaves alone). Since this is the identical mis-tap risk the spec itself asks to fix elsewhere, apply the same button-wrap fix here too rather than leaving a known defect in a table this plan is already touching for column priorities.

- [ ] **Step 1: Replace the table block (lines 82-119)**

```tsx
        <Table>
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead className="sticky left-0 z-10 bg-inherit">Dosya</TableHead>
              <TableHead className="hidden md:table-cell">Tarih</TableHead>
              <TableHead className="hidden text-center sm:table-cell">Konu</TableHead>
              <TableHead className="text-center">Soru</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => (
              <TableRow key={s.source_id} className="bg-white hover:bg-gray-50">
                <TableCell className="sticky left-0 z-10 bg-inherit font-medium">
                  <button type="button" className="text-left hover:underline" onClick={() => router.push(`/sources/${s.source_id}`)}>
                    {s.file_name}
                  </button>
                </TableCell>
                <TableCell className="hidden text-gray-500 md:table-cell">
                  {s.created_at ? new Date(s.created_at).toLocaleString("tr-TR") : "—"}
                </TableCell>
                <TableCell className="hidden text-center sm:table-cell">{s.topic_count}</TableCell>
                <TableCell className="text-center"><Badge variant="secondary">{s.question_count}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-11 w-11 p-0 md:h-8 md:w-8" title="Soruları indir"
                            disabled={s.question_count === 0 || downloading === s.source_id}
                            onClick={() => handleDownload(s)}>
                      <Download className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-11 w-11 p-0 md:h-8 md:w-8" title="Kaynağı sil"
                            onClick={() => { setTarget(s); setAlsoQuestions(false); }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
```

- [ ] **Step 2: Verify**

`npx tsc --noEmit` + `npm run lint` clean, `npm run build` succeeds.
- **390px:** no horizontal scroll; visible columns Dosya, Soru, action icons; tapping the file name navigates to the source detail page; the download/delete icon buttons are 44px targets and don't trigger navigation (no more row-level `onClick` to accidentally hit).
- **640px/768px:** Konu, then Tarih appear.
- **1280px:** identical to before this task.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/sources/page.tsx"
git commit -m "feat: Kaynaklar tablosunda kolon öncelikleri, sabit kolon, erişilebilir satır"
```

---

## Task 9: Kategoriler tablosu — kolon öncelikleri, sabit kolon, ikon aksiyonlar

**Files:**
- Modify: `app/(admin)/categories/page.tsx:1-16, 78-108`

**Interfaces:**
- Consumes: nothing new.

Categories has no row-level click to fix (rows aren't navigable — edit happens via the "Düzenle" button opening a dialog), so this task is column visibility, the sticky first column, and the icon-action-button treatment only.

- [ ] **Step 1: Add icon imports**

```tsx
import { Pencil, Trash2 } from "lucide-react";
```

- [ ] **Step 2: Replace the table block (lines 78-108)**

```tsx
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead className="sticky left-0 z-10 bg-inherit">İsim</TableHead>
                <TableHead className="hidden md:table-cell">Üst Kategori</TableHead>
                <TableHead className="hidden sm:table-cell">Aktif Soru</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id} className="bg-white hover:bg-gray-50">
                  <TableCell className="sticky left-0 z-10 bg-inherit font-medium">{cat.name}</TableCell>
                  <TableCell className="hidden text-gray-600 md:table-cell">{cat.parentCategoryName ?? "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell">{cat.activeQuestionCount}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" className="h-11 w-11 p-0 md:h-8 md:w-auto md:px-3" onClick={() => openEdit(cat)}>
                      <Pencil className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Düzenle</span>
                    </Button>
                    <Button size="sm" variant="outline" className="h-11 w-11 p-0 text-red-700 border-red-300 md:h-8 md:w-auto md:px-3" onClick={() => setDeleteTarget(cat)}>
                      <Trash2 className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Sil</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-400">Kategori bulunamadı</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
```

- [ ] **Step 3: Verify**

`npx tsc --noEmit` + `npm run lint` clean, `npm run build` succeeds.
- **390px:** no horizontal scroll; visible columns İsim, Aksiyonlar; Düzenle/Sil are tappable icon buttons that still open the edit dialog / delete confirm correctly.
- **640px/768px:** Aktif Soru, then Üst Kategori appear.
- **1280px:** identical to before this task.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/categories/page.tsx"
git commit -m "feat: Kategoriler tablosunda kolon öncelikleri, sabit kolon, ikon aksiyonlar"
```

---

## Task 10: Dashboard grafikleri — `useMediaQuery` + responsive `YAxis`

**Files:**
- Create: `lib/hooks/useMediaQuery.ts`
- Modify: `app/(admin)/dashboard/page.tsx:1-19, 97-105`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean` — SSR-safe (`false` on server and on first client render, real value only after mount), per Review Focus #5.

Recharts' `YAxis width` prop needs a number, so this can't be solved with CSS alone — one small client-only hook is the deliberate cost the spec accepts for this (spec §6.3).

- [ ] **Step 1: Create `lib/hooks/useMediaQuery.ts`**

```ts
"use client";
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    function handleChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }

    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
```

- [ ] **Step 2: Wire it into `app/(admin)/dashboard/page.tsx`**

Add the import near the top (after the `date-fns/locale` import):

```tsx
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
```

Inside `DashboardPage`, after the existing `data`/`reports` hooks (around line 13):

```tsx
  const isCompact = useMediaQuery("(max-width: 639px)");
```

Replace the `categoryData` computation (lines 17-19) to truncate long names on compact screens:

```tsx
  const categoryData = [...(data?.categoryDistribution ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((c) => ({
      ...c,
      categoryName:
        isCompact && c.categoryName.length > 14
          ? `${c.categoryName.slice(0, 14)}…`
          : c.categoryName,
    }));
```

Replace the `YAxis` line (line 101):

```tsx
                  <YAxis type="category" dataKey="categoryName" width={isCompact ? 90 : 130} tick={{ fontSize: isCompact ? 11 : 12 }} />
```

- [ ] **Step 3: Verify**

`npx tsc --noEmit` + `npm run lint` clean, `npm run build` succeeds.
- **390px:** category names in the horizontal bar chart are readable, truncated with `…` instead of overlapping the bars; open the browser console and confirm there is **no hydration-mismatch warning** on page load (Review Focus #5); refresh a few times to be sure the chart doesn't visibly jump from a wide to a narrow axis after mount.
- **768px/1280px:** chart looks identical to before this task (`isCompact` is `false` at those widths).

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/useMediaQuery.ts "app/(admin)/dashboard/page.tsx"
git commit -m "feat: dashboard grafiğinde dar ekranda okunabilir kategori eksen"
```

---

## After Task 10

Push the branch (`git push -u origin feature/panel-mobil-uyum` — note the explicit upstream, since this branch currently tracks `origin/main`). Then run the full spec §8 gate one more time end-to-end (all three breakpoints, all three mandatory flows) before opening a PR, since each task above was only checked in isolation.
