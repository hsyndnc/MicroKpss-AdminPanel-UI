# Ağaç Öneri Paneli (LLM-Hakem) — Tasarım

- **Tarih:** 2026-08-16
- **Repo:** `kpss-admin-panel` (dal: `dev`)
- **İlgili pipeline işi:** `kpss-content-pipeline` — `tree_reviewer.py` + `POST /sources/{id}/review` (bu iş TAMAMLANDI, canlı çalışıyor; panel yalnızca TÜKETİR).

## 1. Amaç ve bağlam

Pipeline tarafında LLM-hakem, kurulan konu ağacını inceleyip "şu düğüm yanlış
parent altına düşmüş, şuraya taşınmalı" önerileri üretiyor (`suggestions`).
Öneriler **danışman** niteliğinde: ingest'e/ağaca dokunmaz, yalnız ağaç JSON'una
iliştirilir. Şu an bu önerileri görmenin/uygulamanın bir yolu yok.

Bu iş, panele önerileri **kart olarak gösterip tek tıkla uygulama** yeteneği
ekler. Kullanıcı önerilere Uygula/Yoksay der, düğüm ağaçta yeni yerine taşınır,
sonra mevcut **Kaydet** akışıyla backend'e yazılır (chunk `parent_id`'leri
güncellenir). **Yeni backend işi yoktur** — mevcut `POST /review` (öneri üretimi)
ve `PUT /topics` (kaydetme) uçları kullanılır.

Amaç kullanıcının cümlesiyle: "panelde görmeden ne kadar çalıştığını
anlayamıyorum." Bu yüzden v1 önceliği = **önerileri bağlamında gör + kabul/ret**.

## 2. Kapsam

