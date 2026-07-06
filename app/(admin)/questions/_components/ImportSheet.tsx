"use client";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { createQuestion } from "@/lib/api/questions";
import { parseImportFile, type ImportQuestion } from "@/lib/validations/importSchema";

type Step = "upload" | "preview" | "done";

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [valid, setValid] = useState<ImportQuestion[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(0);
  const qc = useQueryClient();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = parseImportFile(ev.target?.result as string);
      setValid(result.valid);
      setErrors(result.errors);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setLoading(true);
    let count = 0;
    for (const q of valid) {
      try { await createQuestion(q); count++; } catch {}
    }
    setLoading(false);
    setImported(count);
    setStep("done");
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  function handleClose() {
    setStep("upload");
    setValid([]);
    setErrors([]);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className="w-[560px] sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Soru İçe Aktar</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {step === "upload" && (
            <>
              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <span className="text-sm text-gray-500">JSON dosyası sürükle veya tıkla</span>
                <span className="text-xs text-gray-400 mt-1">Desteklenen format: .json</span>
                <input type="file" accept=".json" className="hidden" onChange={handleFile} />
              </label>
              <details>
                <summary className="text-sm text-blue-600 cursor-pointer select-none">Format örneği?</summary>
                <pre className="mt-2 text-xs bg-gray-50 border rounded p-3 overflow-auto">{`[
  {
    "body": "Türkçede kaç harf vardır?",
    "categoryId": "uuid-buraya",
    "options": ["26", "27", "28", "29"],
    "correctAnswer": "29",
    "difficulty": "Easy",
    "explanation": "Türk alfabesi 29 harften oluşur."
  }
]`}</pre>
              </details>
            </>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                <span className="text-green-700">{valid.length} soru bulundu</span>
                {errors.length > 0 && <span className="text-red-600 ml-2">· {errors.length} hatalı satır</span>}
              </p>
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700 space-y-1">
                  {errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
                  {errors.length > 5 && <div>...ve {errors.length - 5} hata daha</div>}
                </div>
              )}
              <div className="border rounded overflow-auto max-h-56">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr><th className="p-2 text-left">Soru</th><th className="p-2 text-left">Zorluk</th></tr>
                  </thead>
                  <tbody>
                    {valid.slice(0, 10).map((q, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 max-w-xs truncate">{q.body.slice(0, 60)}{q.body.length > 60 ? "..." : ""}</td>
                        <td className="p-2">{q.difficulty}</td>
                      </tr>
                    ))}
                    {valid.length > 10 && (
                      <tr className="border-t"><td colSpan={2} className="p-2 text-gray-400">...ve {valid.length - 10} soru daha</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleImport} disabled={loading || valid.length === 0}>
                  {loading ? "Aktarılıyor..." : `Aktar (${valid.length} soru)`}
                </Button>
                <Button variant="outline" onClick={() => setStep("upload")}>Geri</Button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="text-center space-y-4 py-8">
              <div className="text-5xl">✅</div>
              <p className="font-medium">{imported} soru PendingReview&apos;a eklendi</p>
              <Button
                onClick={() => {
                  handleClose();
                  window.location.href = "/questions?status=PendingReview";
                }}
              >
                Bekleyenleri Görüntüle
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
