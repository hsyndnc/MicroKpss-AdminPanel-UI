# Soru Detayında Ders → Konu Kategori Seçici — Tasarım

**Tarih:** 2026-07-19
**Durum:** Onaylandı (kullanıcı, sohbet içinde)

## Amaç

Soru detay sayfasındaki kategori seçici (`app/(admin)/questions/[id]/page.tsx:131-142`) bütün kategorileri tek düz listede gösteriyor; dersler ile konular karışık duruyor. Veri modelinde iki seviyeli hiyerarşi zaten var (`AdminCategory.parentCategoryId` / `parentCategoryName`). Seçici iki adımlı olacak: önce ders, sonra o dersin konuları.

## Revizyon 2 (2026-07-20): hiyerarşi 3 seviyeli — Alan → Ders → Konu

DB sorgusu (kpssapp Postgres, Categories) kesinleştirdi: kökler **Genel Yetenek / Genel Kültür** (alan), altında **dersler** (Türkçe, Tarih...), derslerin altında da İçerik Üretimi sayfasının oluşturduğu **konular** (Osmanlı Kuruluş... vb.) var. Sorular karışık derinlikte: seed soruları derslere, pipeline üretimleri konulara bağlı (1 soru köke bağlı — veri tuhaflığı).

Nihai tasarım:
- `CategoryCascadeSelect` üç kademeli: **Alan → Ders → Konu**. Konu kutusu yalnızca seçili dersin altında konu varsa görünür.
- Ders seçildiğinde: dersin konusu yoksa `onChange(dersId)` (ders geçerli yaprak); konusu varsa `onChange("")` ve konu seçimi beklenir.
- Submit kuralı: kategori yaprak olmalı — parent'sız (alan) ise "Ders seçiniz", çocuğu olan ders ise "Konu seçiniz" hatası.
- Alan/ders türetme zinciri value'dan (konu→ders→alan); `pickedAlan`/`pickedDers` local state'leri yalnızca value boşken devrede (effect'te setState yok).
- **İçerik Üretimi sayfası düzeltmesi:** `content/page.tsx:38`'deki ders filtresi `parentCategoryId != null` konuları da ders listesine sokuyordu; doğrusu "parent'ı kök (alan) olanlar".

İlk revizyondaki "hiyerarşi 2 seviye, konu yok" tespiti eksik veriye (yalnız seed) dayanıyordu; bu revizyon onu geçersiz kılar.

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
