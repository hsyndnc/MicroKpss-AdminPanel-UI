# Kaynak Kütüphanesi — Panel Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panelde ayrı bir "Kaynaklar" sayfası: yüklenmiş PDF'leri listele, birine tıklayıp konu ağacından soru üret, kaynağı (opsiyonel sorularıyla) sil.

**Architecture:** İki yeni Next.js proxy route (`GET/DELETE /api/pipeline/sources`) → `lib/api/pipeline.ts` client fonksiyonları → yeni `Kaynaklar` nav sayfası (liste + silme diyaloğu). "Ağaç düzenle + üret" bloğu content sayfasından `TopicWorkspace` bileşenine ayıklanır ve hem content (upload sonrası) hem `sources/[id]` (mevcut kaynak) tarafından yeniden kullanılır.

**Tech Stack:** Next.js 16 (App Router, route handler `params: Promise<...>`), React 19, TypeScript, axios (`/api/pipeline` proxy), shadcn/base-ui bileşenleri (`Table`, `AlertDialog`, `Checkbox`, `Select`, `Badge`).

**Spec:** `kpss-content-pipeline/docs/superpowers/specs/2026-07-22-kaynak-kutuphanesi-design.md`

## Global Constraints

- **Pipeline sözleşmesi** (bu panelin tükettiği endpoint'ler):
  - `GET /sources` → `[{source_id, file_name, topic_count, question_count, created_at}]`
  - `DELETE /sources/{id}?delete_questions=<bool>` → `{status, deleted_questions}`
  - (mevcut) `GET/PUT /sources/{id}/topics`, `POST /sources/{id}/topics/{node_id}/generate`
- Panel pipeline'a **doğrudan gitmez**; her çağrı `app/api/pipeline/...` route handler proxy'sinden geçer. `X-Api-Key` yalnız sunucuda (`process.env.PIPELINE_API_KEY`) eklenir, tarayıcıya inmez.
- Route handler imzası Next 16: `{ params }: { params: Promise<{ id: string }> }`, `const { id } = await params;`.
- **Test harness'i yok.** Her task'ın doğrulaması `npx tsc --noEmit` (temiz) + gerektiğinde `npm run build`; son task elle smoke.
- Bileşen prop adları belirsizse (`Checkbox.onCheckedChange`, `AlertDialogAction` kapanışı vb.) `components/ui/*.tsx` imzasına göre uyarlanır; typecheck rehber.
- Commit mesajları sade, Claude imzası yok.
- Dal: `dev`.

---

### Task 0: `dev` dalına geç + bekleyen konu-bazlı-üretim işini commit'le (Faz 0)

Panelde konu-bazlı üretim işi `main` dalında commit'lenmemiş duruyor (proxy route'ları, `topic-tree-editor.tsx`, `content` + `questions/[id]` değişiklikleri, `pipeline.ts`). Feature'a temiz zeminde başlamak için önce `dev`'e taşıyıp commit'le.

**Files:** (mevcut değişiklikler)
- `app/(admin)/content/page.tsx`, `app/(admin)/questions/[id]/page.tsx`, `lib/api/pipeline.ts` (modified)
- `app/api/pipeline/sources/`, `components/topic-tree-editor.tsx`, `docs/superpowers/plans/2026-07-21-konu-bazli-uretim-panel.md` (untracked)

- [ ] **Step 1: dev dalına geç**

Run: `git rev-parse --abbrev-ref HEAD`
`main` ise: `git checkout -b dev` (yoksa) veya `git checkout dev` (varsa). Değişiklikler working tree'de taşınır.

- [ ] **Step 2: Typecheck temiz mi**

Run: `npx tsc --noEmit`
Expected: hata yok (çıktı boş, exit 0).

- [ ] **Step 3: Build geçiyor mu**

