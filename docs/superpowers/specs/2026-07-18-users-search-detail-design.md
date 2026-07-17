# Kullanıcılar Sayfası: Arama/Filtre + Detay Drawer — Tasarım

**Tarih:** 2026-07-18
**Durum:** Onaylandı (kullanıcı, brainstorming oturumunda)

## Amaç

`/users` sayfası şu an salt-okunur, filtresiz bir liste. Bu iş iki özellik ekler:

1. **Arama/filtre:** e-posta araması + rol ve KPSS türü filtreleri.
2. **Detay drawer:** satıra tıklayınca sağdan açılan panelde kullanıcı detayları
   (son giriş, çözülen soru sayısı, doğruluk oranı) ve rol değiştirme aksiyonu.

Backend değişiklikleri bu repo'da yapılmaz; API sözleşmesi aşağıda tanımlıdır ve
backend repo'suna (`KpssSoru-backend/docs/`) ayrı bir görev notu olarak yazılıp
kullanıcının backend agent'ına devredilir. Frontend, backend hazır olmadan da
bozulmadan çalışacak şekilde kurulur.

## Kararlar (brainstorming çıktısı)

- Arama/filtre kapsamı: e-posta + rol + KPSS türü.
- "Son giriş" için **gerçek `LastLoginAt` alanı** backend'e eklenecek (türetilmiş
  son cevap tarihi yerine). KVKK/mağaza beyan etkisi aşağıda.
- Drawer: bilgiler + **rol değiştirme** aksiyonu. Hesap kapatma/anonimleştirme
  kapsam dışı (ileride ayrıca değerlendirilecek).
- Süre takibi verileri (TimeSpentSeconds) KVKK kararı gereği admin UI'da gösterilmez.

## 1. UI

### Liste araç çubuğu

Başlığın altında tek satır:

- **Arama kutusu** — placeholder "E-posta ara...", ~400ms debounce ile tetiklenir.
- **Rol select** — Tümü / Standart / Premium / Admin.
- **KPSS Türü select** — Tümü / Lisans / Önlisans / Ortaöğretim.

Tüm filtreler URL query paramlarında yaşar: `?search=&role=&kpssType=&page=`
(sorular sayfasındaki desen). Filtre değişince `page=1`'e dönülür. Boş/"Tümü"
değerleri URL'e yazılmaz.

### Detay drawer

Satıra tıklayınca sağdan `Sheet` açılır (ImportSheet ile aynı shadcn bileşeni).
Yeni bileşen: `app/(admin)/users/_components/UserDetailSheet.tsx`.

İçerik, yukarıdan aşağıya:

1. **Başlık:** e-posta; altında rol ve KPSS türü rozetleri. Bu bilgiler satırdan
   (liste verisinden) gelir, drawer açılır açılmaz görünür.
2. **Bilgi listesi:** Kayıt tarihi · Son giriş · Çözülen soru · Doğruluk oranı.
   İstatistikler detay API'sinden gelene kadar skeleton gösterilir.
   - Son giriş `null` ise "—" (alan yeni; eski kullanıcılarda ilk girişe kadar boş).
   - Doğruluk = `correctCount / solvedCount`, yüzde olarak; `solvedCount === 0`
     ise "—".
   - Tarih biçimi mevcut desen: `format(date, "d MMM yyyy", { locale: tr })`,
     son giriş için saatli: `"d MMM yyyy HH:mm"`.
3. **Rol bölümü** (ayrık, üstüne ince çizgi): rol select'i + "Kaydet" butonu.
   Seçim mevcut rolden farklı değilse buton pasif. Başarıda toast ("Rol
   güncellendi") + liste ve detay invalidate. Hata durumu §4'te.

## 2. Frontend veri akışı

- `useUsers({ page, search, role, kpssType })` — mevcut `useUsers(page)` hook'u
  parametre objesi alacak şekilde genişletilir; React Query anahtarına tüm
  paramlar girer. `lib/api/users.ts`'teki fetch fonksiyonu query string'i kurar.
- `useUserDetail(id: string | null)` — yeni hook; `enabled: !!id` ile drawer
  açıkken `GET /admin/users/{id}` çağırır.
- `useUpdateUserRole()` — yeni mutation; `PUT /admin/users/{id}/role`. Başarıda
  `["admin-users"]` ve `["admin-user", id]` anahtarları invalidate edilir.
- Sayfa durumu: seçili kullanıcı `useState<AdminUser | null>` (drawer'a satır
  verisi prop olarak geçer; detay hook'u yalnızca istatistikleri tamamlar).

## 3. API sözleşmesi (backend görevi)

Backend repo'suna yazılacak görev notunun özü:

### 3a. Liste endpoint'i genişler

```
GET /api/v1/admin/users?page=1&size=20&search=&role=&kpssType=
```

- `search`: e-postada büyük/küçük harf duyarsız "içerir" araması.
- `role`, `kpssType`: kesin eşleşme (enum adıyla, örn. `Premium`, `Lisans`).
- Parametreler opsiyonel; verilmezse mevcut davranış.

### 3b. Yeni: kullanıcı detayı

```
GET /api/v1/admin/users/{id}
```

Yanıt (`AdminUserDetailDto`):

```json
{
  "id": "...",
  "email": "...",
  "role": "Premium",
  "kpssType": "Lisans",
  "createdAt": "...",
  "lastLoginAt": "..." ,
  "solvedCount": 482,
  "correctCount": 343
}
```

- `lastLoginAt` nullable. Doğruluk yüzdesi backend'de hesaplanmaz; frontend türetir.
- `solvedCount`/`correctCount` `UserAnswer` tablosundan aggregate.

### 3c. Yeni: rol güncelleme

```
PUT /api/v1/admin/users/{id}/role
Body: { "role": "Premium" }
```

- Geçerli roller: `Standard`, `Premium`, `Admin` (`User.SetRole` entity'de mevcut).
- **Koruma:** admin kendi hesabının rolünü Admin'den düşüremez (son admin
  kilitlenmesini önler). Bu durumda 400 + açıklayıcı hata.

### 3d. `LastLoginAt` alanı

- `User` entity'sine `DateTime? LastLoginAt` + EF migration.
- Login endpoint'inde başarılı girişte güncellenir (refresh token yenilemede değil).

## 4. Hata durumları

- **Detay isteği başarısız** (backend hazır değil / 404 / ağ hatası): drawer
  kapanmaz; satırdan gelen temel bilgiler görünmeye devam eder, istatistik
  bölümünde "İstatistikler yüklenemedi" metni gösterilir.
- **Rol güncelleme hatası:** toast'ta hata mesajı; select kullanıcının gerçek
  rolüne geri döner.
- **Arama sonucu boş:** mevcut "Kullanıcı bulunamadı" satırı korunur.

## 5. KVKK / mağaza beyanı notu

- `LastLoginAt` **yeni bir kişisel veri kalemidir**: aydınlatma metnine ve
  Apple "Privacy Nutrition Labels" / Google Play "Data Safety" formlarına
  eklenmelidir. Bu not backend görev dosyasına da yazılır; yayın öncesi
  kontrol listesine alınmalı.
- Çözülen soru sayısı ve doğruluk oranı mevcut cevap verisinden türetilir;
  yeni veri toplama değildir, ek beyan gerektirmez.

## 6. Doğrulama

- Frontend: `npx eslint <dosyalar>` + `npx tsc --noEmit` + kullanıcının görsel
  kontrolü (sayfalar login arkasında; test framework'ü yok).
- Backend görev notunda curl'lü kabul kriterleri yer alır (arama paramlı liste,
  detay yanıtı, rol güncelleme, self-demote engeli).
