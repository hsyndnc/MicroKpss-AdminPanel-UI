# Ağaç Öneri Paneli (LLM-Hakem) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panelde konu ağacına LLM-hakem önerilerini kart olarak gösterip tek tıkla uygulamak (düğümü taşımak), sonra mevcut Kaydet akışıyla kalıcı yapmak.

**Architecture:** Yeni backend işi yok — mevcut `POST /sources/{id}/review` (öneri üretimi) ve `PUT /sources/{id}/topics` (kaydet) uçları kullanılır. Öneriler ağaç JSON'unun kökünde `suggestions` olarak gelir; panel bunları no-op filtresiyle süzüp kart çizer. Uygula → ağacı `moveNode(nodeId, newParentId, topicId)` ile mutasyona uğratır (saf, yeniden kullanılabilir; sonraki turda sürükle-bırak da aynısını çağıracak). Kalıcılık yine "Ağacı Kaydet" ile.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, TypeScript, axios, Tailwind v4, shadcn/ui (Base UI 1.6 Select).

**Spec:** `docs/superpowers/specs/2026-08-16-agac-oneri-paneli-design.md`

## Global Constraints

- **Bu NOT bildiğin Next.js değil** — kod yazmadan önce `node_modules/next/dist/docs/` içindeki ilgili rehberi oku (AGENTS.md kuralı). Deprecation uyarılarına uy.
- **Test çatısı YOK** — repo yalnız `lint` script'ine sahip. Her task'ın doğrulaması: `npx tsc --noEmit` temiz + `npm run lint` temiz (+ gerektiğinde `npm run build`). Uçtan uca smoke elle (canlı pipeline gerektirir, kullanıcıda).
- **Commit'ler Co-Authored-By İMZASIZ.** Mesajlar sade Türkçe.
- **Dal:** `dev` (aktif çalışma dalı). Push yalnız kullanıcı isteyince.
- **Pipeline proxy deseni:** tüm `app/api/pipeline/*` route'ları `@/lib/api/pipeline-proxy`'deki `pipelineProxy` helper'ını kullanır (X-Api-Key sunucuda, non-JSON'a dayanıklı). Kullanılmayan ilk route argümanı `_request: NextRequest` olarak adlandırılır (repo deseni; lint temiz).
- **Base UI Select tuzağı:** değer≠etiket olan Select'e `items={[{value,label}]}` ver (bu işte yeni Select yok, ama uyanık ol).
- **Backend sözleşmesi değişmez** — `POST /review` `{ status, topics }` döner; dönen ağacın kökünde `suggestions` vardır. `node_id`/`new_parent_id` ağaçta var olan gerçek düğümlerdir, taşıma aynı `topic_id` içindedir (pipeline garanti eder).

---

### Task 1: Veri katmanı — `Suggestion` tipi, `reviewTopics`, review proxy route

**Files:**
- Modify: `lib/api/pipeline.ts` (Suggestion tipi + `TopicTree.suggestions?` + `reviewTopics`)
- Create: `app/api/pipeline/sources/[id]/review/route.ts`

**Interfaces:**
- Consumes: mevcut `pipelineClient` (axios, baseURL `/api/pipeline`), `pipelineProxy(path, init)`.
- Produces:
  - `interface Suggestion { node_id: string; node_title: string; new_parent_id: string | null; new_parent_title: string | null; topic_id: string; reason: string }`
  - `TopicTree.suggestions?: Suggestion[]`
  - `reviewTopics(sourceId: string): Promise<TopicTree>`
  - `POST /api/pipeline/sources/{id}/review` proxy

- [ ] **Step 1: `Suggestion` tipini ve `TopicTree.suggestions` alanını ekle**

`lib/api/pipeline.ts` içinde, `TopicTree` interface'inin ÜSTÜNE `Suggestion`'ı ekle:

