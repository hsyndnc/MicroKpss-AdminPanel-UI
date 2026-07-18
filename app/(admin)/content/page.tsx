"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminCategories, createCategory } from "@/lib/api/categories";
import { uploadPdfToPipeline, getPipelineJob } from "@/lib/api/pipeline";
import type { AdminCategory } from "@/lib/types";

type Step = "form" | "processing" | "done" | "error" | "export_error";

export default function ContentPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedDersId, setSelectedDersId] = useState("");
  const [selectedKonuId, setSelectedKonuId] = useState("");
  const [newKonuName, setNewKonuName] = useState("");
  const [isNewKonu, setIsNewKonu] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [nQuestions, setNQuestions] = useState(10);
  const [step, setStep] = useState<Step>("form");
  const [resultCount, setResultCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getAdminCategories().then(setCategories);
  }, []);

  const dersler = categories.filter((c) => c.parentCategoryId !== null && c.parentCategoryId !== undefined);
  const konular = categories.filter((c) => c.parentCategoryId === selectedDersId);

  async function handleSubmit() {
    if (!file || !selectedDersId) return;

    let categoryId = selectedKonuId;

    if (isNewKonu) {
      if (!newKonuName.trim()) return;
      const created = await createCategory({
        name: newKonuName.trim(),
        parentCategoryId: selectedDersId,
      });
      categoryId = created.id;
    }

    if (!categoryId) return;

    try {
      setStep("processing");
      const { job_id } = await uploadPdfToPipeline(file, categoryId, nQuestions);

      pollRef.current = setInterval(async () => {
        const job = await getPipelineJob(job_id);
        if (job.status === "done") {
          clearInterval(pollRef.current!);
          if (job.export?.error) {
            setErrorMsg(
              `Sorular üretildi (${job.count ?? 0} adet) ama veritabanına kaydedilemedi: ${job.export.error}`
            );
            setStep("export_error");
            return;
          }
          setResultCount(job.export?.imported ?? job.count ?? 0);
          setStep("done");
        } else if (job.status === "error") {
          clearInterval(pollRef.current!);
          setErrorMsg(job.error ?? "Bilinmeyen hata");
          setStep("error");
        }
      }, 3000);
    } catch {
      setErrorMsg("Pipeline'a bağlanılamadı.");
      setStep("error");
    }
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-2xl animate-spin">⏳</div>
        <p className="text-gray-600 font-medium">Sorular üretiliyor...</p>
        <p className="text-sm text-gray-400">Bu işlem 1-2 dakika sürebilir.</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-5xl">✅</div>
        <p className="font-medium text-lg">{resultCount} soru veritabanına eklendi</p>
        <p className="text-sm text-gray-500">Sorular inceleme kuyruğuna eklendi.</p>
        <Button onClick={() => router.push("/questions?status=PendingReview")}>
          Bekleyen Soruları Gör
        </Button>
      </div>
    );
  }

  if (step === "export_error") {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-5xl">⚠️</div>
        <p className="font-medium text-orange-600">Sorular üretildi ama kaydedilemedi</p>
        <p className="text-sm text-gray-500 text-center max-w-sm">{errorMsg}</p>
        <p className="text-xs text-gray-400">Backend loglarını kontrol edin.</p>
        <Button variant="outline" onClick={() => setStep("form")}>Tekrar Dene</Button>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-5xl">❌</div>
        <p className="font-medium text-red-600">Hata oluştu</p>
        <p className="text-sm text-gray-500">{errorMsg}</p>
        <Button variant="outline" onClick={() => setStep("form")}>Tekrar Dene</Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold">İçerik Üretimi</h1>
      <p className="text-gray-500 text-sm">
        PDF yükle → AI sorular üretir → Sen onayla → Uygulamaya yansır
      </p>

      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Ders</Label>
          <Select onValueChange={(v) => { setSelectedDersId(v as string); setSelectedKonuId(""); setIsNewKonu(false); }}>
            <SelectTrigger><SelectValue placeholder="Ders seç..." /></SelectTrigger>
            <SelectContent>
              {dersler.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedDersId && (
          <div className="space-y-1">
            <Label>Konu</Label>
            <Select onValueChange={(v) => {
              const val = v as string;
              if (val === "__new__") { setIsNewKonu(true); setSelectedKonuId(""); }
              else { setIsNewKonu(false); setSelectedKonuId(val); }
            }}>
              <SelectTrigger><SelectValue placeholder="Konu seç..." /></SelectTrigger>
              <SelectContent>
                {konular.map((k) => (
                  <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                ))}
                <SelectItem value="__new__">+ Yeni konu ekle...</SelectItem>
              </SelectContent>
            </Select>
            {isNewKonu && (
              <Input
                placeholder="Konu adı gir..."
                value={newKonuName}
                onChange={(e) => setNewKonuName(e.target.value)}
                className="mt-2"
              />
            )}
          </div>
        )}

        <div className="space-y-1">
          <Label>PDF Dosyası</Label>
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            {file ? (
              <span className="text-sm font-medium text-blue-600">{file.name}</span>
            ) : (
              <>
                <span className="text-sm text-gray-500">PDF dosyasını sürükle veya tıkla</span>
                <span className="text-xs text-gray-400 mt-1">Sadece .pdf</span>
              </>
            )}
            <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="space-y-1">
          <Label>Kaç soru üretilsin?</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={nQuestions}
            onChange={(e) => setNQuestions(Number(e.target.value))}
            className="w-32"
          />
        </div>

        <Button
          className="w-full"
          disabled={!file || !selectedDersId || (!selectedKonuId && !isNewKonu) || (isNewKonu && !newKonuName.trim())}
          onClick={handleSubmit}
        >
          Soru Üret
        </Button>
      </div>
    </div>
  );
}
