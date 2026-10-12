# Panel mobil uyum + UX turu — tasarım

**Tarih:** 2026-10-13
**Dal:** `feature/panel-mobil-uyum` (`origin/main`'den açıldı)
**Durum:** spec yazıldı, kod yazılmadı

## 1. Amaç ve kabul ölçütü

Masaüstü birincil kullanım olarak kalıyor. Telefon ikincil ama **şu üç iş telefondan
yapılabilmeli** (kullanıcının seçimi):

1. Soru onay / red — Sorular listesi + soru detayı
2. Raporları işleme — Raporlar listesi
3. Durum bakma — Dashboard

Kabul ölçütü: 390px genişlikte bu üç akış **yatay kaydırma olmadan** ve yanlış dokunma
üretmeden tamamlanabiliyor; 1280px'te bugünkü masaüstü düzeni görsel olarak bozulmamış.

Kullanıcının seçmediği başlık: **tutarlılık turu** (sayfa başlıkları, boş durum/hata
dallarının birleştirilmesi) — bkz. §7 Kapsam dışı.

## 2. Bugünkü durum — ölçüldü

| Yer | Bugün | Sonuç |
|---|---|---|
| `app/(admin)/layout.tsx:11` | `flex h-screen` | Telefonda yan menü ekranın 256px'ini yiyor |
| `app/(admin)/layout.tsx:15` | `main` içinde `overflow-auto` | İki kaydırma katmanı; mobil adres çubuğu/klavye düzeni oynatıyor |
| `components/layout/Sidebar.tsx:36` | `aside w-64 ... h-screen` | Sabit genişlik, kapanma yok |
| `components/layout/Header.tsx:7` | `h-14`, içinde yalnız e-posta | Mobil menü düğmesi ve sayfa başlığı için boş yer |
| `components/ui/table.tsx:11` | Sarmalayıcıda `overflow-x-auto` | Tablo taşmıyor ama telefonda her satır yana kaydırma istiyor |
| `app/(admin)/questions/page.tsx:296-303` | 9 kolon (checkbox + 8) | Aksiyonlar en sağda; telefonda görünmüyor |
| `app/(admin)/questions/page.tsx:308` | `TableRow onClick` + hücrelerde `stopPropagation` | Dar ekranda yanlışlıkla detaya düşme |
| `app/(admin)/questions/page.tsx:210-243` | 3 × `w-40` select + checkbox tek satırda | Telefonda yığılıp ekranın yarısını kaplıyor |
| `app/(admin)/dashboard/page.tsx:101` | `YAxis width={130}` | 390px'de kategori adlarına yer kalmıyor |
| Tüm panelde | ~40 adet `sm:/md:/lg:` sınıfı, çoğu shadcn'den | Sayfaların kendi düzenleri dar ekrana hiç tepki vermiyor |

Tablo kolonu sayıları: Sorular 9, Kullanıcılar 7, Raporlar 6, Kaynaklar 6, Kategoriler 5.

**Next.js notu:** `meta viewport` etiketini Next zaten varsayılan olarak basıyor
(`node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`,
"Default fields") — `app/layout.tsx`'e `viewport` export'u eklemek gerekmiyor.

## 3. Karar — liste modeli: tablo korunuyor

Üç seçenek tartışıldı: (a) dar ekranda kart listesi, (b) tabloyu koruyup kolon önceliği +
sabit kolon, (c) mobilde ayrı inceleme kuyruğu. **Kullanıcı (b)'yi seçti** (öneri (a)
idi; karar kullanıcının). Gerekçe: tek kod yolu, en az risk, masaüstü hiç değişmiyor.

Bunun bedeli bilinçli kabul edildi: telefonda satırlar tablo satırı olarak kalıyor,
kart okunabilirliği gelmiyor.

## 4. Kabuk (A)

### 4.1 Gezinme modeli — çekmece
`components/ui/sheet.tsx` projede hazır; yeni bağımlılık yok.

- **Yeni:** `components/layout/SidebarNav.tsx` — `navItems` dizisi ve rozet sayılarıyla
  gezinme listesini render eden tek bileşen. İsteğe bağlı `onNavigate` callback'i alır.
- `Sidebar.tsx` — masaüstü kabuğu olarak kalır, `hidden lg:flex` olur, içeriği
  `SidebarNav`'a devreder. Çıkış düğmesi yerinde kalır.
- **Yeni:** `components/layout/MobileNav.tsx` — `Sheet side="left"` içinde aynı
  `SidebarNav`; `onNavigate` ile bağlantıya basınca çekmece kapanır. Tetikleyici ☰
  düğmesi Header'da, `lg:hidden`.
- Menü girdileri **tek yerde** (`SidebarNav`) tanımlı kalır; iki kabuk da onu kullanır.

