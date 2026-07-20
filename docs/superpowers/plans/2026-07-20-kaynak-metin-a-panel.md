# Kaynak Metin Panelde (A) — Panel Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soru detay sayfasında, doğrulama not kutusunun altında katlanır "Kaynak Metin" bölümü göstermek.

**Architecture:** `Question` tipine `sourceText` alanı; detay sayfasına `question.sourceText` doluysa render edilen `<details>` bloğu. Backend zaten camelCase `sourceText` döndürür — API katmanında değişiklik gerekmez.

**Tech Stack:** Next.js (App Router), TypeScript, Tailwind.

**Spec:** kpss-content-pipeline reposunda `docs/superpowers/specs/2026-07-20-kaynak-metin-panelde-design.md`

## Global Constraints

- Branch: **main** (bu repoda iş main'de yürüyor).
- Bölüm YALNIZ `sourceText` doluysa görünür; varsayılan KAPALI (`<details>` open'sız).
- Liste sayfasına hiçbir şey eklenmez.
- Önkoşul: backend planı tamam (detay endpoint'i `sourceText` döndürüyor).
- Commit ATMADAN ÖNCE kullanıcıya sor (kullanıcı tercihi).

---

### Task 1: Tip + detay bölümü

**Files:**
- Modify: `lib/types.ts:28` (verificationNote satırının altı)
- Modify: `app/(admin)/questions/[id]/page.tsx:127` (doğrulama not bloğunun kapanışından sonra)

**Interfaces:**
- Consumes: backend admin detay JSON'undaki `sourceText: string | null`.
- Produces: görsel bölüm; başka tüketici yok.

- [ ] **Step 1: Tipe alan ekle**

`lib/types.ts` içinde `verificationNote?: string | null;` satırının altına:

```ts
  sourceText?: string | null; // üretimde kullanılan kaynak metin (yalnız detay endpoint'i döner)
```

- [ ] **Step 2: Detay sayfasına katlanır bölüm**

`app/(admin)/questions/[id]/page.tsx` içinde şu bloğun:

```tsx
      {question.verificationStatus === "supheli" && question.verificationNote && (
        <div className="max-w-2xl rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">AI doğrulama notu</p>
          <p className="mt-1">{question.verificationNote}</p>
        </div>
      )}
```

hemen ALTINA:

```tsx
      {question.sourceText && (
        <details className="max-w-2xl rounded-md border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Kaynak Metin</summary>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{question.sourceText}</p>
        </details>
      )}
```

- [ ] **Step 3: Build doğrula**

```bash
cd /Users/hsyndnc/Desktop/kpss-admin-panel && npm run build
```

Expected: build temiz (tip hatası yok).

- [ ] **Step 4: Elle doğrulama**

Panel + backend + pipeline çalışırken:
1. Yeni bir üretim işi başlat (pipeline restart edilmiş olmalı — pipeline planı Step 6).
2. Üretilen bir sorunun detayına gir → doğrulama kutusunun altında kapalı "Kaynak Metin" bölümü; tıklayınca metin açılır.
3. Eski bir sorunun detayına gir (sourceText null) → bölüm hiç görünmez.

- [ ] **Step 5: KULLANICIYA SORARAK commit**

```bash
git add lib/types.ts "app/(admin)/questions/[id]/page.tsx"
git commit -m "feat: soru detayında katlanır Kaynak Metin bölümü"
```
