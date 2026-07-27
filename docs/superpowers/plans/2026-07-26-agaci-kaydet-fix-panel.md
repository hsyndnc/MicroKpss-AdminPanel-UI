# "Ağacı Kaydet" fix — Panel — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konu Ağacı "Ağacı Kaydet" akışına görünür başarı/hata geri bildirimi eklemek ve tüm pipeline proxy route'larını non-JSON/ağ hatasında çökmeyen ortak bir helper'a taşımak.

**Architecture:** İki bağımsız iş. (1) Ortak `lib/api/pipeline-proxy.ts` helper: fetch'i try/catch'e sarar, yanıtı text okuyup güvenli `JSON.parse` eder, 6 route ince kabuğa iner. (2) `components/topic-workspace.tsx` `handleSaveTree`: ayrı `saveState` + buton disable + yeşil/kırmızı banner. İki iş ayrı ayrı derlenir ve commit'lenir.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, TypeScript, axios (client), Tailwind v4. Test framework YOK.

**Spec:** `docs/superpowers/specs/2026-07-26-agaci-kaydet-fix-panel-design.md`

## Global Constraints

- **Test harness YOK.** Doğrulama her task sonunda: `npx tsc --noEmit` + `npm run lint` + `npm run build` temiz + elle smoke.
- Commit mesajları sade Türkçe; **Co-Authored-By imzası YOK.**
- Path alias `@/` kullan (ör. `@/lib/api/pipeline-proxy`).
- Proxy'lerde `X-Api-Key` yalnız sunucuda eklenir; env: `PIPELINE_URL`, `PIPELINE_API_KEY`.
- `pipelineProxy` caller vermedikçe `Content-Type` EKLEMEZ (upload multipart boundary'sini bozmamak için).
- `react-hooks/set-state-in-effect` kuralı açık: effect'te senkron setState yazma (bu planda yeni effect yok; setState yalnız event handler'larda).
- Dal: `dev`.

## Dosya yapısı

| Dosya | Sorumluluk | Değişim |
|-------|-----------|---------|
| `lib/api/pipeline-proxy.ts` | Pipeline'a dayanıklı ortak fetch (X-Api-Key + try/catch + güvenli JSON) | **Create** |
| `app/api/pipeline/jobs/[id]/route.ts` | GET /jobs proxy | Modify → helper |
| `app/api/pipeline/sources/route.ts` | GET /sources proxy | Modify → helper |
| `app/api/pipeline/sources/[id]/route.ts` | DELETE /sources/{id} proxy | Modify → helper |
| `app/api/pipeline/sources/[id]/topics/route.ts` | GET+PUT /sources/{id}/topics proxy | Modify → helper |
| `app/api/pipeline/sources/[id]/topics/[nodeId]/generate/route.ts` | POST generate proxy | Modify → helper |
| `app/api/pipeline/upload/route.ts` | POST /upload proxy (FormData) | Modify → helper |
| `components/topic-workspace.tsx` | Konu ağacı çalışma alanı (kaydet + üret) | Modify → save feedback |

---

### Task 1: Ortak proxy helper + 6 route göçü

Kök neden #3: proxy'ler körlemesine `await res.json()` yapıyor → pipeline non-JSON/kapalı olunca route çöküyor. Helper'a taşınınca bu sınıf tek yerde kapanır.

**Files:**
- Create: `lib/api/pipeline-proxy.ts`
- Modify: `app/api/pipeline/jobs/[id]/route.ts`
- Modify: `app/api/pipeline/sources/route.ts`
- Modify: `app/api/pipeline/sources/[id]/route.ts`
- Modify: `app/api/pipeline/sources/[id]/topics/route.ts`
- Modify: `app/api/pipeline/sources/[id]/topics/[nodeId]/generate/route.ts`
- Modify: `app/api/pipeline/upload/route.ts`

**Interfaces:**
- Produces: `pipelineProxy(path: string, init?: RequestInit): Promise<NextResponse>` — pipeline tabanına `path` ekleyerek fetch yapar; `X-Api-Key`'i sunucuda ekler; ağ hatasında `502 {error}`, non-JSON yanıtta upstream status + `{error}` döner.

- [ ] **Step 1: Helper'ı oluştur**

`lib/api/pipeline-proxy.ts`:

