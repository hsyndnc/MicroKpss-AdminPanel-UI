# Kategori durumu (Aktif / Yakında / Gizli) — panel tasarımı

**Tarih:** 2026-11-03
**Backend ikizi:** `KpssSoru-backend/docs/superpowers/specs/2026-11-03-kategori-durum-aktif-yakinda-gizli-design.md`
**Durum:** spec yazıldı, kod yazılmadı

## 1. Neden panel işi

Mobil ana sayfadaki kategori/ders listesinde henüz içeriği hazır olmayan
dersler de görünüp tıklanabiliyor. Backend her kategoriye üç durumlu bir
`PublishState` (Hidden/ComingSoon/Active) ekliyor; panel bu durumu
**görüntüleyip değiştirebilen tek arayüz** — admin elle yönetmezse her yeni
kategori varsayılan Gizli kalır ve mobilde hiç görünmez.

## 2. Bugünkü durum — ölçüldü

| Dosya | Bugün |
|---|---|
| `app/(admin)/categories/page.tsx` | Tek tablo: İsim, Üst Kategori, Aktif Soru, Aksiyonlar (Düzenle/Sil). **Yayın/durum sütunu yok.** |
| `lib/types.ts:33-39` | `AdminCategory { id, name, parentCategoryId?, parentCategoryName?, activeQuestionCount }` — durum alanı yok |
| `lib/api/categories.ts` | `getAdminCategories`, `createCategory`, `updateCategory`, `deleteCategory` — hepsi `/admin/categories[...]` |
| `lib/hooks/useCategories.ts` | React Query, tek query key `["admin-categories"]`, 3 mutation hook |
| `feature/kategori-yayin-bayragi` dalı | Hiç merge edilmemiş; `CategoryPublishBadge.tsx` (yeşil "Yayında"/gri "Gizli" rozeti) ve `lib/categoryTree.ts` (`isParentHidden`, `hasSubCategories`) dosyaları **sadece o dalda var**, main'de yok. İkili (`isPublished: bool`) tasarımdı — bu iş üç durumlu, doğrudan taşınmıyor, yalnız ilham kaynağı. |

## 3. Tip katmanı

```ts
export type CategoryPublishState = "Hidden" | "ComingSoon" | "Active";

export interface AdminCategory {
  id: string;
  name: string;
  parentCategoryId?: string;
  parentCategoryName?: string;
  activeQuestionCount: number;
  publishState: CategoryPublishState; // YENİ
}
```

## 4. API client + hook

