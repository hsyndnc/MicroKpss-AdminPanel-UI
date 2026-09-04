# Kullanıcılar Sayfası: Kullanıcı Adıyla Arama (Panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/users` arama kutusunun artık kullanıcı adıyla da arama yapılabildiğini kullanıcıya bildirmek.

**Architecture:** Arama akışı (debounce → URL `?search=` → `useUsers` → `getAdminUsers` → `GET /admin/users?search=`) zaten uçtan uca kurulu. Backend `search`'ü kullanıcı adında da eşleştirmeye başladığında panel ek kod olmadan çalışır; tek gereken arama kutusunun placeholder metnini kapsamı yansıtacak şekilde güncellemek.

**Tech Stack:** Next.js (bu repo'nun özel sürümü), React, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-04-admin-users-username-arama-panel-design.md`

## Global Constraints

- **Yalnız placeholder metni değişir** — fonksiyonel akış (state, debounce, URL param, hook, API çağrısı) aynı kalır; yeni state/istek yok.
- **Yeni "arama alanı" seçici EKLENMEZ** — backend tek `search` paramıyla e-posta VEYA kullanıcı adını tarıyor (OR); tek kutu ikisini de kapsar.
- **Bağımlılık:** Uçtan uca sonuç, backend planının (`KpssSoru-backend/docs/superpowers/plans/2026-09-04-admin-users-username-arama-backend.md`) uygulanıp backend'in restart edilmesine bağlıdır. Placeholder değişikliği bağımsızdır ve zararsızdır (backend güncel değilken de arama e-postada çalışmaya devam eder).
- Panelde test runner yok — doğrulama `tsc + lint + build` + canlı smoke (repo'nun yerleşik akışı).

---

### Task 1: Arama kutusu placeholder'ını güncelle

**Files:**
- Modify: `app/(admin)/users/page.tsx` (arama `Input` bileşeni; ~satır 82-87 civarı, `placeholder="E-posta ara..."`)

**Interfaces:**
- Consumes: mevcut `searchInput` state ve `setSearchInput` (değişmez).
- Produces: görünür placeholder metni — davranış/tip değişikliği yok.

- [ ] **Step 1: Placeholder metnini değiştir**

`app/(admin)/users/page.tsx` içindeki arama `Input`'unda:

```tsx
// ÖNCE
<Input
  placeholder="E-posta ara..."
  value={searchInput}
  onChange={(e) => setSearchInput(e.target.value)}
  className="w-64"
/>

// SONRA
<Input
  placeholder="E-posta / kullanıcı adı ara..."
  value={searchInput}
  onChange={(e) => setSearchInput(e.target.value)}
  className="w-64"
/>
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc hatasız; lint yalnız mevcut/ilgisiz uyarı (`questions/[id]/page.tsx` react-hooks/incompatible-library) — yeni hata yok.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Başarılı derleme.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/users/page.tsx"
git commit -m "feat: kullanıcı arama kutusu placeholder'ı kullanıcı adını da kapsıyor"
```

---

## Uygulama sonrası (canlı doğrulama — backend güncel + restart sonrası)

- Arama kutusunun placeholder'ı "E-posta / kullanıcı adı ara..." görünür.
- Kutuya bir kullanıcı adı parçası yaz → liste hem e-posta hem kullanıcı adı eşleşmelerine daralır; sayfalama sayacı doğru.

## Self-Review (spec ↔ plan)

- **Spec "yalnız placeholder değişir, akış aynı"** → Task 1 tek satırı değiştirir; başka dosya/mantık yok. ✓
- **Spec "arama alanı seçici eklenmez"** → eklenmedi. ✓
- **Spec "backend'e bağımlı, panel bozulmaz"** → Global Constraints'te belirtildi; değişiklik zararsız. ✓
- Placeholder taraması (TBD/TODO): yok. Tip tutarlılığı: state/handler imzaları değişmedi. ✓
