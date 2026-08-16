"use client";
import axios from "axios";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdminCategories } from "@/lib/api/categories";
import { saveTopics, generateFromTopic, reviewTopics, type TopicTree, type TopicSubtopic, type Suggestion } from "@/lib/api/pipeline";
import { TopicTreeEditor, moveNode } from "@/components/topic-tree-editor";
import { TopicSuggestions } from "@/components/topic-suggestions";
import type { AdminCategory } from "@/lib/types";

export function TopicWorkspace({
  sourceId, tree, onTreeChange,
}: { sourceId: string; tree: TopicTree; onTreeChange: (t: TopicTree) => void }) {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedDersId, setSelectedDersId] = useState("");
  const [selectedKonuId, setSelectedKonuId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [count, setCount] = useState(10);
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [resultCount, setResultCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [reviewState, setReviewState] = useState<"idle" | "loading" | "error">("idle");
  const [reviewError, setReviewError] = useState("");

  useEffect(() => { getAdminCategories().then(setCategories); }, []);

  const rootIds = new Set(categories.filter((c) => !c.parentCategoryId).map((c) => c.id));
  const dersler = categories.filter((c) => c.parentCategoryId && rootIds.has(c.parentCategoryId));
  const konular = categories.filter((c) => c.parentCategoryId === selectedDersId);

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
    if (!selectedNodeId || !selectedKonuId) return;
    try {
      setPhase("generating");
      await saveTopics(sourceId, tree); // üretimden önce düzeltmeleri kaydet
      const res = await generateFromTopic(sourceId, selectedNodeId, { count, category_id: selectedKonuId });
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

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold">Konu Ağacı — {tree.file_name}</h1>
      <p className="text-gray-500 text-sm">Başlıkları düzelt, hedef kategoriyi ve üretilecek konuyu seç.</p>

      <TopicTreeEditor tree={tree} onChange={(t) => { setSaveState("idle"); onTreeChange(t); }} />
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

      <TopicSuggestions
        tree={tree}
        suggestions={tree.suggestions ?? []}
        onApply={handleApplySuggestion}
        onDismiss={handleDismissSuggestion}
      />

      <div className="rounded-lg border p-4 space-y-3">
        <div className="space-y-1">
          <Label>Ders (kayıt hedefi)</Label>
          <Select items={dersler.map((d) => ({ value: d.id, label: d.name }))}
                  onValueChange={(v) => { setSelectedDersId(v as string); setSelectedKonuId(""); }}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Ders seç..." /></SelectTrigger>
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
              <SelectTrigger className="w-full"><SelectValue placeholder="Konu seç..." /></SelectTrigger>
              <SelectContent>
                {konular.map((k) => (<SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        )}
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
        <div className="space-y-1">
          <Label>Kaç soru?</Label>
          <Input type="number" min={1} max={30} value={count}
                 onChange={(e) => setCount(Number(e.target.value))} className="w-32" />
        </div>
        <Button className="w-full" disabled={!selectedNodeId || !selectedKonuId || phase === "generating"}
                onClick={handleGenerate}>
          {phase === "generating" ? "Üretiliyor..." : "Soru Üret"}
        </Button>

        {phase === "done" && (
          <div className="rounded-md bg-green-50 text-green-700 text-sm p-3">
            ✅ {resultCount} soru veritabanına eklendi.{" "}
            <button className="underline" onClick={() => router.push("/questions?status=PendingReview")}>
              Bekleyenleri gör
            </button>
          </div>
        )}
        {phase === "error" && (
          <div className="rounded-md bg-red-50 text-red-700 text-sm p-3">{errorMsg}</div>
        )}
      </div>
    </div>
  );
}
