# Admin Panel — Pipeline Entegrasyon Görevleri

Sırayla yapılmalı. Her görev bağımsız commit alabilir.

---

## Görev 1: Pipeline URL'sini env'e ekle

**Dosya:** `.env.local`

Mevcut satırın altına ekle:
```
NEXT_PUBLIC_PIPELINE_URL=http://localhost:8001
```

---

## Görev 2: Pipeline API client yaz

**Yeni dosya:** `lib/api/pipeline.ts`

```typescript
import axios from "axios";

const pipelineClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PIPELINE_URL,
});

export interface PipelineUploadResponse {
  job_id: string;
  status: string;
  file: string;
}

export interface PipelineJobResponse {
  status: "queued" | "processing" | "done" | "error";
  file: string;
  count?: number;
  export?: { imported?: number; error?: string };
  error?: string;
}

export async function uploadPdfToPipeline(
  file: File,
  categoryId: string,
  nQuestions: number
): Promise<PipelineUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("category_id", categoryId);
  form.append("n_questions", String(nQuestions));
  const { data } = await pipelineClient.post<PipelineUploadResponse>("/upload", form);
  return data;
}

export async function getPipelineJob(jobId: string): Promise<PipelineJobResponse> {
  const { data } = await pipelineClient.get<PipelineJobResponse>(`/jobs/${jobId}`);
  return data;
}
```

---

## Görev 3: "İçerik Üretimi" sayfası yaz

**Yeni dosya:** `app/(admin)/content/page.tsx`

Sayfa şu akışı takip eder:

### Adım 1 — Form
- **Ders dropdown**: `getAdminCategories()` sonucundan `parentCategoryId !== null` olanlar (Türkçe, Matematik, Tarih, Coğrafya, Vatandaşlık, Din Kültürü)
- **Konu dropdown**: Seçilen derse göre filtreli 3. seviye kategoriler + "Yeni konu ekle..." seçeneği
  - "Yeni konu ekle..." seçilince: metin girişi çıkar, kullanıcı konu adı yazar → `createCategory({ name, parentCategoryId: seçilenDersId })` çağrılır → yeni kategori ID'si kullanılır
- **PDF dosyası**: file input, sadece .pdf kabul eder
- **Kaç soru**: number input, varsayılan 10, min 1 max 30
- **Yükle butonu**: tüm alanlar doluysa aktif

### Adım 2 — İşleniyor
- `uploadPdfToPipeline(file, categoryId, nQuestions)` çağrılır → `job_id` alınır
- Her 3 saniyede `getPipelineJob(job_id)` çekilir
- `status === "processing"` → "Sorular üretiliyor..." mesajı
- `status === "done"` → Adım 3'e geç
- `status === "error"` → Hata mesajı göster

### Adım 3 — Tamamlandı
- "{count} soru üretildi ve inceleme kuyruğuna eklendi" mesajı
- "Bekleyen Soruları Gör" butonu → `/questions?status=PendingReview`

---

Tam kod:

```tsx
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

type Step = "form" | "processing" | "done" | "error";

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

  // 2. seviye kategoriler (dersler) — parentCategoryId dolu olanlar
  const dersler = categories.filter((c) => c.parentCategoryId !== null && c.parentCategoryId !== undefined);

  // 3. seviye kategoriler — seçilen derse bağlı olanlar
  const konular = categories.filter((c) => c.parentCategoryId === selectedDersId);

  async function handleSubmit() {
    if (!file || !selectedDersId) return;

    let categoryId = selectedKonuId;

    // Yeni konu oluştur
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
          setResultCount(job.count ?? 0);
          setStep("done");
        } else if (job.status === "error") {
          clearInterval(pollRef.current!);
          setErrorMsg(job.error ?? "Bilinmeyen hata");
          setStep("error");
        }
      }, 3000);
    } catch (e) {
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
        <p className="font-medium text-lg">{resultCount} soru üretildi</p>
        <p className="text-sm text-gray-500">Sorular inceleme kuyruğuna eklendi.</p>
        <Button onClick={() => router.push("/questions?status=PendingReview")}>
          Bekleyen Soruları Gör
        </Button>
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
        {/* Ders */}
        <div className="space-y-1">
          <Label>Ders</Label>
          <Select onValueChange={(v) => { setSelectedDersId(v); setSelectedKonuId(""); setIsNewKonu(false); }}>
            <SelectTrigger><SelectValue placeholder="Ders seç..." /></SelectTrigger>
            <SelectContent>
              {dersler.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Konu */}
        {selectedDersId && (
          <div className="space-y-1">
            <Label>Konu</Label>
            <Select onValueChange={(v) => {
              if (v === "__new__") { setIsNewKonu(true); setSelectedKonuId(""); }
              else { setIsNewKonu(false); setSelectedKonuId(v); }
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

        {/* PDF */}
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

        {/* Kaç soru */}
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
```

