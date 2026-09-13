# "Tüm kaynaktan üret" — arka-plan iş + ilerleme çubuğu (Panel)

**Tarih:** 2026-09-12 (revize 2026-09-13 — arka-plan iş + ilerleme)
**Repo:** `kpss-admin-panel` (Next.js)
**İkiz (pipeline):** `kpss-content-pipeline` — asıl iş orada. Bkz.
`kpss-content-pipeline/docs/superpowers/specs/2026-09-12-tum-kaynaktan-uret-endpoint-pipeline-design.md`

## İstek

"Tüm kaynaktan üret" modu kaynağın tamamından soru üretsin, hepsi **Tarih dersi** altına gitsin
(konuya bölme/etiket yok — konu izlenebilirlik için pipeline tarafında saklanır, panelde ayrı
kategori açılmaz). Pipeline bu işi **arka planda** yapıyor (813 soru ≈ saatler) ve `job_id`
döndürüyor; panel **ilerlemeyi çubukla göstermeli** ("340/813 — Atatürk İnkılapları").

## Neden değişti (eski spec'e göre)

Eski panel spec'i senkron tek istek + kullanıcı-girdili `count` + "ilerleme kapsam dışı"
varsayıyordu. Pipeline tasarımı değişti:
- **Sayı artık kullanıcıdan alınmaz** — context boyutuna göre pipeline otomatik belirler
  (ağaç-gezinme). → "Tüm kaynaktan" modunda **`count` girdisi kaldırılır.**
- **İş arka planda, uzun sürüyor** → senkron bekleme yok; **`job_id` + polling + ilerleme çubuğu**
  (ilerleme artık kapsam **içi**).

## Bulgu (kod okundu)

- `lib/api/pipeline.ts`: **`getPipelineJob(jobId)`** + `PipelineJobResponse`
  (`status: queued|processing|done|error`) upload için **zaten var** → polling deseni yeniden
  kullanılır. `generateFromSource` iskeleti var (eski senkron dönüş) → dönüşü `{job_id}`'ye
  güncellenir.
- `components/topic-workspace.tsx`: `handleGenerateFromSource` (eski) senkron çağırıp count
  bekliyor; `distributeByWeight`/`countChunks`/`topicChunkCount` bölme yardımcıları yalnız eski
  konuya-bölme için var → **silinir**. `handleGenerateFromNode` ("Belirli konudan") **dokunulmaz**.
- Upload akışı (aynı dosyada/komşuda) `getPipelineJob`'u interval'le sorgulayıp faz gösteriyor →
  aynı polling helper'ı örnek alınır.

## Kilitli kararlar

1. **`generateFromSource` `{ job_id }` döner** — body sadece `{ category_id, tip? }` (count YOK).
2. **Bölme mantığı silinir** — `distributeByWeight`, `countChunks`, `topicChunkCount` ve konu
   döngüsü kaldırılır.
3. **"Tüm kaynaktan" modunda `count` input gizlenir** — yerine bilgi metni
   ("Kaynağın tamamından üretilir; soru sayısı içeriğe göre otomatik belirlenir, sorular **Tarih**
   dersi altına kaydedilir"). "Belirli konudan" modunda count/akış **aynı kalır**.
4. **İlerleme çubuğu** — Üret'e basınca `job_id` alınır, `getPipelineJob` ~2 sn'de bir sorgulanır;
   `done/total` ile çubuk + `current` başlık metni. `status:"done"` → yeşil "N soru üretildi,
   Bekleyenleri gör"; `status:"error"` → kırmızı banner.
5. **UI toggle, Ders seçimi, "Belirli konundan"** — dokunulmaz.

## Değişiklikler

### `lib/api/pipeline.ts`
- `generateFromSource(sourceId, { category_id, tip? })` → `{ job_id, status }` döner (senkron
  `GenerateResult` değil).
- `PipelineJobResponse`'a üretim iş alanları: `done?, total?, current?, count?, skipped?, export?`.

### `components/topic-workspace.tsx`
- `countChunks`/`topicChunkCount`/`distributeByWeight` silinir.
- `handleGenerateFromSource`: `saveTopics` → `generateFromSource(...)` → `job_id` → polling döngüsü
  (`getPipelineJob`) `done==total` veya `status:"done"` olana dek; state'e `done/total/current`
  yazılır; done'da `res.count`/export sonucu gösterilir; error'da banner.
- All-modu paneli: count input yerine bilgi metni + (üretim sırasında) ilerleme çubuğu.

## Testler

Panelde test altyapısı yok → `tsc + lint + build` + canlı smoke:
- **Tüm kaynaktan:** Ders=Tarih → Üret → çubuk 0→N ilerler, başlık adı değişir → done'da yeşil
  "N soru üretildi" + "Bekleyenleri gör".
- **Regresyon:** "Belirli konudan" hâlâ çalışır.
- **Graceful:** pipeline endpoint'i yok/job error → kırmızı banner, sayfa bozulmaz.

## Kapsam dışı (YAGNI)

- **Zorluk seçici** — sonraki iş.
- **İş iptali / arka planda sekme kapatınca sürdürme** — polling sadece sayfa açıkken; kapatılırsa
  iş pipeline'da devam eder (checkpoint'li), tekrar açınca "Bekleyenler"den görülür. İleride "aktif
  işi yeniden bağla" eklenebilir.
- **"Belirli konudan" değişikliği** — yok.

## Sıra / bağımlılık

Pipeline endpoint'i + job alanları önce/paralel. Panel `tsc/lint/build`'den geçer; uçtan uca smoke
endpoint canlı olunca anlamlı.
