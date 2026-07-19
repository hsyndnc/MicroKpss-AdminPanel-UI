# Ders → Konu Kategori Seçici Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soru detay sayfasındaki flat kategori dropdown'ını iki adımlı Ders → Konu seçicisine çevirmek; soru yalnızca konuya (alt kategoriye) kaydedilebilecek.

**Architecture:** Yeni `CategoryCascadeSelect` bileşeni ders/konu ayrımını `AdminCategory.parentCategoryId` üzerinden kendisi yapar; form yine tek `categoryId` alanı tutar. Ders, seçili konudan türetilir (effect'te setState yok); submit'te "seçilen kategori bir konu mu" kontrolü yapılır.

**Tech Stack:** Next.js 16 (App Router), React 19, react-hook-form + zod, shadcn/ui (`Select`), TanStack Query.

**Spec:** `docs/superpowers/specs/2026-07-19-kategori-secici-design.md`

## Global Constraints

- Bu repo'daki Next.js eğitim verinden farklı olabilir — şüphede kalınca `node_modules/next/dist/docs/` içindeki ilgili dokümana bak.
- Test framework'ü YOK. Her görevin doğrulaması: `npm run build` başarılı + `npx eslint <dosyalar>` temiz. Bilinen tek mevcut uyarı: `app/(admin)/questions/[id]/page.tsx` içinde `form.watch` (`react-hooks/incompatible-library`) — buna dokunma, yeni uyarı ekleme.
- `react-hooks/set-state-in-effect` kuralı açık: effect içinde senkron setState YAZMA. Bu planda effect hiç kullanılmıyor; öyle kalsın.
- Commit mesajları sade Türkçe, **Co-Authored-By imzası YOK**.
- Tüm iş `main` branch'inde yapılır (worktree yok — kullanıcı tercihi).
- Zod şeması (`lib/validations/questionSchema.ts`) DEĞİŞMEZ; konu kontrolü submit'te categories verisiyle yapılır.

---

### Task 1: `CategoryCascadeSelect` bileşeni

**Files:**
- Create: `components/shared/CategoryCascadeSelect.tsx`

**Interfaces:**
- Consumes: `AdminCategory` tipi (`lib/types.ts:31-37` — `id`, `name`, `parentCategoryId?`, `parentCategoryName?`), shadcn `Select` (`components/ui/select`).
- Produces: `CategoryCascadeSelect({ categories, value, onChange })` — `categories: AdminCategory[]`, `value: string` (form'daki categoryId), `onChange: (id: string) => void`. Task 2 bu imzayla kullanacak.

- [ ] **Step 1: Bileşeni yaz**

`components/shared/CategoryCascadeSelect.tsx` (yeni dosya, tam içerik):

```tsx
"use client";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminCategory } from "@/lib/types";

interface CategoryCascadeSelectProps {
  categories: AdminCategory[];
  value: string;
  onChange: (id: string) => void;
}

export function CategoryCascadeSelect({ categories, value, onChange }: CategoryCascadeSelectProps) {
  // value doluyken ders her zaman değerden türetilir; pickedDers sadece konu boşken devrede.
  const [pickedDers, setPickedDers] = useState("");

  const dersler = categories.filter((c) => !c.parentCategoryId);
  const selected = categories.find((c) => c.id === value);
  const effectiveDers = value ? (selected?.parentCategoryId ?? selected?.id ?? "") : pickedDers;
  const konular = categories.filter((c) => c.parentCategoryId === effectiveDers);
  // Eski veri: value bir ders id'siyse konu dropdown'ı boş (placeholder) görünmeli.
  const konuValue = selected?.parentCategoryId ? value : "";

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <span className="text-sm font-medium">Ders</span>
        <Select
          value={effectiveDers}
          onValueChange={(v) => {
            if (!v || v === effectiveDers) return;
            setPickedDers(v);
            onChange("");
          }}
        >
          <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
          <SelectContent>
            {dersler.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">Konu</span>
        <Select
          value={konuValue}
          onValueChange={(v) => v && onChange(v)}
          disabled={!effectiveDers}
        >
          <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
          <SelectContent>
            {konular.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Lint + derleme kontrolü**

Çalıştır: `npx eslint components/shared/CategoryCascadeSelect.tsx && npm run build`
Beklenen: eslint sessiz; build başarılı (bileşen henüz kullanılmıyor, sadece derlenebilirlik kontrolü).

- [ ] **Step 3: Commit**

```bash
git add components/shared/CategoryCascadeSelect.tsx
git commit -m "feat: CategoryCascadeSelect — ders→konu iki adımlı seçici bileşeni"
```

---

### Task 2: Soru detay sayfasına entegrasyon + submit kontrolü

**Files:**
- Modify: `app/(admin)/questions/[id]/page.tsx` (kategori FormField'ı ~131-142. satırlar; form onSubmit ~120. satır; import bloğu)

**Interfaces:**
- Consumes: Task 1'den `CategoryCascadeSelect({ categories, value, onChange })`.
- Produces: Kullanıcıya görünen davranış — dışa API yok.

- [ ] **Step 1: Import ekle**

`app/(admin)/questions/[id]/page.tsx` import bloğuna (`VerificationBadge` import'unun altına):

```tsx
import { CategoryCascadeSelect } from "@/components/shared/CategoryCascadeSelect";
```

- [ ] **Step 2: Kategori FormField'ını değiştir**

Mevcut blok (satır ~131-142):

```tsx
<FormField control={form.control} name="categoryId" render={({ field }) => (
  <FormItem>
    <FormLabel>Kategori</FormLabel>
    <Select onValueChange={(v) => v && field.onChange(v)} value={field.value}>
      <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
      <SelectContent>
        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
      </SelectContent>
    </Select>
    <FormMessage />
  </FormItem>
)} />
```

Yenisi:

```tsx
<FormField control={form.control} name="categoryId" render={({ field }) => (
  <FormItem>
    <CategoryCascadeSelect categories={categories} value={field.value} onChange={field.onChange} />
    <FormMessage />
  </FormItem>
)} />
```

Not: `FormLabel` kalkıyor (etiketler bileşenin içinde); bu dosyada `FormLabel`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` başka alanlarda da kullanılıyor — import'ları SİLME.

- [ ] **Step 3: Submit'e konu kontrolü ekle**

Mevcut form etiketi (satır ~120):

```tsx
<form id="question-form" onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="max-w-2xl space-y-4">
```

Yenisi:

```tsx
<form id="question-form" onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
```

Ve `updateMutation` tanımının hemen üstüne (satır ~73 civarı) şu fonksiyonu ekle:

```tsx
const onSubmit = (d: QuestionInput) => {
  const cat = categories.find((c) => c.id === d.categoryId);
  if (!cat?.parentCategoryId) {
    form.setError("categoryId", { message: "Konu seçiniz" });
    return;
  }
  updateMutation.mutate(d);
};
```

Not: `categories` bileşen gövdesinde zaten mevcut (`useCategories`, satır 35). `QuestionInput` tipi zaten import'lu.

- [ ] **Step 4: Lint + derleme kontrolü**

Çalıştır: `npx eslint "app/(admin)/questions/[id]/page.tsx" && npm run build`
Beklenen: build başarılı; eslint'te yalnızca önceden var olan `form.watch` uyarısı (`react-hooks/incompatible-library`) — yeni uyarı YOK.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/questions/[id]/page.tsx"
git commit -m "feat: soru detayında ders→konu kategori seçici + konu zorunluluğu"
```

---

### Task 3: Tarayıcı doğrulaması (kullanıcıyla)

**Files:** yok (manuel doğrulama)

**Interfaces:** yok

Auth gerektiren sayfalar tarayıcıdan kullanıcıyla test edilir (admin credential'ları agent'ta yok). Dev server: http://localhost:3000, backend 5213, pipeline 8001 ayakta olmalı.

- [ ] **Step 1: Kullanıcıya kontrol listesini ver ve sonucu bekle**

1. Konuya atanmış mevcut bir soru aç → Ders ve Konu dolu gelmeli.
2. Dersi değiştir → Konu "Seçiniz"e dönmeli, konu listesi yeni dersin konuları olmalı.
3. Konu seçmeden Kaydet → "Konu seçiniz" hatası, kayıt gitmemeli.
4. Konu seç + Kaydet → "Kaydedildi" toast'ı; sayfayı yenileyince yeni ders/konu dolu gelmeli.
5. (Varsa) derse atanmış eski bir soru aç → Ders dolu, Konu boş; Kaydet "Konu seçiniz" demeli.
6. "AI ile Düzelt" → Forma Uygula → ders/konu bozulmamalı.

- [ ] **Step 2: Sonucu hafızaya işle**

Test sonucunu (`~/.claude/projects/-Users-hsyndnc-Desktop-kpss-admin-panel/memory/project_kpss_state.md`) güncelle; sorun çıktıysa superpowers:systematic-debugging ile debug.
