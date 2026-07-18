# AI Soru Doğrulama — Admin Panel Implementasyon Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend'in soru DTO'sunda gönderdiği AI doğrulama etiketini soru listesinde rozet (✅/⚠️/❓), soru detayında gerekçe kutusu olarak göstermek. Panel SADECE gösterir — hesaplama/filtre yok (MVP).

**Architecture:** Yeni `VerificationBadge` paylaşılan bileşeni; `AdminQuestion` tipine 2 opsiyonel alan; liste sayfasının Durum hücresine rozet; detay sayfasına koşullu bilgi kutusu. Alan gelmezse (eski backend / eski soru) hiçbir şey render edilmez — geriye uyumlu.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query. Doğrulama: `npx tsc --noEmit` + `npm run dev` ile görsel kontrol.

**Spec:** `KpssSoru-backend/docs/superpowers/specs/2026-07-16-ai-soru-dogrulama-design.md`

## Global Constraints

- **Sözleşme (üç repo ortak — DEĞİŞTİRME):** Backend `GET /admin/questions` ve `GET /admin/questions/{id}` response'larında şu iki alanı döner (camelCase):
  - `verificationStatus`: `"gecti" | "supheli" | "kontrol_edilemedi" | null` (null = eski/elle girilen soru)
  - `verificationNote`: `string | null` (insan-okur Türkçe gerekçe)
- `verificationStatus` null/undefined/bilinmeyen değer ise rozet ve kutu RENDER EDİLMEZ (backend henüz deploy edilmemişse panel bozulmamalı — paralel geliştirme).
- Mevcut görsel dile uy: shadcn/ui + Tailwind, mevcut `StatusBadge` benzeri kompakt rozetler.

---

### Task 1: Tip + VerificationBadge bileşeni

**Files:**
- Modify: `lib/types.ts:12-27` (`AdminQuestion` interface)
- Create: `components/shared/VerificationBadge.tsx`

**Interfaces:**
- Produces: `AdminQuestion.verificationStatus?: string | null`, `AdminQuestion.verificationNote?: string | null`; `<VerificationBadge status={...} note={...} />` — Task 2 ve 3 bunları kullanır.

- [ ] **Step 1: AdminQuestion tipine alanları ekle**

`lib/types.ts` — `AdminQuestion` interface'ine `createdAt` satırından sonra:

```ts
  verificationStatus?: "gecti" | "supheli" | "kontrol_edilemedi" | null;
  verificationNote?: string | null;
```

- [ ] **Step 2: VerificationBadge bileşenini yaz**

`components/shared/VerificationBadge.tsx`:

```tsx
const BADGES = {
  gecti: {
    icon: "✓",
    label: "AI kontrolü: geçti",
    cls: "bg-green-100 text-green-700 border-green-200",
  },
  supheli: {
    icon: "⚠",
    label: "AI kontrolü: şüpheli",
    cls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  kontrol_edilemedi: {
    icon: "?",
    label: "AI kontrolü yapılamadı",
    cls: "bg-gray-100 text-gray-500 border-gray-200",
  },
} as const;

interface Props {
  status?: string | null;
  note?: string | null;
}

export function VerificationBadge({ status, note }: Props) {
  if (!status) return null;
  const badge = BADGES[status as keyof typeof BADGES];
  if (!badge) return null;

  return (
    <span
      title={note ? `${badge.label} — ${note}` : badge.label}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${badge.cls}`}
    >
      {badge.icon} AI
    </span>
  );
}
```

- [ ] **Step 3: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: hata yok

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts components/shared/VerificationBadge.tsx
git commit -m "feat: AdminQuestion doğrulama alanları + VerificationBadge bileşeni"
```

---

### Task 2: Soru listesinde rozet

**Files:**
- Modify: `app/(admin)/questions/page.tsx:150` (Durum hücresi)

**Interfaces:**
- Consumes: `VerificationBadge`, `q.verificationStatus`, `q.verificationNote` (Task 1)

- [ ] **Step 1: Import ekle**

`app/(admin)/questions/page.tsx` başına (`StatusBadge` import'unun yanına):

```tsx
import { VerificationBadge } from "@/components/shared/VerificationBadge";
```

- [ ] **Step 2: Durum hücresine rozeti ekle**

Mevcut satırı:

```tsx
                  <TableCell><StatusBadge status={q.status as ContentStatus} /></TableCell>
```

şuna çevir:

```tsx
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={q.status as ContentStatus} />
                      <VerificationBadge status={q.verificationStatus} note={q.verificationNote} />
                    </div>
                  </TableCell>
```

- [ ] **Step 3: Tip kontrolü + görsel kontrol**

Run: `npx tsc --noEmit`
Expected: hata yok

`npm run dev` çalışırken `localhost:3000/questions` aç (admin girişi: `admin@kpssapp.com`). Backend'de doğrulamalı soru yoksa rozet görünmez — sayfanın ESKİSİ GİBİ hatasız render olması yeterli. (Rozeti canlı görmek için backend tarafının Task 2 curl adımı doğrulamalı bir test sorusu ekler.)

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/questions/page.tsx"
git commit -m "feat: soru listesinde AI doğrulama rozeti"
```

---

### Task 3: Soru detayında gerekçe kutusu

**Files:**
- Modify: `app/(admin)/questions/[id]/page.tsx` (~satır 97 StatusBadge ve ~satır 99-109 onay butonları bölgesi)

**Interfaces:**
- Consumes: `VerificationBadge`, `question.verificationStatus`, `question.verificationNote` (Task 1)

- [ ] **Step 1: Import ekle**

`app/(admin)/questions/[id]/page.tsx` başına:

```tsx
import { VerificationBadge } from "@/components/shared/VerificationBadge";
```

- [ ] **Step 2: Başlıktaki StatusBadge yanına rozet, altına gerekçe kutusu**

Mevcut:

```tsx
        <StatusBadge status={question.status as ContentStatus} />
      </div>

      {question.status === "PendingReview" && (
```

şuna çevir:

```tsx
        <div className="flex items-center gap-1.5">
          <StatusBadge status={question.status as ContentStatus} />
          <VerificationBadge status={question.verificationStatus} note={question.verificationNote} />
        </div>
      </div>

      {question.verificationStatus === "supheli" && question.verificationNote && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">⚠ AI kontrolü şüpheli buldu:</span>{" "}
          {question.verificationNote}
        </div>
      )}

      {question.status === "PendingReview" && (
```

(Gerekçe kutusu bilinçli olarak yalnız `supheli` durumunda gösterilir — `gecti` için rozet yeterli, kutu gürültü olur.)

- [ ] **Step 3: Tip kontrolü + build**

Run: `npx tsc --noEmit && npm run build`
Expected: ikisi de hatasız

- [ ] **Step 4: Görsel kontrol**

`npm run dev` ile `localhost:3000/questions` → bir soruya tıkla → detay sayfası hatasız açılmalı. Doğrulamalı soru varsa: listede ⚠/✓ rozeti, şüpheli sorunun detayında sarı gerekçe kutusu görünmeli.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/questions/[id]/page.tsx"
git commit -m "feat: soru detayında AI doğrulama rozeti ve şüpheli gerekçe kutusu"
```

---

### Uçtan uca not

Üç repo da bittiğinde tam akış testi: admin panelden PDF yükle (DeepSeek maliyeti — kullanıcı onayıyla) → sorular doğrulama etiketleriyle `PendingReview` düşer → listede rozetler, şüpheli detayında gerekçe kutusu.
