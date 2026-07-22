"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getAdminCategories } from "@/lib/api/categories";
import {
  uploadPdfToPipeline, getPipelineJob, saveTopics, generateFromTopic,
  type TopicTree,
} from "@/lib/api/pipeline";
import { TopicTreeEditor } from "@/components/topic-tree-editor";
import type { AdminCategory } from "@/lib/types";

type Step = "form" | "detecting" | "edit" | "generating" | "done" | "error";

export default function ContentPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedDersId, setSelectedDersId] = useState("");
  const [selectedKonuId, setSelectedKonuId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [tree, setTree] = useState<TopicTree | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [count, setCount] = useState(10);
  const [resultCount, setResultCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { getAdminCategories().then(setCategories); }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const rootIds = new Set(categories.filter((c) => !c.parentCategoryId).map((c) => c.id));
  const dersler = categories.filter((c) => c.parentCategoryId && rootIds.has(c.parentCategoryId));
  const konular = categories.filter((c) => c.parentCategoryId === selectedDersId);

  // Ağaçtaki tüm seçilebilir düğümler (konu + alt başlık)
  const nodeOptions = tree
    ? tree.topics.flatMap((t) => [
        { id: t.id, label: t.title },
        ...t.subtopics.map((s) => ({ id: s.id, label: `— ${s.title}` })),
      ])
    : [];

  async function handleUpload() {
    if (!file || !selectedKonuId) return;
    try {
      setStep("detecting");
      const { job_id } = await uploadPdfToPipeline(file);
      pollRef.current = setInterval(async () => {
        const job = await getPipelineJob(job_id);
        if (job.status === "done" && job.topics && job.source_id) {
          clearInterval(pollRef.current!);
          setSourceId(job.source_id);
          setTree(job.topics);
          setStep("edit");
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

  async function handleSaveTree() {
    if (!tree) return;
    const saved = await saveTopics(sourceId, tree);
    setTree(saved);
  }

  async function handleGenerate() {
    if (!selectedNodeId || !selectedKonuId) return;
    try {
      setStep("generating");
      if (tree) await saveTopics(sourceId, tree); // üretimden önce düzeltmeleri kaydet
      const res = await generateFromTopic(sourceId, selectedNodeId, {
        count, category_id: selectedKonuId,
      });
      if (res.export?.error) {
        setErrorMsg(`Sorular üretildi ama kaydedilemedi: ${res.export.error}`);
        setStep("error");
        return;
      }
      setResultCount(res.export?.imported ?? res.count);
      setStep("done");
    } catch {
      setErrorMsg("Üretim sırasında hata.");
      setStep("error");
    }
  }

  if (step === "detecting") {
    return <Centered emoji="⏳" spin title="Belge konulara ayrılıyor..." sub="Başlıklar tespit ediliyor." />;
  }
  if (step === "generating") {
    return <Centered emoji="⏳" spin title="Sorular üretiliyor..." sub="Bu işlem 1-2 dakika sürebilir." />;
  }
  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-5xl">✅</div>
        <p className="font-medium text-lg">{resultCount} soru veritabanına eklendi</p>
        <Button onClick={() => router.push("/questions?status=PendingReview")}>Bekleyen Soruları Gör</Button>
        <Button variant="outline" onClick={() => setStep("edit")}>Aynı belgeden üretmeye devam et</Button>
      </div>
    );
  }
  if (step === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-5xl">❌</div>
        <p className="font-medium text-red-600">Hata</p>
        <p className="text-sm text-gray-500 text-center max-w-sm">{errorMsg}</p>
        <Button variant="outline" onClick={() => setStep(tree ? "edit" : "form")}>Geri dön</Button>
      </div>
    );
  }

  if (step === "edit" && tree) {
    return (
      <div className="max-w-2xl mx-auto py-10 space-y-6">
        <h1 className="text-2xl font-bold">Konu Ağacı — {tree.file_name}</h1>
        <p className="text-gray-500 text-sm">Başlıkları düzelt, sonra bir konu seçip üret.</p>
        <TopicTreeEditor tree={tree} onChange={setTree} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveTree}>Ağacı Kaydet</Button>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <Label>Hangi konudan üretilsin?</Label>
          <Select items={nodeOptions.map((n) => ({ value: n.id, label: n.label }))}
                  onValueChange={(v) => setSelectedNodeId(v as string)}>
            <SelectTrigger><SelectValue placeholder="Konu/alt başlık seç..." /></SelectTrigger>
            <SelectContent>
              {nodeOptions.map((n) => (<SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label>Kaç soru?</Label>
            <Input type="number" min={1} max={30} value={count}
                   onChange={(e) => setCount(Number(e.target.value))} className="w-32" />
          </div>
          <Button className="w-full" disabled={!selectedNodeId} onClick={handleGenerate}>Soru Üret</Button>
        </div>
      </div>
    );
  }

  // step === "form"
  return (
    <div className="max-w-xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold">İçerik Üretimi</h1>
      <p className="text-gray-500 text-sm">Hedef kategoriyi seç, PDF yükle → belge konulara ayrılır → konu seçip üretirsin.</p>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Ders</Label>
          <Select items={dersler.map((d) => ({ value: d.id, label: d.name }))}
                  onValueChange={(v) => { setSelectedDersId(v as string); setSelectedKonuId(""); }}>
            <SelectTrigger><SelectValue placeholder="Ders seç..." /></SelectTrigger>
            <SelectContent>
              {dersler.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        {selectedDersId && (
          <div className="space-y-1">
            <Label>Konu (kayıt hedefi)</Label>
            <Select items={konular.map((k) => ({ value: k.id, label: k.name }))}
                    onValueChange={(v) => setSelectedKonuId(v as string)}>
              <SelectTrigger><SelectValue placeholder="Konu seç..." /></SelectTrigger>
              <SelectContent>
                {konular.map((k) => (<SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>))}
              </SelectContent>
            </Select>
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
            <input type="file" accept=".pdf" className="hidden"
                   onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <Button className="w-full" disabled={!file || !selectedKonuId} onClick={handleUpload}>
          Yükle ve Konulara Ayır
        </Button>
      </div>
    </div>
  );
}

function Centered({ emoji, spin, title, sub }: { emoji: string; spin?: boolean; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className={`text-2xl ${spin ? "animate-spin" : ""}`}>{emoji}</div>
      <p className="text-gray-600 font-medium">{title}</p>
      <p className="text-sm text-gray-400">{sub}</p>
    </div>
  );
}
