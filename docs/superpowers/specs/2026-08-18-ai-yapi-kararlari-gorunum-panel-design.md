# AI Yapı Kararları Görünümü — Panel Tasarımı

- **Tarih:** 2026-08-18
- **Repo:** `kpss-admin-panel` (dal: `dev`)
- **İlgili pipeline işi:** `kpss-content-pipeline` — `heading_segmenter.py` + `topic_nester.py` (LLM yapısal ağaç kurma). Pipeline artık ağacı LLM ile kurar ve **kararlarını gerekçesiyle ağaç JSON'una iliştirir**; panel yalnızca **TÜKETİR + gösterir**.

## 1. Amaç ve bağlam

Pipeline'da mekanik yapı-kurma yerini LLM'e bıraktı: hangi kalın satır gerçek
başlık, hangisi gövdeye karışmalı (callout/Not kutusu), ve başlıklar nasıl iç içe
geçiyor kararlarını LLM veriyor. Kullanıcının net isteği: **"AI neyi nereye nasıl
yaptı, UI'dan kolayca görelim"** — diske rapor/JSON'a dalmak değil.

Bu iş, panele AI'ın yapı kararlarını **ağaç üzerinde işaret + gerekçe** olarak
gösterme yeteneği ekler: değişen düğümlerde rozet, üstüne gelince gerekçe, ve
gövdeye karışan (başlık sayılmayan) parçaların bulundukları bölüm altında
listelenmesi. Böylece kullanıcı **marker ham çıktısı → AI kararları → son ağaç**
karşılaştırmasını baktığı yerde yapar; yanlış bir folding/nesting anında görünür.

**Bu spec, `2026-08-16-agac-oneri-paneli-design.md`'nin yerine geçer:** hakem/öneri
(`suggestions`) yaklaşımı pipeline'da kaldırıldığı için öneri kartları da geçersiz.
Yeni model danışman değil — ağaç zaten doğru kurulmuş gelir; panelin işi onu
**açıklamak**, düzeltme önermek değil.

## 2. Kapsam

**Kapsam içi (v1):**
- Ağaç düğümlerinde AI provenance rozeti (nesting yapıldı / üst-düzeye alındı) +
  gerekçe (tooltip/expand).
- Her bölümün altında "AI gövdeye kattı: `<başlık>` — `<gerekçe>`" soluk satırları
  (`ai_structure.folded`).
- Salt görüntüleme; mevcut düzenleme (rename/move/sil) aynen çalışmaya devam eder.

**Kapsam dışı (YAGNI):**
- **Yan yana öncesi/sonrası** (marker ham yapısı vs AI ağacı) — sonraki tur;
  pipeline bunun için gereken `marker_headings` verisini şimdilik zorunlu tutmaz.
- Yeni backend ucu — yok (`GET /sources/{id}/topics` zaten `ai`/`ai_structure`
  taşır).
- AI kararını panelden düzenleme/geri alma — v1 yalnız gösterir. (Kullanıcı yine de
  mevcut manuel taşıma/rename araçlarıyla ağacı elle düzeltebilir.)

## 3. Backend sözleşmesi (pipeline sağlıyor — panel yalnız okur)

`GET /sources/{id}/topics` → `TopicTree`. Yenilikler:

Her düğümde (opsiyonel):
```ts
interface AiNodeInfo {
  placement: "nested" | "top";       // parent altına mı, konu üst-düzeyine mi
  parent_title: string | null;       // nested ise parent başlığı
  reason: string;                    // LLM gerekçesi (kısa)
}
```

Ağaç kökünde (opsiyonel):
```ts
interface AiFolded {
  title: string;                     // gövdeye karışan başlık adayı
  page: number;
  reason: string;
  folded_into: string;               // hangi bölümün gövdesine karıştı (başlık)
}
interface AiStructure { folded: AiFolded[]; }
```

Garantiler: bu alanlar **opsiyonel** — eski ağaçlarda / taksonomi-dışı kaynakta
bulunmayabilir; panel yoklukta sessizce eski görünümü çizer.

