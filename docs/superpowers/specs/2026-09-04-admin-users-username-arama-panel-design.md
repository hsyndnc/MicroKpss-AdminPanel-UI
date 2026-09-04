# Kullanıcılar Sayfası: Kullanıcı Adıyla Arama — Panel Tasarım Spec'i

**Tarih:** 2026-09-04
**Repo:** `kpss-admin-panel` (Next.js)
**İkiz (backend):** `KpssSoru-backend` — asıl iş orada.
Bkz. `KpssSoru-backend/docs/superpowers/specs/2026-09-04-admin-users-username-arama-backend-design.md`

## İstek

`/users` arama kutusu şu an "e-posta ara" olarak sunuluyor ve backend yalnız e-postada
arıyordu. Backend araması kullanıcı adını da kapsayacak şekilde genişletiliyor; panelin
bunu kullanıcıya bildirmesi gerekir.

## Bulgu (kod okundu) — panel fonksiyonel olarak ZATEN HAZIR

Arama akışı uçtan uca kurulu; girdi backend'e `search` paramıyla gidiyor:

```
Input (searchInput) --400ms debounce--> setQueryParam("search", …) --URL ?search=--> 
  useUsers({ search }) --> getAdminUsers({ search }) --> GET /admin/users?search=<terim>
```

Kanıt (dev log, canlı):
```
GET /api/backend/api/v1/admin/users?page=1&pageSize=20&search=memo 200
```

Yani backend kullanıcı adında da eşleştirmeye başladığı an, panel **kod değişikliği olmadan**
kullanıcı adı sonuçlarını da gösterecek. Tek eksik: arama kutusunun **sadece e-posta** ima
eden placeholder metni — kullanıcıya kullanıcı adıyla da arayabileceğini bildirmiyor.

## Kilitli kararlar

1. **Yalnız placeholder metni değişir.** Fonksiyonel arama akışı (debounce, URL param,
   hook, API çağrısı) olduğu gibi kalır; ek state/istek yok.
2. **Yeni bir "arama alanı" seçici EKLENMEZ.** Backend tek `search` paramıyla e-posta VEYA
   kullanıcı adını tarıyor (OR); kullanıcıya "hangi alanda arayayım" sorusu sorulmaz — tek
   kutu ikisini de kapsar.
3. **Backend'e bağımlı davranış paneli bozmaz.** Backend henüz güncellenmemişse arama eskisi
   gibi yalnız e-postada çalışır; placeholder güncellemesi zararsızdır (yanlış sonuç üretmez,
   sadece kapsam vaadi). Yine de sıralama: backend canlı olduktan sonra doğrulanır.

## Değişiklik (tek dosya, tek satır)

### `app/(admin)/users/page.tsx` — arama `Input` placeholder'ı

```tsx
// MEVCUT
<Input
  placeholder="E-posta ara..."
  value={searchInput}
  onChange={(e) => setSearchInput(e.target.value)}
  className="w-64"
/>

// YENİ
<Input
  placeholder="E-posta / kullanıcı adı ara..."
  value={searchInput}
  onChange={(e) => setSearchInput(e.target.value)}
  className="w-64"
/>
```

Başka dosya değişmez. `useUsers` / `getAdminUsers` / URL param mantığı aynı kalır.

## Testler

Panelde test altyapısı yok (mevcut örüntü); doğrulama `tsc + lint + build` + canlı smoke ile:

- **Görsel:** `/users` arama kutusunun placeholder'ı "E-posta / kullanıcı adı ara..." gösterir.
- **Uçtan uca (backend güncel + restart sonrası):** kutuya bir kullanıcı adı parçası yaz →
  liste hem e-posta hem kullanıcı adı eşleşmelerine daralır; sayfalama sayacı doğru.

## Kapsam dışı (YAGNI)

- **Arama alanı seçici / gelişmiş filtre** — tek kutu OR araması yeterli.
- **Kullanıcı adı sütunu** — ayrı iş olarak ZATEN eklendi (commit `90b3bbe`); bu spec'in konusu değil.
- **Debounce süresi / URL param şeması değişikliği** — mevcut desen korunur.

## Sıra / bağımlılık

Backend spec'i önce uygulanır (arama alanını genişletir + restart). Panel değişikliği
(placeholder) bağımsızdır ve her an yapılabilir; ancak uçtan uca doğrulama backend canlı
olduktan sonra anlamlıdır.