Eski dalın ikili `publishCategory`/`unpublishCategory` çifti yerine tek
fonksiyon (backend'in tek `POST /admin/categories/{id}/state` ucuna uyar):

```ts
// lib/api/categories.ts
export async function setCategoryPublishState(
  id: string, state: CategoryPublishState,
): Promise<AdminCategory> {
  const { data } = await apiClient.post<AdminCategory>(
    `/admin/categories/${id}/state`, { state },
  );
  return data;
}
```

```ts
// lib/hooks/useCategories.ts
export function useSetCategoryPublishState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: CategoryPublishState }) =>
      setCategoryPublishState(id, state),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
  });
}
```

## 5. `lib/categoryTree.ts` — etkin durum hesaplama

Backend'in "etkin durum = kendisi + tüm atalarının en kısıtlayıcısı"
kuralı panelde de lazım (admin "Aktif" yazan bir derse baktığında, üst
kategorisi Gizliyse bunun mobilde yine de görünmediğini bilmeli — eski
dalın `isParentHidden` fikrinin üç duruma genişletilmiş hâli):

```ts
const RANK: Record<CategoryPublishState, number> = { Hidden: 0, ComingSoon: 1, Active: 2 };

/** Kendi durumu + (varsa) ebeveyninin etkin durumunun en kısıtlayıcısı. */
export function effectiveState(
  cat: AdminCategory, all: AdminCategory[],
): CategoryPublishState {
  if (!cat.parentCategoryId) return cat.publishState;
  const parent = all.find((c) => c.id === cat.parentCategoryId);
  if (!parent) return cat.publishState;
  const parentEffective = effectiveState(parent, all);
  return RANK[parentEffective] < RANK[cat.publishState] ? parentEffective : cat.publishState;
}
```

`hasSubCategories()` (silme engeli) bu işin kapsamında değil — backend'de o
kısıtlama hiç yok (bkz. backend spec'in "bugünkü durum" tablosu), ayrı/ilgisiz
bir konu, burada da eklenmiyor.

## 6. Ekran — `app/(admin)/categories/page.tsx`

### 6.1 Yeni "Durum" sütunu

Mevcut dört sütuna ("İsim", "Üst Kategori", "Aktif Soru", "Aksiyonlar")
ek, "Aksiyonlar"dan önce:

- Üç değerli `Select` (Aktif/Yakında/Gizli), satırın kendi `publishState`'i
  seçili. Değişiklik anında `useSetCategoryPublishState().mutate(...)`
  tetikler — ayrı bir "Kaydet" düğmesi yok (mevcut panelde publish/unpublish
  de tek tıkla anlıktı, aynı dil korunuyor).
- Hemen yanında, yalnız `effectiveState(cat, categories) !== cat.publishState`
  ise amber bir rozet: *"Ebeveyn gizli"* (etkin durum Hidden) veya
  *"Ebeveyn yakında"* (etkin durum ComingSoon) — `title` ile açıklama:
  "Üst kategori [durum] olduğu için bu ders mobilde [görünmüyor/tıklanamıyor]."

### 6.2 Aktif → Yakında/Gizli geçişi onay ister

Mevcut davranışta (ölü dalda da) "yayından kaldırma" yıkıcıydı (anında
gerçek kullanıcılardan içerik gizleniyor), "yayınlama" anlıktı. Aynı asimetri
üç durumda da korunur:

- **Aktif'ten Yakında veya Gizli'ye düşürme:** `ConfirmDialog` açılır —
  *"Bu [kategori/ders] şu an canlıda kullanıcılara görünüyor. [Yakında/Gizli]
  yaparsan hemen [tıklanamaz hale gelir / tamamen kaybolur]. Devam edilsin
  mi?"* Onaylanmazsa `Select` eski değerine döner.
- **Yakında/Gizli → Aktif, veya Gizli ↔ Yakında arası:** Onay sormadan
  anında uygulanır — hiçbiri şu an canlıda görünür içerik olmadığı için
  riski yok.

### 6.3 Backend alanı henüz yoksa

Panel backend'den önce deploy edilirse `publishState` alanı yanıtta
gelmeyebilir (`undefined`). Bu durumda `Select` "—" placeholder'ıyla
devre dışı gösterilir (eski dalın `isPublished === undefined` davranışıyla
aynı mantık), hata fırlatılmaz.

## 7. Kapsam dışı

- Yeni kategori oluşturma formuna durum seçimi **eklenmiyor** — backend
  varsayılan olarak Gizli ile oluşturuyor (bkz. backend spec madde 3),
  admin oluşturduktan sonra tablodan durumu değiştirir. İki adımlı ama
  "yanlışlıkla Aktif kategori oluşturma" riskini sıfırlıyor.
- Toplu durum değiştirme (çoklu seçim) yok.
- `hasSubCategories` / alt-kategorili silme engeli: backend'de olmadığı
  için panelde de eklenmiyor (bkz. bölüm 5).

## 8. Çıkış sırası

Backend spec'indeki sırayla aynı: **panel → backend**. Panel önce çıkarsa
`publishState` alanı gelmez, `Select` "—" ile pasif görünür (bölüm 6.3),
hiçbir şey kırılmaz. Backend önce çıkarsa panel hâlâ eski `AdminCategory`
tipini bekler — TypeScript derlemesi etkilenmez, yalnızca yeni alan
UI'da gösterilmeden durur (zararsız, ama pratikte ikisini birlikte
deploy etmek daha temiz).
