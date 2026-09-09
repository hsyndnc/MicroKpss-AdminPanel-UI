# Soru Kaynak Etiketi (Servis/İmport) — Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panelinde her soruya kaynak etiketi (Servis/İmport) göster ve "Kaynak" filtresiyle daralt.

**Architecture:** Backend `Question`'a `source` alanı + `?source=` filtresi ekliyor (ikiz backend spec'i). Panel bu string enum'u (`"Service"`/`"Import"`) alıp Türkçe rozete çevirir; listeye sütun + URL-param'lı filtre, detaya rozet ekler. Veri akışı zaten hazır: `getAdminQuestions` parametre nesnesini query string'e seriyor, `useQuestions` onu queryKey + queryFn'e geçiriyor.

**Tech Stack:** Next.js (App Router), TypeScript, TanStack Query, shadcn/ui (`Badge`, `Select`, `Table`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-09-soru-kaynak-etiketi-panel-design.md`

## Global Constraints

- **Kaynak değerleri backend enum string'i:** `"Service"` (pipeline) · `"Import"` (panel-import). Panel Türkçe'ye çevirir: `Servis` / `İmport`.
- **Graceful degradation:** `source` yoksa (backend eski) rozet `—` gösterir; filtre paramı zararsız. Sayfa asla bozulmaz.
- **Mevcut kalıpları izle:** filtreler URL search param + `setQueryParam` (status filtresi kalıbı); rozet `VerificationBadge` kalıbı (`Record<string,{label,className}>` + `<Badge>`).
- **Panelde birim test altyapısı YOK** (repo geneli). Her task'ın doğrulaması: `npx tsc --noEmit` + değişen dosyalar için `npx eslint` (+ sayfa task'larında `npm run build`). Uçtan uca tarayıcı smoke'u **backend spec'i canlı olunca** anlamlı (o ana kadar sütun `—`).
- **Commit'lerde Co-Authored-By EKLEME** (repo konvansiyonu).

---

### Task 1: Tip + API filtre paramı (veri tesisatı)

**Files:**
- Modify: `lib/types.ts` (AdminQuestion — `sourceText` satırının hemen altına)
- Modify: `lib/api/questions.ts:4-10` (`GetQuestionsParams`)

**Interfaces:**
- Consumes: —
- Produces: `AdminQuestion.source?: "Service" | "Import"`; `GetQuestionsParams.source?: string` (→ `getAdminQuestions` `{ params }` ile query string'e otomatik akar).

- [ ] **Step 1: `AdminQuestion`'a `source` alanı ekle**

`lib/types.ts` içinde `AdminQuestion` interface'inde `sourceText?: string | null;` satırının altına:

```ts
  source?: "Service" | "Import"; // kaynak: "Service" = pipeline üretti, "Import" = panelden import
```

- [ ] **Step 2: `GetQuestionsParams`'a `source` ekle**

`lib/api/questions.ts` — `GetQuestionsParams` içinde `verification?: string;` satırının altına:

```ts
  source?: string; // kaynak filtresi ("Service" | "Import"); {params} ile query'ye gider
```

- [ ] **Step 3: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: PASS (exit 0)

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/api/questions.ts
git commit -m "feat: AdminQuestion.source alanı + GetQuestionsParams.source filtresi"
```

---

### Task 2: `SourceBadge` bileşeni

**Files:**
- Create: `components/shared/SourceBadge.tsx`

**Interfaces:**
- Consumes: `Badge` (`@/components/ui/badge`)
- Produces: `SourceBadge({ source }: { source?: string | null }): JSX.Element` — `"Service"`→"Servis" (mavi), `"Import"`→"İmport" (mor), yok/tanınmaz → gri `—`.

- [ ] **Step 1: Bileşeni oluştur**

`components/shared/SourceBadge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  Service: { label: "Servis", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  Import:  { label: "İmport", className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
};

export function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return <span className="text-gray-400 text-sm">—</span>;
  const entry = config[source];
  if (!entry) return <span className="text-gray-400 text-sm">—</span>;
  return <Badge className={entry.className}>{entry.label}</Badge>;
}
```

- [ ] **Step 2: Tip + lint kontrolü**

Run: `npx tsc --noEmit && npx eslint components/shared/SourceBadge.tsx`
Expected: PASS (exit 0, çıktı yok)

- [ ] **Step 3: Commit**

```bash
git add components/shared/SourceBadge.tsx
git commit -m "feat: SourceBadge (Servis/İmport rozeti)"
```

---

### Task 3: Sorular listesi — "Kaynak" sütunu + filtresi

**Files:**
- Modify: `app/(admin)/questions/page.tsx`

**Interfaces:**
- Consumes: `SourceBadge` (Task 2), `AdminQuestion.source` + `GetQuestionsParams.source` (Task 1)
- Produces: URL `?source=Service|Import|all` filtresi + listede Kaynak sütunu

- [ ] **Step 1: `SourceBadge` import et**

`app/(admin)/questions/page.tsx:6` (`VerificationBadge` import'unun altına):

```tsx
import { SourceBadge } from "@/components/shared/SourceBadge";
```

- [ ] **Step 2: `SOURCE_OPTIONS` sabitini ekle**

`STATUS_OPTIONS` dizisinin (satır 23-28) hemen altına:

```tsx
const SOURCE_OPTIONS = [
  { value: "all", label: "Tümü" },
  { value: "Service", label: "Servis" },
  { value: "Import", label: "İmport" },
];
```

- [ ] **Step 3: `source` paramını oku + `useQuestions`'a geçir**

`const verification = searchParams.get("verification") ?? "";` (satır 35) altına ekle:

```tsx
  const source = searchParams.get("source") ?? "all";
```

Ve `useQuestions({...})` çağrısına (satır 39-44) `source` satırını ekle:

```tsx
  const { data, isLoading } = useQuestions({
    status: status === "all" ? undefined : status,
    verification: verification || undefined,
    source: source === "all" ? undefined : source,
    page,
    pageSize: 20,
  });
```

- [ ] **Step 4: "Kaynak" filtre Select'ini ekle**

Filtre satırında (satır 115-131) status `Select`'inden sonra, "Yalnızca AI'dan geçenler" label'ından ÖNCE — status Select'iyle birebir aynı kalıp:

```tsx
        <Select value={source} items={SOURCE_OPTIONS} onValueChange={(v) => v && setQueryParam("source", v)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
```

- [ ] **Step 5: Tabloya "Kaynak" sütununu ekle + `colSpan` güncelle**

(a) `<TableHead>AI Doğrulama</TableHead>` (satır 157) altına:

```tsx
                <TableHead>Kaynak</TableHead>
```

(b) `<TableCell><VerificationBadge status={q.verificationStatus} /></TableCell>` (satır 174) altına:

```tsx
                  <TableCell><SourceBadge source={q.source} /></TableCell>
```

(c) Boş satır `colSpan={8}` (satır 197) → `colSpan={9}`:

```tsx
                  <TableCell colSpan={9} className="text-center py-8 text-gray-400">Soru bulunamadı</TableCell>
```

- [ ] **Step 6: Tip + lint + build**

Run: `npx tsc --noEmit && npx eslint "app/(admin)/questions/page.tsx" && npm run build`
Expected: PASS — tsc/eslint sessiz, build "✓ Compiled successfully" + 18 rota.

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)/questions/page.tsx"
git commit -m "feat: sorular listesine Kaynak sütunu + Kaynak filtresi"
```

---

### Task 4: Soru detayı — kaynak rozeti

**Files:**
- Modify: `app/(admin)/questions/[id]/page.tsx:12,134`

**Interfaces:**
- Consumes: `SourceBadge` (Task 2), `AdminQuestion.source` (Task 1)
- Produces: —

- [ ] **Step 1: `SourceBadge` import et**

`app/(admin)/questions/[id]/page.tsx:12` (`VerificationBadge` import'unun altına):

```tsx
import { SourceBadge } from "@/components/shared/SourceBadge";
```

- [ ] **Step 2: Başlık rozetlerine ekle**

`<VerificationBadge status={question.verificationStatus} />` (satır 134) altına:

```tsx
          <SourceBadge source={question.source} />
```

- [ ] **Step 3: Tip + lint + build**

Run: `npx tsc --noEmit && npx eslint "app/(admin)/questions/[id]/page.tsx" && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/questions/[id]/page.tsx"
git commit -m "feat: soru detayına kaynak rozeti"
```

---

## Uçtan uca doğrulama (backend canlı olunca)

Backend spec'i (`KpssSoru-backend/.../2026-09-09-soru-kaynak-etiketi-backend-design.md`) uygulanıp `:5213` rebuild+restart edildikten sonra panelden smoke:

- Listede import edilen sorular **İmport** (mor), pipeline soruları **Servis** (mavi) rozeti gösterir.
- "Kaynak: İmport" filtresi yalnız import'ları, "Servis" yalnız pipeline'ı listeler; "Tümü" hepsini; sayfalama sayacı tutarlı.
- Bir sorunun detayında doğru kaynak rozeti.
- Backend henüz güncel değilken sütun `—` gösterir, sayfa bozulmaz (graceful).

## Self-Review notu

- **Spec kapsamı:** types+api (T1), SourceBadge (T2), liste sütunu+filtre (T3), detay rozeti (T4) → spec'teki 5 dosya değişikliğinin tümü kapsanıyor.
- **Tip tutarlılığı:** `source?: "Service" | "Import"` (T1) ↔ `SourceBadge` config anahtarları `Service`/`Import` (T2) ↔ `SOURCE_OPTIONS` value'ları (T3) tutarlı.
- **Placeholder yok:** her adım gerçek kod/komut içeriyor.
