"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { requestAiFix } from "@/lib/api/questions";
import type { AdminQuestion, AiFixResult, AiFixSuggestion } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const HARFLER = ["A", "B", "C", "D", "E"];

function DiffRow({ label, eski, yeni }: { label: string; eski: string; yeni: string }) {
  const degisti = eski !== yeni;
  return (
    <div className={`rounded-md border p-2 text-sm ${degisti ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}>
      <p className="font-medium text-gray-500">{label}{degisti && " — değişti"}</p>
      {degisti && <p className="mt-1 text-gray-500 line-through">{eski}</p>}
      <p className="mt-1">{yeni}</p>
    </div>
  );
}

export function AiFixDialog({
  open, question, onClose, onApply,
}: {
  open: boolean;
  question: AdminQuestion;
  onClose: () => void;
  onApply: (s: AiFixSuggestion) => void;
}) {
  const [adminNote, setAdminNote] = useState("");
  const [result, setResult] = useState<AiFixResult | null>(null);

  const fixMutation = useMutation({
    mutationFn: () => requestAiFix(question.id, adminNote),
    onSuccess: setResult,
  });

  function handleClose() {
    setResult(null);
    setAdminNote("");
    fixMutation.reset();
    onClose();
  }

  const errorMessage =
    fixMutation.error &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (((fixMutation.error as any).response?.data?.error as string) ??
      "AI düzeltme üretemedi, tekrar deneyin.");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI ile Düzelt</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {question.verificationNote && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">AI doğrulama raporu</p>
                <p className="mt-1">{question.verificationNote}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">Ek talimat (opsiyonel)</p>
              <Textarea
                placeholder='Örn: "C şıkkı da doğru, çeldiriciyi değiştir"'
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                disabled={fixMutation.isPending}
              />
            </div>
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={fixMutation.isPending}>Vazgeç</Button>
              <Button onClick={() => fixMutation.mutate()} disabled={fixMutation.isPending}>
                {fixMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {fixMutation.isPending ? "AI düzeltiyor…" : "Düzelt"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium">Değişiklik özeti</p>
              <p className="mt-1">{result.changeSummary || "Özet verilmedi."}</p>
            </div>
            {!result.sourceFound && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Kaynak metin bulunamadı — düzeltme yalnızca rapora dayanıyor, dikkatli incele.
              </div>
            )}
            <DiffRow label="Soru" eski={question.body} yeni={result.suggestion.body} />
            {result.suggestion.options.map((opt, i) => (
              <DiffRow key={i} label={`${HARFLER[i]} şıkkı`} eski={question.options[i] ?? ""} yeni={opt} />
            ))}
            <DiffRow label="Doğru cevap" eski={question.correctAnswer} yeni={result.suggestion.correctAnswer} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Vazgeç</Button>
              <Button onClick={() => { onApply(result.suggestion); handleClose(); }}>Forma Uygula</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
