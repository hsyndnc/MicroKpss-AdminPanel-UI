# Hatalı Soru Raporlama — Admin Panel (Tasarım Spec'i)

**Tarih:** 2026-08-12
**Repo:** `kpss-admin-panel` (Next.js 15, App Router, TS) — bu spec'i bu repodaki agent uygular
**İkiz spec'ler:**
- Backend (SÖZLEŞME KAYNAĞI): `KpssSoru-backend/docs/superpowers/specs/2026-08-12-hatali-soru-raporlama-backend-design.md`
- Mobil: `KpssSoru-mobile/docs/superpowers/specs/2026-08-12-hatali-soru-raporlama-mobil-design.md`

**Bağımlılık:** Backend endpoint'leri (`GET /admin/reports`, `POST /admin/reports/{id}/dismiss`) **canlı
olmadan** liste boş/hata döner. Backend ÖNCE. Panel sadece tüketir.

## Amaç

Admin, eşiği aşıp otomatik gizlenen ("FlaggedForReview") soruları tek bir yerde görsün: hangi soru, kaç
rapor, hangi sebeplerle, kullanıcı notları neler. Buradan soruyu **düzeltip onaylayabilsin**,
**reddedebilsin** veya rapor yanlış alarmsa **yoksayıp** soruyu geri Active yapabilsin.

## Kilitli tasarım kararları (backend brainstorming'iyle aynı — değişmez)

1. Admin akışı: rapor listesi + durum takibi + soruya atlama + eşikte otomatik gizleme (backend yapar).
2. Panel yalnızca **FlaggedForReview** soruları listeler (eşik altı raporlar sessizce backend'de birikir,
   panele düşmez).
3. Eylemler: **Düzelt/Onayla** · **Reddet** · **Yoksay (dismiss)**.

## API sözleşmesi (backend spec'inden — birebir tüketilecek)

Tüm çağrılar mevcut `apiClient` (baseURL `/api/backend/api/v1`) üzerinden; catch-all proxy otomatik geçirir.

- `GET /admin/reports` → `FlaggedForReview` sorular + her biri için Open rapor sayısı + sebep dökümü
  (reason→adet) + notlar (`Other` notları). `[Admin]`.
- `POST /admin/reports/{questionId}/dismiss` → soru Active'e döner + o sorunun Open raporları Dismissed. `[Admin]`.
- **Düzelt/Reddet = MEVCUT endpoint'ler** (yeni değil): `POST /admin/questions/{id}/approve`,
  `POST /admin/questions/{id}/reject` (+ opsiyonel `POST /admin/questions/{id}/ai-fix`). Bunlar
  `lib/api/questions.ts`'te zaten var: `approveQuestion`, `rejectQuestion`, `requestAiFix`.
- Enum'lar JSON'da **string** (ör. reason `"WrongAnswer"`, status `"FlaggedForReview"`).

## Doğrulanmış kod gerçekleri (bu spec yazılırken teyit edildi)

- **Proxy işi YOK:** `app/api/backend/[...path]/route.ts` generic pass-through
  (`/api/backend/<X> → ${BACKEND}/<X>`) + sessiz refresh. Yeni admin route'ları **otomatik** çalışır.
- `lib/api/client.ts` — `apiClient` baseURL `/api/backend/api/v1`; 401'de `/login`'e yönlendirir.
- `lib/api/questions.ts` mevcut: `getAdminQuestions({status,...})`, `approveQuestion(id)`,
  `rejectQuestion(id, reason)`, `requestAiFix(id, note?)`, `deleteQuestion(id)`. **Yeniden kullanılacak.**
- `lib/types.ts`: `ContentStatus = "PendingReview" | "Active" | "Rejected" | "Archived"` →
  **`"FlaggedForReview"` eklenmeli.** `AdminQuestion` interface mevcut (satır 12).
- Nav: `components/layout/Sidebar.tsx` — mevcut linkler (`/questions` = "Sorular" vb.). Buraya "Raporlar" eklenir.
- Sayfa deseni: `app/(admin)/questions/page.tsx` — `"use client"`, `useState`, `rejectTarget` modal
  deseni, `selected` set'i. **Rapor sayfası bu deseni izler.**

## Kapsam

