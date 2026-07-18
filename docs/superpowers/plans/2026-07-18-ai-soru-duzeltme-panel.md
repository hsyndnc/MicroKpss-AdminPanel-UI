# AI Soru Düzeltme — Panel Planı (3/3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doğrulama durumunu panelde göstermek (Görev 5) ve soru detayında "AI ile Düzelt" akışını eklemek: rapor + opsiyonel not → öneri → eski/yeni karşılaştırma → forma uygula → mevcut Kaydet.

**Architecture:** Yeni `VerificationBadge` ve `AiFixDialog` bileşenleri; `lib/api/questions.ts`'e `requestAiFix`. Öneri hiçbir zaman doğrudan kaydedilmez — "Forma Uygula" react-hook-form'u doldurur, kayıt mevcut PUT akışından geçer.

**Tech Stack:** Next.js (App Router), TypeScript, TanStack Query, react-hook-form + zod, shadcn/ui, sonner.

**Spec:** `kpss-content-pipeline/docs/superpowers/specs/2026-07-18-ai-soru-duzeltme-design.md`
**Sıra:** Pipeline (1/3) ve backend (2/3) planları tamamlanmış olmalı. Bu plan, `docs/ADMIN_PANEL_PIPELINE_TASKS.md` Görev 5'i Task 1 olarak kapsar.

## Global Constraints

- Backend `ai-fix` yanıt sözleşmesi: `{ suggestion: { body, options: string[], correctAnswer, explanation }, changeSummary, sourceFound }`; hatalar: 404 / 400 (`{ error }`) / 502 (`{ error }`).
- `verificationStatus` değerleri: `"gecti" | "supheli" | "kontrol_edilemedi" | null` (null = pipeline dışı soru).
- UI metinleri Türkçe; mevcut bileşen kalıpları (shadcn/ui, `StatusBadge`, `RejectDialog`) izlenir.
- Commit mesajları sade, Co-Authored-By imzası YOK.
- Panelde test altyapısı yok — her task'ın doğrulaması `npm run build` (tip + derleme) ve son task'taki elle uçtan uca kontrol listesi.

---

### Task 1: Doğrulama alanlarını göster (= Görev 5)

