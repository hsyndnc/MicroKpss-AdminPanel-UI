"use client";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuestions, useApproveQuestion, useRejectQuestion } from "@/lib/hooks/useQuestions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BulkActionBar } from "@/components/shared/BulkActionBar";
import { ImportSheet } from "./_components/ImportSheet";
import { Button } from "@/components/ui/button";
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

function QuestionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const status = searchParams.get("status") ?? "PendingReview";
  const page = Number(searchParams.get("page") ?? "1");

  const { data, isLoading } = useQuestions({
    status: status === "all" ? undefined : status,
    page,
    pageSize: 20,
  });

  const approveMutation = useApproveQuestion();
  const rejectMutation = useRejectQuestion();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  function setQueryParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (key !== "page") params.set("page", "1");
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
    setBulkLoading(true);
    let count = 0;
    for (const id of Array.from(selected)) {
      try { await approveMutation.mutateAsync(id); count++; } catch {}
    }
    setBulkLoading(false);
    setSelected(new Set());
    toast.success(`${count} soru onaylandı.`);
  }

  async function handleApprove(id: string) {
    await approveMutation.mutateAsync(id);
    toast.success("Soru onaylandı.");
  }

  async function handleReject(id: string) {
    await rejectMutation.mutateAsync(id);
    setRejectTarget(null);
    toast.error("Soru reddedildi.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sorular</h1>
        <Button onClick={() => setImportOpen(true)}>İçe Aktar</Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={status} onValueChange={(v) => v && setQueryParam("status", v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <BulkActionBar
        count={selected.size}
        onApprove={handleBulkApprove}
        onCancel={() => setSelected(new Set())}
        loading={bulkLoading}
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
                <TableHead>Tarih</TableHead>
                <TableHead className="text-right">Aksiyonlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((q) => (
                <TableRow key={q.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} />
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="line-clamp-1">{q.body.slice(0, 80)}{q.body.length > 80 ? "..." : ""}</span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{q.categoryName}</TableCell>
                  <TableCell className="text-sm">{q.difficulty}</TableCell>
                  <TableCell><StatusBadge status={q.status as ContentStatus} /></TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {format(new Date(q.createdAt), "d MMM yyyy", { locale: tr })}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
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
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/questions/${q.id}`)}>
                      Düzenle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">Soru bulunamadı</TableCell>
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

      <ConfirmDialog
        open={!!rejectTarget}
        title="Soruyu Reddet"
        description="Bu soruyu reddetmek istediğine emin misin?"
        onConfirm={() => rejectTarget && handleReject(rejectTarget)}
        onCancel={() => setRejectTarget(null)}
        confirmLabel="Reddet"
        confirmVariant="destructive"
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
