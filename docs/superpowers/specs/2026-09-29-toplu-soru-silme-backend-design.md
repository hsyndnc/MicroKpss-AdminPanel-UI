# Toplu soru silme — backend uç noktası

**Tarih:** 2026-09-29
**Hedef repo:** `KpssSoru-backend` (.NET)
**Yazan:** panel tarafı (`kpss-admin-panel`). Bu dosya **backend agent'ı için tariftir** —
panel oturumu backend repo'suna dokunmaz.
**İlgili panel işi:** Sorular sayfasına toplu silme (`BulkActionBar`'a "Sil" butonu).

## İstek

Admin panelinde birden çok soru seçilip tek hamlede silinebilecek. Panel bunu **bugün**
mevcut `DELETE /admin/questions/{id}` ucunu tekrar tekrar çağırarak yapıyor. Çalışıyor ama
N soru = N istek. Bu spec, onu **tek isteğe** indiren ucu tanımlar.

## Neden gerekli (ölçülmüş problem)

Backend'de hız sınırı var: giriş yapmış kullanıcı için **dakikada 120 istek**, `QueueLimit = 0`
(sınırı aşan istek kuyruğa alınmaz, anında `429`). Bkz. `KpssApp.API/Program.cs:126-155`,
`appsettings.json` → `RateLimiting:AuthenticatedPermitLimit`.

2026-09-29'da bu sınır gerçek veri kaybına yol açtı: panelden 187 soruluk bir içe aktarımda
**115 soru kaydedildi (201), 72 soru `429` ile reddedildi.** Panel tarafı yeniden-deneme
(`lib/api/retry.ts`) ile düzeltildi, ama kök sorun duruyor: **toplu işlemler tek tek istek
atıyor.** 115 soruluk bir toplu silme yine 115 istek demek — sınırın tam dibinde.

Toplu uç nokta bunu 1 isteğe indirir ve işlemi atomik yapar.

## Uç nokta

```
POST /api/v1/admin/questions/bulk-delete
Body: { "ids": ["<guid>", "<guid>", ...] }
```

`DELETE` + gövde yerine `POST` seçildi: gövdeli DELETE bazı ara katmanlarda (Caddy, proxy)
güvenilmez. Mevcut `[HttpPost("{id:guid}/approve")]` kalıbıyla da tutarlı.

**Yanıt (200):**
```json
{ "deleted": 115, "notFound": ["<guid>"] }
```

- `deleted` — gerçekten silinen kayıt sayısı
- `notFound` — gönderilen ama bulunamayan id'ler (panel bunları kullanıcıya bildirir)

**Hata durumları:**
- `ids` boş veya yok → `400`, `{ "error": "Silinecek soru seçilmedi." }`
- `ids` uzunluğu **500'den fazla** → `400`, `{ "error": "Tek seferde en fazla 500 soru silinebilir." }`
  (üst sınır: tek istekte sınırsız silmeyi engeller; panel sayfa başına en çok 200 seçiyor)
- Beklenmeyen hata → mevcut `Result<T>.Failure` kalıbı, `400` + `{ error }`

## Davranış

**Atomik:** Tüm silmeler **tek** `SaveChangesAsync` ile yapılır. Yarısı silinip yarısı kalmaz.
Bulunamayan id'ler hata değildir — atlanır ve `notFound`'a yazılır (panel listesi bayat
olabilir; kullanıcı silerken başka biri silmiş olabilir).

**Denetim kaydı:** Mevcut tekil handler her silmede şunu basıyor
(`DeleteQuestionCommandHandler.cs`):

```
logger.LogInformation("AdminAction {Action} {EntityType} {EntityId} by Admin {AdminId}",
    "DeleteQuestion", "Question", request.Id, request.AdminId);
```

Toplu handler **silinen her id için aynı satırı** basmalı — denetim izi soru başına kalmalı,
yoksa "bu soruyu kim sildi" sorusu cevapsız kalır. Ek olarak bir özet satırı atılabilir
(`"BulkDeleteQuestions" ... {Count}`).

## Dosyalar

Mevcut `DeleteQuestion` klasörünün birebir kardeşi olarak:

1. **`KpssApp.Application/Features/Admin/Questions/Commands/BulkDeleteQuestions/BulkDeleteQuestionsCommand.cs`**
   ```csharp
   public record BulkDeleteQuestionsCommand(IReadOnlyList<Guid> Ids, Guid AdminId)
       : IRequest<Result<BulkDeleteResult>>;
   ```

2. **`.../BulkDeleteQuestionsCommandHandler.cs`** — `DeleteQuestionCommandHandler` kalıbı:
   id'lerle soruları çek → bulunanları sil → **tek** `SaveChangesAsync` → her silinen için
   `AdminAction` logla → `BulkDeleteResult(deleted, notFound)` döndür. try/catch + `Result.Failure`
   aynı şekilde.

3. **`KpssApp.Application/DTOs/Admin/BulkDeleteResult.cs`** (veya komutun yanında)
   ```csharp
   public record BulkDeleteResult(int Deleted, IReadOnlyList<Guid> NotFound);
   ```

4. **`KpssApp.Application/Interfaces/Repositories/IQuestionRepository.cs`** + `UserRepository`nin
   karşılığı `QuestionRepository` — id listesiyle çekme gerekiyor:
   ```csharp
   Task<List<Question>> GetByIdsAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default);
   ```
   Silme için mevcut `Delete(question)` döngüde çağrılabilir; EF `RemoveRange` varsa o tercih edilir.
   ⚠️ **Global query filter'a dikkat:** tekil yolda `GetByIdIgnoreFiltersAsync` diye ayrı bir
   metot var — yani `Question` üzerinde filtre uygulanıyor. `GetByIdsAsync`'in soft-delete/filtre
   davranışı tekil `DeleteQuestion` ile **aynı** olmalı, yoksa panelde görünen soru silinemez.

5. **`KpssApp.API/Controllers/V1/Admin/AdminQuestionsController.cs`**
   ```csharp
   [HttpPost("bulk-delete")]
   public async Task<IActionResult> BulkDeleteQuestions(
       [FromBody] BulkDeleteRequest request, CancellationToken cancellationToken)
   ```
   `AdminId` mevcut controller'daki gibi alınır. Sonuç `Ok(new { deleted, notFound })`.

6. **`KpssApp.Tests/Integration/BulkDeleteQuestionsTests.cs`** — `DeleteQuestionTests.cs` kalıbı.

## Testler (en az)

1. **Çoklu silme:** 3 soru oluştur → hepsinin id'siyle çağır → `deleted == 3`, veritabanında yok.
2. **Kısmi:** 2 gerçek + 1 uydurma id → `deleted == 2`, `notFound` 1 eleman, gerçek 2 silinmiş.
3. **Boş liste:** `ids: []` → `400`.
4. **Sınır aşımı:** 501 id → `400`.
5. **Atomiklik:** tek `SaveChangesAsync` çağrıldığını doğrula (veya araya hata enjekte edilebiliyorsa
   hiçbirinin silinmediğini).
6. **Yetki:** admin olmayan token → mevcut controller kalıbının döndürdüğü kod (`403`).

## Panel tarafı (bu spec'in kapsamı DIŞI, bilgi için)

Panel bugün **tek tek silen** sürümü kullanıyor (`lib/api/retry.ts` ile 429'a dayanıklı).
Bu uç nokta gelince panel `lib/api/questions.ts`'e `bulkDeleteQuestions(ids)` ekleyip
`handleBulkDelete`'i ona bağlayacak — küçük bir değişiklik, uç nokta gelmeden panel bozulmaz.

## Kapsam dışı

- Toplu **onaylama** ucu (`bulk-approve`). Aynı sorun orada da var (panel tek tek onaylıyor,
  her onay sonrası cache tazeleme ek istek doğuruyor). Ayrı iş; istenirse bu spec'in kardeşi yazılır.
- Hız sınırı değerlerini değiştirmek. Sınır doğru bir koruma; çözüm istek sayısını azaltmak.
- Geri alma / çöp kutusu. Silme kalıcı (mevcut davranış korunuyor).
