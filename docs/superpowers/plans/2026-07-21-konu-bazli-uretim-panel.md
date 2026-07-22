# Konu-Bazlı Soru Üretimi — Panel Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İçerik Üretimi akışını değiştir: PDF yüklenince pipeline belgeyi konu→alt başlık ağacına ayırır; admin ağacı düzeltir; sonra seçtiği konudan N soru üretir.

**Architecture:** Panel pipeline'a kendi Next.js route-handler proxy'si (`/api/pipeline/*`, `X-Api-Key` sunucuda) üzerinden gider — backend bu akışta yok. Üç faz: (1) hedef kategori seç + PDF yükle → tespit, (2) konu ağacını göster/düzelt (PUT), (3) konu seç + adet/tip → üret (pipeline export'u backend'e yazar).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, axios, Tailwind, @base-ui/react, react-hook-form.

**Spec:** kpss-content-pipeline reposunda `docs/superpowers/specs/2026-07-21-konu-bazli-uretim-design.md`

## Global Constraints

- Branch: **main** (bu repoda iş main'de yürüyor).
- Bu repoda **birim test yok** → her task'ın doğrulaması `npm run build` (typecheck) + `npm run lint` + belirtilen **manuel kontrol**.
- Pipeline'a yalnız `/api/pipeline/*` proxy route handler'ları üzerinden gidilir; `PIPELINE_API_KEY` asla tarayıcıya inmez.
- Commit ATMADAN ÖNCE kullanıcıya sor (kullanıcı tercihi).
- UI adlandırma: **backend kategorisi** = "Ders/Konu" (export hedefi, mevcut); **belge yapısı** = "Konu Ağacı → Konu / Alt Başlık". İkisi ayrı fazlarda gösterilir.

## Önkoşullar (Pipeline)

Panel bu pipeline sözleşmesine dayanır (pipeline planı: `kpss-content-pipeline/docs/superpowers/plans/2026-07-21-konu-bazli-uretim-pipeline.md`):

- `POST /upload` (yalnız `file`) → `{job_id, status, file}`; job `done` olduğunda `{status:"done", source_id, topics, previews}`.
- `GET /sources/{id}/topics` → `{source_id, file_name, topics, previews}`.
- `PUT /sources/{id}/topics` (ağaç) → `{status:"ok", topics}`.
- `POST /sources/{id}/topics/{nodeId}/generate` `{count, category_id, tip?}` → `{status:"ok", count, questions, export}`.
- **EKLEME (pipeline planına):** ağaç yanıtına `previews: { [chunk_id]: string }` (her chunk'ın ilk ~80 karakteri). Chunk yeniden atama UI'ı chunk içeriğini göstermek için buna ihtiyaç duyar. Bu alan olmadan Task 4'teki chunk-taşıma devre dışı bırakılmalı.

Ağaç tipi:
```ts
interface TopicSubtopic { id: string; title: string; chunk_ids: string[]; }
interface Topic { id: string; title: string; subtopics: TopicSubtopic[]; }
interface TopicTree {
  source_id: string; file_name: string;
  topics: Topic[];
  previews?: Record<string, string>;
}
```

---

## Dosya Yapısı

- Create: `app/api/pipeline/sources/[id]/topics/route.ts` — GET + PUT proxy
- Create: `app/api/pipeline/sources/[id]/topics/[nodeId]/generate/route.ts` — POST proxy
- Modify: `lib/api/pipeline.ts` — upload imzası + ağaç tipleri + getTopics/saveTopics/generateFromTopic
- Create: `components/topic-tree-editor.tsx` — ağaç görünümü + düzenleme
- Modify: `app/(admin)/content/page.tsx` — 3 fazlı akış

---

### Task 1: Pipeline proxy route handler'ları (topics + generate)

**Files:**
- Create: `app/api/pipeline/sources/[id]/topics/route.ts`
- Create: `app/api/pipeline/sources/[id]/topics/[nodeId]/generate/route.ts`

**Interfaces:**
- Produces: `/api/pipeline/sources/{id}/topics` (GET, PUT); `/api/pipeline/sources/{id}/topics/{nodeId}/generate` (POST) — hepsi `PIPELINE_URL`'e X-Api-Key ile geçer. Mevcut `app/api/pipeline/jobs/[id]/route.ts` deseniyle aynı.

- [ ] **Step 1: topics route handler (GET+PUT)**

```ts
// app/api/pipeline/sources/[id]/topics/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(
    `${process.env.PIPELINE_URL}/sources/${encodeURIComponent(id)}/topics`,
    { headers: { "X-Api-Key": process.env.PIPELINE_API_KEY ?? "" }, cache: "no-store" }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.text();
  const res = await fetch(
    `${process.env.PIPELINE_URL}/sources/${encodeURIComponent(id)}/topics`,
    {
      method: "PUT",
      headers: {
        "X-Api-Key": process.env.PIPELINE_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body,
    }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

- [ ] **Step 2: generate route handler (POST)**

```ts
// app/api/pipeline/sources/[id]/topics/[nodeId]/generate/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const { id, nodeId } = await params;
  const body = await request.text();
  const res = await fetch(
    `${process.env.PIPELINE_URL}/sources/${encodeURIComponent(id)}/topics/${encodeURIComponent(nodeId)}/generate`,
    {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.PIPELINE_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body,
    }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

- [ ] **Step 3: Doğrula**

Run: `npm run build`
Expected: TypeScript/derleme hatası yok.
Manuel: (pipeline ayaktayken) `curl` yerine tarayıcı yerine — bu adımda sadece build yeterli; uçtan uca Task 4'te.

- [ ] **Step 4: Commit**

```bash
git add app/api/pipeline/sources
git commit -m "feat: pipeline topics + generate proxy route handler'ları"
```

---

### Task 2: API client + tipler (`lib/api/pipeline.ts`)

**Files:**
- Modify: `lib/api/pipeline.ts`

**Interfaces:**
- Consumes: Task 1 proxy route'ları.
- Produces: `uploadPdfToPipeline(file)`, `getTopics(sourceId)`, `saveTopics(sourceId, tree)`, `generateFromTopic(sourceId, nodeId, body)`, `TopicTree`/`Topic`/`TopicSubtopic` tipleri.

- [ ] **Step 1: `uploadPdfToPipeline` imzasını sadeleştir + tipleri ekle**

`lib/api/pipeline.ts` tamamını şununla değiştir:

```ts
import axios from "axios";

// Pipeline'a doğrudan değil, kendi route handler proxy'mize gidiyoruz —
// X-Api-Key sadece sunucu tarafında eklenir, tarayıcıya inmez.
const pipelineClient = axios.create({ baseURL: "/api/pipeline" });

export interface TopicSubtopic {
  id: string;
  title: string;
  chunk_ids: string[];
}
export interface Topic {
  id: string;
  title: string;
  subtopics: TopicSubtopic[];
}
export interface TopicTree {
  source_id: string;
  file_name: string;
  topics: Topic[];
  previews?: Record<string, string>;
}

export interface PipelineUploadResponse {
  job_id: string;
  status: string;
  file: string;
}

export interface PipelineJobResponse {
  status: "queued" | "processing" | "done" | "error";
  file: string;
  source_id?: string;
  topics?: TopicTree;
  error?: string;
}

export interface GenerateResult {
  status: string;
  count: number;
  export?: { imported?: number; error?: string };
}

export async function uploadPdfToPipeline(file: File): Promise<PipelineUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await pipelineClient.post<PipelineUploadResponse>("/upload", form);
  return data;
}

export async function getPipelineJob(jobId: string): Promise<PipelineJobResponse> {
  const { data } = await pipelineClient.get<PipelineJobResponse>(`/jobs/${jobId}`);
  return data;
}

export async function getTopics(sourceId: string): Promise<TopicTree> {
  const { data } = await pipelineClient.get<TopicTree>(`/sources/${sourceId}/topics`);
  return data;
}

export async function saveTopics(sourceId: string, tree: TopicTree): Promise<TopicTree> {
  const { data } = await pipelineClient.put<{ topics: TopicTree }>(
    `/sources/${sourceId}/topics`, tree
  );
  return data.topics;
}

export async function generateFromTopic(
  sourceId: string,
  nodeId: string,
  body: { count: number; category_id: string; tip?: string }
): Promise<GenerateResult> {
  const { data } = await pipelineClient.post<GenerateResult>(
    `/sources/${sourceId}/topics/${nodeId}/generate`, body
  );
  return data;
}
```

- [ ] **Step 2: Doğrula**

Run: `npm run build`
Expected: Hata yok. (Not: `content/page.tsx` şu an eski `uploadPdfToPipeline(file, categoryId, nQuestions)` imzasını kullanıyor → build KIRILIR. Task 4'te düzeltilecek; bu task'ı Task 4 ile aynı PR'da tut ya da bu adımda `content/page.tsx`'in eski çağrısını geçici yorumlama YAPMA — sıralı git: Task 2 sonrası build kırıksa Task 4 hemen ardından gelir.)

> Uygulama notu: Task 2 ve Task 4 birlikte derlenir. İstersen Task 2'yi commit'lemeden Task 4'e geç, ikisini tek commit yap.

- [ ] **Step 3: Commit (Task 4 ile birlikte de olabilir)**

```bash
git add lib/api/pipeline.ts
git commit -m "feat: pipeline API — topics/generate fonksiyonları + tipler"
```

---

### Task 3: Konu ağacı düzenleyici bileşeni (`components/topic-tree-editor.tsx`)

**Files:**
- Create: `components/topic-tree-editor.tsx`

**Interfaces:**
- Consumes: `TopicTree` (Task 2 tipi), `previews` haritası.
- Produces: `<TopicTreeEditor tree onChange />` — kontrollü; her düzenlemede güncel ağacı `onChange` ile üst bileşene verir. Kaydetme üst bileşende.

Düzenleme yetenekleri (v1): konu/alt başlık **yeniden adlandır**, alt başlık **ekle/sil**, alt başlığı **başka konuya taşı**, chunk'ı **başka alt başlığa taşı** (previews varsa).

- [ ] **Step 1: Bileşeni yaz**

```tsx
// components/topic-tree-editor.tsx
"use client";
import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { TopicTree, Topic, TopicSubtopic } from "@/lib/api/pipeline";

interface Props {
  tree: TopicTree;
  onChange: (t: TopicTree) => void;
}

export function TopicTreeEditor({ tree, onChange }: Props) {
  // Tüm alt başlıklar (chunk taşıma hedefleri için)
  const allSubs = useMemo(
    () => tree.topics.flatMap((t) => t.subtopics.map((s) => ({ id: s.id, label: `${t.title} › ${s.title}` }))),
    [tree]
  );

  function update(mut: (draft: TopicTree) => void) {
    const draft: TopicTree = structuredClone(tree);
    mut(draft);
    onChange(draft);
  }

  function renameTopic(tid: string, title: string) {
    update((d) => { const t = d.topics.find((x) => x.id === tid); if (t) t.title = title; });
  }
  function renameSub(sid: string, title: string) {
    update((d) => d.topics.forEach((t) => t.subtopics.forEach((s) => { if (s.id === sid) s.title = title; })));
  }
  function deleteSub(sid: string) {
    update((d) => d.topics.forEach((t) => { t.subtopics = t.subtopics.filter((s) => s.id !== sid); }));
  }
  function addSub(tid: string) {
    update((d) => {
      const t = d.topics.find((x) => x.id === tid);
      if (t) t.subtopics.push({ id: crypto.randomUUID(), title: "Yeni alt başlık", chunk_ids: [] });
    });
  }
  function moveSubToTopic(sid: string, destTopicId: string) {
    update((d) => {
      let moved: TopicSubtopic | undefined;
      d.topics.forEach((t) => {
        const i = t.subtopics.findIndex((s) => s.id === sid);
        if (i >= 0) { moved = t.subtopics.splice(i, 1)[0]; }
      });
      const dest = d.topics.find((t) => t.id === destTopicId);
      if (moved && dest) dest.subtopics.push(moved);
    });
  }
  function moveChunk(chunkId: string, destSubId: string) {
    update((d) => {
      d.topics.forEach((t) => t.subtopics.forEach((s) => {
        s.chunk_ids = s.chunk_ids.filter((c) => c !== chunkId);
      }));
      d.topics.forEach((t) => t.subtopics.forEach((s) => {
        if (s.id === destSubId) s.chunk_ids.push(chunkId);
      }));
    });
  }

  return (
    <div className="space-y-4">
      {tree.topics.map((topic: Topic) => (
        <div key={topic.id} className="rounded-lg border p-3 space-y-2">
          <Input
            value={topic.title}
            onChange={(e) => renameTopic(topic.id, e.target.value)}
            className="font-semibold"
          />
          {topic.subtopics.map((sub) => (
            <div key={sub.id} className="ml-3 rounded-md border bg-gray-50 p-2 space-y-1">
              <div className="flex items-center gap-2">
                <Input value={sub.title} onChange={(e) => renameSub(sub.id, e.target.value)} />
                <span className="text-xs text-gray-500 whitespace-nowrap">{sub.chunk_ids.length} chunk</span>
                <Select
                  items={tree.topics.map((t) => ({ value: t.id, label: t.title }))}
                  onValueChange={(v) => moveSubToTopic(sub.id, v as string)}
                >
                  <SelectTrigger className="w-32"><SelectValue placeholder="Taşı →" /></SelectTrigger>
                  <SelectContent>
                    {tree.topics.map((t) => (<SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => deleteSub(sub.id)}>Sil</Button>
              </div>
              {tree.previews && sub.chunk_ids.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500">Parçalar</summary>
                  <div className="mt-1 space-y-1">
                    {sub.chunk_ids.map((cid) => (
                      <div key={cid} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-gray-600">
                          {tree.previews?.[cid] ?? cid}
                        </span>
                        <Select items={allSubs.map((s) => ({ value: s.id, label: s.label }))}
                                onValueChange={(v) => moveChunk(cid, v as string)}>
                          <SelectTrigger className="w-40"><SelectValue placeholder="Taşı →" /></SelectTrigger>
                          <SelectContent>
                            {allSubs.map((s) => (<SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => addSub(topic.id)}>+ Alt başlık ekle</Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Doğrula**

Run: `npm run build`
Expected: Hata yok. (Bu bileşen henüz kullanılmıyor; Task 4'te bağlanır.)

- [ ] **Step 3: Commit**

```bash
git add components/topic-tree-editor.tsx
git commit -m "feat: konu ağacı düzenleyici bileşeni"
```

---

### Task 4: İçerik Üretimi sayfasını 3 fazlı akışa çevir

**Files:**
- Modify: `app/(admin)/content/page.tsx`

**Interfaces:**
- Consumes: `uploadPdfToPipeline`, `getPipelineJob`, `saveTopics`, `generateFromTopic`, `TopicTree`, `TopicTreeEditor`, `getAdminCategories`, `createCategory`.

Akış: **form** (hedef kategori Ders/Konu + PDF) → **detecting** (upload+poll) → **edit** (TopicTreeEditor + üret formu) → **done/error**.

- [ ] **Step 1: Sayfayı yeniden yaz**

`app/(admin)/content/page.tsx` tamamını şununla değiştir:

```tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getAdminCategories, createCategory } from "@/lib/api/categories";
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
```

> Not: "Yeni konu ekle" (createCategory) akışı sadeleştirme için çıkarıldı; gerekirse mevcut koddan geri eklenebilir. `tip` seçici opsiyonel — v1'de gönderilmiyor (pipeline otomatik döngü). İstenirse Select ile eklenir.

- [ ] **Step 2: Doğrula (build + lint)**

Run: `npm run build && npm run lint`
Expected: Hata yok.

- [ ] **Step 3: Manuel uçtan uca (pipeline + backend ayaktayken)**

1. `/content` → Ders + Konu seç → PDF yükle → **"Yükle ve Konulara Ayır"**.
2. Tespit bitince konu ağacı görünür. Bir başlığı yeniden adlandır, "Ağacı Kaydet" → hata yok.
3. Bir konu seç, adet gir, **"Soru Üret"** → done ekranı, "Bekleyen Soruları Gör" çalışır.
4. `/questions?status=PendingReview` → üretilen sorular seçilen backend kategorisinde.

- [ ] **Step 4: Commit**

```bash
git add app/(admin)/content/page.tsx lib/api/pipeline.ts
git commit -m "feat: içerik üretimi — konu ağacı düzenleme + konudan üretim akışı"
```

---

## Self-Review Notları

- **Spec kapsamı (panel):** ağaç görünüm+düzenleme (Task 3), üret formu (Task 4), proxy+API (Task 1-2) → spec §7 panel maddesi karşılanıyor.
- **Routing:** panel→Next.js proxy→pipeline (mevcut desen); **backend'e dokunulmuyor** (üretilen sorular pipeline tarafından mevcut `pipeline/import` ile export edilir).
- **Cross-repo önkoşul:** chunk taşıma UI'ı pipeline'dan `previews` bekler → pipeline planına eklenmeli (bu dosyanın "Önkoşullar" bölümü). `previews` yoksa Task 3'teki parça listesi otomatik gizlenir (kod `tree.previews` kontrollü) — yani özellik güvenli şekilde küçülür.
- **Adlandırma:** backend "Konu" (kategori, export hedefi) vs belge "Konu Ağacı" ayrı fazlarda; karışma önlendi.
- **v1 sadeleştirme:** "yeni konu ekle" ve `tip` seçici çıkarıldı (gerekirse eklenebilir); chunk taşıma previews'e bağlı.
- **Bağımlılık sırası:** pipeline planı ÖNCE (endpoint'ler + previews), sonra bu plan.