```ts
import { NextResponse } from "next/server";

/**
 * Pipeline'a giden tüm proxy route'ların ortak, dayanıklı fetch'i.
 * - X-Api-Key'i sunucuda ekler (caller header'larıyla birleştirir).
 * - Ağ hatasında 502 + {error} döner (route çökmez).
 * - Yanıtı text okuyup güvenli JSON.parse eder; non-JSON'da upstream status'u
 *   KORUR ve {error} döner (200'ü maskelemez, çökmez).
 *
 * @param path Pipeline tabanına göre yol, örn. `/sources/${id}/topics`
 * @param init method/body/ek header. Content-Type helper eklemez (upload multipart).
 */
export async function pipelineProxy(
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  const headers = new Headers(init.headers);
  headers.set("X-Api-Key", process.env.PIPELINE_API_KEY ?? "");

  let res: Response;
  try {
    res = await fetch(`${process.env.PIPELINE_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Pipeline servisine ulaşılamıyor." },
      { status: 502 },
    );
  }

  const text = await res.text();
  if (!text) {
    return new NextResponse(null, { status: res.status });
  }
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Pipeline beklenmeyen bir yanıt döndürdü." },
      { status: res.status },
    );
  }
}
```

- [ ] **Step 2: Helper tek başına derleniyor mu**

Run: `npx tsc --noEmit`
Expected: Temiz (helper'ın henüz tüketicisi yok; hata olmamalı).

- [ ] **Step 3: `jobs/[id]/route.ts` göçü**

Dosyanın tamamını şununla değiştir:

```ts
import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return pipelineProxy(`/jobs/${encodeURIComponent(id)}`);
}
```

- [ ] **Step 4: `sources/route.ts` göçü**

Dosyanın tamamını şununla değiştir (elle try/catch kalkar):

```ts
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function GET() {
  return pipelineProxy("/sources");
}
```

- [ ] **Step 5: `sources/[id]/route.ts` göçü (DELETE)**

Dosyanın tamamını şununla değiştir:

```ts
import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleteQuestions = request.nextUrl.searchParams.get("delete_questions") ?? "false";
  return pipelineProxy(
    `/sources/${encodeURIComponent(id)}?delete_questions=${deleteQuestions}`,
    { method: "DELETE" }
  );
}
```

- [ ] **Step 6: `sources/[id]/topics/route.ts` göçü (GET+PUT)**

Dosyanın tamamını şununla değiştir:

```ts
import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return pipelineProxy(`/sources/${encodeURIComponent(id)}/topics`);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.text();
  return pipelineProxy(`/sources/${encodeURIComponent(id)}/topics`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
```

- [ ] **Step 7: `sources/[id]/topics/[nodeId]/generate/route.ts` göçü (POST)**

Dosyanın tamamını şununla değiştir:

```ts
import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  const { id, nodeId } = await params;
  const body = await request.text();
  return pipelineProxy(
    `/sources/${encodeURIComponent(id)}/topics/${encodeURIComponent(nodeId)}/generate`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body }
  );
}
```

- [ ] **Step 8: `upload/route.ts` göçü (FormData — Content-Type ELLE verilmez)**

Dosyanın tamamını şununla değiştir:

```ts
import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  return pipelineProxy("/upload", { method: "POST", body: form });
}
```

- [ ] **Step 9: Tip + lint temiz**

Run: `npx tsc --noEmit && npm run lint`
Expected: Temiz. (Bilinen tek önceden var olan uyarı: `app/(admin)/questions/[id]/page.tsx` `form.watch` — bu task'ın dosyalarıyla ilgisiz.)

- [ ] **Step 10: Build temiz**

Run: `npm run build`
Expected: Başarılı (6 route + helper derleniyor).

- [ ] **Step 11: Elle smoke — dayanıklılık**

Pipeline 8001 KAPALIYKEN:
- Tarayıcıda **Kaynaklar** sayfasını aç → nazik hata (502/`{error}`) görünür, route 500 ile çökmez.

Pipeline 8001 AÇIKKEN (Docker):
- **Kaynaklar** listelenir; İçerik Üretimi'nde PDF yükleme + konu ağacı akışı eskisi gibi çalışır (regresyon yok).

Expected: İki durumda da çökme yok; kapalıyken `{error}`, açıkken normal veri.

- [ ] **Step 12: Commit**

```bash
git add lib/api/pipeline-proxy.ts app/api/pipeline
git commit -m "refactor: pipeline proxy route'ları ortak dayanıklı helper'a taşındı"
```

---

### Task 2: `handleSaveTree` görünür geri bildirimi

Kök neden #2: `handleSaveTree` sessiz (try/catch yok, UI yok) → kullanıcı kaydın olup olmadığını göremiyor. Ayrı `saveState` + banner eklenir (generate'in `phase` deseniyle aynı görünür ama ayrı state).

**Files:**
- Modify: `components/topic-workspace.tsx`

**Interfaces:**
- Consumes: `saveTopics(sourceId, tree): Promise<TopicTree>` (mevcut, `lib/api/pipeline.ts`), Task 1'in dayanıklı proxy'si (hata → `{error}`).
- Produces: (yalnız bileşen içi durum; dışarı arayüz yok).

- [ ] **Step 1: axios import + save state ekle**

`components/topic-workspace.tsx` başındaki importlara ekle (en üste):

```ts
import axios from "axios";
```

`const [errorMsg, setErrorMsg] = useState("");` satırının hemen ardına ekle:

```ts
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
```

- [ ] **Step 2: `getSaveErrorMessage` yardımcısı + yeni `handleSaveTree`**

Mevcut `handleSaveTree`'yi (şu an tek satırlık gövde) şununla değiştir:

```ts
  function getSaveErrorMessage(err: unknown): string {
    if (axios.isAxiosError(err)) {
      const msg = err.response?.data?.error;
      if (typeof msg === "string" && msg) return msg;
    }
    return "Ağaç kaydedilemedi.";
  }

  async function handleSaveTree() {
    try {
      setSaveState("saving");
      const saved = await saveTopics(sourceId, tree);
      onTreeChange(saved);
      setSaveState("saved");
    } catch (err) {
      setSaveError(getSaveErrorMessage(err));
      setSaveState("error");
    }
  }