```ts
export interface Suggestion {
  node_id: string;              // taşınacak düğümün id'si
  node_title: string;           // düğümün başlığı
  new_parent_id: string | null; // hedef parent id; null => konu üst-düzeyine terfi
  new_parent_title: string | null;
  topic_id: string;             // düğümün ait olduğu taksonomi konusunun id'si
  reason: string;               // LLM gerekçesi (kısa)
}
```

`TopicTree` interface'ine `suggestions?` alanı ekle:

```ts
export interface TopicTree {
  source_id: string;
  file_name: string;
  topics: Topic[];
  previews?: Record<string, string>;
  suggestions?: Suggestion[];
}
```

- [ ] **Step 2: `reviewTopics` fonksiyonunu ekle**

`lib/api/pipeline.ts` sonuna (örn. `saveTopics`'in altına) ekle:

```ts
export async function reviewTopics(sourceId: string): Promise<TopicTree> {
  const { data } = await pipelineClient.post<{ topics: TopicTree }>(
    `/sources/${sourceId}/review`
  );
  return data.topics;
}
```

- [ ] **Step 3: Review proxy route'unu oluştur**

`app/api/pipeline/sources/[id]/review/route.ts` (gövde yok; `sources/[id]/route.ts` deseni):

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

- [ ] **Step 4: Tip + lint doğrula**

Run: `npx tsc --noEmit && npm run lint`
Expected: ikisi de temiz (0 hata). `[id]/page.tsx` `form.watch` uyarısı önceden var, bloklamaz.

- [ ] **Step 5: Commit**

```bash
git add lib/api/pipeline.ts "app/api/pipeline/sources/[id]/review/route.ts"
git commit -m "feat: ağaç öneri veri katmanı — Suggestion tipi + reviewTopics + /review proxy"
```

---

### Task 2: `topic-tree-editor.tsx` — saf `moveNode` + `findParentId` genelleştirmesi

**Files:**
- Modify: `components/topic-tree-editor.tsx`

**Interfaces:**
- Consumes: `TopicTree`, `Topic`, `TopicSubtopic` (`@/lib/api/pipeline`).
- Produces (module-level, EXPORT'lu — workspace + suggestions import eder):
  - `moveNode(tree: TopicTree, nodeId: string, newParentId: string | null, topicId: string): TopicTree` — saf; düğümü çıkarıp hedefe ekler, YENİ ağaç döner.
  - `findParentId(tree: TopicTree, nodeId: string): string | null` — düğümün mevcut parent alt-başlık id'si; doğrudan bir konunun altındaysa `null`.
- Davranış garantisi: mevcut editör (rename/sil/taşı/chunk) AYNEN çalışır (`moveSubToTopic` içeride `moveNode` mantığına yönlendirilir, çıktı değişmez).

- [ ] **Step 1: Module-level saf yardımcıları ekle**

`components/topic-tree-editor.tsx` içinde, mevcut `collectLeaves` fonksiyonunun ALTINA (hâlâ modül düzeyinde, `export function TopicTreeEditor`'ın ÜSTÜNE) ekle:

```ts
// Düğümü (çocuklarıyla) ağaçtan çıkar; bulursa döndürür (mutasyon: splice).
function removeNode(subs: TopicSubtopic[], nodeId: string): TopicSubtopic | undefined {
  const i = subs.findIndex((s) => s.id === nodeId);
  if (i >= 0) return subs.splice(i, 1)[0];
  for (const s of subs) {
    if (s.subtopics) {
      const r = removeNode(s.subtopics, nodeId);
      if (r) return r;
    }
  }
  return undefined;
}

// id'si parentId olan alt-başlığın subtopics'ine node ekle (recursive). Bulursa true.
function insertUnderSubs(subs: TopicSubtopic[], parentId: string, node: TopicSubtopic): boolean {
  for (const s of subs) {
    if (s.id === parentId) {
      if (!s.subtopics) s.subtopics = [];
      s.subtopics.push(node);
      return true;
    }
    if (s.subtopics && insertUnderSubs(s.subtopics, parentId, node)) return true;
  }
  return false;
}

// Draft üzerinde taşımayı uygular (mutasyon). newParentId null => topicId konusunun üst-düzeyine.
function moveNodeInDraft(
  draft: TopicTree, nodeId: string, newParentId: string | null, topicId: string
): void {
  let moved: TopicSubtopic | undefined;
  for (const t of draft.topics) {
    if (!moved) moved = removeNode(t.subtopics, nodeId);
  }
  if (!moved) return; // bayat öneri — düğüm yok, güvenli no-op
  if (newParentId === null) {
    const topic = draft.topics.find((t) => t.id === topicId) ?? draft.topics[0];
    topic?.subtopics.push(moved);
    return;
  }
  let inserted = false;
  for (const t of draft.topics) {
    if (insertUnderSubs(t.subtopics, newParentId, moved)) { inserted = true; break; }
  }
  if (!inserted) {
    // hedef parent bulunamadı → topicId üst-düzeyine güvenli fallback (düğüm kaybolmaz)
    const topic = draft.topics.find((t) => t.id === topicId) ?? draft.topics[0];
    topic?.subtopics.push(moved);
  }
}

// SAF genel taşıma: yeni ağaç döner (workspace bunu çağırır).
export function moveNode(
  tree: TopicTree, nodeId: string, newParentId: string | null, topicId: string
): TopicTree {
  const draft: TopicTree = structuredClone(tree);
  moveNodeInDraft(draft, nodeId, newParentId, topicId);
  return draft;
}

// Düğümün mevcut parent alt-başlık id'si; doğrudan bir konunun altındaysa null.
function locateParent(
  subs: TopicSubtopic[], nodeId: string, parentId: string | null
): { found: boolean; parentId: string | null } {
  for (const s of subs) {
    if (s.id === nodeId) return { found: true, parentId };
    const r = locateParent(s.subtopics ?? [], nodeId, s.id);
    if (r.found) return r;
  }
  return { found: false, parentId: null };
}

export function findParentId(tree: TopicTree, nodeId: string): string | null {
  for (const t of tree.topics) {
    const r = locateParent(t.subtopics, nodeId, null);
    if (r.found) return r.parentId;
  }
  return null;
}
```

- [ ] **Step 2: Component içindeki `removeIn`'i sil, `deleteSub` + `moveSubToTopic`'i genel fonksiyona yönlendir**

Component içindeki `removeIn` fonksiyonunu (satır ~44-51) TAMAMEN SİL. `renameIn`, `stripChunk`, `addChunkTo` KALIR.

`deleteSub`'ı module-level `removeNode` kullanacak şekilde değiştir:

```ts
  function deleteSub(sid: string) {
    update((d) => d.topics.forEach((t) => removeNode(t.subtopics, sid)));
  }
```

`moveSubToTopic`'i `moveNodeInDraft` ile yeniden yaz (konu üst-düzeyine taşıma = newParentId null):

```ts
  function moveSubToTopic(sid: string, destTopicId: string) {
    update((d) => moveNodeInDraft(d, sid, null, destTopicId));
  }
```

- [ ] **Step 3: Tip + lint + build doğrula (editör davranışı bozulmadı)**

Run: `npx tsc --noEmit && npm run lint && npx next build`
Expected: hepsi temiz/başarılı. Mevcut editör (rename/sil/taşı/chunk taşı) tip düzeyinde korunur; `moveSubToTopic(sid, null=>topicId üst düzeyi)` eski çıktının aynısını üretir.

- [ ] **Step 4: Commit**

```bash
git add components/topic-tree-editor.tsx
git commit -m "refactor: konu ağacı taşımasını saf moveNode + findParentId'e genelleştir"
```

---

### Task 3: `components/topic-suggestions.tsx` — öneri kartları (sunum)

**Files:**
- Create: `components/topic-suggestions.tsx`

**Interfaces:**
- Consumes: `TopicTree`, `TopicSubtopic`, `Suggestion` (`@/lib/api/pipeline`); `findParentId` (`@/components/topic-tree-editor`); `Button` (`@/components/ui/button`).
- Produces: `TopicSuggestions` bileşeni.
  ```ts
  interface Props {
    tree: TopicTree;
    suggestions: Suggestion[];
    onApply: (s: Suggestion) => void;
    onDismiss: (s: Suggestion) => void;
  }
  export function TopicSuggestions(props: Props): JSX.Element | null
  ```
- Sorumluluk: no-op filtresi (§5) + kart çizimi. AĞACI MUTASYONA UĞRATMAZ, yalnız `onApply`/`onDismiss` yayar.

- [ ] **Step 1: Bileşeni oluştur**

`components/topic-suggestions.tsx`:

```tsx
"use client";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { findParentId } from "@/components/topic-tree-editor";
import type { TopicTree, TopicSubtopic, Suggestion } from "@/lib/api/pipeline";

// id -> başlık haritası (konular + tüm alt başlıklar, herhangi derinlik).
function buildTitleMap(tree: TopicTree): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (subs: TopicSubtopic[]) => {
    for (const s of subs) {
      map.set(s.id, s.title);
      walk(s.subtopics ?? []);
    }
  };
  for (const t of tree.topics) {
    map.set(t.id, t.title);
    walk(t.subtopics);
  }
  return map;
}

// §5: "olduğu yere taşı" (etkisiz) veya "zaten üst-düzeyde" önerileri gizle.
function isNoop(tree: TopicTree, s: Suggestion): boolean {
  const current = findParentId(tree, s.node_id);
  if (s.new_parent_id !== null && s.new_parent_id === current) return true;
  if (s.new_parent_id === null && current === null) return true;
  return false;
}

interface Props {
  tree: TopicTree;
  suggestions: Suggestion[];
  onApply: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
}

export function TopicSuggestions({ tree, suggestions, onApply, onDismiss }: Props) {
  const titleMap = useMemo(() => buildTitleMap(tree), [tree]);
  const visible = suggestions.filter((s) => !isNoop(tree, s));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
      <div className="text-sm font-semibold text-blue-800">
        Ağaç önerileri ({visible.length})
      </div>
      {visible.map((s, i) => {
        const currentParentId = findParentId(tree, s.node_id);
        const currentLabel = currentParentId
          ? (titleMap.get(currentParentId) ?? currentParentId)
          : "konu üst-düzeyi";
        const targetLabel =
          s.new_parent_id === null
            ? "⬆ konu üst-düzeyine (terfi)"
            : (titleMap.get(s.new_parent_id) ?? s.new_parent_title ?? s.new_parent_id);
        return (
          <div
            key={`${s.node_id}:${s.new_parent_id ?? "root"}:${i}`}
            className="rounded-md border bg-white p-2 space-y-1 text-sm"
          >
            <div className="font-medium">{titleMap.get(s.node_id) ?? s.node_title}</div>
            <div className="text-xs text-gray-600">
              şu an: {currentLabel} <span className="mx-1">→</span> {targetLabel}
            </div>
            <div className="text-xs italic text-gray-500">{s.reason}</div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => onApply(s)}>Uygula</Button>
              <Button size="sm" variant="outline" onClick={() => onDismiss(s)}>Yoksay</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Tip + lint doğrula**

Run: `npx tsc --noEmit && npm run lint`
Expected: temiz. (Bileşen henüz bağlanmadı; import'lar çözülüyor mu diye bakar.)

- [ ] **Step 3: Commit**

```bash
git add components/topic-suggestions.tsx
git commit -m "feat: ağaç öneri kartları bileşeni (no-op filtreli, salt sunum)"
```

---

### Task 4: `topic-workspace.tsx` — "Önerileri Getir" + kartları bağla

**Files:**
- Modify: `components/topic-workspace.tsx`

**Interfaces:**
- Consumes: `reviewTopics`, `moveNode` (`@/components/topic-tree-editor`), `TopicSuggestions`, `Suggestion` tipi.
- Produces: (dış sözleşme yok — bu son bağlama task'ı.)

- [ ] **Step 1: Import'ları ekle**

`components/topic-workspace.tsx` üstünde:
- pipeline import satırına `reviewTopics` + `Suggestion` ekle:
  ```ts
  import { saveTopics, generateFromTopic, reviewTopics, type TopicTree, type TopicSubtopic, type Suggestion } from "@/lib/api/pipeline";
  ```
- editör import satırına `moveNode` ekle:
  ```ts
  import { TopicTreeEditor, moveNode } from "@/components/topic-tree-editor";
  ```
- yeni bileşen import'u:
  ```ts
  import { TopicSuggestions } from "@/components/topic-suggestions";
  ```

- [ ] **Step 2: Review state'i ekle**

`saveError` state'inin altına:

```ts
  const [reviewState, setReviewState] = useState<"idle" | "loading" | "error">("idle");
  const [reviewError, setReviewError] = useState("");
```

- [ ] **Step 3: `getSaveErrorMessage`'i genelleştir (DRY) + review handler'ları ekle**

`getSaveErrorMessage`'i fallback parametreli hale getir:

```ts
  function getPipelineErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError(err)) {
      const msg = err.response?.data?.error;
      if (typeof msg === "string" && msg) return msg;
    }
    return fallback;
  }
```

`handleSaveTree` içindeki çağrıyı güncelle:

```ts
      setSaveError(getPipelineErrorMessage(err, "Ağaç kaydedilemedi."));
```

`handleSaveTree`'in altına review + suggestion handler'larını ekle:

```ts
  async function handleReview() {
    try {
      setReviewState("loading");
      const reviewed = await reviewTopics(sourceId);
      onTreeChange(reviewed);
      setReviewState("idle");
    } catch (err) {
      setReviewError(getPipelineErrorMessage(err, "Öneriler alınamadı."));
      setReviewState("error");
    }
  }

  function handleApplySuggestion(s: Suggestion) {
    const next = moveNode(tree, s.node_id, s.new_parent_id, s.topic_id);
    next.suggestions = (tree.suggestions ?? []).filter((x) => x !== s);
    setSaveState("idle"); // ağaç değişti → kaydet banner'ını sıfırla
    onTreeChange(next);
  }

  function handleDismissSuggestion(s: Suggestion) {
    onTreeChange({ ...tree, suggestions: (tree.suggestions ?? []).filter((x) => x !== s) });
  }
```

- [ ] **Step 4: "Önerileri Getir" düğmesi + kartları render et**

Save button bloğunu ("Ağacı Kaydet" içeren `<div className="space-y-2">`) iki düğmeli hale getir ve altına öneri hata banner'ı + `<TopicSuggestions>` ekle. Bloğu şununla değiştir:

```tsx
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button variant="outline" disabled={saveState === "saving"} onClick={handleSaveTree}>
            {saveState === "saving" ? "Kaydediliyor..." : "Ağacı Kaydet"}
          </Button>
          <Button variant="outline" disabled={reviewState === "loading"} onClick={handleReview}>
            {reviewState === "loading"
              ? "Öneriler alınıyor..."
              : (tree.suggestions?.length ? "Önerileri Yenile" : "Önerileri Getir")}
          </Button>
        </div>
        {saveState === "saved" && (
          <div className="rounded-md bg-green-50 text-green-700 text-sm p-3">
            ✅ Ağaç kaydedildi.{" "}
            <button className="underline" onClick={() => router.push("/sources")}>
              Kaynaklarda gör
            </button>
          </div>
        )}
        {saveState === "error" && (
          <div className="rounded-md bg-red-50 text-red-700 text-sm p-3">{saveError}</div>
        )}
        {reviewState === "error" && (
          <div className="rounded-md bg-red-50 text-red-700 text-sm p-3">{reviewError}</div>
        )}
      </div>

      <TopicSuggestions
        tree={tree}
        suggestions={tree.suggestions ?? []}
        onApply={handleApplySuggestion}
        onDismiss={handleDismissSuggestion}
      />
```

- [ ] **Step 5: Tip + lint + build doğrula**

Run: `npx tsc --noEmit && npm run lint && npx next build`
Expected: hepsi temiz/başarılı. `/content` ve `/sources/[id]` route'ları TopicWorkspace'i kullanır → build üretilmeli.

- [ ] **Step 6: Commit**

```bash
git add components/topic-workspace.tsx
git commit -m "feat: konu ağacına Önerileri Getir + öneri kartlarını bağla (Uygula/Yoksay)"
```

---

### Task 5: Elle uçtan uca smoke (kullanıcı — canlı pipeline gerekir)

**Files:** yok (manuel doğrulama). Bu task, canlı pipeline + dev sunucu + auth gerektirdiği için KULLANICI ile yapılır; kod değişikliği içermez.

- [ ] **Step 1: Dev sunucu + pipeline ayakta, bir kaynağın Konu Ağacı ekranını aç** (spec örneği: kaynak `38c54d85`).
- [ ] **Step 2: "Önerileri Getir" → kartlar geliyor, no-op'lar görünmüyor** (canlı veride filtre sonrası ~48 öneri beklenir).
- [ ] **Step 3: Bir "TERFİ" kartında Uygula → düğüm konu üst-düzeyine çıkıyor, kart kayboluyor** (örn. "YARARLI CEMİYETLER" → "ZARARLI CEMİYETLER"den çıkıp üst-düzeye).
- [ ] **Step 4: Bir "TAŞIMA" kartında Uygula → düğüm doğru parent altına giriyor** (örn. "Rauf (Orbay)" → "KİMDİR?" altına).
- [ ] **Step 5: Yoksay → kart kayboluyor, ağaç değişmiyor.**
- [ ] **Step 6: "Ağacı Kaydet" → PUT başarılı; sayfa yeniden yüklenince taşıma kalıcı.**
- [ ] **Step 7: Pipeline kapalıyken "Önerileri Getir" → panel hata banner'ı gösteriyor, çökmüyor** (proxy 502 → "Öneriler alınamadı." veya upstream mesajı).

---

## Notlar (uygulayan için)

- **moveNode konumu (spec §6.3 kararı):** Spec (a)/(b) seçeneklerini sunup implementer'a bırakıyor. Bu plan üçüncü ama en temiz yolu seçti: `moveNode`/`findParentId` `topic-tree-editor.tsx`'te **module-level export saf fonksiyonlar** (dosyadaki mevcut `collectLeaves` deseniyle tutarlı). Workspace + suggestions bunları düz import eder — ref API/callback zinciri yok, taşıma mantığı tek dosyada. Editörün kendi `moveSubToTopic`'i de aynı çekirdeği kullanır (DRY).
- **Review edits'i ezme:** `reviewTopics` backend'in sakladığı ağacı döndürür ve `onTreeChange` ile workspace state'ini set eder. Spec §4 bunu böyle modelliyor; kaydedilmemiş yerel düzenleme varken "Önerileri Getir" onları backend hâlini getirmekle değiştirebilir — spec kapsamı bu; ek "önce kaydet" davranışı EKLENMEZ (YAGNI).
- **Kaydet'te suggestions temizliği:** Zorunlu değil (spec §6.5). `PUT` ağacın tamamını gönderir, backend `suggestions`'ı yeniden yazar. Uygulanmadı; istenirse ayrı küçük iş.