**Dahil:**
- Yeni `lib/api/reports.ts`: `listReports()`, `dismissReport(questionId)`.
- Yeni sayfa `app/(admin)/reports/page.tsx`: FlaggedForReview liste + her satırda rapor sayısı + sebep
  dökümü + notlar + eylem düğmeleri (**Düzelt/Onayla**, **Reddet**, **Yoksay**).
- `lib/types.ts`: `"FlaggedForReview"` ekle + `ReportedQuestion` (ve gerekiyorsa `ReportReason`) tipleri.
- Sidebar'a "Raporlar" navigasyon linki.

**Opsiyonel (plan aşamasında karar — ilk sürümde atlanabilir):**
- `app/(admin)/questions/page.tsx` listesinde satır başına **"N rapor" rozeti** (eşik altı dahil görünürlük
  isteniyorsa; backend `GET /admin/questions` bunu dönmüyorsa ayrı sözleşme gerekir → ilk sürümde YAPMA).

**Dışında (YAGNI):**
- Rapor başına ayrı çözüm/durum ekranı (çözüm mevcut approve/reject üzerinden yürür).
- Rapor eden kullanıcıları listeleme / kullanıcıya geri bildirim.
- Gerçek zamanlı bildirim (ayrı iş).

## Değişiklikler (dosya bazında)

1. **`lib/types.ts`:**
   - `ContentStatus`'a `"FlaggedForReview"` ekle.
   - Yeni: `export interface ReportedQuestion` — `{ questionId, body (kısaltma), categoryName?, status,
     reportCount, reasonBreakdown: Record<string, number>, notes: string[] }` (alan adları backend
     `GET /admin/reports` yanıtına göre plan aşamasında kesinleşir).
2. **`lib/api/reports.ts` (yeni):**
   - `listReports(): Promise<ReportedQuestion[]>` → `apiClient.get("/admin/reports")`.
   - `dismissReport(questionId: string): Promise<void>` → `apiClient.post(\`/admin/reports/${questionId}/dismiss\`)`.
3. **`app/(admin)/reports/page.tsx` (yeni, `"use client"`):**
   - Mount'ta `listReports()` çek → tablo/kart listesi. Boşsa "İncelenecek rapor yok" durumu.
   - Her satır: soru gövdesi (kısaltma), kategori, **rapor sayısı**, **sebep dökümü** (çip/rozetler,
     Türkçe etiket: WrongAnswer=Yanlış cevap, Typo=Yazım, Nonsense=Anlamsız, Inappropriate=Uygunsuz,
     Other=Diğer), **notlar** (varsa açılır/expand).
   - Eylemler (mevcut `questions.ts` fonksiyonlarını çağırır):
     - **Düzelt/Onayla:** soruyu düzenleme moduna götür (mevcut questions düzenleme akışına link/yönlendirme)
       ya da doğrudan `approveQuestion(id)`; onay sonrası backend raporları Resolved yapar → listeden düşer.
       (Düzenleme UI'ı zaten questions sayfasında — en basit: "Soruya git" linki + oradaki mevcut düzenle/onayla.)
     - **Reddet:** `rejectTarget` modal deseniyle sebep al → `rejectQuestion(id, reason)`.
     - **Yoksay:** `dismissReport(questionId)` → onay dialogu → başarıda listeden çıkar (soru Active'e döndü).
   - Her eylemden sonra listeyi tazele (refetch veya local çıkarma).
4. **`components/layout/Sidebar.tsx`:** "Raporlar" linki `/reports` (uygun ikon; "Sorular" linkinin yanına).

## Test / doğrulama

- Panelde otomatik test yaygın değilse: `npm run build`/`next lint` temiz + **manuel akış**: backend lokal
  ayakta, bir soru 3 farklı test kullanıcısıyla raporlanıp FlaggedForReview'e düşürüldükten sonra
  `/reports` sayfasında görünmesi; **Yoksay** → soru listeden çıkar + mobilde geri gelir; **Reddet/Onayla**
  → rapor kapanır, listeden düşer.
- Uçtan uca eşik/gizleme mantığı **backend entegrasyon testinde** kanıtlanır; panel yalnız sunum + eylem.

## Sonraki adım

Bu spec onaylandıktan sonra repodaki agent **writing-plans** ile plan çıkarıp uygular. Backend endpoint'leri
canlı olduktan sonra uçtan uca manuel doğrulama yapılır. Commit öncesi kullanıcı onayı beklenir.