**Files:**
- Modify: `lib/types.ts` (AdminQuestion interface'i, ~satır 12-27)
- Create: `components/shared/VerificationBadge.tsx`
- Modify: `app/(admin)/questions/page.tsx` (tablo kolonları)
- Modify: `app/(admin)/questions/[id]/page.tsx` (başlık + not kutusu)

**Interfaces:**
- Produces: `AdminQuestion.verificationStatus?: string | null`, `AdminQuestion.verificationNote?: string | null`; `<VerificationBadge status={...} />` (null/boşta hiçbir şey render etmez). Task 2-3 bu alanlara dayanır.

- [ ] **Step 1: Tipe alanları ekle** — `lib/types.ts`, `AdminQuestion` içine `createdAt: string;` satırının altına:

```typescript
  verificationStatus?: string | null; // "gecti" | "supheli" | "kontrol_edilemedi" | null
  verificationNote?: string | null;
```

(Alan adlarını API yanıtından doğrula: `GET /api/v1/admin/questions` çıktısında `verificationStatus` camelCase gelmeli — .NET varsayılan serializasyonu camelCase.)

- [ ] **Step 2: Badge bileşeni** — `components/shared/VerificationBadge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  gecti:              { label: "AI: Geçti",             className: "bg-green-100 text-green-800 hover:bg-green-100" },
  supheli:            { label: "AI: Şüpheli",           className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  kontrol_edilemedi:  { label: "AI: Kontrol edilemedi", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

export function VerificationBadge({ status }: { status?: string | null }) {
  if (!status || !config[status]) return null;
  const { label, className } = config[status];
  return <Badge className={className}>{label}</Badge>;
}
```

- [ ] **Step 3: Liste kolonunu ekle** — `app/(admin)/questions/page.tsx`:

Import: `import { VerificationBadge } from "@/components/shared/VerificationBadge";`

`<TableHead>Durum</TableHead>` satırının altına:

```tsx
<TableHead>AI Doğrulama</TableHead>
```

`<TableCell><StatusBadge status={q.status as ContentStatus} /></TableCell>` satırının altına:

```tsx
<TableCell><VerificationBadge status={q.verificationStatus} /></TableCell>
```

"Soru bulunamadı" satırındaki `colSpan={7}` → `colSpan={8}`.

- [ ] **Step 4: Detay sayfası** — `app/(admin)/questions/[id]/page.tsx`:

Import: `import { VerificationBadge } from "@/components/shared/VerificationBadge";`

Başlıktaki `<StatusBadge status={question.status as ContentStatus} />` satırını şununla değiştir:

```tsx
<div className="flex items-center gap-2">
  <VerificationBadge status={question.verificationStatus} />
  <StatusBadge status={question.status as ContentStatus} />
</div>
```

Başlık `div`inin kapanışından hemen sonra (form başlamadan önce), şüpheli sorular için not kutusu:

```tsx
{question.verificationStatus === "supheli" && question.verificationNote && (
  <div className="max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
    <p className="font-medium">AI doğrulama raporu</p>
    <p className="mt-1">{question.verificationNote}</p>
  </div>
)}
```

- [ ] **Step 5: Derleme kontrolü**

Run: `npm run build`
Expected: hatasız derlenir

- [ ] **Step 6: Elle doğrula**

Backend + panel ayakta: `/questions` listesinde pipeline sorularında "AI: Geçti/Şüpheli" badge'i görünür (son testte 11 gecti / 4 supheli); eski sorularda badge yok; şüpheli sorunun detayında amber rapor kutusu var.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts components/shared/VerificationBadge.tsx "app/(admin)/questions/page.tsx" "app/(admin)/questions/[id]/page.tsx"
git commit -m "feat: soru listesi ve detayında AI doğrulama durumu gösterimi"
```

---

### Task 2: `requestAiFix` API fonksiyonu

**Files:**
- Modify: `lib/types.ts` (dosya sonuna tipler)
- Modify: `lib/api/questions.ts` (dosya sonuna fonksiyon)

**Interfaces:**
- Consumes: backend `POST /admin/questions/{id}/ai-fix` (bkz. Global Constraints).
- Produces: `requestAiFix(id: string, adminNote?: string): Promise<AiFixResult>`; `AiFixResult`/`AiFixSuggestion` tipleri. Task 3 kullanır.

- [ ] **Step 1: Tipler** — `lib/types.ts` sonuna:

```typescript
export interface AiFixSuggestion {
  body: string;
  options: string[];
  correctAnswer: string;
  explanation?: string | null;
}

export interface AiFixResult {
  suggestion: AiFixSuggestion;
  changeSummary: string;
  sourceFound: boolean;
}
```

- [ ] **Step 2: API fonksiyonu** — `lib/api/questions.ts` sonuna (import satırına `AiFixResult` ekle):

```typescript
export async function requestAiFix(id: string, adminNote?: string): Promise<AiFixResult> {
  const { data } = await apiClient.post<AiFixResult>(
    `/admin/questions/${id}/ai-fix`,
    { adminNote: adminNote?.trim() || null },
  );
  return data;
}
```

- [ ] **Step 3: Derleme kontrolü + commit**

Run: `npm run build` — Expected: hatasız

```bash
git add lib/types.ts lib/api/questions.ts
git commit -m "feat: requestAiFix — ai-fix endpoint istemcisi"
```

---

### Task 3: `AiFixDialog` bileşeni

**Files:**
- Create: `components/shared/AiFixDialog.tsx`

**Interfaces:**
- Consumes: `requestAiFix` (Task 2), `AdminQuestion` (Task 1 alanlarıyla), shadcn `Dialog`/`Button`/`Textarea`.
- Produces: `<AiFixDialog open question onClose onApply />`; `onApply(s: AiFixSuggestion)` — Task 4 formu doldurmak için kullanır.

- [ ] **Step 1: Bileşeni yaz** — `components/shared/AiFixDialog.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { requestAiFix } from "@/lib/api/questions";
import type { AdminQuestion, AiFixResult, AiFixSuggestion } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const HARFLER = ["A", "B", "C", "D", "E"];

function DiffRow({ label, eski, yeni }: { label: string; eski: string; yeni: string }) {
  const degisti = eski !== yeni;
  return (
    <div className={`rounded-md border p-2 text-sm ${degisti ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}>
      <p className="font-medium text-gray-500">{label}{degisti && " — değişti"}</p>
      {degisti && <p className="mt-1 text-gray-500 line-through">{eski}</p>}
      <p className="mt-1">{yeni}</p>
    </div>
  );
}

export function AiFixDialog({
  open, question, onClose, onApply,
}: {
  open: boolean;
  question: AdminQuestion;
  onClose: () => void;
  onApply: (s: AiFixSuggestion) => void;
}) {
  const [adminNote, setAdminNote] = useState("");
  const [result, setResult] = useState<AiFixResult | null>(null);

  const fixMutation = useMutation({
    mutationFn: () => requestAiFix(question.id, adminNote),
    onSuccess: setResult,
  });

  function handleClose() {
    setResult(null);
    setAdminNote("");
    fixMutation.reset();
    onClose();
  }

  const errorMessage =
    fixMutation.error &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (((fixMutation.error as any).response?.data?.error as string) ??
      "AI düzeltme üretemedi, tekrar deneyin.");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI ile Düzelt</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {question.verificationNote && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">AI doğrulama raporu</p>
                <p className="mt-1">{question.verificationNote}</p>
              </div>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">Ek talimat (opsiyonel)</p>
              <Textarea
                placeholder='Örn: "C şıkkı da doğru, çeldiriciyi değiştir"'
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                disabled={fixMutation.isPending}
              />
            </div>
            {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={fixMutation.isPending}>Vazgeç</Button>
              <Button onClick={() => fixMutation.mutate()} disabled={fixMutation.isPending}>
                {fixMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {fixMutation.isPending ? "AI düzeltiyor…" : "Düzelt"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-medium">Değişiklik özeti</p>
              <p className="mt-1">{result.changeSummary || "Özet verilmedi."}</p>
            </div>
            {!result.sourceFound && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Kaynak metin bulunamadı — düzeltme yalnızca rapora dayanıyor, dikkatli incele.
              </div>
            )}
            <DiffRow label="Soru" eski={question.body} yeni={result.suggestion.body} />
            {result.suggestion.options.map((opt, i) => (
              <DiffRow key={i} label={`${HARFLER[i]} şıkkı`} eski={question.options[i] ?? ""} yeni={opt} />
            ))}
            <DiffRow label="Doğru cevap" eski={question.correctAnswer} yeni={result.suggestion.correctAnswer} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Vazgeç</Button>
              <Button onClick={() => { onApply(result.suggestion); handleClose(); }}>Forma Uygula</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Derleme kontrolü + commit**

Run: `npm run build` — Expected: hatasız

```bash
git add components/shared/AiFixDialog.tsx
git commit -m "feat: AiFixDialog — rapor, ek talimat ve eski/yeni karşılaştırma akışı"
```

---

### Task 4: Detay sayfasına entegrasyon + uçtan uca doğrulama

**Files:**
- Modify: `app/(admin)/questions/[id]/page.tsx`

**Interfaces:**
- Consumes: `AiFixDialog` (Task 3), sayfadaki mevcut `form` (react-hook-form) ve `question` query'si.

- [ ] **Step 1: Sayfaya bağla** — `app/(admin)/questions/[id]/page.tsx`:

Import'lara:

```tsx
import { AiFixDialog } from "@/components/shared/AiFixDialog";
import type { AiFixSuggestion } from "@/lib/types";
```

State'lere (`const [rejectOpen, setRejectOpen] = useState(false);` altına):

```tsx
const [aiFixOpen, setAiFixOpen] = useState(false);
```

Başlıktaki badge grubuna (Task 1'de eklenen `div` içine, `VerificationBadge`'den önce) tuş:

```tsx
{question.verificationStatus && (
  <Button size="sm" variant="outline" onClick={() => setAiFixOpen(true)}>
    AI ile Düzelt
  </Button>
)}
```

Sayfanın sonuna (RejectDialog'un yanına):

```tsx
<AiFixDialog
  open={aiFixOpen}
  question={question}
  onClose={() => setAiFixOpen(false)}
  onApply={(s: AiFixSuggestion) => {
    form.reset({
      ...form.getValues(),
      body: s.body,
      options: s.options,
      correctAnswer: s.correctAnswer,
    });
    toast.info("Öneri forma uygulandı — kontrol edip Kaydet'e basın.");
  }}
/>
```

- [ ] **Step 2: Derleme kontrolü**

Run: `npm run build`
Expected: hatasız

- [ ] **Step 3: Elle uçtan uca doğrulama** (pipeline + backend + panel ayakta)

1. Şüpheli bir sorunun detayını aç → "AI ile Düzelt" tuşu görünür, raporlu dialog açılır.
2. "Düzelt" → bekleme durumu → karşılaştırma görünümü; değişen alanlar vurgulu, özet dolu.
3. "Forma Uygula" → form yeni değerlerle dolar → "Kaydet" → toast "Kaydedildi"; detay yeniden açıldığında düzeltilmiş hali görünür.
4. Ek talimat yazarak tekrar dene → talimatın etkisi öneride görünür.
5. Pipeline'ı durdur (`docker compose stop pipeline`) → "Düzelt" → "Pipeline'a bağlanılamadı" hatası görünür; pipeline'ı tekrar başlat.
6. `verificationStatus` null olan eski bir soruda tuşun görünmediğini kontrol et.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/questions/[id]/page.tsx"
git commit -m "feat: soru detayında AI ile Düzelt akışı"
```
