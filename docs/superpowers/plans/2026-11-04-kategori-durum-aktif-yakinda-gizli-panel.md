# Kategori Durumu (Aktif / Yakında / Gizli) — Panel Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin panelde kategori/ders tablosuna üç durumlu (Aktif/Yakında/Gizli) bir durum sütunu eklemek; adminin her kategoriyi tek tıkla yönetebilmesini, ebeveyn kısıtlamasının (üst kategori gizli/yakındaysa) görünür olmasını ve yıkıcı geçişlerde (Aktif'ten düşürme) onay istenmesini sağlamak.

**Architecture:** Üç katman, görev sırası bunu izliyor: veri katmanı (tip + API client + hook) → saf hesaplama (`lib/categoryTree.ts`, etkin durum) → ekran (`app/(admin)/categories/page.tsx`: durum sütunu, rozet, onay akışı). Mevcut mimari korunuyor: ekran yalnız hook'u çağırır, hook yalnız `lib/api`'yi, `lib/api` yalnız `apiClient`'ı tanır.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19 client components (`"use client"`), TanStack Query v5, axios, `@base-ui/react` Select primitive (`components/ui/select.tsx`), yerel `components/ui/badge.tsx`, `components/shared/ConfirmDialog.tsx`, `sonner` toast.

**Spec:** `docs/superpowers/specs/2026-11-03-kategori-durum-aktif-yakinda-gizli-panel-design.md`
**Backend ikizi:** `KpssSoru-backend/docs/superpowers/specs/2026-11-03-kategori-durum-aktif-yakinda-gizli-design.md`

## Global Constraints

- **Backend'e dokunulmaz.** Backend ayrı bir oturumun/ajanın kapsamı; bu planda backend reposunda commit yok. Kapsam yalnız panel.
- **Çıkış sırası panel → backend** (spec §8). Panel backend'den önce deploy edilebilir; bu yüzden `publishState` alanı yanıtta gelmeyebilir.
- **`publishState` `undefined` olabilir.** Bu durumda durum `Select`'i "—" placeholder'ıyla devre dışı gösterilir, hata fırlatılmaz, amber rozet çıkmaz (spec §6.3).
- **Yeni kategori oluşturma formuna durum seçimi eklenmiyor** (spec §7) — backend varsayılan Gizli ile oluşturuyor, admin sonradan tablodan değiştirir.
- **Toplu durum değiştirme yok** (spec §7).
- **`hasSubCategories` / alt-kategorili silme engeli eklenmiyor** — backend'de böyle bir kısıtlama yok, bu iş de eklemiyor (spec §5, §7).
- **Onay yalnız Aktif'ten düşerken istenir.** Aktif → Yakında/Gizli: `ConfirmDialog`. Diğer tüm geçişler (Yakında/Gizli → Aktif, Gizli ↔ Yakında): anında, onaysız (spec §6.2).
- Arayüz metinleri Türkçe ve spec'teki ifadeler **aynen** kullanılır.
- Commit mesajlarına **`Co-Authored-By` satırı eklenmez** (proje kuralı).
- Bu iş "büyük/çok adımlı" olarak işaretlendi: TDD'nin önce-test akışı yerine, test/doğrulama en sona bırakılıyor (bkz. aşağıdaki Doğrulama Yöntemi).

## Doğrulama Yöntemi — önce okunmalı

**Bu repoda test koşucusu yok.** `package.json` script'leri yalnız `dev`, `build`, `start`, `lint`; `*.test.*` dosyası sıfır (ölçüldü: `find . -iname "*.test.*"` boş döndü). Yeni bir test altyapısı (vitest/RTL) kurmak bu işin kapsamında değil — mevcut alışkanlık korunuyor. Bu yüzden her görev TDD'nin "önce başarısız test" döngüsü yerine şu üç kapıyla kapanıyor:

