"use client";
import axios from "axios";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdminCategories } from "@/lib/api/categories";
import { saveTopics, generateFromTopic, generateFromSource, getPipelineJob, cancelPipelineJob, reviewTopics, type TopicTree, type TopicSubtopic, type Suggestion } from "@/lib/api/pipeline";
import { TopicTreeEditor, moveNode, visibleSuggestions } from "@/components/topic-tree-editor";
import { SuggestionPreview } from "@/components/suggestion-preview";
import type { AdminCategory } from "@/lib/types";

export function TopicWorkspace({
  sourceId, tree, onTreeChange,
}: { sourceId: string; tree: TopicTree; onTreeChange: (t: TopicTree) => void }) {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedDersId, setSelectedDersId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [mode, setMode] = useState<"all" | "topic">("all");
  const [count, setCount] = useState(10);
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [resultCount, setResultCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [reviewState, setReviewState] = useState<"idle" | "loading" | "error">("idle");
  const [reviewError, setReviewError] = useState("");
  const [selectedSugNodeId, setSelectedSugNodeId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; current: string }>(
    { done: 0, total: 0, current: "" }
  );
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);  // İptal isteği için etkin job_id
  const jobKey = `pipeline-gen-job:${sourceId}`;

  // "Tüm kaynaktan üret" job'ının ilerleme yoklamasını kurar. job_id localStorage'da
  // tutulduğundan reload/logout sonrası da bu fonksiyonla kaldığı yerden devam eder.
  function startJobPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    jobIdRef.current = jobId;  // İptal isteği bu job'a gider
    setPhase("generating");    // hem üretim hem reload-resume yolu buradan generating'e girer
    pollRef.current = setInterval(async () => {
      try {
        const job = await getPipelineJob(jobId);
        setProgress({ done: job.done ?? 0, total: job.total ?? 0, current: job.current ?? "" });
        // "cancelled": iptal edilen iş de kısmi sonuçla biter → done ekranı, iptal notuyla.
        if (job.status === "done" || job.status === "cancelled") {
          clearInterval(pollRef.current!);
          localStorage.removeItem(jobKey);
          setCancelling(false);
          if (job.export?.error) {
            setErrorMsg(`Sorular üretildi ama kaydedilemedi: ${job.export.error}`);
            setPhase("error");
            return;
          }
          setResultCount(job.export?.imported ?? job.count ?? 0);
          setCancelled(job.status === "cancelled");
          setPhase("done");
        } else if (job.status === "error") {
          clearInterval(pollRef.current!);
          localStorage.removeItem(jobKey);
          setCancelling(false);
          setErrorMsg(job.error ?? "Üretim sırasında hata.");
          setPhase("error");
        }
      } catch (err) {
        clearInterval(pollRef.current!);
        localStorage.removeItem(jobKey);
        setCancelling(false);
        // Job yok (ör. pipeline yeniden başladı) → sessizce idle; başka hata → göster.
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setPhase("idle");
        } else {
          setErrorMsg("Üretim durumu alınamadı.");
          setPhase("error");
        }
      }
    }, 2000);
  }

  useEffect(() => { getAdminCategories().then(setCategories); }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  // Reload/geri geliş: bu kaynak için kayıtlı çalışan iş varsa ilerleme çubuğunu geri getir.
  useEffect(() => {
    const saved = localStorage.getItem(jobKey);
    if (saved) queueMicrotask(() => startJobPolling(saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  // Görünür öneriler + etkin seçim (seçili öneri listeden düşerse ilkine döner).
  const visibleSugs = visibleSuggestions(tree, tree.suggestions ?? []);
  const effectiveSelectedSug =
    selectedSugNodeId && visibleSugs.some((s) => s.node_id === selectedSugNodeId)
      ? selectedSugNodeId
      : (visibleSugs[0]?.node_id ?? null);

  const rootIds = new Set(categories.filter((c) => !c.parentCategoryId).map((c) => c.id));
  const dersler = categories.filter((c) => c.parentCategoryId && rootIds.has(c.parentCategoryId));

  // Parent (gruplama) + tüm çocuklar seçilebilir; girinti derinliği gösterir.
  // Parent seçilince backend where=parent_id ile tüm çocukların içeriğini çeker.
  const flattenSubs = (subs: TopicSubtopic[], depth: number): { id: string; label: string }[] =>
    subs.flatMap((s) => [
      { id: s.id, label: `${"— ".repeat(depth)}${s.title}` },
      ...flattenSubs(s.subtopics ?? [], depth + 1),
    ]);
  const nodeOptions = tree.topics.flatMap((t) => [
    { id: t.id, label: t.title },
    ...flattenSubs(t.subtopics, 1),
  ]);

  function getPipelineErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError(err)) {
      const msg = err.response?.data?.error;
      if (typeof msg === "string" && msg) return msg;
    }
    return fallback;
  }

  async function handleSaveTree() {
    try {
      setSaveState("saving");
      const saved = await saveTopics(sourceId, tree);
      onTreeChange(saved);
      setSaveState("saved");
    } catch (err) {
      setSaveError(getPipelineErrorMessage(err, "Ağaç kaydedilemedi."));
      setSaveState("error");
    }
  }

  async function handleReview() {
    try {
      setReviewState("loading");
      const reviewed = await reviewTopics(sourceId);
      onTreeChange(reviewed);
      setReviewState("idle");
    } catch (err) {
      setReviewError(getPipelineErrorMessage(err, "Öneriler alınamadı."));
      setReviewState("error");
    }
  }

  function handleApplySuggestion(s: Suggestion) {
    const next = moveNode(tree, s.node_id, s.new_parent_id, s.topic_id);
    next.suggestions = (tree.suggestions ?? []).filter((x) => x !== s);
    setSaveState("idle"); // ağaç değişti → kaydet banner'ını sıfırla
    onTreeChange(next);
  }

  function handleDismissSuggestion(s: Suggestion) {
    onTreeChange({ ...tree, suggestions: (tree.suggestions ?? []).filter((x) => x !== s) });
  }

  async function handleGenerate() {
    if (mode === "topic") return handleGenerateFromNode();
    return handleGenerateFromSource();
  }

  // Seçilen tek ağaç düğümünden üret; sorular seçilen Ders'e kaydedilir.
  async function handleGenerateFromNode() {
    if (!selectedNodeId || !selectedDersId) return;
    try {
      setPhase("generating");
      await saveTopics(sourceId, tree); // üretimden önce düzeltmeleri kaydet
      const res = await generateFromTopic(sourceId, selectedNodeId, { count, category_id: selectedDersId });
      if (res.export?.error) {
        setErrorMsg(`Sorular üretildi ama kaydedilemedi: ${res.export.error}`);
        setPhase("error");
        return;
      }
      setResultCount(res.export?.imported ?? res.count);
      setPhase("done");
    } catch {
      setErrorMsg("Üretim sırasında hata.");
      setPhase("error");
    }
  }

  // Tüm kaynaktan: uzun süren iş. Endpoint job_id döner; ilerleme getPipelineJob ile ~2 sn'de bir
  // yoklanır (upload akışındaki desenle aynı). Sorular Ders'e kaydedilir, topic_id ile etiketlenir.
  async function handleGenerateFromSource() {
    if (!selectedDersId) return;
    try {
      setCancelled(false);
      setCancelling(false);
      setPhase("generating");
      setProgress({ done: 0, total: 0, current: "" });
      await saveTopics(sourceId, tree); // üretimden önce düzeltmeleri kaydet
      const { job_id } = await generateFromSource(sourceId, { category_id: selectedDersId });
      if (!job_id) {
        setErrorMsg("Üretim işi başlatılamadı (pipeline job desteği gerekiyor).");
        setPhase("error");
        return;
      }
      localStorage.setItem(jobKey, job_id);
      startJobPolling(job_id);
    } catch {
      setErrorMsg("Üretim başlatılamadı.");
      setPhase("error");
    }
  }

  // İptal: pipeline'a cancel isteği gider; iş bayrağı görüp durur ve kısmi sonucu
  // kaydeder. Ekranı polling "cancelled" durumunu görünce sonlandırır. İstek
  // başarısız olursa iş sürebilir → cancelling'i bırak, kullanıcı tekrar deneyebilir.
  async function handleCancelGeneration() {
    if (!jobIdRef.current) return;
    try {
      setCancelling(true);
      await cancelPipelineJob(jobIdRef.current);
    } catch {
      setCancelling(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold">Konu Ağacı — {tree.file_name}</h1>
      <p className="text-gray-500 text-sm">Başlıkları düzelt, hedef kategoriyi ve üretilecek konuyu seç.</p>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Button variant="outline" disabled={saveState === "saving"} onClick={handleSaveTree}>
            {saveState === "saving" ? "Kaydediliyor..." : "Ağacı Kaydet"}
          </Button>
          <Button variant="outline" disabled={reviewState === "loading"} onClick={handleReview}>
            {reviewState === "loading"
              ? "Öneriler alınıyor..."
              : (tree.suggestions?.length ? "Önerileri Yenile" : "Önerileri Getir")}
          </Button>
        </div>
        {saveState === "saved" && (
          <div className="rounded-md bg-green-50 text-green-700 text-sm p-3">
            ✅ Ağaç kaydedildi.{" "}
            <button className="underline" onClick={() => router.push("/sources")}>
              Kaynaklarda gör
            </button>
          </div>
        )}
        {saveState === "error" && (
          <div className="rounded-md bg-red-50 text-red-700 text-sm p-3">{saveError}</div>
        )}
        {reviewState === "error" && (
          <div className="rounded-md bg-red-50 text-red-700 text-sm p-3">{reviewError}</div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <TopicTreeEditor
          tree={tree}
          onChange={(t) => { setSaveState("idle"); onTreeChange(t); }}
          suggestions={tree.suggestions ?? []}
          selectedNodeId={effectiveSelectedSug}
          onSelectSuggestion={setSelectedSugNodeId}
        />
        {visibleSugs.length > 0 && (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <SuggestionPreview
              tree={tree}
              suggestions={tree.suggestions ?? []}
              selectedNodeId={effectiveSelectedSug}
              onSelect={setSelectedSugNodeId}
              onApply={handleApplySuggestion}
              onDismiss={handleDismissSuggestion}
            />
          </div>
        )}
      </div>

      <div className="max-w-2xl rounded-lg border p-4 space-y-3">
        <div className="flex gap-2">
          <Button variant={mode === "all" ? "default" : "outline"} className="flex-1"
                  onClick={() => setMode("all")}>Tüm kaynaktan</Button>
          <Button variant={mode === "topic" ? "default" : "outline"} className="flex-1"
                  onClick={() => setMode("topic")}>Belirli konudan</Button>
        </div>
        <div className="space-y-1">
          <Label>Ders (kayıt hedefi)</Label>
          <Select items={dersler.map((d) => ({ value: d.id, label: d.name }))}
                  onValueChange={(v) => setSelectedDersId(v as string)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Ders seç..." /></SelectTrigger>
            <SelectContent>
              {dersler.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        {mode === "topic" && (
          <div className="space-y-1">
            <Label>Hangi konudan üretilsin?</Label>
            <Select items={nodeOptions.map((n) => ({ value: n.id, label: n.label }))}
                    onValueChange={(v) => setSelectedNodeId(v as string)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Konu/alt başlık seç..." /></SelectTrigger>
              <SelectContent>
                {nodeOptions.map((n) => (<SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}
        {mode === "all" && (
          <p className="text-sm text-gray-500">
            Kaynağın tümünden, ağaçta gezerek (her başlık ve alt başlık) üretilir. Soru sayısı
            içerik boyutuna göre <b>otomatik</b> belirlenir; sorular <b>Ders</b> altına kaydedilir.
          </p>
        )}
        {mode === "all" && phase === "generating" && (
          <div className="space-y-1">
            <div className="h-2 w-full rounded bg-gray-200">
              <div className="h-2 rounded bg-blue-600 transition-all"
                   style={{ width: progress.total > 0
                     ? `${Math.round((progress.done / progress.total) * 100)}%` : "0%" }} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500">
                {progress.total > 0
                  ? `${progress.done}/${progress.total}${progress.current ? ` — ${progress.current}` : ""}`
                  : "Üretim başlatılıyor..."}
              </p>
              <Button variant="outline" size="sm" disabled={cancelling}
                      onClick={handleCancelGeneration}>
                {cancelling ? "İptal ediliyor..." : "İptal"}
              </Button>
            </div>
          </div>
        )}
        {mode === "topic" && (
          <div className="space-y-1">
            <Label>Kaç soru?</Label>
            <Input type="number" min={1} max={30} value={count}
                   onChange={(e) => setCount(Number(e.target.value))} className="w-32" />
          </div>
        )}
        <Button className="w-full" onClick={handleGenerate}
                disabled={phase === "generating" ||
                  (mode === "all" ? !selectedDersId : (!selectedNodeId || !selectedDersId))}>
          {phase === "generating" ? "Üretiliyor..." : "Soru Üret"}
        </Button>

        {phase === "done" && (
          <div className="space-y-2">
            <div className={`rounded-md text-sm p-3 ${cancelled
              ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
              {cancelled
                ? `⏹️ İptal edildi — ${resultCount} soru kaydedildi.`
                : `✅ ${resultCount} soru veritabanına eklendi.`}{" "}
              <button className="underline" onClick={() => router.push("/questions?status=PendingReview")}>
                Bekleyenleri gör
              </button>
            </div>
            {errorMsg && (
              <div className="rounded-md bg-amber-50 text-amber-700 text-sm p-3">⚠️ {errorMsg}</div>
            )}
          </div>
        )}
        {phase === "error" && (
          <div className="rounded-md bg-red-50 text-red-700 text-sm p-3">{errorMsg}</div>
        )}
      </div>
    </div>
  );
}