---

## Görev 4: Sidebar'a "İçerik Üretimi" linki ekle

**Dosya:** `components/layout/Sidebar.tsx`

`navItems` dizisine ekle:

```typescript
import { Upload } from "lucide-react"; // import'a ekle

// navItems dizisine ekle:
{ href: "/content", label: "İçerik Üretimi", icon: Upload },
```

---

## Görev 5: AI doğrulama durumunu göster (VerificationStatus / VerificationNote)

> Bağlam: Pipeline artık her ürettiği soruyu `QuestionVerifier` ile denetliyor ve export'ta
> backend'e `dogrulama` alanını gönderiyor. Backend DB'de `VerificationStatus` ve
> `VerificationNote` dolu geliyor, `/admin/questions` API'si de döndürüyor — ama panel
> render etmiyor. Olası değerler: `gecti`, `supheli`, `kontrol_edilemedi` (pipeline'dan
> gelmeyen eski sorularda boş/null).

### 5a. Tipe alanları ekle

**Dosya:** `lib/types.ts` — `AdminQuestion` interface'ine ekle:

```typescript
verificationStatus?: string | null; // "gecti" | "supheli" | "kontrol_edilemedi" | null
verificationNote?: string | null;
```

> Önce API yanıtındaki gerçek alan adlarını doğrula (`GET /admin/questions` çıktısına bak) —
> backend camelCase serialize ediyorsa `verificationStatus` gelir; farklıysa tipi ona göre adlandır.

### 5b. VerificationBadge bileşeni

**Yeni dosya:** `components/shared/VerificationBadge.tsx`

`StatusBadge` ile aynı kalıpta küçük bir badge:

| Değer | Etiket | Renk |
|-------|--------|------|
| `gecti` | AI: Geçti | yeşil |
| `supheli` | AI: Şüpheli | sarı/amber |
| `kontrol_edilemedi` | AI: Kontrol edilemedi | gri |
| null/boş | — (badge gösterme) | — |

### 5c. Soru listesinde kolon

**Dosya:** `app/(admin)/questions/page.tsx`

- Tabloya "Durum" kolonundan sonra **"AI Doğrulama"** kolonu ekle (`TableHead` + `TableCell` içinde `VerificationBadge`).
- "Soru bulunamadı" satırındaki `colSpan={7}`'yi `8` yap.

### 5d. Soru detayında badge + not

**Dosya:** `app/(admin)/questions/[id]/page.tsx`

- Başlıktaki `StatusBadge`'in yanına `VerificationBadge` ekle.
- `verificationStatus === "supheli"` ise formun üstünde amber bir uyarı kutusunda `verificationNote` metnini göster (inceleme yapan admin nedeni görsün).

### Doğrulama

- Pipeline'dan üretilmiş bir soru listede badge'li görünmeli (son testte 15 soru: 11 `gecti`, 4 `supheli`).
- `supheli` bir sorunun detayında not kutusu görünmeli.
- Eski (pipeline dışı) sorularda badge görünmemeli, sayfa hata vermemeli.

---

## Notlar

- `AdminCategory` tipinde `id` ve `parentCategoryId` alanlarının `string | null` olduğunu kontrol et (`lib/types.ts`)
- Pipeline çalışmıyorsa "Pipeline'a bağlanılamadı" hatası verir — önce pipeline'ın ayakta olduğunu doğrula
- 3. seviye kategori (konu) `createCategory` ile oluşturulur, mevcut endpoint zaten destekliyor