### 4.2 Header
- Solda `lg:hidden` ☰ düğmesi (44px dokunma hedefi).
- Yanında sayfa başlığı: `usePathname()` ile `navItems` etiketinden çözülür (eşleşme
  yoksa başlık basılmaz).
- E-posta `hidden sm:inline` olur — telefonda yer açar.
- `sticky top-0 z-20` + `bg-white`: tek kaydırma katmanına geçince başlık yukarıda kalır.

### 4.3 Kaydırma ve yükseklik
- `app/(admin)/layout.tsx`: `flex h-screen` → `flex min-h-dvh flex-col lg:flex-row`.
- `main`: `flex-1 overflow-auto bg-gray-50 p-6` → `flex-1 bg-gray-50 p-4 lg:p-6`
  (iç kaydırma kalkar, sayfa doğal akar).
- `Sidebar` masaüstünde `lg:sticky lg:top-0 lg:h-dvh` ile yerinde kalır.

## 5. Listeler (B)

### 5.1 Kolon öncelikleri
Eşikler Tailwind varsayılanı: `sm` 640, `md` 768, `lg` 1024. Kolon hem `TableHead` hem
`TableCell` tarafında aynı sınıfı alır.

**Sorular**

| Kolon | <640 | ≥640 | ≥768 | ≥1024 |
|---|---|---|---|---|
| Checkbox | — | ✓ | ✓ | ✓ |
| Soru (sabit) | ✓ | ✓ | ✓ | ✓ |
| Durum | ✓ | ✓ | ✓ | ✓ |
| Aksiyonlar | ✓ | ✓ | ✓ | ✓ |
| Kategori | — | ✓ | ✓ | ✓ |
| AI Doğrulama, Zorluk | — | — | ✓ | ✓ |
| Kaynak, Tarih | — | — | — | ✓ |

**Raporlar:** <640 → Soru(sabit), Rapor, Aksiyonlar · ≥640 + Sebepler · ≥768 + Kategori
**Kullanıcılar:** <640 → Kullanıcı Adı(sabit), Rol · ≥640 + E-posta · ≥768 + KPSS Türü,
Giriş Yöntemi · ≥1024 + Kayıt Tarihi
**Kaynaklar:** <640 → Dosya(sabit), Soru, aksiyon · ≥640 + Konu · ≥768 + Tarih
**Kategoriler:** <640 → İsim(sabit), Aksiyonlar · ≥640 + Aktif Soru · ≥768 + Üst Kategori

390px'de Sorular'da kalan üç kolon (Soru · Durum · Aksiyonlar; checkbox gizli) ekrana
sığar — yatay kaydırma normal kullanımda devreye girmez. Raporlar'da kalan üç kolon
(Soru · Rapor · üç aksiyon) 390px'e sığıyor ama dar: aksiyonlar ikona indiğinde
(§5.3) yer açılıyor.

