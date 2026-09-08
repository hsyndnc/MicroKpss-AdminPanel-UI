"use client";
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { createQuestion } from "@/lib/api/questions";
import { useCategories } from "@/lib/hooks/useCategories";
import { CategoryCascadeSelect } from "@/components/shared/CategoryCascadeSelect";
import {
  parseImportFile,
  parseExcelFile,
  parseCsvFile,
  buildCategoryMap,
  type ImportQuestion,
} from "@/lib/validations/importSchema";

type Step = "upload" | "preview" | "done";

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [valid, setValid] = useState<ImportQuestion[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [imported, setImported] = useState(0);
  const [failed, setFailed] = useState(0);
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const categoryMap = useMemo(() => buildCategoryMap(categories), [categories]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const isCsv = /\.csv$/i.test(file.name);
    const target = targetCategoryId || undefined;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const result = isExcel
        ? await parseExcelFile(ev.target?.result as ArrayBuffer, categoryMap, target)
        : isCsv
          ? await parseCsvFile(ev.target?.result as string, categoryMap, target)
          : parseImportFile(ev.target?.result as string, categoryMap, target);
      setValid(result.valid);
      setErrors(result.errors);
      setStep("preview");
    };
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
    e.target.value = ""; // aynı dosyayı tekrar seçebilmek için
  }

  async function handleImport() {
    setLoading(true);
    let ok = 0;
    let fail = 0;
    let cursor = 0;
    // Sınırlı eşzamanlılık: yüzlerce soruyu seri yerine küçük bir havuzla gönder.
    async function worker() {
      while (cursor < valid.length) {
        const q = valid[cursor++];
        try { await createQuestion(q); ok++; } catch { fail++; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(6, valid.length) }, worker));
    setLoading(false);
    setImported(ok);
    setFailed(fail);
    setStep("done");
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  function handleClose() {
    setStep("upload");
    setValid([]);
    setErrors([]);
    setImported(0);
    setFailed(0);
    setTargetCategoryId("");
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
              <div className="space-y-2">
                <span className="text-sm font-medium">Hedef ders</span>
                <p className="text-xs text-gray-500">
                  Dosyada kategori yoksa tüm sorular seçtiğin derse eklenir. Karışıksa incelemede tek tek düzeltebilirsin.
                </p>
                <CategoryCascadeSelect categories={categories} value={targetCategoryId} onChange={setTargetCategoryId} />
              </div>

              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <span className="text-sm text-gray-500">Excel, CSV veya JSON dosyası sürükle veya tıkla</span>
                <span className="text-xs text-gray-400 mt-1">Desteklenen formatlar: .xlsx, .xls, .csv, .json</span>
                <input type="file" accept=".xlsx,.xls,.csv,.json" className="hidden" onChange={handleFile} />
              </label>

              <details open>
                <summary className="text-sm text-blue-600 cursor-pointer select-none">Excel / CSV sütunları nasıl olmalı?</summary>
                <div className="mt-2 text-xs bg-gray-50 border rounded p-3 space-y-2 overflow-auto">
                  <p className="text-gray-600">İlk satır başlık; her satır bir soru. Sütunlar:</p>
                  <pre className="whitespace-pre">{`soru | kategori | A | B | C | D | E | dogru | zorluk | aciklama | yil`}</pre>
                  <ul className="list-disc pl-4 text-gray-500 space-y-0.5">
                    <li><b>kategori</b> = kategori adı (arka planda UUID&apos;ye çevrilir)</li>
                    <li><b>dogru</b> = doğru şıkkın harfi (A–E)</li>
                    <li><b>zorluk</b> = Kolay / Orta / Zor (boşsa Orta)</li>
                    <li>Boş şık sütunu = o şık yok · <b>aciklama</b>, <b>yil</b> opsiyonel</li>
                  </ul>
                </div>
              </details>

              <details>
                <summary className="text-sm text-blue-600 cursor-pointer select-none">JSON formatı?</summary>
                <p className="mt-2 text-xs text-gray-500">
                  İki şekil de desteklenir. Kategori alanı yoksa yukarıda seçtiğin <b>hedef ders</b> kullanılır.
                </p>
                <pre className="mt-1 text-xs bg-gray-50 border rounded p-3 overflow-auto">{`[
  {
    "body": "Türkçede kaç harf vardır?",
    "categoryId": "Türkçe",
    "options": ["26", "27", "28", "29"],
    "correctAnswer": "29"
  }
]

// veya soru bankası şekli (kategori yok → hedef ders):
[
  {
    "soru": "...",
    "siklar": ["A) ...", "B) ...", "C) ..."],
    "dogru_indeks": 3,        // veya "dogru_harf": "D"
    "zorluk": "orta",
    "yil": "2020"
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
              {failed > 0 && <p className="text-sm text-red-600">{failed} soru aktarılamadı</p>}
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