```

- [ ] **Step 3: Editör onChange'ini sar (bayat banner koruması)**

`<TopicTreeEditor tree={tree} onChange={onTreeChange} />` satırını şununla değiştir:

```tsx
      <TopicTreeEditor tree={tree} onChange={(t) => { setSaveState("idle"); onTreeChange(t); }} />
```

- [ ] **Step 4: Kaydet butonu (disable + metin) + banner**

`<Button variant="outline" onClick={handleSaveTree}>Ağacı Kaydet</Button>` satırını şununla değiştir:

```tsx
      <div className="space-y-2">
        <Button variant="outline" disabled={saveState === "saving"} onClick={handleSaveTree}>
          {saveState === "saving" ? "Kaydediliyor..." : "Ağacı Kaydet"}
        </Button>
        {saveState === "saved" && (
          <div className="rounded-md bg-green-50 text-green-700 text-sm p-3">✅ Ağaç kaydedildi.</div>
        )}
        {saveState === "error" && (
          <div className="rounded-md bg-red-50 text-red-700 text-sm p-3">{saveError}</div>
        )}
      </div>
```

- [ ] **Step 5: Tip + lint temiz**

Run: `npx tsc --noEmit && npm run lint`
Expected: Temiz.

- [ ] **Step 6: Build temiz**

Run: `npm run build`
Expected: Başarılı.

- [ ] **Step 7: Elle smoke**

Pipeline 8001 AÇIKKEN, İçerik Üretimi → PDF yükle → Konu Ağacı ekranında:
1. Bir başlığı düzenle → **Ağacı Kaydet** → buton "Kaydediliyor..." olur, sonra yeşil "✅ Ağaç kaydedildi." banner çıkar.
2. Ağacı tekrar düzenle → yeşil banner KAYBOLUR (bayat koruması).

Pipeline 8001 KAPALIYKEN:
3. Ağacı Kaydet → kırmızı hata banner'ı çıkar ("Pipeline servisine ulaşılamıyor." veya backend mesajı); sayfa çökmez.

Expected: Üç senaryo da yukarıdaki gibi.

- [ ] **Step 8: Commit**

```bash
git add components/topic-workspace.tsx
git commit -m "feat: Ağacı Kaydet'e başarı/hata geri bildirimi"
```

---

## Self-Review (plan yazarı)

- **Spec kapsamı:** Bölüm A (handleSaveTree feedback) → Task 2; Bölüm B (pipeline-proxy helper + 6 route) → Task 1. Spec 5.4 route göç tablosundaki 6 dosyanın hepsi Task 1'de birer step (upload Content-Type kısıtı Step 8'de). Doğrulama (spec §6) her task'ın son 3 step'inde. ✅
- **Placeholder:** yok; her kod step'i tam içerik. tsc/lint/build/smoke komutları somut.
- **Tip tutarlılığı:** `pipelineProxy(path, init?)` imzası Step 1'de tanımlı, 6 route'ta aynı çağrılıyor. `saveState` birliği `"idle"|"saving"|"saved"|"error"` her yerde aynı. `getSaveErrorMessage(err: unknown): string` tanım+kullanım tutarlı.
- **Pipeline bağımlılığı:** `GET /sources` gelmeden Kaynaklar boş kalır ama Task 1 sayesinde çökmeden nazik hata verir; Task 2 save feedback pipeline'dan bağımsız çalışır. Pipeline kapsamı ayrı spec/plan (`kpss-content-pipeline`).
- **Not:** Bu plan yalnız panel'i kapsar. Pipeline değişiklikleri için `kpss-content-pipeline/docs/superpowers/plans/2026-07-22-kaynak-kutuphanesi-pipeline.md` (Spec 1'e hizalı; `created_at` zaten üretimde, yalnız PUT koruması açık).
