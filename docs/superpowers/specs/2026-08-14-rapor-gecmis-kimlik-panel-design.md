# Rapor Geçmişi + Raporlayan Kimlik — Panel Tasarımı

**Tarih:** 2026-08-14
**Repo:** kpss-admin-panel (Next.js)
**Bağlam:** `2026-08-12-hatali-soru-raporlama-panel-design.md`'nin devamı. Backend
sözleşmesi: `KpssSoru-backend/docs/superpowers/specs/2026-08-14-rapor-gecmis-kimlik-backend-design.md`.
**Bağımlılık:** Backend'deki 2 yeni endpoint ÖNCE yayında olmalı.

## Amaç

1. **Son Raporlar** — /reports'a düz, kronolojik, statü-filtreli rapor akışı sekmesi.
2. **Soru bazlı rapor geçmişi** — soru detayında o soruya ait tüm raporlar.
3. **Raporlayan kimlik** — her satırda backend'den gelen **maskeli e-posta** + tarih.
4. **Detaydan kapatma aksiyonları** — `FlaggedForReview` sorularda da footer'da
   Onayla/Reddet/Yoksay (bugün yalnız `PendingReview`'da çıkıyor).

## Sözleşme / tipler (`lib/types.ts`)

```ts
export type ReportStatus = "Open" | "Resolved" | "Dismissed";

export interface QuestionReportRow {
  id: string;
  questionId: string;
  questionBody: string;
  categoryName: string;
  reason: ReportReason;      // mevcut tip
  note: string | null;
  reporterMasked: string;    // "h***@gmail.com"
  createdAt: string;         // ISO
  status: ReportStatus;
}
```

Mevcut `ReportedQuestion` (gruplu kuyruk) aynen kalır.

## API katmanı (`lib/api/reports.ts`)

Mevcut `listReports` + `dismissReport` yanına:

```ts
listRecentReports(params?: { status?: ReportStatus; limit?: number }): Promise<QuestionReportRow[]>
  // GET /admin/reports/recent?status=&limit=
listQuestionReports(questionId: string): Promise<QuestionReportRow[]>
  // GET /admin/reports/question/{id}
```

## Hook'lar (`lib/hooks/useReports.ts`)

```ts
useRecentReports(params?: { status?: ReportStatus })  // queryKey ["admin-reports-recent", status]
useQuestionReports(questionId: string, opts?: { enabled?: boolean })
  // queryKey ["question-reports", questionId]
```

## Sabitler (`lib/constants.ts`)

Mevcut `REASON_LABELS` yanına:

```ts
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> =
  { Open: "Açık", Resolved: "Çözüldü", Dismissed: "Yoksayıldı" };
```

Rozet varyantı: Open→`destructive`/`secondary`, Resolved→`default`, Dismissed→`outline`.

## /reports sayfası — sekmeler (`app/(admin)/reports/page.tsx`)

`tabs.tsx` YOK → **hafif yerel toggle** (`useState<"queue"|"recent">`, iki `Button`'lı
segmented). Yeni bağımlılık/komponent dosyası eklenmez.

- **İnceleme Kuyruğu** (varsayılan): MEVCUT tablo + aksiyonlar (Onayla/Reddet/Yoksay)
  aynen korunur. Sıfır davranış değişikliği.
- **Son Raporlar** (yeni): üstte statü `Select` (Tümü/Açık/Çözüldü/Yoksayıldı,
  varsayılan Tümü) → `useRecentReports({ status })`. Tablo kolonları:
  **Soru** (linkli → `/questions/{questionId}`, kırpılmış) · **Sebep** (`REASON_LABELS`
  rozeti) · **Raporlayan** (`reporterMasked`) · **Not** · **Tarih** (`createdAt` TR
  formatı) · **Statü** (`REPORT_STATUS_LABELS` rozeti). Salt-okunur (aksiyon yok).
  Loading→Skeleton, hata→"tekrar dene", boş→"Rapor yok".

## Soru detayı (`app/(admin)/questions/[id]/page.tsx`)

**Rapor geçmişi kartı (aside):** Commit'siz "Kullanıcı Raporları" not kartı bu kartla
DEĞİŞTİRİLİR (boşa gitmez, zenginleşir). Kaynak: **toplu `useReports` yerine**
`useQuestionReports(id, { enabled: !!question })` (soru yüklenince çek). Kart yalnız
`rows.length > 0` ise render olur. Üstte özet (rapor sayısı), altında her rapor satırı:
**sebep rozeti · maskeli e-posta · tarih · statü rozeti · not**. Böylece detay sayfası
artık tüm listeyi çekip filtrelemez; tek soruyu sorgular.

**Footer kapatma aksiyonları:** aksiyon bloğu koşulu
`question.status === "PendingReview"` → `["PendingReview","FlaggedForReview"].includes(status)`.
`FlaggedForReview`'da: **Onayla** (`approveQuestion`), **Reddet** (`rejectQuestion` +
RejectDialog), **Yoksay** (`dismissReport` + ConfirmDialog — /reports ile aynı metinler).
Başarıda ilgili query'ler invalidate + toast; `PendingReview` davranışı aynen korunur.

## Doğrulama

`tsc + lint + build` yeşil. Backend canlıyken uçtan uca smoke: (1) Son Raporlar akışı +
statü filtresi, (2) satırdan soruya atlama, (3) detayda rapor geçmişi + maskeli e-posta,
(4) `FlaggedForReview` soruyu detay footer'ından Onayla/Reddet/Yoksay ile kapatma.

## Kapsam dışı (YAGNI)

- `tabs.tsx` shadcn komponenti (yerel toggle yeterli).
- Sayfalama (backend `limit` yeterli).
- Ayrı "Geçmiş" sekmesi — statü filtresi geçmişi Son Raporlar içinde veriyor.
- Mobil değişikliği yok.

## Commit notu

Commit'ler Co-Author imzasız. Commit'siz not-kartı/`constants` değişiklikleri bu iş
kapsamında kartın zenginleştirilmesiyle beraber commit'lenir (ayrı "toparlama" adımı yok).