**Kapsam içi (v1):**
- "Önerileri Getir" düğmesi → `POST /review` → öneriler ağaç state'ine iner.
- Öneri kartları listesi (no-op'lar gizli).
- Kart başına Uygula (düğümü taşı) / Yoksay (kartı kapat).
- Taşıma mantığının `moveNode(nodeId, newParentId | null)` olarak genelleştirilmesi.

**Kapsam dışı (YAGNI):**
- **Sürükle-bırak** — sonraki tur. (Tasarım bunu kolaylaştıracak: sürükle-bırak da
  aynı `moveNode`'u çağıracak; şimdi genelleştiriliyor.)
- Yeni backend ucu — yok.
- Önerilerin ayrı kalıcılığı — öneriler yalnız ağaç state'inde yaşar; sayfa
  yenilenirse "Önerileri Getir" tekrar çağrılır.
- Pipeline tarafında no-op gürültüsünün kaynaktan temizlenmesi — ayrı iş; panel
  şimdilik istemci tarafında gizler (§5).

## 3. Backend sözleşmesi (mevcut — değişmez)

`POST /sources/{source_id}/review` → `{ "status": "ok", "topics": <TopicTree> }`.
Dönen ağacın kökünde `suggestions` dizisi bulunur. Her öneri:

```ts
interface Suggestion {
  node_id: string;              // taşınacak düğümün id'si
  node_title: string;           // düğümün başlığı (ağaçtan dolduruldu)
  new_parent_id: string | null; // hedef parent id; null => konu üst-düzeyine TERFİ
  new_parent_title: string | null;
  topic_id: string;             // düğümün ait olduğu taksonomi konusunun id'si
  reason: string;               // LLM gerekçesi (kısa)
}
```

Garantiler (pipeline tarafında sağlanıyor, panelin varsayabileceği):
- `node_id` ve (null değilse) `new_parent_id` ağaçta **var olan** gerçek düğümlerdir.
- Taşıma **aynı taksonomi konusu** (`topic_id`) içindedir — konular arası taşıma önerilmez.
- Bozuk/bilinmeyen id'ler pipeline'da zaten elenmiştir.

## 4. Veri akışı

```
[Önerileri Getir] --POST /review--> backend review_tree
      |                                   |
      |<------ TopicTree + suggestions ---+
      v
  workspace state: tree (artık suggestions taşır)
      v
  TopicSuggestions: no-op'ları ele, kalanları kart olarak çiz
      |                         |
   [Uygula]                  [Yoksay]
      |                         |
  moveNode(node, target)     kartı listeden çıkar
  + kartı listeden çıkar        (ağaç değişmez)
      v
  tree state güncellenir -> TopicTreeEditor düğümü yeni yerde gösterir
      v
  [Kaydet] (mevcut) --PUT /topics--> chunk parent_id güncellenir
```

## 5. No-op filtresi (istemci tarafı gösterim kuralı)

Panel bir öneriyi **çizmez** (gizler) eğer:
1. `new_parent_id` !== null **ve** `new_parent_id` === düğümün ağaçtaki **mevcut
   parent id'si** (yani "olduğu yere taşı" — etkisiz), **veya**
2. `new_parent_id` === null **ve** düğüm zaten konusunun üst-düzeyinde (parent'ı
   yok — terfiye gerek yok).

Bu kural, "MALİYE" tipi kusurlu öneriyi de (LLM `null` demek isteyip mevcut
parent'ı doldurmuş → kural 1'e takılır) gizler. Kabul edilen bir yan etki:
bu tür öneriler kullanıcıya hiç gösterilmez. Canlı veride 91 öneriden ~43'ü
no-op; filtre sonrası kullanıcı ~48 gerçek öneri görür.

"Mevcut parent id" ağaçtan türetilir (§6.1 `findParentId`).

## 6. Bileşenler ve arayüzler

### 6.1 `lib/api/pipeline.ts` (mevcut dosyaya ekleme)
- `Suggestion` tipi (§3) eklenir.
- `TopicTree`'ye `suggestions?: Suggestion[]` alanı eklenir.
- Yeni fonksiyon:
  ```ts
  export async function reviewTopics(sourceId: string): Promise<TopicTree> {
    const { data } = await pipelineClient.post<{ topics: TopicTree }>(
      `/sources/${sourceId}/review`
    );
    return data.topics;
  }
  ```

### 6.2 `app/api/pipeline/sources/[id]/review/route.ts` (yeni proxy)
`generate/route.ts` ile birebir aynı desen; gövde yok:
```ts
import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return pipelineProxy(`/sources/${encodeURIComponent(id)}/review`, {
    method: "POST",
  });
}
```

### 6.3 `components/topic-tree-editor.tsx` (mevcut — `moveNode` genelleştirmesi)
Bugünkü `moveSubToTopic(sid, destTopicId)` yalnız bir **konunun** üst-düzeyine
taşıyabiliyor. Genelleştirilmiş taşıma gerekir:

```ts
// nodeId'yi mevcut yerinden çıkar; newParentId null ise konu üst-düzeyine,
// değilse id'si newParentId olan düğümün subtopics'ine ekle.
function moveNode(nodeId: string, newParentId: string | null, topicId: string): void
```

Algoritma (mevcut `removeIn` yeniden kullanılır):
1. `removeIn` ile düğümü (çocuklarıyla birlikte) ağaçtan çıkar. Bulunamazsa çık (bayat öneri — güvenli no-op).
2. `newParentId === null` → `topicId`'li konunun `subtopics` dizisine `push` (terfi).
3. Aksi halde → id'si `newParentId` olan düğümü recursive bul; `subtopics` yoksa `[]` ata; düğümü `push`. Hedef bulunamazsa güvenli fallback: `topicId` üst-düzeyine ekle (düğüm kaybolmaz).

Bu fonksiyon dışarıdan tetiklenebilmeli. İki seçenekten biri (uygulayan agent
mevcut kod hissiyatına göre seçsin; ikisi de kabul):
- **(a)** Taşıma mantığını (`removeIn` + yerleştirme) `topic-workspace.tsx`'in
  `update` yardımcısına taşıyıp `TopicSuggestions`'a callback olarak geçmek, veya
- **(b)** `TopicTreeEditor`'a opsiyonel `onApplySuggestion` / ref API'si vermek.

Öneri **(a)**: workspace zaten `tree` state'inin ve `onTreeChange`'in sahibi;
taşıma orada tek noktadan yapılır, hem kartlar hem (sonra) sürükle-bırak aynı
`moveNode`'u çağırır. Mevcut `moveSubToTopic` bu genel fonksiyon üzerinden
yeniden yazılabilir (`moveNode(sid, null, destTopicId)` = konu üst-düzeyine).

### 6.4 `components/topic-suggestions.tsx` (yeni)
Sunum + kullanıcı etkileşimi; ağaç mutasyonu YAPMAZ, yalnız olay yayar.

```ts
interface Props {
  tree: TopicTree;                       // no-op filtresi ve başlık çözümü için
  suggestions: Suggestion[];
  onApply: (s: Suggestion) => void;      // workspace moveNode'u çağırır
  onDismiss: (s: Suggestion) => void;    // workspace kartı listeden düşürür
}
```
Sorumluluklar:
- No-op filtresi (§5). Görünür öneri yoksa bileşen boş/gizli.
- Her görünür öneri için kart:
  - Başlık: `s.node_title`.
  - Konum satırı: `şu an: <mevcut parent başlığı ya da "konu üst-düzeyi"> →
    <s.new_parent_id === null ? "⬆ konu üst-düzeyine (terfi)" : hedef başlık>`.
    Başlıklar ağaçtan çözülür (id→title haritası); `new_parent_title` yalnız
    yedek. Mevcut parent, `findParentId(tree, node_id)` ile bulunur.
  - Gerekçe: `s.reason` (italik/soluk).
  - `[Uygula]` → `onApply(s)`; `[Yoksay]` → `onDismiss(s)`.
- İsteğe bağlı düzen: konuya (`topic_id` → konu başlığı) göre grupla; zorunlu değil.

### 6.5 `components/topic-workspace.tsx` (mevcut — bağlama)
- Yeni state: `reviewState: "idle" | "loading" | "error"`, `reviewError: string`.
- Öneriler ağaç state'inde (`tree.suggestions`) taşınır; ayrı state şart değil.
- **"Önerileri Getir"** düğmesi (Kaydet yanına): `reviewTopics(sourceId)` çağırır,
  dönen ağacı `onTreeChange` ile set eder (suggestions dahil), yükleniyor/hata
  durumunu yönetir. Metin örn. "Önerileri Getir" / "Önerileri Yenile".
- `<TopicSuggestions tree={tree} suggestions={tree.suggestions ?? []} onApply onDismiss />`.
- `onApply(s)`: `moveNode(s.node_id, s.new_parent_id, s.topic_id)` ile ağacı
  mutasyona uğrat **ve** aynı `s`'i `tree.suggestions`'tan çıkar (uygulandı) →
  `onTreeChange`.
- `onDismiss(s)`: yalnız `s`'i `tree.suggestions`'tan çıkar → `onTreeChange`
  (ağaç değişmez).
- Not: Uygula/Yoksay yalnız **görünüm** state'ini (kartın kaybolması) ve/veya
  ağacı değiştirir; kalıcılık yine **Kaydet** ile olur. Kaydet'ten önce
  `tree.suggestions` temizlenmeli mi? Zorunlu değil; backend `PUT` ağacın
  tamamını alır ve `suggestions`'ı yeniden yazar. İstenirse Kaydet'te
  `suggestions` sıfırlanabilir (küçük temizlik, opsiyonel).

## 7. Hata yönetimi
- `POST /review` başarısız (proxy 502 / upstream hata) → kart alanında hata
  mesajı, mevcut ağaç korunur, çökme yok. (`pipelineProxy` zaten ağ hatasını
  502 + `{error}`'a çeviriyor.)
- Uygula sırasında `node_id`/`new_parent_id` ağaçta bulunamazsa (bayat öneri):
  `moveNode` güvenli davranır (düğüm kaybolmaz), kart yine listeden düşer.
- Öneri üretimi konu bazında pipeline'da hataya dayanıklı; panel yalnızca dönen
  listeyi işler.

## 8. Doğrulama (bu repoda test çatısı YOK — lint + tsc + elle)
Repo yalnız `lint` script'ine sahip; birim test altyapısı yok. Bu yüzden:
1. `npx tsc --noEmit` temiz (yeni tipler/propların tip güvenliği).
2. `npm run lint` temiz.
3. Elle (dev sunucu, gerçek pipeline ayakta, kaynak `38c54d85`):
   - "Önerileri Getir" → kartlar geliyor; no-op'lar görünmüyor (sayı ~48).
   - Bir "TERFİ" kartında Uygula → düğüm ağaçta konu üst-düzeyine çıkıyor,
     kart kayboluyor. Örnek: "YARARLI CEMİYETLER" → "ZARARLI CEMİYETLER"den çıkıp
     üst-düzeye.
   - Bir "TAŞIMA" kartında Uygula → düğüm doğru parent'ın altına giriyor.
     Örnek: "Rauf (Orbay)" → "KİMDİR?" altına.
   - Yoksay → kart kayboluyor, ağaç değişmiyor.
   - Kaydet → PUT başarılı; yeniden yükleyince taşıma kalıcı.
   - `POST /review` hata verdiğinde (örn. pipeline kapalı) panel hata gösteriyor,
     çökmüyor.

## 9. Bilinen sınırlar / sonraki tur
- **Sürükle-bırak** eklenince `moveNode` aynen kullanılır (bu tasarımın nedeni).
- No-op/kusurlu öneriler istemcide gizleniyor; kaynaktan temizlik (prompt +
  pipeline no-op filtresi) ayrı bir iş olarak `kpss-content-pipeline`'da ele alınacak.
- Uygulanan bir taşıma başka bir öneriyi bayatlatabilir; v1 bunu ele almaz
  (Uygula sırasında `moveNode` güvenli davranır, sorun çökme yaratmaz).