## 4. Bileşenler ve arayüzler

### 4.1 `lib/api/pipeline.ts` (mevcut dosyaya ekleme)
- `AiNodeInfo`, `AiFolded`, `AiStructure` tipleri.
- `TopicSubtopic`'e `ai?: AiNodeInfo`.
- `TopicTree`'ye `ai_structure?: AiStructure`.
- Kaldırılan hakem yaklaşımıyla birlikte `Suggestion` / `suggestions` /
  `reviewTopics` bu iş kapsamında **temizlenir** (2026-08-16 işi geri alınır;
  uygulayan agent kullanımda olup olmadığını kontrol ederek çıkarır).

### 4.2 `components/topic-tree-editor.tsx` (mevcut — rozet + folded satırları)
Zaten recursive render var ve düğüme rozet basma örüntüsü mevcut (öneri rozeti
için yazılmış satır). Aynı desenle:
- `sub.ai` varsa düğüm başlığının yanına küçük **rozet**:
  - `placement === "nested"` → "AI: yerleştirdi" (parent_title ile).
  - `placement === "top"` → "AI: ana bölüm" (üst-düzeye alındı; MALİYE gibi).
  - Rozet başlığı/`title` attr'ı = `sub.ai.reason` (hover'da gerekçe). İstenirse
    tıkla-genişlet ile satır altında tam gerekçe.
- Bölüm (konu) render'ının sonunda, `tree.ai_structure.folded` içinden
  `folded_into === <bu bölümün/başlığın title>` olanlar için soluk satır:
  "↳ AI gövdeye kattı: **`title`** — `reason`". Böylece "kaybolan" başlık ve
  nedeni görünür kalır.
- Öneri kartı / no-op filtresi / `moveNode`-öneri bağlantısı: 2026-08-16'dan gelen
  bu kısımlar **çıkarılır** (öneri modeli iptal). Manuel taşıma (`moveSubToTopic`
  vb.) düzenleme aracı olarak **korunur**.

### 4.3 `components/topic-workspace.tsx` (mevcut — sadeleştirme)
- "Önerileri Getir" düğmesi ve `reviewState`/`reviewTopics` bağlaması **çıkarılır**.
- `<TopicSuggestions />` kullanımı ve dosyası **çıkarılır**.
- Ağaç yükleme/gösterme/Kaydet akışının gerisi aynı.

## 5. Doğrulama (bu repoda test çatısı YOK — lint + tsc + elle)
1. `npx tsc --noEmit` temiz (yeni opsiyonel tipler; eski `Suggestion` referansları
   kalmadı).
2. `npm run lint` temiz.
3. Elle (dev sunucu, gerçek pipeline ayakta, LLM ile kurulmuş taze kaynak):
   - MALİYE benzeri düğümde "AI: ana bölüm" rozeti; hover'da gerekçe.
   - Divan-ı Hümayun benzeri düğümde "AI: yerleştirdi (Devlet Teşkilatı)" rozeti.
   - İtil Bulgar bölümü altında "↳ AI gövdeye kattı: Not — …" satırı; ayrı düğüm
     olarak GÖRÜNMÜYOR.
   - `ai`/`ai_structure` olmayan eski kaynakta panel eskisi gibi, hatasız çiziyor.
   - Öneri kartları / "Önerileri Getir" artık yok; düzenleme araçları çalışıyor.

## 6. Bilinen sınırlar / sonraki tur
- **Öncesi/sonrası yan yana görünüm** (marker ham yapısı vs AI ağacı) sonraki tur;
  pipeline `ai_structure.marker_headings` üretmeye başlarsa eklenir.
- v1 salt gösterim; AI kararını panelden geri almak için ayrı bir "düzelt" akışı
  düşünülebilir (şimdilik mevcut manuel araçlar yeterli).
- Sıra: **önce pipeline** LLM yapı işini bitirir ve `ai`/`ai_structure` üretir,
  **sonra** bu panel işi (kaliteyi taze bir kaynakta UI'dan değerlendirmek için).
