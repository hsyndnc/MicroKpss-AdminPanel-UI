# Admin Panel — Export Hata Kontrolü Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF yükleme akışında export hatalarını kullanıcıya göster; "N soru üretildi" yerine gerçekten DB'ye kaydedilen soru sayısını göster.

**Architecture:** `page.tsx`'e `"export_error"` adımı eklenir. Polling döngüsünde `job.export?.error` kontrol edilir. Başarı durumunda `job.export?.imported` gösterilir (AI-generated count değil). Mevcut `PipelineJobResponse` tipi zaten doğru — sadece bunu kullanan component düzeltilecek.

**Tech Stack:** Next.js 15, TypeScript, React

## Global Constraints

- TypeScript derleme hatasız olmalı: `npx tsc --noEmit`
- Yeni paket eklenmeyecek
- Co-Authored-By satırı commit mesajına eklenmeyecek
- Commit öncesi kullanıcıdan onay al

---

## Dosya Haritası

| Durum | Dosya |
|-------|-------|
| Modify | `app/(admin)/content/page.tsx` |
| No change | `lib/api/pipeline.ts` — tip zaten doğru |

---

## Mevcut Sorun

`page.tsx:63-66` (polling döngüsü):
```typescript
if (job.status === "done") {
  clearInterval(pollRef.current!);
  setResultCount(job.count ?? 0);  // ← AI-generated count, DB'ye yazılan değil
  setStep("done");                  // ← export.error olsa bile "done" gösteriyor
}
```

`job.export.error` kontrol edilmiyor. `job.count` = AI'ın ürettiği soru sayısı; `job.export.imported` = gerçekten DB'ye yazılan.

---

## Task 1: `page.tsx` — Export Hata Adımı ve Doğru Count

**Dosyalar:**
- Modify: `app/(admin)/content/page.tsx`

- [ ] **Step 1: `Step` tipine `"export_error"` ekle**

Dosyanın üst kısmındaki `type Step` satırını bul:
```typescript
type Step = "form" | "processing" | "done" | "error";
```

Şununla değiştir:
```typescript
type Step = "form" | "processing" | "done" | "error" | "export_error";
```

- [ ] **Step 2: Polling döngüsünü güncelle**

`handleSubmit` içindeki `setInterval` callback'ini bul:
```typescript
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
```

Şununla değiştir:
```typescript
pollRef.current = setInterval(async () => {
  const job = await getPipelineJob(job_id);
  if (job.status === "done") {
    clearInterval(pollRef.current!);
    if (job.export?.error) {
      setErrorMsg(
        `Sorular üretildi (${job.count ?? 0} adet) ama veritabanına kaydedilemedi: ${job.export.error}`
      );
      setStep("export_error");
      return;
    }
    setResultCount(job.export?.imported ?? job.count ?? 0);
    setStep("done");
  } else if (job.status === "error") {
    clearInterval(pollRef.current!);
    setErrorMsg(job.error ?? "Bilinmeyen hata");
    setStep("error");
  }
}, 3000);
```

- [ ] **Step 3: `"done"` adımındaki metni güncelle**

Mevcut:
```tsx
<p className="font-medium text-lg">{resultCount} soru üretildi</p>
<p className="text-sm text-gray-500">Sorular inceleme kuyruğuna eklendi.</p>
```

Şununla değiştir:
```tsx
<p className="font-medium text-lg">{resultCount} soru veritabanına eklendi</p>
<p className="text-sm text-gray-500">Sorular inceleme kuyruğuna eklendi.</p>
```

- [ ] **Step 4: `"export_error"` adımı için UI bloğu ekle**

`if (step === "error")` bloğunun hemen **öncesine** ekle:

```tsx
if (step === "export_error") {
  return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className="text-5xl">⚠️</div>
      <p className="font-medium text-orange-600">Sorular üretildi ama kaydedilemedi</p>
      <p className="text-sm text-gray-500 text-center max-w-sm">{errorMsg}</p>
      <p className="text-xs text-gray-400">Backend loglarını kontrol edin.</p>
      <Button variant="outline" onClick={() => setStep("form")}>Tekrar Dene</Button>
    </div>
  );
}
```

- [ ] **Step 5: TypeScript derleme kontrolü**

```bash
cd /Users/hsyndnc/Desktop/kpss-admin-panel
npx tsc --noEmit
```

Beklenen: Hata yok (ya da mevcut hata sayısı artmamış).

---

## Task 2: Manuel Test

**Önkoşul:** Admin panel çalışıyor (`npm run dev`, port 3000).

- [ ] **Step 1: Export hata senaryosunu simüle et**

Backend **kapalıyken** admin panelden PDF yükle. Pipeline soruları üretip export etmeye çalışacak ama backend'e bağlanamayacak.

Beklenen ekran: Sarı uyarı (`⚠️`) ile **"Sorular üretildi ama veritabanına kaydedilemedi"** mesajı + hata detayı.

Daha önce: Yeşil tik (`✅`) ile "N soru üretildi" yazıyordu — bu artık görünmemeli.

- [ ] **Step 2: Başarılı senaryo**

Backend ve pipeline ikisi de çalışırken PDF yükle.

Beklenen ekran: Yeşil tik (`✅`) ile `"N soru veritabanına eklendi"` — burada N = `job.export.imported` (AI'ın ürettiği sayı değil, gerçekten DB'ye yazılan).
