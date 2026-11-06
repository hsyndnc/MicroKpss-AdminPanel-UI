# Kategori "Düzenle" (PUT) isteği 400 dönüyor

**Durum:** ✅ Düzeltildi (2026-11-06). **Bulunduğu tarih:** 2026-11-03 (kategori durumu
işi sırasında, panel oturumu). **Doğrulandı:** 2026-11-05, kullanıcı elle
tekrar üretti (`Runtime AxiosError — Request failed with status code 400`).

## Belirti
Kategoriler listesinde bir kategoriyi **Düzenle** edip **Kaydet**'e basınca
istek 400 ile reddediliyor. Backend hata mesajı: `"Route id ile body id
uyuşmuyor."`

## Kök neden
`lib/api/categories.ts:14` — `updateCategory(id, body)` gövdeye (`body`)
yalnız `{ name, parentCategoryId }` koyuyor, **`id` hiç eklemiyor**:

```ts
export async function updateCategory(id: string, body: { name: string; parentCategoryId?: string }): Promise<AdminCategory> {
  const { data } = await apiClient.put<AdminCategory>(`/admin/categories/${id}`, body);
  return data;
}
```

Backend ise PUT isteğinde route'taki `id` ile body'deki `id`'nin eşleşmesini
bekliyor; body'de `id` hiç olmadığı için uyuşmazlık sayılıp 400 dönüyor.

## Kapsam notu
Bu fonksiyon, 2026-11-03 "Kategori Durumu Aktif/Yakında/Gizli" işinin diff'inde
**hiç değişmedi** — yani o işin sebep olduğu bir regresyon değil, ondan önce de
muhtemelen aynı şekilde bozuktu. `main`'de de büyük olasılıkla aynı hata var.

## Uygulanan düzeltme
`lib/api/categories.ts` — `updateCategory` çağrısında body'ye `id` eklendi
(`updateQuestion`'daki aynı desenle birebir aynı):

```ts
const { data } = await apiClient.put<AdminCategory>(`/admin/categories/${id}`, { id, ...body });
```

**Doğrulama (2026-11-06):** Gerçek backend'e (Docker, local) karşı panelin proxy
route'u üzerinden curl ile RED→GREEN test edildi — `id`'siz body → 400 (bug
yeniden üretildi), `id`'li body → 200 (`PUT .../categories/<uuid>` 200 döndü,
log'da doğrulandı). `npx tsc --noEmit` temiz. Gerçek tarayıcıda Düzenle
diyaloğu üzerinden tıklama testi bu ortamda **yapılmadı** (chromium-cli/Playwright
kurulu değil) — kullanıcı isterse `localhost:3000`'de (dev server + backend
halen ayakta) manuel doğrulayabilir.
