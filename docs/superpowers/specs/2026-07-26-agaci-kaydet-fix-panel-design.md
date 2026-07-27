# "Ağacı Kaydet" fix — Panel tarafı — Tasarım (Design Spec)

> Tarih: 2026-07-26 · Dal: `dev` · Repo: kpss-admin-panel
> İlgili pipeline spec'i: `kpss-content-pipeline/docs/superpowers/specs/2026-07-26-agaci-kaydet-fix-pipeline-design.md`

## 1. Problem

Kullanıcı şikâyeti: **"Konu Ağacı → Ağacı Kaydet çalışmıyor + kaydedince ağaç Kaynaklar
ekranında görünmüyor."**

Bu spec'in kapsadığı **panel kök nedenleri** (2 tane; "görünmüyor"un pipeline ayağı ayrı
spec'te):

1. **`handleSaveTree` sessiz.** `components/topic-workspace.tsx:37-40` try/catch YOK,
   başarı/hata UI'ı YOK. Kayıt aslında çalışıyor (`PUT /sources/{id}/topics` uç MEVCUT) ama
   kullanıcı hiçbir geri bildirim görmediği için "çalışmıyor" sanıyor. Hata olsa da sessiz
   yutulur.
2. **Proxy route'ları non-JSON yanıtta çöküyor.** 6 pipeline proxy route'unun tamamı
   körlemesine `await res.json()` yapıyor; pipeline kapalı/hatalı olup non-JSON (HTML hata
   sayfası, boş gövde) dönünce route 500 ile çöker ve UI ham hata alır.

## 2. Doğrulanmış gerçekler (kod okundu)

**`handleSaveTree` (`components/topic-workspace.tsx:37-40`):**
```ts
async function handleSaveTree() {
  const saved = await saveTopics(sourceId, tree);
  onTreeChange(saved);
}
```
Buton (satır 67): `<Button variant="outline" onClick={handleSaveTree}>Ağacı Kaydet</Button>`
— disable yok. Aynı bileşende `handleGenerate` (satır 42-59) ise `phase` state'i + yeşil
(`bg-green-50`) / kırmızı (`bg-red-50`) banner deseni kullanıyor (satır 112-122). **Save için
bu deseni AYRI bir state ile tekrarlayacağız** (generate'in `phase`'ini paylaşmayız).

**6 proxy route (hepsi `app/api/pipeline/` altında)** — desen aynı:
`const res = await fetch(...)` → `const data = await res.json()` →
`NextResponse.json(data, { status: res.status })`.

| Route | Metod | try/catch | `res.json()` |
|-------|-------|-----------|--------------|
| `jobs/[id]/route.ts` | GET | ✗ | 1× kör |
| `sources/route.ts` | GET | ✓ | 1× kör (try içinde) |
| `sources/[id]/route.ts` | DELETE | ✗ | 1× kör |
| `sources/[id]/topics/route.ts` | GET + PUT | ✗ | 2× kör |
| `sources/[id]/topics/[nodeId]/generate/route.ts` | POST | ✗ | 1× kör |
| `upload/route.ts` | POST | ✗ | 1× kör |

`sources/route.ts` tek istisna: ağ hatasını try/catch ile 502'ye çeviriyor **ama** başarılı
non-JSON yanıtta yine `res.json()` içeride çöküyor (yanıltıcı 502 verir).

**Not:** Panel'de test harness'i YOK → doğrulama `npx tsc --noEmit` + `npm run build` + elle
smoke.

## 3. Kararlar

1. **Save geri bildirimi generate deseniyle aynı görünsün ama AYRI state** — iki akış
   birbirinin banner'ını ezmesin.
2. **Proxy dayanıklılığı tek yerde toplansın:** `lib/api/pipeline-proxy.ts` ortak helper;
   6 route ince kabuğa iner. Böylece non-JSON çökme sınıfı tek noktada kapanır.
3. **Hata mesajı, varsa backend'inkini gösterir** — `UserDetailSheet`/`AiFixDialog`
   desenine uygun (`err.response?.data?.error` önce, yoksa sabit Türkçe metin).
4. **Sözleşme değişmez:** helper mevcut pipeline uçlarına aynı yolla gider; sadece hata/JSON
   dayanıklılığı eklenir.

## 4. Bölüm A — `handleSaveTree` geri bildirimi (`components/topic-workspace.tsx`)

Yeni state:
```ts
const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
const [saveError, setSaveError] = useState("");
```

Yeni `handleSaveTree`:
```ts
async function handleSaveTree() {
  try {
    setSaveState("saving");
    const saved = await saveTopics(sourceId, tree);
    onTreeChange(saved);
    setSaveState("saved");
  } catch (err) {
    setSaveError(getSaveErrorMessage(err));   // err.response?.data?.error ?? "Ağaç kaydedilemedi."
    setSaveState("error");
  }
}
```

Buton (satır 67) — kaydederken disable + metin değişir:
```tsx
<Button variant="outline" disabled={saveState === "saving"} onClick={handleSaveTree}>
  {saveState === "saving" ? "Kaydediliyor..." : "Ağacı Kaydet"}
</Button>
```

Buton altına banner (generate deseniyle aynı sınıflar, ayrı state):
```tsx
{saveState === "saved" && (
  <div className="rounded-md bg-green-50 text-green-700 text-sm p-3">✅ Ağaç kaydedildi.</div>
)}
{saveState === "error" && (
  <div className="rounded-md bg-red-50 text-red-700 text-sm p-3">{saveError}</div>
)}
```

