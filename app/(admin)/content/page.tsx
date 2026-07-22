"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  uploadPdfToPipeline, getPipelineJob, listSources,
  type TopicTree, type SourceSummary,
} from "@/lib/api/pipeline";
import { TopicWorkspace } from "@/components/topic-workspace";

type Step = "form" | "detecting" | "edit" | "error";

export default function ContentPage() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [tree, setTree] = useState<TopicTree | null>(null);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { listSources().then(setSources).catch(() => {}); }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const duplicate = file != null && sources.some((s) => s.file_name === file.name);

  async function handleUpload() {
    if (!file) return;
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

  if (step === "detecting") {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="text-2xl animate-spin">⏳</div>
        <p className="text-gray-600 font-medium">Belge konulara ayrılıyor...</p>
        <p className="text-sm text-gray-400">Başlıklar tespit ediliyor.</p>
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
    return <TopicWorkspace sourceId={sourceId} tree={tree} onTreeChange={setTree} />;
  }

  // step === "form"
  return (
    <div className="max-w-xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold">İçerik Üretimi</h1>
      <p className="text-gray-500 text-sm">PDF yükle → belge konulara ayrılır → konu seçip üretirsin.</p>
      <div className="space-y-4">
        <div className="space-y-1">
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
          {duplicate && (
            <p className="text-xs text-amber-600">
              ⚠️ Bu adla bir kaynak zaten var. Yine de yükleyebilirsin (ayrı kaynak olarak eklenir).
            </p>
          )}
        </div>
        <Button className="w-full" disabled={!file} onClick={handleUpload}>
          Yükle ve Konulara Ayır
        </Button>
      </div>
    </div>
  );
}
