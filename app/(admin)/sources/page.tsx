"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteSource, type SourceSummary } from "@/lib/api/pipeline";
import { useSources } from "@/lib/hooks/useSources";

export default function SourcesPage() {
  const router = useRouter();
  const { data: sources = [], isLoading, isError, refetch } = useSources();
  const [target, setTarget] = useState<SourceSummary | null>(null);
  const [alsoQuestions, setAlsoQuestions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      await deleteSource(target.source_id, alsoQuestions);
      setTarget(null);
      setAlsoQuestions(false);
      await refetch();
    } finally { setDeleting(false); }
  }

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold">Kaynaklar</h1>
      <p className="text-gray-500 text-sm">Yüklenmiş belgeler. Bir satıra tıkla → konu ağacından soru üret.</p>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Yükleniyor...</p>
      ) : isError ? (
        <div className="space-y-3">
          <p className="text-red-600 text-sm">Kaynaklar yüklenemedi — pipeline servisine ulaşılamıyor.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tekrar dene</Button>
        </div>
      ) : sources.length === 0 ? (
        <p className="text-gray-400 text-sm">Henüz kaynak yok. İçerik Üretimi&apos;nden PDF yükle.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dosya</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead className="text-center">Konu</TableHead>
              <TableHead className="text-center">Soru</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => (
              <TableRow key={s.source_id} className="cursor-pointer"
                        onClick={() => router.push(`/sources/${s.source_id}`)}>
                <TableCell className="font-medium">{s.file_name}</TableCell>
                <TableCell className="text-gray-500">
                  {s.created_at ? new Date(s.created_at).toLocaleString("tr-TR") : "—"}
                </TableCell>
                <TableCell className="text-center">{s.topic_count}</TableCell>
                <TableCell className="text-center"><Badge variant="secondary">{s.question_count}</Badge></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm"
                          onClick={() => { setTarget(s); setAlsoQuestions(false); }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={target !== null} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kaynağı sil</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{target?.file_name}</b> kaynağının konu ağacı ve parçaları (chunk) silinecek. Geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={alsoQuestions}
                      onCheckedChange={(v) => setAlsoQuestions(v === true)} />
            Bu kaynaktan üretilmiş soruları da sil
          </label>
          <p className="text-xs text-gray-400">Backend&apos;e aktarılmış sorular silinmez.</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction disabled={deleting}
                               onClick={(e) => { e.preventDefault(); confirmDelete(); }}>
              {deleting ? "Siliniyor..." : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