### 5.2 Sabit ilk kolon
İlk veri kolonu (Soru / Kullanıcı Adı / Dosya / İsim) `sticky left-0 z-10 bg-inherit`.
Çalışması için `TableRow`'un açık bir arka planı olmalı: satıra `bg-white
hover:bg-gray-50` verilir, hücre `bg-inherit` ile bunu dinamik olarak miras alır.
Seçili satır vurgusu kullanılan yerlerde aynı kural (satırda renk, hücrede `bg-inherit`).

### 5.3 Aksiyonlar
- Tek `Button`, iki görünüm: ikon her zaman, etiket `hidden md:inline`.
  `<Check className="h-4 w-4 md:mr-1" /><span className="hidden md:inline">Onayla</span>`
- Boyut: `h-11 w-11 p-0 md:h-8 md:w-auto md:px-3` — telefonda 44px hedef, `md` üstünde
  bugünkü `size="sm"` görünümü.
- İkonlar (lucide, projede mevcut): `Check` onayla, `X` reddet, `Pencil` düzenle,
  `Trash2` sil, `Undo2` raporu yoksay.

### 5.4 Yanlış dokunma
- Satır tıklaması yalnız **Sorular** (`questions/page.tsx:308`) ve **Kullanıcılar**
  (`users/page.tsx:149`) sayfalarında var; `TableRow onClick` oralarda kaldırılır,
  detaya/sheet'e gitme ilk kolondan olur. Raporlar, Kaynaklar ve Kategoriler bu deseni
  zaten kullanıyor (ilk hücrede `<button>`), dokunulmaz.
- İlk kolondaki metin `<button type="button" className="text-left">` içine alınır —
  klavyeyle de erişilebilir; böylece diğer hücrelerdeki `stopPropagation` sarmalayıcıları
  gereksizleşir ve silinir.
- Boş durum satırlarındaki `colSpan` değerleri olduğu gibi kalır (tarayıcı fazlasını
  kırpar, görsel sonuç değişmez).

### 5.5 Soru detay sayfası (mobil onay/red akışının ikinci yarısı)
`app/(admin)/questions/[id]/page.tsx`:
- Dıştaki `flex-1 ... overflow-auto p-6` → `p-4 lg:p-6`, iç kaydırma kalkar (§4.3 ile uyum).
- Alt aksiyon çubuğu (`Kaydet` / `Onayla` / `Reddet` / `Sil`) telefonda
  `sticky bottom-0` + `bg-white border-t` + tam genişlik düğmeler; `md` üstünde bugünkü
  satır düzeni.
- Üstteki `← Geri` ve "AI ile düzelt" satırı dar ekranda alt alta sarar.

## 6. Filtreler, dokunma, grafikler (C)

### 6.1 Filtreler
- **Yeni:** `app/(admin)/questions/_components/QuestionFilters.tsx` — bugünkü üç select +
  checkbox, `layout: "row" | "stack"` prop'u ile. Markup iki kere yazılmaz.
- Sorular sayfasında: `hidden md:flex` satır hâli + `md:hidden` "Filtreler" düğmesi.
  Düğme `Sheet` açar, içinde `layout="stack"` (tam genişlik select'ler). Aktif filtre
  sayısı düğme üzerinde `Badge` olarak görünür; "Filtreleri Temizle" çekmecenin altında.

### 6.2 Dokunma hedefleri
- Satır içi aksiyonlar §5.3 ile 44px'e çıkıyor.
- Checkbox'lar `sm` (640px) altında görünmüyor (§5.1), görünen yerlerde `p-2` dokunma
  payı alır.
- `BulkActionBar` değişmiyor (toplu seçim masaüstü/tablet işi kalıyor).

### 6.3 Dashboard grafikleri
- **Yeni:** `lib/hooks/useMediaQuery.ts` — `matchMedia` üzerine SSR güvenli kanca
  (sunucuda ve ilk render'da `false`). Recharts sayısal `width` beklediği için CSS ile
  çözülemiyor; tek JS kancası bilinçli maliyet.
- `YAxis width` 130 → dar ekranda 90, `tick fontSize` 12 → 11, kategori adı 14 karakterde
  kısaltılır (`…`).
- Kart ızgarası (`grid-cols-2 lg:grid-cols-3`) bugünkü gibi kalır — 390px'de iki kart
  yan yana okunuyor.

## 7. Kapsam dışı

- Kart listesi düzeni ve mobilde ayrı "inceleme kuyruğu" ekranı — §3'te reddedildi.
- Tutarlılık turu: sayfa başlıklarının ortak düzeni, her listeye hata/boş durum dalı,
  boş durum metinlerinin tek dile getirilmesi. Kullanıcı bu başlığı seçmedi; kusurlar
  §2'de kayıtlı, ayrı iş olarak açılabilir.
- Yasal Metinler, İçerik Üretimi, Sınav Tarihleri sayfalarının mobil düzeni — telefondan
  yapılması şart olan işler arasında değil; yalnız kabuk (§4) iyileştirmesinden
  dolaylı fayda görürler.
- Karanlık tema, tablo kolonu kullanıcı tercihi olarak saklama, sanallaştırma.
- Test koşucusu kurmak (bkz. §8).

## 8. Doğrulama

Repoda test koşucusu yok (Vitest önerilmiş, kullanıcı almamıştı) ve bu iş neredeyse
tamamen düzen/sınıf değişikliği — otomatik testle korunacak mantık doğmuyor. Kapılar:

1. `npx tsc --noEmit` → 0 hata
2. `npm run lint` → yeni hata yok (taban: 0 hata / 3 eski uyarı)
3. `npm run build` → başarılı
4. Tarayıcıda üç genişlikte gözle kontrol: **390px**, **768px**, **1280px**
   - 390: çekmece açılıp kapanıyor; Sorular'da yatay kaydırma yok; onay/red düğmeleri
     parmakla basılabiliyor; soru detayında alt çubuk erişilebilir; Raporlar'da aksiyonlar
     görünür; Dashboard grafiklerinde kategori adları okunuyor.
   - 768: kolonlar tabloya dönüyor, filtre satırı açılıyor.
   - 1280: masaüstü düzeni bugünküyle aynı (yan menü yerinde, 9 kolon, yazılı düğmeler).

## 9. Çıkış sırası

1. Kabuk: `SidebarNav` + `MobileNav` + `Header` + `layout.tsx` (§4)
2. Sorular tablosu: kolon öncelikleri, sabit kolon, ikon aksiyonlar, satır tıklaması (§5.1-5.4)
3. Soru detay mobil düzeni (§5.5)
4. Raporlar tablosu (§5.1) — telefondan yapılacak ikinci iş
5. Filtre çekmecesi (§6.1)
6. Kullanıcılar / Kaynaklar / Kategoriler tabloları (§5.1)
7. Dashboard grafikleri + dokunma payları (§6.2-6.3)

Her adım kendi commit'i; 1-3 bittiğinde tarayıcıda ara kontrol.