1. `npx tsc --noEmit` — **taban çizgisi ölçüldü: çıkış 0, hiç hata yok.** Her görev sonunda hâlâ 0 olmalı.
2. `npm run lint` — **taban çizgisi ölçüldü: 0 hata, 3 uyarı** (`questions/[id]/page.tsx` React Compiler uyarısı, `ImportSheet.tsx` ve `lib/api/client.ts`'te `window.location.href` uyarısı). Bu üçü bu işten önce de vardı, bu işle ilgisiz; sayı 3'ün üstüne çıkmadıkça kapı açık.
3. Tarayıcı kontrolü — her görevde tıklama yolu ve beklenen gözlem yazılı. `npm run dev` ile `/categories` sayfası üzerinden elle doğrulanır.

Vitest + React Testing Library kurmak istenirse ayrı bir iş olarak konuşulmalı; bu plan mevcut doğrulama alışkanlığını sürdürüyor.

**Backend henüz çıkmadı**, bu yüzden görevlerin tarayıcı kontrolleri iki gruba ayrılıyor:

| Şimdi doğrulanabilir | Backend çıkınca doğrulanabilir |
|---|---|
| `publishState` gelmediğinde Select'in "—" ile pasif görünmesi | Gerçek durum değişikliğinin tabloya yansıması |
| Select'in üç seçeneği (Aktif/Yakında/Gizli) doğru render etmesi | `POST /admin/categories/{id}/state` isteğinin gerçek gönderilmesi |
| Onay diyaloğunun metni, Aktif'ten düşerken çıkması | Ebeveyn rozetinin gerçek iç içe kategori verisiyle doğru çıkması |
| Onay iptalinde Select'in eski değerde kalması (mock veriyle) | — |

Şimdilik `useCategories()`'in döndürdüğü veriye geçici olarak `publishState` eklemeden (backend yoksa gerçek API `undefined` dönecek) elle test etmek için **React Query Devtools** üzerinden cache'e geçici veri enjekte etmek yerine, bu görevlerin tarayıcı adımlarında olduğu gibi gerçek API yanıtını gözlemlemek yeterli — `publishState` alanı hiç gelmezse zaten "—" davranışı tetiklenir, bu da gerçek (backend öncesi) senaryo.

## Review Focus

Spec'in ima ettiği ama hiçbir bölümünün açıkça yazmadığı, admini en çok ısıracak beş durum. Her biri aşağıda sahibi olan görevde bir doğrulama adımıyla sabitlendi:

1. **Çok seviyeli ebeveyn zinciri** (torun kategori, büyükebeveyn Gizli/Yakında, ara ebeveyn Aktif) → `effectiveState` yalnız bir seviye yukarı bakarsa yanlış sonuç verir. Beklenen: zincir özyinelemeli olarak en kısıtlayıcıya iner. (Görev 2, Adım 4)
2. **Parent referansı var ama listede bulunamıyor** (`parentCategoryId` dolu, `all` içinde eşleşen yok — örn. filtrelenmiş/sayfalanmış veri) → çökme riski. Beklenen: kendi `publishState`'ini döndürür, atmaz. (Görev 2, Adım 4)
3. **Onay diyaloğu "İptal" ile kapatılırsa** → Select görünür değeri eski haline dönmeli VE `setCategoryPublishState` hiç çağrılmamalı. Beklenen: hiçbir ağ isteği atılmaz (bu plan hiçbir yerel/optimistic state tutmayarak bunu by design sağlıyor — Görev 3, Adım 6). (Görev 3, Adım 7)
4. **`publishState` `undefined` (backend henüz yok)** → Select "—" ile pasif, amber rozet çıkmaz, sayfa çökmez. Beklenen: `effectiveState` çağrısı `RANK[undefined]` ile de atmaz (JS karşılaştırması `false` döner, fonksiyon kendi durumunu döndürür). (Görev 2, Adım 4 + Görev 3, Adım 7)
5. **Yükseltme yönü onay istemeden uygulanmalı** (Yakında/Gizli → Aktif, Gizli ↔ Yakında) → yanlışlıkla her geçişte onay istenirse admin işi yavaşlar ve spec'in asimetrisi bozulur. Beklenen: yalnız `cat.publishState === "Active" && nextState !== "Active"` onay ister. (Görev 3, Adım 7)

---

### Task 1: Veri katmanı — tip, API client, hook

Spec §3 + §4. Üçü tek görevde çünkü `setCategoryPublishState`'in imzası (`CategoryPublishState`) tip katmanından geliyor ve hook doğrudan bu imzayı sarıyor — ayırmak, ortadaki API fonksiyonunu kendi başına anlamsız bir ara adım yapardı.

**Files:**
- Modify: `lib/types.ts:33-38` (`AdminCategory` interface'i)
- Modify: `lib/api/categories.ts`
- Modify: `lib/hooks/useCategories.ts`

**Interfaces:**
- Consumes: mevcut `apiClient` (`lib/api/client.ts`), mevcut `AdminCategory` alanları (`id`, `name`, `parentCategoryId`, `parentCategoryName`, `activeQuestionCount`).
- Produces:
  - `type CategoryPublishState = "Hidden" | "ComingSoon" | "Active"`
  - `AdminCategory.publishState: CategoryPublishState` (yeni alan; backend henüz çıkmadıysa runtime'da gerçekte `undefined` gelebilir — spec §6.3, tip bunu yansıtmıyor çünkü backend sözleşmesi bunu garanti ediyor, geçiş dönemi ayrıca ele alınıyor)
  - `setCategoryPublishState(id: string, state: CategoryPublishState): Promise<AdminCategory>`
  - `useSetCategoryPublishState(): UseMutationResult<AdminCategory, unknown, { id: string; state: CategoryPublishState }>`

- [ ] **Step 1: `AdminCategory` tipine `publishState` ekle ve `CategoryPublishState` tipini tanımla**

`lib/types.ts` içindeki `AdminCategory` interface'ini (satır 33-38) bununla değiştir:

```ts
export type CategoryPublishState = "Hidden" | "ComingSoon" | "Active";

export interface AdminCategory {
  id: string;
  name: string;
  parentCategoryId?: string;
  parentCategoryName?: string;
  activeQuestionCount: number;
  publishState: CategoryPublishState;
}
```

- [ ] **Step 2: `setCategoryPublishState` API fonksiyonunu ekle**

`lib/api/categories.ts`'e, mevcut importa `CategoryPublishState`'i ekleyip dosyanın sonuna ekle:

```ts
export async function setCategoryPublishState(
  id: string,
  state: CategoryPublishState
): Promise<AdminCategory> {
  const { data } = await apiClient.post<AdminCategory>(
    `/admin/categories/${id}/state`,
    { state }
  );
  return data;
}
```

- [ ] **Step 3: `useSetCategoryPublishState` hook'unu ekle**

`lib/hooks/useCategories.ts`'e, mevcut diğer mutation hook'larıyla aynı desende ekle:

```ts
export function useSetCategoryPublishState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: CategoryPublishState }) =>
      setCategoryPublishState(id, state),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}
```

İlgili import'u (`setCategoryPublishState`, `CategoryPublishState`) dosyanın üstüne ekle.

- [ ] **Step 4: Doğrula**

Komutlar:
```bash
npx tsc --noEmit
npm run lint
```
Beklenen: ikisi de taban çizgiyle aynı (0 hata / 0 hata+3 uyarı). Bu görev yalnız tip ve veri katmanı olduğu için tarayıcı kontrolü yok — ekranda henüz kullanılmıyor.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/api/categories.ts lib/hooks/useCategories.ts
git commit -m "feat: kategori durumu için tip, API client ve hook ekle"
```

---

### Task 2: Etkin durum hesaplama — `lib/categoryTree.ts`

Spec §5. Saf fonksiyon, ekran kodundan bağımsız; kendi başına doğrulanabilir tek görev.

**Files:**
- Create: `lib/categoryTree.ts`

**Interfaces:**
- Consumes: `AdminCategory`, `CategoryPublishState` (Görev 1).
- Produces: `effectiveState(cat: AdminCategory, all: AdminCategory[]): CategoryPublishState` — Görev 3'ün rozet ve onay mantığı bunu çağırır.

- [ ] **Step 1: `effectiveState`'i spec'teki algoritmayla birebir yaz**

`lib/categoryTree.ts`:

```ts
import type { AdminCategory, CategoryPublishState } from "@/lib/types";

const RANK: Record<CategoryPublishState, number> = { Hidden: 0, ComingSoon: 1, Active: 2 };

/** Kendi durumu + (varsa) ebeveyninin etkin durumunun en kısıtlayıcısı. */
export function effectiveState(
  cat: AdminCategory,
  all: AdminCategory[]
): CategoryPublishState {
  if (!cat.parentCategoryId) return cat.publishState;
  const parent = all.find((c) => c.id === cat.parentCategoryId);
  if (!parent) return cat.publishState;
  const parentEffective = effectiveState(parent, all);
  return RANK[parentEffective] < RANK[cat.publishState] ? parentEffective : cat.publishState;
}
```

- [ ] **Step 2: Doğrula — tip ve lint**

```bash
npx tsc --noEmit
npm run lint
```
Beklenen: taban çizgiyle aynı.

- [ ] **Step 3: Elle doğrula (Review Focus #1, #2, #4) — geçici `console.log` ile**

Dev server'da herhangi bir sayfa bileşeninde (örn. `/categories` sayfasının en üstüne geçici olarak) aşağıdakini çalıştırıp konsolu kontrol et, sonra kaldır:

```ts
const a: AdminCategory = { id: "1", name: "A", activeQuestionCount: 0, publishState: "Active" };
const b: AdminCategory = { id: "2", name: "B", parentCategoryId: "1", activeQuestionCount: 0, publishState: "Active" };
const c: AdminCategory = { id: "3", name: "C", parentCategoryId: "2", activeQuestionCount: 0, publishState: "Active" };
console.log(effectiveState(c, [a, b, c])); // "Active" — hepsi aktif
console.log(effectiveState(c, [{ ...a, publishState: "Hidden" }, b, c])); // "Hidden" — büyükebeveyn gizli, 2 seviye yukarı doğru taşınmalı
console.log(effectiveState(b, [a, b])); // ebeveyn ("1") `all` içinde var, normal
console.log(effectiveState({ ...b, parentCategoryId: "yok-boyle-id" }, [a, b])); // kendi durumu, atmamalı
```

Beklenen: üçüncü satır büyükebeveynin durumunu iki seviye yukarıdan doğru taşıyor, dördüncü satır çökmeden kendi `publishState`'ini döndürüyor.

- [ ] **Step 4: Commit**

```bash
git add lib/categoryTree.ts
git commit -m "feat: kategoriler için ebeveyn zincirine göre etkin durum hesapla"
```

---

### Task 3: Ekran — durum sütunu, ebeveyn rozeti, onay akışı

Spec §6. Önceki iki görevin ürettiği hook ve fonksiyonu `app/(admin)/categories/page.tsx`'e bağlar.

**Files:**
- Modify: `app/(admin)/categories/page.tsx`

**Interfaces:**
- Consumes: `useSetCategoryPublishState()` (Görev 1), `effectiveState()` (Görev 2), mevcut `ConfirmDialog`, `Badge` (`components/ui/badge.tsx`), `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` (`components/ui/select.tsx`).
- Produces: ekran değişikliği, başka görev tüketmiyor.

- [ ] **Step 1: Import'ları ekle**

`useSetCategoryPublishState` (`@/lib/hooks/useCategories`), `effectiveState` (`@/lib/categoryTree`), `Badge` (`@/components/ui/badge`), `CategoryPublishState` tipi (`@/lib/types`) importlarını dosyanın üstüne ekle.

- [ ] **Step 2: Bekleyen değişiklik state'i ve mutation'ı tanımla**

Bileşenin en üstüne, mevcut `deleteTarget` state'inin yanına:

```ts
const setStateMutation = useSetCategoryPublishState();
const [pendingChange, setPendingChange] = useState<{ cat: AdminCategory; nextState: CategoryPublishState } | null>(null);
```

- [ ] **Step 3: Geçiş etiketlerini ve metinlerini üreten yardımcılar**

Bileşen içinde (veya dosyanın üstünde, bileşen dışında — state'e ihtiyaç duymuyor):

```ts
const STATE_LABEL: Record<CategoryPublishState, string> = { Active: "Aktif", ComingSoon: "Yakında", Hidden: "Gizli" };

function needsConfirm(current: CategoryPublishState, next: CategoryPublishState): boolean {
  return current === "Active" && next !== "Active";
}

function downgradeDescription(cat: AdminCategory, next: CategoryPublishState): string {
  const noun = cat.parentCategoryId ? "ders" : "kategori";
  const verb = next === "Hidden" ? "tamamen kaybolur" : "tıklanamaz hale gelir";
  return `Bu ${noun} şu an canlıda kullanıcılara görünüyor. ${STATE_LABEL[next]} yaparsan hemen ${verb}. Devam edilsin mi?`;
}
```

(`noun` seçimi spec'te açık bırakılmış; üst kategorisi olmayanlar "kategori", alt kategoriler "ders" olarak adlandırılıyor — mobil/panel genelindeki iki seviyeli isimlendirmeyle tutarlı.)

- [ ] **Step 4: Durum değişikliği işleyicisi**

```ts
function handleStateChange(cat: AdminCategory, nextState: CategoryPublishState) {
  if (needsConfirm(cat.publishState, nextState)) {
    setPendingChange({ cat, nextState });
    return;
  }
  applyStateChange(cat.id, nextState);
}

async function applyStateChange(id: string, nextState: CategoryPublishState) {
  try {
    await setStateMutation.mutateAsync({ id, state: nextState });
    toast.success("Durum güncellendi");
  } catch {
    toast.error("Durum güncellenemedi");
  }
}
```

`applyStateChange` lokal state tutmuyor — `Select`'in `value`'su doğrudan `cat.publishState`'ten (React Query cache) okunduğu için, onay iptal edilip mutation hiç çağrılmazsa görünen değer zaten değişmemiş olur (Review Focus #3).

- [ ] **Step 5: Tabloya "Durum" sütununu ekle**

`TableHeader`'daki mevcut dört `TableHead`'e, "Aksiyonlar"dan önce ekle:
```tsx
<TableHead>Durum</TableHead>
```

Her `TableRow` içine, "Aktif Soru" hücresinden sonra, "Aksiyonlar" hücresinden önce:

```tsx
<TableCell>
  <div className="flex items-center gap-2">
    <Select
      items={(Object.keys(STATE_LABEL) as CategoryPublishState[]).map((s) => ({ value: s, label: STATE_LABEL[s] }))}
      value={cat.publishState ?? ""}
      disabled={cat.publishState == null}
      onValueChange={(v) => v && handleStateChange(cat, v as CategoryPublishState)}
    >
      <SelectTrigger size="sm">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATE_LABEL) as CategoryPublishState[]).map((s) => (
          <SelectItem key={s} value={s}>{STATE_LABEL[s]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    {cat.publishState != null && effectiveState(cat, categories) !== cat.publishState && (
      <Badge
        className="bg-amber-100 text-amber-800 hover:bg-amber-100"
        title={`Üst kategori ${effectiveState(cat, categories) === "Hidden" ? "gizli" : "yakında"} olduğu için bu ders mobilde ${effectiveState(cat, categories) === "Hidden" ? "görünmüyor" : "tıklanamıyor"}.`}
      >
        {effectiveState(cat, categories) === "Hidden" ? "Ebeveyn gizli" : "Ebeveyn yakında"}
      </Badge>
    )}
  </div>
</TableCell>
```

`colSpan={4}` olan boş-liste satırını `colSpan={5}` yap (sütun sayısı arttı).

- [ ] **Step 6: Onay diyaloğunu ekle**

Mevcut silme `ConfirmDialog`'unun yanına, ikinci bir `ConfirmDialog`:

```tsx
<ConfirmDialog
  open={!!pendingChange}
  title="Durumu Değiştir"
  description={pendingChange ? downgradeDescription(pendingChange.cat, pendingChange.nextState) : ""}
  onConfirm={() => {
    if (pendingChange) applyStateChange(pendingChange.cat.id, pendingChange.nextState);
    setPendingChange(null);
  }}
  onCancel={() => setPendingChange(null)}
  confirmLabel="Devam Et"
/>
```

- [ ] **Step 7: Doğrula**

Komutlar:
```bash
npx tsc --noEmit
npm run lint
```
Beklenen: taban çizgiyle aynı.

Tarayıcıda (`npm run dev`, `/categories`):
1. Durum sütunu görünüyor, her satırda üç seçenekli bir `Select` var.
2. `publishState` backend'den gelmiyorsa (bugünkü durum — backend henüz çıkmadı): Select "—" gösterip pasif, sayfa çökmüyor, amber rozet hiçbir satırda çıkmıyor. **(Review Focus #4)**
3. (Backend çıktıktan sonra tekrar doğrulanacak, şimdilik mock/manuel veriyle React DevTools'tan kontrol edilebilir:) Aktif bir satırı Yakında veya Gizli'ye çekince onay diyaloğu açılıyor, metinde doğru isim (kategori/ders) ve doğru fiil (tamamen kaybolur/tıklanamaz hale gelir) geçiyor. **(Review Focus #5)**
4. Onay diyaloğunda "İptal"e basınca Select eski değerinde kalıyor, Network sekmesinde hiç `/state` isteği gitmiyor. **(Review Focus #3)**
5. Yakında/Gizli → Aktif veya Gizli ↔ Yakında geçişlerinde onay diyaloğu hiç açılmıyor, istek anında gidiyor.

- [ ] **Step 8: Commit**

```bash
git add "app/(admin)/categories/page.tsx"
git commit -m "feat: kategoriler tablosuna durum sütunu, ebeveyn rozeti ve onay akışı ekle"
```

---

## Self-Review Notu

- **Spec kapsaması:** §3 tip (Görev 1), §4 API+hook (Görev 1), §5 etkin durum (Görev 2), §6.1 sütun+rozet (Görev 3 Adım 5), §6.2 onay asimetrisi (Görev 3 Adım 3-4, 6), §6.3 backend-yok durumu (Görev 3 Adım 5, 7), §7 kapsam dışı maddeler (Global Constraints'te negatif olarak listelendi, kodda hiç karşılığı yok — doğru), §8 çıkış sırası (Doğrulama Yöntemi tablosu). Hepsi karşılanıyor.
- **Tip tutarlılığı:** `CategoryPublishState`, `effectiveState`, `useSetCategoryPublishState` isimleri Görev 1-3 boyunca aynı kullanıldı.
- **Oran:** Plan spec'ten (150 satır) daha uzun ama spec'in kendisi kod örnekleri içeriyor ve bu kod örnekleri birebir taşınıyor (spec'in "pinned" kodu) — icat edilen kısım yalnız Görev 3'teki JSX bağlama kodu.

---

Plan tamamlandı ve `docs/superpowers/plans/2026-11-04-kategori-durum-aktif-yakinda-gizli-panel.md`'e kaydedildi.
