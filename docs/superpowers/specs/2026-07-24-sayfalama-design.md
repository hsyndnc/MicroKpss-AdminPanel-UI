# Sayfalama (pagination) — Tasarım

**Tarih:** 2026-07-24
**Durum:** Onaylandı (brainstorming), plan bekliyor

## Amaç

Sorular ve Kullanıcılar liste sayfalarına numaralı sayfalama eklemek.

### Çözülen sorun

İki liste de (`app/(admin)/questions/page.tsx:188-189`, `app/(admin)/users/page.tsx:132-133`)
şu anda birebir aynı kırılgan kontrolü kullanıyor:

```jsx
{page > 1 && <Button onClick={() => setQueryParam("page", String(page - 1))}>← Önceki</Button>}
{data && data.items.length === 20 && <Button onClick={() => setQueryParam("page", String(page + 1))}>Sonraki →</Button>}
```

Sorunlar:
- **"Sonraki", sayfada tam 20 öğe oldu mu görünüyor** → toplam tam 20 (veya 20'nin katı) ise
  kullanıcı **boş sayfaya** gidebiliyor.
- **Sayfa numarası yok** → kullanıcı kaçıncı sayfada / kaç sayfa olduğunu bilmiyor.

`PagedResult<T>` (`lib/types.ts:73`) zaten `totalCount` taşıyor; `components/ui/pagination.tsx`
(shadcn) hazır ama hiçbir yere bağlı değil.

## Yaklaşım

**Sunum bileşeni + `onPageChange` callback** (router'dan bağımsız). İki liste de zaten
`setQueryParam` ile imperatif geziniyor; bileşen saf UI olur, `onPageChange` ile geri bildirir.
Tek başına test edilebilir, mevcut desene birebir oturur.

(Alternatif — URL/`<Link>` href üreten bileşen — reddedildi: bileşeni `?page` konvansiyonuna
bağlar, mevcut imperatif `setQueryParam` akışıyla çelişir.)

## Bileşen

**Yeni dosya:** `components/shared/DataPagination.tsx` (mevcut `components/ui/pagination.tsx`
primitifleri üstüne kurulu).

**Arayüz:**

```ts
interface DataPaginationProps {
  page: number;                       // 1-tabanlı mevcut sayfa
  totalCount: number;                 // toplam öğe sayısı (PagedResult.totalCount)
  pageSize: number;                   // sayfa başına öğe (şu an 20)
  onPageChange: (page: number) => void;
}
```

## Davranış

- `totalPages = Math.ceil(totalCount / pageSize)`
- **`totalPages <= 1` → `null` döner** (tek sayfa / boş listede sayfalama gösterilmez).
- **Önceki**: `page <= 1` iken pasif (non-interactive + soluk).
- **Sonraki**: `page >= totalPages` iken pasif → *boş sayfaya gitme sorunu ortadan kalkar.*
- **Pencereli sayfa numaraları** (ellipsis'li):
  - Her zaman **1** ve **son sayfa** gösterilir.
  - Aktif sayfa ve **±1 komşusu** gösterilir.
  - Aradaki boşluklar `…` (`PaginationEllipsis`) ile gizlenir.
  - Aktif sayfa vurgulu (`PaginationLink isActive`).
  - Örnek (page=5, totalPages=12): `← Önceki  1 … 4 [5] 6 … 12  Sonraki →`
  - Örnek (page=2, totalPages=4): `← Önceki  1 [2] 3 4  Sonraki →` (ellipsis yok, hepsi sığıyor)
- Numaraya / Önceki / Sonraki tıklanınca `onPageChange(hedefSayfa)` çağrılır.

### Pencereleme algoritması

`totalPages <= 7` ise tüm sayfalar gösterilir (ellipsis yok). Aksi halde şu set:
`{1, page-1, page, page+1, totalPages}` (geçerli aralığa clamp'lenir), sıralanır; ardışık olmayan
iki numara arasına bir `…` konur.

## Veri akışı

`page` URL query'sinden (`?page=N`) geliyor — iki sayfa da `Number(searchParams.get("page") ?? "1")`
ile okuyor. `DataPagination` yalnızca görüntüler ve `onPageChange` ile geri bildirir; sayfalar
`onPageChange={(p) => setQueryParam("page", String(p))}` bağlar. `setQueryParam` mevcut kodda zaten
var ve `page` dışındaki filtre değişiminde sayfayı 1'e resetliyor (dokunulmuyor).

## Entegrasyon

- **`app/(admin)/questions/page.tsx`**: satır 188-189'daki iki-buton bloğu şununla değişir:
  ```jsx
  {data && (
    <DataPagination
      page={page}
      totalCount={data.totalCount}
      pageSize={20}
      onPageChange={(p) => setQueryParam("page", String(p))}
    />
  )}
  ```
- **`app/(admin)/users/page.tsx`**: satır 132-133 aynı şekilde.
- `pageSize` ikisinde de 20 (sabit); istekte kullanılan değerle aynı tutulur.

## Kenar durumlar

- **`totalCount === 0`** → `totalPages = 0`, bileşen `null` döner.
- **Bayat URL (`page > totalPages`)** → Sonraki pasif, numaralar clamp'lenir; kullanıcı geçerli bir
  numaraya tıklayabilir. Otomatik yönlendirme YOK (sade tutuluyor).
- **`page < 1`** (elle bozuk URL) → 1 gibi davranılır (clamp).

## Doğrulama

Projede test framework'ü yok. Doğrulama:
- `npx tsc --noEmit` + `npm run lint` temiz.
- Tarayıcı kontrolü (iki listede de):
  1. Numaralar ve aktif vurgu görünüyor.
  2. 1. sayfada Önceki pasif; son sayfada Sonraki pasif (boş sayfaya gidilemiyor).
  3. Tek sayfalık sonuçta sayfalama hiç görünmüyor.
  4. Bir numaraya tıklayınca doğru sayfa yükleniyor (URL `?page=N` güncelleniyor).
