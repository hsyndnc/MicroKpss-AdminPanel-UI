# "Tüm kaynaktan üret" — arka-plan iş + ilerleme çubuğu (Panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel'in "Tüm kaynaktan üret" modunu senkron bekleyişten `job_id` + polling + ilerleme çubuğu modeline çevirerek uzun (saatlerce sürebilen) üretimde timeout'u ortadan kaldırmak.

**Architecture:** `generateFromSource` artık işi başlatıp `{ job_id }` döner (sonucu beklemez). `handleGenerateFromSource`, upload akışındaki (`app/(admin)/content/page.tsx`) `setInterval` + `pollRef` desenini birebir örnek alarak `getPipelineJob(job_id)`'yi ~2 sn'de bir sorgular; `done/total/current` ile ilerleme çubuğunu günceller; `status:"done"`/`"error"`'da durur. `/jobs/{id}` proxy'si ve `getPipelineJob` zaten var → yeniden kullanılır.

**Tech Stack:** Next.js (modifiye sürüm — bkz. `AGENTS.md`, kod yazmadan önce `node_modules/next/dist/docs/`), React (client component), TypeScript, axios (`pipelineClient` proxy'si üzerinden).

**Spec:** `docs/superpowers/specs/2026-09-12-tum-kaynaktan-uret-sade-panel-design.md`

## Global Constraints

- **Test altyapısı YOK.** Panelde birim-test koşucusu yok (spec §Testler). Doğrulama = `npx tsc --noEmit` (0 hata) + `npm run lint` (0 hata; mevcut 3 uyarı beklenir, artmamalı) + `npm run build` + canlı smoke. TDD "failing test" adımları bu repoda uygulanamaz; her task tsc/lint kapısıyla doğrulanır.
- **Lint kuralı:** repo `setState-in-effect`'i ve benzeri kalıpları yasaklıyor; mevcut 3 uyarı (`questions/[id]/page.tsx` `watch()`, `ImportSheet.tsx:197` + `lib/api/client.ts:12` `window.location.href`) DIŞINDA yeni uyarı çıkmamalı.
- **Commit imzası:** Co-Authored-By EKLEME (`[[feedback-no-coauthor]]`).
- **Kullanıcının Docker işini KARIŞTIRMA:** working tree'de kullanıcının commit'siz `next.config.ts` (output:standalone) + `Dockerfile` + `.dockerignore` değişiklikleri var. Commit'lere SADECE bu planın dosyalarını dahil et.
- **"Belirli konudan" moduna DOKUNMA.** `handleGenerateFromNode`, `generateFromTopic`, count input'unun topic-modu davranışı aynen kalır.
- **Bağımlılık (repo dışı):** Bu plan, pipeline'ın `POST /sources/{id}/generate`'in `{ job_id }` döndürmesine ve `/jobs/{id}` iş durumunun `done/total/current/count/skipped/export` alanlarını yayınlamasına bağlıdır. Bu, `kpss-content-pipeline` repo'sundaki AYRI planın işidir (pipeline spec'i şu an senkron tarif ediyor — güncellenmeli). Pipeline hazır olana kadar uçtan uca smoke anlamlı değildir; panel yine de tsc/lint/build'den geçer ve pipeline `job_id` dönmezse **graceful** kırmızı banner gösterir (Task 2, graceful adımı).

---

## Dosya Yapısı

