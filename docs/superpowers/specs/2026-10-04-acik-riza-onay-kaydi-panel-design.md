# Açık rıza metni + onay kaydı — panel tasarımı

**Tarih:** 2026-10-04
**Backend ikizi:** `KpssSoru-backend/docs/superpowers/specs/2026-10-04-acik-riza-onay-kaydi-design.md`
**Durum:** spec yazıldı, kod yazılmadı

## 1. Neden panel işi

Backend yasal metinleri **append-only sürümlü** hâle getiriyor ve
`PUT /api/v1/admin/legal` gövdesine **zorunlu** bir `requiresReconsent` alanı ekliyor.
Panel bu alanı göndermezse **her kayıt denemesi `400` döner** — yani panel
güncellenmeden backend canlıya çıkarsa yasal metin yönetimi tamamen kırılır.

Ayrıca dördüncü bir belge türü doğuyor (`ExplicitConsent`) ve panel bugün onu
listelemiyor; açık rıza metnini yayınlayacak tek arayüz burası.

## 2. Bugünkü durum — ölçüldü

| Dosya | Bugün |
|---|---|
| `app/(admin)/legal/page.tsx:8-12` | `DOC_TYPES` üç tür: `PrivacyPolicy`, `TermsOfService`, `KvkkNotice` |
| `app/(admin)/legal/page.tsx` | Sekmeler + tek `textarea` + "Kaydet"; kaydetme `upsert.mutateAsync({ type, content })` |
| `lib/api/legal.ts` | `getLegalDocument(type)`, `upsertLegalDocument(type, content)` |
| `lib/hooks/useLegal.ts` | `useLegalDocument`, `useUpsertLegalDocument` |
| `lib/types.ts:86-92` | `LegalDocumentType` üç değer; `LegalDocument { type, content, updatedAt }` |

Yani bugünkü model "tek metin, üzerine yaz". Backend bunu "sürüm yayınla"ya çeviriyor.

## 3. Tip katmanı

```ts
export type LegalDocumentType =
  "PrivacyPolicy" | "TermsOfService" | "KvkkNotice" | "ExplicitConsent";

export interface LegalDocument {
  type: LegalDocumentType;
  content: string;
  version: number;      // YENİ
  updatedAt: string;
}
```

`requiresReconsent` **yanıtta yok** — backend onu public GET'te açmıyor, iç bilgi.
Panel onu yalnızca **gönderir**, geri okumaz.

```ts
export async function publishLegalDocumentVersion(
  type: LegalDocumentType, content: string, requiresReconsent: boolean
): Promise<LegalDocument> {
  const { data } = await apiClient.put<LegalDocument>("/admin/legal",
    { type, content, requiresReconsent });
  return data;
}
```

`upsertLegalDocument` adı bırakılır, `publishLegalDocumentVersion` olur — backend'de de
komut `UpsertLegalDocument` → `PublishLegalDocumentVersion` olarak değişiyor; "upsert"
append-only modelde yalan.

## 4. Ekran

### 4.1 Dördüncü sekme
`DOC_TYPES`'a eklenir: `{ type: "ExplicitConsent", label: "Açık Rıza Metni" }`.

### 4.2 Sürüm göstergesi
Editörün üstünde belgenin güncel sürümü okunur: **"Sürüm 3 · 4 Ekim 2026'da güncellendi"**.
Metin hiç yayınlanmamışsa (`404` → `null`) "Henüz yayınlanmadı" yazar; bu durumda
kaydetmek sürüm 1'i oluşturur.

### 4.3 "Kaydet" → "Yeni sürüm yayınla"
Düğme metni ve davranışı değişir: kaydetmek artık üzerine yazmıyor, **yeni bir sürüm
oluşturuyor** ve eski sürüm kalıcı olarak saklanıyor. Düğme bunu söylemeli, yoksa
admin "küçük bir yazım hatası düzeltiyorum" diye her seferinde yeni sürüm üretir.

### 4.4 `requiresReconsent` — zorunlu seçim

Yayınlamadan önce admin bu soruyu cevaplamak **zorunda**; varsayılan yok. İki
seçenekli bir radyo grubu (kutucuk değil — işaretlenmemiş kutucuk "hayır" gibi
görünür, oysa burada "cevaplanmadı" ile "hayır" farklı şeyler):

