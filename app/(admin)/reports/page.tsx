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
