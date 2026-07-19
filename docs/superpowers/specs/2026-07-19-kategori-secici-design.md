# Soru Detayında Ders → Konu Kategori Seçici — Tasarım

**Tarih:** 2026-07-19
**Durum:** Onaylandı (kullanıcı, sohbet içinde)

## Amaç

Soru detay sayfasındaki kategori seçici (`app/(admin)/questions/[id]/page.tsx:131-142`) bütün kategorileri tek düz listede gösteriyor; dersler ile konular karışık duruyor. Veri modelinde iki seviyeli hiyerarşi zaten var (`AdminCategory.parentCategoryId` / `parentCategoryName`). Seçici iki adımlı olacak: önce ders, sonra o dersin konuları.

## Karar: soru sadece konuya atanır

Kullanıcı kararı: bir soru derse (üst kategoriye) doğrudan atanamaz; her soru bir konuya (alt kategoriye) ait olmalı. Halihazırda derse atanmış eski bir soru açılırsa ders dolu, konu boş görünür ve konu seçilmeden kayıt engellenir.

## Yaklaşım

Değerlendirilen seçenekler: (A) iki ayrı Select ders → konu, (B) tek Select'te `SelectGroup` ile gruplu görünüm, (C) aramalı combobox. **Seçilen: A** — istenen akışın birebir karşılığı, konu listesi kısa ve odaklı kalıyor; combobox konu sayısı yüzleri bulmadıkça gereksiz bağımlılık.

## Tasarım

### Yeni bileşen: `components/shared/CategoryCascadeSelect.tsx`

- Props: `categories: AdminCategory[]`, `value: string` (form'daki `categoryId`), `onChange: (id: string) => void`.
- Ders listesi = `parentCategoryId`'si boş olan kategoriler. Konu listesi = seçili dersin çocukları.
- **Ders türetme:** `value` doluysa efektif ders her zaman değerden türetilir (konu ise `parentCategoryId`'si, ders ise kendisi); `value` boşken kullanıcının elle seçtiği `pickedDers` local state'i kullanılır. Böylece `form.reset` ile dışarıdan gelen değer her zaman kazanır ve effect içinde setState gerekmez (`react-hooks/set-state-in-effect` kuralı).
- Ders değişince `onChange("")` ile konu temizlenir; konu dropdown'ı placeholder'a döner.
- `value` bir ders id'siyse (eski veri): ders dropdown'ı o dersi gösterir, konu boş kalır.

### Sayfa entegrasyonu

- Mevcut tek "Kategori" `FormField`'ının yerine geçer; "Ders" ve "Konu" iki kolonlu grid'de yan yana (Zorluk/Tür ile aynı desen).
- **Submit kontrolü:** `handleSubmit` içinde, seçili `categoryId` konu değilse (kategori bulunamıyor veya `parentCategoryId`'si yoksa) `form.setError("categoryId", { message: "Konu seçiniz" })` + kayıt yapılmaz. Zod şeması değişmez; kontrol categories verisiyle yapılır.
- `AiFixDialog` `categoryId`'ye dokunmuyor; `form.reset` sonrası ders yine değerden türetilir — ek iş yok.

## Kapsam dışı

- Sorular liste sayfasındaki kategori filtresi (flat kalır).
- Kategoriler sayfası, backend, üçüncü hiyerarşi seviyesi.

## Doğrulama

Test framework'ü yok. `npm run build` + eslint temiz; tarayıcıda: mevcut soru açılınca ders+konu dolu gelir, ders değişince konu sıfırlanır, konu seçmeden Kaydet "Konu seçiniz" hatası verir, derse atanmış eski soruda konu boş açılır.