- **"Esaslı değişiklik değil"** (`requiresReconsent: false`) — yazım/biçim düzeltmesi,
  kapsam aynı. Kullanıcılardan yeniden onay istenmez.
- **"Esaslı değişiklik"** (`requiresReconsent: true`) — kapsam genişliyor: yeni alıcı,
  yeni amaç, yeni ülke. **Tüm kullanıcılara yeniden onay sorulur.**

Seçim yapılmadan yayınla düğmesi pasif kalır. Sunucu da eksik alanı `400` ile
reddediyor; istemci kapısı yalnız kullanıcıyı hata ekranından korumak için.

### 4.5 Onay diyalogu
"Esaslı değişiklik" seçiliyken yayınla'ya basılırsa onay sorulur:

> Bu sürüm esaslı değişiklik olarak yayınlanacak. **Tüm kullanıcılar** uygulamayı
> açtığında metni yeniden onaylamak zorunda kalacak. Devam edilsin mi?

Esaslı olmayan yayınlarda diyalog yok — gereksiz sürtünme.

### 4.6 Yarış durumu
İki admin aynı anda yayınlarsa backend'in `(Type, Version)` tekil indeksi ikincisini
düşürür ve `400` döner. Panel bu durumda metni yeniden çeker ve
**"Bu metin siz yazarken güncellendi, en son sürüm yüklendi — değişikliğinizi tekrar
uygulayın."** der. Kullanıcının yazdığını sessizce kaybetmemek için düzenlediği içerik
panoya/duruma alınmalı.

## 5. Kanıt arayüzü — kullanıcı detayında onay geçmişi

Onay kaydını tutmanın tek sebebi gerektiğinde gösterebilmek. Hukuki bir talep
geldiğinde verilmesi gereken cevap şu biçimde: *"12 Ekim 2026 saat 14:33'te açık rıza
metninin 2. sürümünü onayladınız, onayladığınız metin aynen şudur."* Backend bunun için
yeni bir uç ekliyor (karar 2026-10-04):

```
GET /api/v1/admin/users/{id}/consents
→ [{ "type": "ExplicitConsent", "version": 2, "givenAt": "2026-10-12T14:33:00Z" }]
```

Panel tarafı: kullanıcı detayı bugün bir sheet (`app/(admin)/users/_components/UserDetailSheet.tsx`).
Oraya **"Onay Geçmişi"** bölümü eklenir:

- Her satır: belge adı · sürüm · tarih (yerel biçimde, ham UTC sunucudan geliyor).
- Satırdaki sürüm **tıklanabilir**: `GET /legal/{type}/versions/{version}` ile o
  sürümün metni açılır. Kanıt zinciri bu iki çağrıyla tamamlanır.
- Boş dizi dönerse "Bu kullanıcının onay kaydı yok." yazar — hata değil, geçerli cevap
  (mevcut kullanıcılar açık rıza metnini henüz onaylamamış olabilir).
- Uç yalnız `Admin` rolüne açık; sheet zaten admin arkasında.

**Sürüm listesi ucu yok ve gerekmiyor:** onay satırı sürüm numarasını taşıyor, metin o
numarayla çekiliyor. "Bir belgenin tüm sürümlerini gez" özelliği bilinçli olarak
kapsam dışı — kanıt için gerekmiyor, yalnız merak için gerekir.

## 6. Kapsam dışı

- Metnin **içeriğini** panel yazmıyor; metin backend tarafında seed ile doğuyor,
  panel onu düzenliyor. İlk açık rıza metninin yazımı backend işinin ilk dilimi.
- Yasal metin **silme** yok (backend'de de yok; append-only olunca sürüm de silinemez).
- Markdown önizleme bugün yok, bu işte de eklenmiyor — mevcut `textarea` korunur.
- Belge sürüm geçmişini gezme ekranı yok (bölüm 5).

## 7. Çıkış sırası

Panel ile backend **birlikte** çıkmalı, panel önce de olabilir:

- Panel önce çıkarsa: `requiresReconsent` gönderir, eski backend bilinmeyen alanı
  yok sayar, davranış bozulmaz.
- Backend önce çıkarsa: panelin gönderdiği gövdede alan olmadığı için **yasal metin
  kaydetme tamamen kırılır (`400`)**.

Dolayısıyla güvenli sıra: **panel → backend**.