**Bayat banner koruması:** Kullanıcı kaydettikten sonra ağacı tekrar düzenlerse "kaydedildi"
banner'ı yanıltmasın. `TopicTreeEditor`'ın `onChange`'i sarılır (satır 66):
```tsx
<TopicTreeEditor tree={tree} onChange={(t) => { setSaveState("idle"); onTreeChange(t); }} />
```
(`handleSaveTree` içindeki `onTreeChange(saved)` bu sarmalı KULLANMAZ — ham prop'u çağırır,
sıralama: önce `onTreeChange(saved)`, sonra `setSaveState("saved")`; çakışma yok.)

Mesaj yardımcısı `getSaveErrorMessage(err)` bileşen içinde küçük bir fonksiyon ya da satır
içi olabilir; merkezî `getApiErrorMessage` helper'ı bu spec'in kapsamı DIŞINDA (ayrı temizlik).

## 5. Bölüm B — Ortak proxy helper (`lib/api/pipeline-proxy.ts`)

### 5.1 Amaç
Her route'un tekrarladığı "fetch + `X-Api-Key` + `res.json()`" desenini tek, dayanıklı
fonksiyona toplamak. İki çökme sınıfını kapatır: (a) pipeline'a ulaşılamama (ağ hatası),
(b) başarılı ama non-JSON yanıt.

### 5.2 Arayüz
```ts
import { NextResponse } from "next/server";

// path: pipeline tabanına göre yol, örn. `/sources/${id}/topics?delete_questions=false`
// init: method/body/extra headers (Content-Type gibi). X-Api-Key helper ekler.
export async function pipelineProxy(
  path: string,
  init?: RequestInit,
): Promise<NextResponse>;
```

### 5.3 Davranış
1. `${process.env.PIPELINE_URL}${path}`'e fetch; header'lara `X-Api-Key` **eklenir**
   (caller header'larıyla birleştirilir), varsayılan `cache: "no-store"`.
2. Fetch **try/catch içinde**; hata (ağ/ulaşılamama) → `502` +
   `{ error: "Pipeline servisine ulaşılamıyor." }`.
3. Yanıt gövdesi `await res.text()` ile okunur.
   - Boş gövde → `NextResponse.json(null, { status: res.status })` (örn. bazı DELETE'ler).
   - `JSON.parse` **dener**; başarılıysa → `NextResponse.json(parsed, { status: res.status })`.
   - `JSON.parse` **başarısızsa** (non-JSON) → **upstream status korunur** +
     `{ error: "Pipeline beklenmeyen bir yanıt döndürdü." }`. **Asla çökmez, 200'ü
     maskelemez** (500 → 500 kalır).

> Kritik: parse başarısızlığında status DEĞİŞMEZ; yalnız gövde güvenli `{error}` ile
> değiştirilir. Böylece UI upstream durumunu doğru görür.

### 5.4 Route göçü (6 dosya, ince kabuk)
Her route gövdesi `pipelineProxy(...)` çağrısına iner. Örnekler:

- `jobs/[id]/route.ts` (GET):
  ```ts
  const { id } = await params;
  return pipelineProxy(`/jobs/${encodeURIComponent(id)}`);
  ```
- `sources/route.ts` (GET): `return pipelineProxy("/sources");` (elle try/catch kalkar).
- `sources/[id]/route.ts` (DELETE):
  ```ts
  const { id } = await params;
  const dq = request.nextUrl.searchParams.get("delete_questions") ?? "false";
  return pipelineProxy(`/sources/${encodeURIComponent(id)}?delete_questions=${dq}`, { method: "DELETE" });
  ```
- `sources/[id]/topics/route.ts` (GET + PUT): GET düz; PUT için
  `{ method: "PUT", headers: { "Content-Type": "application/json" }, body: await request.text() }`.
- `sources/[id]/topics/[nodeId]/generate/route.ts` (POST): PUT'la aynı desen, POST.
- `upload/route.ts` (POST): `body: await request.formData()`; **Content-Type ELLE
  verilmez** (fetch multipart boundary'yi kendi koyar) — helper Content-Type dayatmamalı.

**Helper kısıtı:** `pipelineProxy`, caller vermedikçe `Content-Type` EKLEMEZ (upload'ı
bozmamak için). Yalnız `X-Api-Key` ve `cache: "no-store"` varsayılanlarını enjekte eder.

## 6. Doğrulama

Test framework'ü yok. Doğrulama:
- `npx tsc --noEmit` + `npm run lint` temiz.
- `npm run build` temiz.
- Elle smoke (pipeline 8001 ayaktayken):
  1. Konu Ağacı → düzenle → **Ağacı Kaydet** → buton "Kaydediliyor..." → yeşil "Ağaç
     kaydedildi." banner.
  2. Ağacı tekrar düzenle → yeşil banner kaybolur (bayat koruması).
  3. **Kaynaklar** ekranı kaydedilen kaynağı listeler (pipeline `GET /sources` gelince).
- Elle smoke (pipeline 8001 KAPALI):
  4. Ağacı Kaydet → kırmızı hata banner'ı (çökme yok).
  5. Kaynaklar / diğer pipeline sayfaları nazik hata gösterir, route 500 ile çökmez
     (proxy 502/`{error}`).

## 7. Kapsam dışı (YAGNI)

- Merkezî `lib/api/errors.ts` `getApiErrorMessage()` helper'ı (ayrı temizlik; interceptor'da
  otomatik toast YAPMA — çift toast tuzağı).
- Pipeline endpoint'lerinin kendisi (ayrı pipeline spec'i).
- Optimistik kaydetme / otomatik kaydet.
- Proxy'ye retry/backoff.

## 8. Sözleşme (pipeline'a bağımlılık)

Panel bu spec'le kendi başına derlenir ve save geri bildirimi çalışır. **Kaynaklar
listesinin dolması** için pipeline `GET /sources` gerekir (ayrı pipeline spec'i). Proxy
helper'ı, pipeline uçları gelene kadar da nazik 502 verir (çökme yok).