- **`lib/api/pipeline.ts`** (Modify) — `generateFromSource`'un dönüş tipini `{ job_id, status }`'e çevir; `GenerateJobResponse` tipini ekle; `PipelineJobResponse`'a üretim ilerleme alanlarını ekle. Tek sorumluluk: pipeline HTTP sözleşmesi.
- **`components/topic-workspace.tsx`** (Modify) — `handleGenerateFromSource`'u polling'e çevir; ilerleme state'i + cleanup; "Tüm kaynaktan" modunda ilerleme çubuğu. Tek sorumluluk: üretim workspace UI'ı.
- **`app/api/pipeline/sources/[id]/generate/route.ts`** (Create — yoksa) — "Tüm kaynaktan" POST'unu pipeline'a ileten proxy route. (Bu oturumun working tree'sinde zaten oluşturulmuş olabilir; Task 2 varlığını garanti eder.)

---

### Task 1: Pipeline tiplerini genişlet (yalnız additive)

Yalnızca yeni/opsiyonel alanlar ekler; hiçbir çağıranı bozmaz → tek başına tsc/lint yeşil kalır.

**Files:**
- Modify: `lib/api/pipeline.ts:40-46` (`PipelineJobResponse`)
- Modify: `lib/api/pipeline.ts` (yeni `GenerateJobResponse` interface — `PipelineUploadResponse`'un hemen ardına ekle)

**Interfaces:**
- Consumes: (yok — additive)
- Produces:
  - `interface GenerateJobResponse { job_id: string; status: string }`
  - `PipelineJobResponse` opsiyonel alanları: `done?: number; total?: number; current?: string; count?: number; skipped?: number; export?: { imported?: number; error?: string }` ve `file`'ın opsiyonel (`file?: string`) yapılması (üretim işi `file` taşımayabilir).

- [ ] **Step 1: `PipelineJobResponse`'a üretim alanlarını ekle ve `file`'ı opsiyonel yap**

`lib/api/pipeline.ts` içindeki mevcut:

```ts
export interface PipelineJobResponse {
  status: "queued" | "processing" | "done" | "error";
  file: string;
  source_id?: string;
  topics?: TopicTree;
  error?: string;
}
```

şununla değiştir:

```ts
export interface PipelineJobResponse {
  status: "queued" | "processing" | "done" | "error";
  file?: string;                 // upload işinde dolu; üretim işinde olmayabilir
  source_id?: string;
  topics?: TopicTree;
  error?: string;
  // "Tüm kaynaktan üret" (generateFromSource) iş alanları:
  done?: number;                 // biten üretim hedefi sayısı
  total?: number;                // toplam üretim hedefi sayısı
  current?: string;              // şu an üretilen başlık
  count?: number;                // biten işte toplam üretilen soru
  skipped?: number;              // atlanan üretim sayısı
  export?: { imported?: number; error?: string };
}
```

- [ ] **Step 2: `GenerateJobResponse` tipini ekle**

`lib/api/pipeline.ts` içinde `PipelineUploadResponse` interface'inin hemen ardına ekle:

```ts
export interface GenerateJobResponse {
  job_id: string;
  status: string;
}
```

- [ ] **Step 3: tsc + lint ile doğrula**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc 0 hata; lint 0 hata + yalnız mevcut 3 uyarı (yeni uyarı yok). `file`'ı opsiyonel yapmak `content/page.tsx`'i bozmamalı (orada `job.file` okunmuyor).

- [ ] **Step 4: Commit**

```bash
git add lib/api/pipeline.ts
git commit -m "feat(pipeline-types): üretim işi ilerleme alanları + GenerateJobResponse"
```

---

### Task 2: `generateFromSource`'u job'a çevir + polling + ilerleme çubuğu

`generateFromSource`'un dönüş tipini değiştirmek `handleGenerateFromSource`'un `res.export`/`res.count` okumasını bozar; bu yüzden API dönüşü + çağıran + UI **tek task**'ta (tsc ancak sonunda yeşil olur).

**Files:**
- Modify: `lib/api/pipeline.ts:96-106` (`generateFromSource`)
- Modify: `components/topic-workspace.tsx` (import satırları, state, cleanup effect, `handleGenerateFromSource`, "all" modu JSX)
- Create (yoksa): `app/api/pipeline/sources/[id]/generate/route.ts`

**Interfaces:**
- Consumes: Task 1'den `GenerateJobResponse`, `PipelineJobResponse` (üretim alanları); mevcut `getPipelineJob(jobId): Promise<PipelineJobResponse>`.
- Produces: `generateFromSource(sourceId, { category_id, tip? }): Promise<GenerateJobResponse>` (artık senkron `GenerateResult` DEĞİL).

- [ ] **Step 1: Proxy route'un var olduğunu garanti et (yoksa oluştur)**

`app/api/pipeline/sources/[id]/generate/route.ts` yoksa şu içerikle oluştur (mevcut `.../topics/[nodeId]/generate/route.ts` deseninin birebir eşi):

```ts
import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.text();
  return pipelineProxy(
    `/sources/${encodeURIComponent(id)}/generate`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body }
  );
}
```

- [ ] **Step 2: `generateFromSource` dönüşünü `GenerateJobResponse`'a çevir**

`lib/api/pipeline.ts` içindeki mevcut:

```ts
// Tüm kaynaktan: ağaçta gezerek (her başlık + alt başlık) üret; soru sayısını endpoint
// içerik boyutuna göre otomatik belirler. Sorular Ders'e kaydedilir, topic_id ile etiketlenir.
export async function generateFromSource(
  sourceId: string,
  body: { category_id: string; tip?: string }
): Promise<GenerateResult> {
  const { data } = await pipelineClient.post<GenerateResult>(
    `/sources/${sourceId}/generate`, body
  );
  return data;
}
```

şununla değiştir:

```ts
// Tüm kaynaktan: ağaçta gezerek (her başlık + alt başlık), uzun süren bir iştir. Endpoint işi
// arka planda başlatıp job_id döner; ilerleme getPipelineJob(job_id) ile yoklanır. Soru sayısını
// endpoint içerik boyutuna göre otomatik belirler; sorular Ders'e kaydedilir, topic_id etiketlenir.
export async function generateFromSource(
  sourceId: string,
  body: { category_id: string; tip?: string }
): Promise<GenerateJobResponse> {
  const { data } = await pipelineClient.post<GenerateJobResponse>(
    `/sources/${sourceId}/generate`, body
  );
  return data;
}
```

- [ ] **Step 3: `topic-workspace.tsx` import'larını güncelle**

Mevcut:

```tsx
import { useState, useEffect } from "react";
```

şununla değiştir:

```tsx
import { useState, useEffect, useRef } from "react";
```

Mevcut:

```tsx
import { saveTopics, generateFromTopic, generateFromSource, reviewTopics, type TopicTree, type TopicSubtopic, type Suggestion } from "@/lib/api/pipeline";
```

şununla değiştir:

```tsx
import { saveTopics, generateFromTopic, generateFromSource, getPipelineJob, reviewTopics, type TopicTree, type TopicSubtopic, type Suggestion } from "@/lib/api/pipeline";
```

- [ ] **Step 4: İlerleme state'i + polling cleanup ekle**

`topic-workspace.tsx` içinde mevcut state bloğundaki bu satırdan sonra:

```tsx
  const [selectedSugNodeId, setSelectedSugNodeId] = useState<string | null>(null);
```

şunları ekle:

```tsx
  const [progress, setProgress] = useState<{ done: number; total: number; current: string }>(
    { done: 0, total: 0, current: "" }
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

Ve mevcut:

```tsx
  useEffect(() => { getAdminCategories().then(setCategories); }, []);
```

satırından sonra unmount temizliği ekle:

```tsx
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
```

- [ ] **Step 5: `handleGenerateFromSource`'u polling'e çevir**

Mevcut:

```tsx
  // Tüm kaynaktan: endpoint ağaçta gezerek (her başlık + alt başlık) üretir; soru sayısını
  // içerik boyutuna göre kendisi belirler. Sorular Ders'e kaydedilir, topic_id ile etiketlenir.
  async function handleGenerateFromSource() {
    if (!selectedDersId) return;
    try {
      setPhase("generating");
      await saveTopics(sourceId, tree); // üretimden önce düzeltmeleri kaydet
      const res = await generateFromSource(sourceId, { category_id: selectedDersId });
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
```

şununla değiştir:

```tsx
  // Tüm kaynaktan: uzun süren iş. Endpoint job_id döner; ilerleme getPipelineJob ile ~2 sn'de bir
  // yoklanır (upload akışındaki desenle aynı). Sorular Ders'e kaydedilir, topic_id ile etiketlenir.
  async function handleGenerateFromSource() {
    if (!selectedDersId) return;
    try {
      setPhase("generating");
      setProgress({ done: 0, total: 0, current: "" });
      await saveTopics(sourceId, tree); // üretimden önce düzeltmeleri kaydet
      const { job_id } = await generateFromSource(sourceId, { category_id: selectedDersId });
      if (!job_id) {
        setErrorMsg("Üretim işi başlatılamadı (pipeline job desteği gerekiyor).");
        setPhase("error");
        return;
      }
      pollRef.current = setInterval(async () => {
        try {
          const job = await getPipelineJob(job_id);
          setProgress({ done: job.done ?? 0, total: job.total ?? 0, current: job.current ?? "" });
          if (job.status === "done") {
            clearInterval(pollRef.current!);
            if (job.export?.error) {
              setErrorMsg(`Sorular üretildi ama kaydedilemedi: ${job.export.error}`);
              setPhase("error");
              return;
            }
            setResultCount(job.export?.imported ?? job.count ?? 0);
            setPhase("done");
          } else if (job.status === "error") {
            clearInterval(pollRef.current!);
            setErrorMsg(job.error ?? "Üretim sırasında hata.");
            setPhase("error");
          }
        } catch {
          clearInterval(pollRef.current!);
          setErrorMsg("Üretim durumu alınamadı.");
          setPhase("error");
        }
      }, 2000);
    } catch {
      setErrorMsg("Üretim başlatılamadı.");
      setPhase("error");
    }
  }
```

- [ ] **Step 6: "Tüm kaynaktan" modu bilgi metninin altına ilerleme çubuğu ekle**

Mevcut:

```tsx
        {mode === "all" && (
          <p className="text-sm text-gray-500">
            Kaynağın tümünden, ağaçta gezerek (her başlık ve alt başlık) üretilir. Soru sayısı
            içerik boyutuna göre <b>otomatik</b> belirlenir; sorular <b>Ders</b> altına kaydedilir.
          </p>
        )}
```

şununla değiştir (mevcut `<p>`'yi koru, altına çubuğu ekle):

```tsx
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
            <p className="text-xs text-gray-500">
              {progress.total > 0
                ? `${progress.done}/${progress.total}${progress.current ? ` — ${progress.current}` : ""}`
                : "Üretim başlatılıyor..."}
            </p>
          </div>
        )}
```

- [ ] **Step 7: tsc + lint + build ile doğrula**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: tsc 0 hata; lint 0 hata + yalnız mevcut 3 uyarı; build başarılı ve `/api/pipeline/sources/[id]/generate` route'u üretilir.
Not: `npm run build` çalışan bir `next dev` ile `.next` çakışabilir — build öncesi dev server'ı durdur.

- [ ] **Step 8: Graceful smoke (pipeline job'suzken)**

Pipeline hâlâ senkron/`job_id` dönmüyorsa: "Tüm kaynaktan" → Ders seç → Üret → panelin kırmızı banner ("Üretim işi başlatılamadı..." veya "Üretim durumu alınamadı.") gösterip **çökmediğini** doğrula. (Pipeline hazırsa tam smoke Step 9.)

- [ ] **Step 9: (Pipeline hazır olunca) uçtan uca smoke**

Servisler ayakta (pipeline job destekli, backend :5213, panel :3000): "Tüm kaynaktan" → Ders=Tarih → Üret → ilerleme çubuğu 0→N ilerler, `current` başlık değişir → `done`'da yeşil "N soru üretildi" + "Bekleyenleri gör". Regresyon: "Belirli konudan" hâlâ çalışır.

- [ ] **Step 10: Commit**

```bash
git add lib/api/pipeline.ts components/topic-workspace.tsx "app/api/pipeline/sources/[id]/generate/route.ts"
git commit -m "feat: Tüm kaynaktan üretimi arka-plan iş + ilerleme çubuğuna çevir"
```

---

## Self-Review Notları

- **Spec kapsamı:** §Kilitli kararlar #1 (`{ job_id }` dönüş) → Task 2 Step 2; #2 (bölme mantığı silinir) → önceki oturumda tamamlandı (`distributeByWeight`/`countChunks`/`topicChunkCount` zaten silinmiş, working tree'de); #3 (count input gizli + bilgi metni) → önceki oturumda tamamlandı, Task 2 Step 6 metni korur; #4 (ilerleme çubuğu + ~2 sn polling + done/error banner) → Task 2 Step 4-6; #5 (toggle/Ders/"Belirli konudan" dokunulmaz) → Global Constraints.
- **Placeholder taraması:** Kod adımlarının tümü tam içerik taşıyor; "TODO"/"uygun hata yönetimi ekle" yok.
- **Tip tutarlılığı:** `GenerateJobResponse` (Task 1) → `generateFromSource` dönüşü (Task 2 Step 2) → `handleGenerateFromSource`'ta `{ job_id }` destructure (Task 2 Step 5); `PipelineJobResponse.done/total/current/count/export` (Task 1) → polling'de okunuyor (Task 2 Step 5). `getPipelineJob` imzası değişmiyor.
- **Bilinen sapma:** Panelde birim-test yok; TDD "failing test" adımları tsc/lint/build kapılarıyla değiştirildi (Global Constraints'te açıklandı). Uçtan uca smoke pipeline planına bağlı (repo dışı).
