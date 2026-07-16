# Sorular Sayfası İstatistik Kartları — Tasarım

**Tarih:** 2026-07-16
**Durum:** Onaylandı

## Amaç

Sorular sayfasının (`/questions`) üstünde, soru havuzunun durumunu bir bakışta gösteren istatistik kartları: onaylı soru sayısı, bekleyen (PendingReview) soru sayısı ve konu bazlı soru dağılımı.

## Veri Kaynağı

Yeni API yok. Mevcut `useDashboardStats()` hook'u (`GET /admin/stats`) kullanılır:

- `activeQuestions` → Onaylı kartı
- `pendingReview` → Bekleyen kartı
- `categoryDistribution: { categoryName, count }[]` → Konu Dağılımı kartı

React Query sayesinde dashboard ve layout ile aynı önbellek paylaşılır; sayfaya ek istek maliyeti minimumdur.

## Bileşen

`app/(admin)/questions/_components/QuestionStats.tsx` — client bileşeni.

**Arayüz:**

```ts
interface QuestionStatsProps {
  onStatusFilter: (status: string) => void; // sayı kartına tıklayınca durum filtresi
}
```

Sayfada `<h1>Sorular</h1>` başlığının hemen altına, filtre satırının üstüne yerleşir.

## Görünüm

```
┌─────────┐ ┌─────────┐ ┌───────────────────────┐
│ Onaylı  │ │ Bekleyen│ │ Konu Dağılımı         │
│  1.240  │ │    87   │ │ Tarih ........... 312 │
└─────────┘ └─────────┘ │ Matematik ....... 289 │
                        │ Türkçe .......... 245 │
                        └───────────────────────┘
```

- **Onaylı** kartı: yeşil vurgu, tıklanınca durum filtresi `Active` olur.
- **Bekleyen** kartı: sarı vurgu (dashboard'daki "Bekleyen Onay" kartıyla aynı stil), tıklanınca durum filtresi `PendingReview` olur.
- **Konu Dağılımı** kartı: `categoryDistribution` çoktan aza sıralı; her satırda konu adı solda, sayı sağda. Konu sayısı fazlaysa kart içinde dikey scroll (sabit maksimum yükseklik ~ sayı kartlarının boyu), sayfa düzeni bozulmaz.
- Grid: mobilde alt alta, `lg` ve üstünde `2 sayı kartı + geniş dağılım kartı` tek satırda.

## Yükleme ve Hata

- Yüklenirken kartların yerinde aynı boyutlarda `Skeleton`'lar.
- İstek başarısız olursa (`isError`) kart bloğu tamamen gizlenir; istatistik yardımcı bilgidir, soru tablosunu bloklamaz.

## Test / Doğrulama

- Dev server'da `/questions` sayfası açılır; kartların doğru sayıları gösterdiği ve karta tıklamanın durum filtresini değiştirdiği doğrulanır.
- `npm run lint` temiz geçer.

## Kapsam Dışı

- Backend değişikliği yok.
- Konu dağılımına tıklayarak kategori filtresi (sayfada henüz kategori filtresi yok) — ileride eklenebilir.
