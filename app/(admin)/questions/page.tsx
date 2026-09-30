"use client";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuestions, useApproveQuestion, useRejectQuestion } from "@/lib/hooks/useQuestions";
import { deleteQuestion } from "@/lib/api/questions";
import { withRateLimitRetry } from "@/lib/api/retry";
import { getAdminCategories } from "@/lib/api/categories";
import type { AdminCategory } from "@/lib/types";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { VerificationBadge } from "@/components/shared/VerificationBadge";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { RejectDialog } from "@/components/shared/RejectDialog";
import { DeleteDialog } from "@/components/shared/DeleteDialog";
import { BulkActionBar } from "@/components/shared/BulkActionBar";
import { ImportSheet } from "./_components/ImportSheet";
import { QuestionStats } from "./_components/QuestionStats";
import { ClientOnly } from "@/components/shared/ClientOnly";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/shared/DataPagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { ContentStatus } from "@/lib/types";
import { Suspense } from "react";

const STATUS_OPTIONS = [
  { value: "PendingReview", label: "Bekliyor" },
  { value: "Active", label: "Aktif" },
  { value: "Rejected", label: "Reddedildi" },
  { value: "all", label: "Tümü" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "Tümü" },
  { value: "Service", label: "Servis" },
  { value: "Import", label: "İmport" },
];

function QuestionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

  const status = searchParams.get("status") ?? "PendingReview";
  const verification = searchParams.get("verification") ?? "";
  const aiPassed = verification === "gecti";
  const source = searchParams.get("source") ?? "all";
  const categoryId = searchParams.get("categoryId") ?? "all";
  const page = Number(searchParams.get("page") ?? "1");

  const [categories, setCategories] = useState<AdminCategory[]>([]);

  useEffect(() => {
    getAdminCategories().then(setCategories);
  }, []);

  const queryParams = useMemo(() => ({
    status: status === "all" ? undefined : status,
    verification: verification || undefined,
    source: source === "all" ? undefined : source,
    categoryId: categoryId === "all" ? undefined : categoryId,
    page,
    pageSize: 20,
  }), [status, verification, source, categoryId, page]);

  const { data, isLoading } = useQuestions(queryParams);

  const approveMutation = useApproveQuestion();
  const rejectMutation = useRejectQuestion();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState<"approve" | "delete" | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuestion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-questions"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Soru silindi.");
    },
    onError: () => {
      toast.error("Soru silinemedi.");
    },
  });

  function setQueryParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (key !== "page") params.set("page", "1");
    router.push(`/questions?${params.toString()}`);
    setSelected(new Set());
  }

  function toggleAiPassed(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) params.set("verification", "gecti");
    else params.delete("verification");
    params.set("page", "1");
    router.push(`/questions?${params.toString()}`);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleAll() {
    const ids = data?.items.map((q) => q.id) ?? [];
    setSelected((prev) => (prev.size === ids.length && ids.length > 0 ? new Set() : new Set(ids)));
  }

  async function handleBulkApprove() {
    setBulkRunning("approve");
    let count = 0;
    for (const id of Array.from(selected)) {
      try { await withRateLimitRetry(() => approveMutation.mutateAsync(id)); count++; } catch {}
    }
    setBulkRunning(null);
    setSelected(new Set());
    toast.success(`${count} soru onaylandı.`);
  }

  /**
   * Seçili soruları tek tek siler — backend'de toplu silme ucu YOK
   * (bkz. docs/superpowers/specs/2026-09-29-toplu-soru-silme-backend-design.md).
   * Hız sınırına takılan istekler beklenip yeniden denenir, yoksa sorular
   * silinmeden "başarılı" sanılır. Liste her silmede değil, SONUNDA bir kez tazelenir.
   */
  async function handleBulkDelete() {
    const ids = Array.from(selected);
    setBulkDeleteOpen(false);
    setBulkRunning("delete");
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try { await withRateLimitRetry(() => deleteQuestion(id)); ok++; } catch { fail++; }
    }
    setBulkRunning(null);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    if (fail === 0) toast.success(`${ok} soru silindi.`);
    else toast.error(`${ok} soru silindi, ${fail} soru silinemedi.`);
  }

  async function handleApprove(id: string) {
    await approveMutation.mutateAsync(id);
    toast.success("Soru onaylandı.");
  }

  async function handleReject(id: string, reason: string) {
    await rejectMutation.mutateAsync({ id, reason });
    setRejectTarget(null);
    toast.error("Soru reddedildi.");
  }

  async function handleDelete(id: string) {
    await deleteMutation.mutateAsync(id);
    setDeleteTarget(null);
  }

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label;
  const hasActiveFilters = status !== "PendingReview" || source !== "all" || categoryId !== "all" || aiPassed;
  const currentUrl = searchParams.toString();

  function navigateToDetail(id: string) {
    router.push(`/questions/${id}?from=${encodeURIComponent(currentUrl)}`);
  }

  function clearAllFilters() {
    router.push("/questions");
    setSelected(new Set());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 mb-1">Sorular / {statusLabel}</div>
          <h1 className="text-2xl font-bold">{statusLabel} Sorular {data?.totalCount ? `(${data.totalCount})` : ""}</h1>
        </div>
        <Button onClick={() => setImportOpen(true)}>İçe Aktar</Button>
      </div>

      <ClientOnly
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg sm:col-span-2" />
          </div>
        }
      >
        <QuestionStats status={status} onStatusFilter={(s) => setQueryParam("status", s)} />
      </ClientOnly>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={status} items={STATUS_OPTIONS} onValueChange={(v) => v && setQueryParam("status", v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={source} items={SOURCE_OPTIONS} onValueChange={(v) => v && setQueryParam("source", v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryId}
          items={[
            { value: "all", label: "Tüm Dersler" },
            ...categories
              .filter((c) => c.parentCategoryId)
              .map((c) => ({ value: c.id, label: c.name })),
          ]}
          onValueChange={(v) => v && setQueryParam("categoryId", v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Dersler</SelectItem>
            {categories
              .filter((c) => c.parentCategoryId)
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <Checkbox checked={aiPassed} onCheckedChange={(c) => toggleAiPassed(!!c)} />
          Yalnızca AI&apos;dan geçenler
        </label>

        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllFilters}
            className="ml-auto"
          >
            Filtreleri Temizle
          </Button>
        )}
      </div>

      <BulkActionBar
        count={selected.size}
        onApprove={handleBulkApprove}
        onDelete={() => setBulkDeleteOpen(true)}
        onCancel={() => setSelected(new Set())}
        running={bulkRunning}
      />

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size > 0 && selected.size === (data?.items.length ?? 0)}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Soru</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Zorluk</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>AI Doğrulama</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((q) => (
                <TableRow key={q.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigateToDetail(q.id)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} />
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="line-clamp-2">{q.body}</span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{q.categoryName}</TableCell>
                  <TableCell className="text-sm">{q.difficulty}</TableCell>
                  <TableCell><StatusBadge status={q.status as ContentStatus} /></TableCell>
                  <TableCell><VerificationBadge status={q.verificationStatus} /></TableCell>
                  <TableCell><SourceBadge source={q.source} /></TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {format(new Date(q.createdAt), "d MMM yyyy", { locale: tr })}
                  </TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    {q.status === "PendingReview" && (
                      <>
                        <Button size="sm" variant="outline" className="text-green-700 border-green-300" onClick={() => handleApprove(q.id)}>
                          Onayla
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-700 border-red-300" onClick={() => setRejectTarget(q.id)}>
                          Reddet
                        </Button>
                      </>
                    )}
                    {q.status === "Active" && (
                      <Button size="sm" variant="outline" className="text-red-700 border-red-300" onClick={() => setDeleteTarget(q.id)}>
                        Sil
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/questions/${q.id}`)}>
                      Düzenle
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
      )}

      {data && (
        <DataPagination
          page={page}
          totalCount={data.totalCount}
          pageSize={20}
          onPageChange={(p) => setQueryParam("page", String(p))}
        />
      )}

      <RejectDialog
        open={!!rejectTarget}
        onConfirm={(reason) => rejectTarget && handleReject(rejectTarget, reason)}
        onCancel={() => setRejectTarget(null)}
        loading={rejectMutation.isPending}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />

      <DeleteDialog
        open={bulkDeleteOpen}
        count={selected.size}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
        loading={bulkRunning === "delete"}
      />

      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}>
      <QuestionsContent />
    </Suspense>
  );
}