Run: `npm run build`
Expected: `Compiled successfully` / hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/api/pipeline/sources app/\(admin\)/content/page.tsx app/\(admin\)/questions/[id]/page.tsx lib/api/pipeline.ts components/topic-tree-editor.tsx docs/superpowers/plans/2026-07-21-konu-bazli-uretim-panel.md
git commit -m "feat: konu-bazlı üretim paneli (proxy + ağaç editörü + üretim akışı)"
```

---

### Task 1: Proxy route'ları — `GET/DELETE /api/pipeline/sources`

**Files:**
- Create: `app/api/pipeline/sources/route.ts` (GET)
- Create: `app/api/pipeline/sources/[id]/route.ts` (DELETE)

**Interfaces:**
- Produces: `GET /api/pipeline/sources` → pipeline `GET /sources` gövdesini aynen döner.
- Produces: `DELETE /api/pipeline/sources/[id]?delete_questions=<bool>` → pipeline `DELETE`'ini proxy'ler.

- [ ] **Step 1: GET listesi proxy'si**

Create `app/api/pipeline/sources/route.ts`:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(`${process.env.PIPELINE_URL}/sources`, {
    headers: { "X-Api-Key": process.env.PIPELINE_API_KEY ?? "" },
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

- [ ] **Step 2: DELETE proxy'si**

Create `app/api/pipeline/sources/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleteQuestions = request.nextUrl.searchParams.get("delete_questions") ?? "false";
  const res = await fetch(
    `${process.env.PIPELINE_URL}/sources/${encodeURIComponent(id)}?delete_questions=${deleteQuestions}`,
    { method: "DELETE", headers: { "X-Api-Key": process.env.PIPELINE_API_KEY ?? "" } }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/api/pipeline/sources/route.ts app/api/pipeline/sources/[id]/route.ts
git commit -m "feat: /api/pipeline/sources GET+DELETE proxy"
```

---

### Task 2: API client — `listSources` + `deleteSource`

**Files:**
- Modify: `lib/api/pipeline.ts`

**Interfaces:**
- Produces: `SourceSummary` tipi; `listSources(): Promise<SourceSummary[]>`; `deleteSource(sourceId: string, deleteQuestions: boolean): Promise<void>`.

- [ ] **Step 1: Tip + fonksiyonlar ekle**

`lib/api/pipeline.ts` sonuna ekle:

```ts
export interface SourceSummary {
  source_id: string;
  file_name: string;
  topic_count: number;
  question_count: number;
  created_at: string | null;
}

export async function listSources(): Promise<SourceSummary[]> {
  const { data } = await pipelineClient.get<SourceSummary[]>("/sources");
  return data;
}

export async function deleteSource(sourceId: string, deleteQuestions: boolean): Promise<void> {
  await pipelineClient.delete(`/sources/${sourceId}?delete_questions=${deleteQuestions}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 3: Commit**

```bash
git add lib/api/pipeline.ts
git commit -m "feat: pipeline client listSources + deleteSource"
```

---

### Task 3: "Kaynaklar" nav + liste sayfası (silme diyaloğu)

**Files:**
- Modify: `components/layout/Sidebar.tsx` (nav öğesi)
- Create: `app/(admin)/sources/page.tsx` (liste + AlertDialog + Checkbox)

**Interfaces:**
- Consumes: `listSources`, `deleteSource`, `SourceSummary` (Task 2).
- Produces: `/sources` route'u; satır tıklaması `/sources/{id}`'e gider (hedef sayfa Task 5).

- [ ] **Step 1: Sidebar'a "Kaynaklar" ekle**

`components/layout/Sidebar.tsx`: import satırına `Library` ikonu ekle ve `navItems`'e öğe ekle.

`import` (satır 4) sonuna `Library` ekle:

```ts
import { LayoutDashboard, FileText, FolderOpen, Users, Calendar, Upload, Scale, LogOut, Library } from "lucide-react";
```

`navItems` dizisinde `content` satırının hemen ardına ekle:

```ts
  { href: "/sources", label: "Kaynaklar", icon: Library },
```

- [ ] **Step 2: Liste sayfası**

Create `app/(admin)/sources/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
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
import { listSources, deleteSource, type SourceSummary } from "@/lib/api/pipeline";

export default function SourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<SourceSummary | null>(null);
  const [alsoQuestions, setAlsoQuestions] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    setLoading(true);
    try { setSources(await listSources()); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function confirmDelete() {
    if (!target) return;
    setDeleting(true);
    try {
      await deleteSource(target.source_id, alsoQuestions);
      setTarget(null);
      setAlsoQuestions(false);
      await refresh();
    } finally { setDeleting(false); }
  }

  return (
    <div className="max-w-4xl mx-auto py-10 space-y-6">
      <h1 className="text-2xl font-bold">Kaynaklar</h1>
      <p className="text-gray-500 text-sm">Yüklenmiş belgeler. Bir satıra tıkla → konu ağacından soru üret.</p>

      {loading ? (
        <p className="text-gray-400 text-sm">Yükleniyor...</p>
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
```

- [ ] **Step 3: Typecheck** — `Checkbox` / `AlertDialog*` prop imzaları farklıysa `components/ui/*`'a göre uyarla.

Run: `npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Sidebar.tsx app/\(admin\)/sources/page.tsx
git commit -m "feat: Kaynaklar nav + liste sayfası (silme diyaloğu)"
```

---

### Task 4: `TopicWorkspace` bileşenini ayıkla + content sayfasını sadeleştir (+ duplicate uyarısı)

Bugün "ağaç düzenle + üret" UI'ı `content/page.tsx` içinde gömülü. Onu yeniden kullanılabilir `TopicWorkspace`'e taşı; content sayfası upload sonrası bu bileşeni kullansın. Kategori seçimi artık üretim anında (workspace içinde) yapılır → upload yalnız dosya ister. Duplicate uyarısı da content sayfasına eklenir (spec 5.4).

**Files:**
- Create: `components/topic-workspace.tsx`
- Modify: `app/(admin)/content/page.tsx` (upload akışı + duplicate uyarısı; edit/generate bloğu workspace'e devredilir)

**Interfaces:**
- Produces: `TopicWorkspace({ sourceId: string; tree: TopicTree; onTreeChange: (t: TopicTree) => void })` — kategori (ders/konu) seçimi + `TopicTreeEditor` + ağaç kaydet + düğüm seç + adet + üret + sonuç/hata bandı. `getAdminCategories`, `saveTopics`, `generateFromTopic` kullanır.

- [ ] **Step 1: TopicWorkspace bileşeni**

Create `components/topic-workspace.tsx`:

```tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAdminCategories } from "@/lib/api/categories";
import { saveTopics, generateFromTopic, type TopicTree } from "@/lib/api/pipeline";
import { TopicTreeEditor } from "@/components/topic-tree-editor";
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

  useEffect(() => { getAdminCategories().then(setCategories); }, []);

  const rootIds = new Set(categories.filter((c) => !c.parentCategoryId).map((c) => c.id));
  const dersler = categories.filter((c) => c.parentCategoryId && rootIds.has(c.parentCategoryId));
  const konular = categories.filter((c) => c.parentCategoryId === selectedDersId);

  const nodeOptions = tree.topics.flatMap((t) => [
    { id: t.id, label: t.title },
    ...t.subtopics.map((s) => ({ id: s.id, label: `— ${s.title}` })),
  ]);

  async function handleSaveTree() {
    const saved = await saveTopics(sourceId, tree);
    onTreeChange(saved);
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

      <TopicTreeEditor tree={tree} onChange={onTreeChange} />
      <Button variant="outline" onClick={handleSaveTree}>Ağacı Kaydet</Button>

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
```

- [ ] **Step 2: content sayfasını sadeleştir + duplicate uyarısı**

`app/(admin)/content/page.tsx`'i tümüyle şu içerikle değiştir:

```tsx
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: hata yok. (Kullanılmayan import kaldıysa temizle.)

- [ ] **Step 4: Commit**

```bash
git add components/topic-workspace.tsx app/\(admin\)/content/page.tsx
git commit -m "refactor: TopicWorkspace ayıklandı + content sadeleşti + duplicate uyarısı"
```

---

### Task 5: `sources/[id]` — mevcut kaynağı aç ve üret

**Files:**
- Create: `app/(admin)/sources/[id]/page.tsx`

**Interfaces:**
- Consumes: `getTopics` (mevcut), `TopicWorkspace` (Task 4).

- [ ] **Step 1: Detay sayfası**

Create `app/(admin)/sources/[id]/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getTopics, type TopicTree } from "@/lib/api/pipeline";
import { TopicWorkspace } from "@/components/topic-workspace";

export default function SourceDetailPage() {
  const params = useParams<{ id: string }>();
  const sourceId = params.id;
  const [tree, setTree] = useState<TopicTree | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getTopics(sourceId).then(setTree).catch(() => setNotFound(true));
  }, [sourceId]);

  if (notFound) {
    return <p className="text-center text-gray-400 py-20">Kaynak bulunamadı.</p>;
  }
  if (!tree) {
    return <p className="text-center text-gray-400 py-20">Yükleniyor...</p>;
  }
  return <TopicWorkspace sourceId={sourceId} tree={tree} onTreeChange={setTree} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: hata yok.

- [ ] **Step 3: Commit**

```bash
git add app/\(admin\)/sources/[id]/page.tsx
git commit -m "feat: sources/[id] mevcut kaynaktan üretim ekranı"
```

---

### Task 6: Build + elle uçtan uca smoke

Ön koşul: pipeline `dev` planı uygulanmış ve pipeline ayakta (port 8001), backend (5213) ayakta, panel `.env.local`'de `PIPELINE_URL` + `PIPELINE_API_KEY` doğru.

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: `Compiled successfully`, tip/lint hatası yok.

- [ ] **Step 2: Dev sunucu + smoke**

Run: `npm run dev` (ayrı terminal), sonra tarayıcıda:
1. **İçerik Üretimi**'nden bir PDF yükle → konu ağacı çıkar → ders/konu + düğüm seç → üret → "✅ N soru eklendi".
2. Aynı PDF'i tekrar seç → **duplicate uyarısı** görünür, yine yüklenebilir.
3. **Kaynaklar** sekmesi → yeni kaynak listede (dosya adı · tarih · konu · soru rozeti).
4. Satıra tıkla → ağaç açılır → başka bir konudan tekrar üret → çalışır.
5. **Sil** → diyalog: "soruları da sil" işaretsiz → sadece kaynak gider, sorular kalır. Tekrar dene, işaretli → sorular da gider.

Expected: 5 adım da beklenen davranışı verir.

- [ ] **Step 3: DURUM/commit (varsa panel durum dosyası)**

Panelde durum belgesi tutuluyorsa güncelle, sonra:

```bash
git add -A
git commit -m "docs: kaynak kütüphanesi paneli tamam (smoke geçti)"
```

---

## Self-Review (plan yazarı taraf)

- **Spec kapsamı:** 5.1 proxy → T1; 5.2 client → T2; 5.3 nav+liste+detay+silme → T3 (liste/silme) + T5 (detay); 5.4 duplicate uyarı → T4; 5.5 doğrulama → her task typecheck + T6 build/smoke. Faz 0 (bekleyen iş) → T0. ✅
- **Placeholder:** yok; yeni dosyalar tam kod.
- **Tip tutarlılığı:** `SourceSummary` (T2) T3'te tüketiliyor; `TopicWorkspace({sourceId, tree, onTreeChange})` T4'te üretiliyor, T4 (content) ve T5 (detay) aynı imzayla tüketiyor; `listSources/deleteSource/getTopics` imzaları client'la uyumlu.
- **Risk notu:** base-ui `Checkbox.onCheckedChange` ve `AlertDialogAction` kapanış davranışı sürüme göre değişebilir → typecheck/manuel smoke ile uyarlanır (Global Constraints'te belirtildi). `Select` kullanımı mevcut `topic-tree-editor.tsx` deseniyle (items + children) birebir aynı.
