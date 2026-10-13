# Açık Rıza Metni + Onay Kaydı — Panel Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yasal metin yönetimini "üzerine yaz"dan "sürüm yayınla"ya çevirmek, dördüncü belge türü olarak açık rıza metnini eklemek ve kullanıcı detayında onay kaydını kanıt olarak gösterilebilir hâle getirmek.

**Architecture:** Değişiklik üç katmanda ilerliyor ve katman sırası görev sırasını belirliyor: tip katmanı (`lib/types.ts`) → veri katmanı (`lib/api/*`, `lib/hooks/*`) → iki ekran (`app/(admin)/legal/page.tsx` ve `app/(admin)/users/_components/UserDetailSheet.tsx`). Mevcut mimari korunuyor: ekran yalnız hook'u, hook yalnız `lib/api`'yi, `lib/api` yalnız `apiClient`'ı tanıyor; ekranlardan doğrudan `lib/api` çağrısı yapılmıyor. Yeni paylaşılan iki küçük modül doğuyor (`lib/legalLabels.ts`, `lib/format.ts`) çünkü belge etiketleri ve tarih biçimlendirmesi artık iki ekranda birden kullanılıyor.

**Tech Stack:** Next.js 16.3.4 (App Router, Turbopack), React client components (`"use client"`), TanStack Query v5, axios, date-fns v4 + `tr` locale, Tailwind, shadcn tarzı yerel `components/ui` (`alert-dialog`, `dialog`, `sheet`, `skeleton`, `button`), `sonner` toast.

**Spec:** `docs/superpowers/specs/2026-10-04-acik-riza-onay-kaydi-panel-design.md`
**Backend ikizi:** `KpssSoru-backend/docs/superpowers/specs/2026-10-04-acik-riza-onay-kaydi-design.md`

## Global Constraints

- **Backend'e dokunulmaz.** `KpssSoru-backend` ayrı bir ajanın kapsamı; bu planda commit/merge/push yok. Kapsam yalnız panel.
- **Çıkış sırası panel → backend.** Panel önce çıkabilir; backend önce çıkarsa yasal metin kaydetme `400` ile tamamen kırılır (spec §7).
- **`requiresReconsent` yalnız gönderilir, geri okunmaz.** Yanıt tipine eklenmez (spec §3).
- **Varsayılan yok:** `requiresReconsent` için ne `true` ne `false` ön seçili olabilir; "cevaplanmadı" ayrı bir hâl (spec §4.4).
- **Append-only:** silme yok, üzerine yazma yok. Düğme metni "Yeni sürüm yayınla" (spec §4.3).
- **Markdown önizleme eklenmiyor**, mevcut `textarea` korunuyor (spec §6).
- **Belge sürüm geçmişini gezme ekranı yapılmıyor** — onay satırı sürüm numarasını taşıyor, metin o numarayla çekiliyor (spec §5, §6).
- **Metnin içeriği panelde yazılmıyor**; ilk açık rıza metni backend'de seed ile doğuyor.
- Arayüz metinleri Türkçe ve spec'teki ifadeler **aynen** kullanılıyor (özellikle §4.5 diyalog metni ve §4.6 yarış mesajı).
- Commit mesajlarına **`Co-Authored-By` satırı eklenmez** (proje kuralı).
- Next.js 16 kontrolü yapıldı: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` ve `06-fetching-data.md` istemci bileşeni + TanStack Query desenini açıkça destekliyor, bu işi etkileyen bir deprecation yok. Yeni bir dosya `"use client"` gerektirirse direktif dosyanın en üstüne, import'ların üstüne yazılır.

## Doğrulama Yöntemi — önce okunmalı

**Bu repoda test koşucusu yok.** `package.json` script'leri yalnız `dev`, `build`, `start`, `lint`; `*.test.*` dosyası sıfır. Bu yüzden görevler TDD döngüsü yerine şu kapıyı kullanıyor ve her görev bu üçüyle kapanıyor:

1. `npx tsc --noEmit` — **bu planın başlangıcında temiz (çıkış 0), öyle kalmalı.**
2. `npm run lint` — yeni uyarı/hata çıkmamalı. **Taban çizgisi ölçüldü: 0 hata, 3 uyarı** (`lib/api/client.ts` ve `ImportSheet.tsx`'te `window.location.href`, `QuestionEditSheet`'te react-hook-form `watch`). Bu üçü bu işten önce de vardı; sayı 3'ün üstüne çıkmadıkça kapı açık.
3. Tarayıcı kontrolü — her görevde tıklama yolu ve beklenen gözlem yazılı. Dev server zaten `http://localhost:3000`'de çalışıyor; dal değiştirince aynı server yeni dalın kodunu servis eder.

Vitest + React Testing Library kurmak istenirse ayrı bir iş olarak konuşulmalı; bu plan mevcut doğrulama alışkanlığını (tarayıcıda elle kontrol) sürdürüyor.

**Backend henüz çıkmadı.** Bu yüzden görevlerin tarayıcı kontrolleri iki gruba ayrılıyor:

| Şimdi doğrulanabilir | Backend çıkınca doğrulanabilir |
|---|---|
| Dördüncü sekme görünüyor, seçilebiliyor | Sürüm numarasının doğru artması (1 → 2 → 3) |
| Seçim yapılmadan yayınla düğmesi pasif | `GET /legal/{type}` yanıtındaki `version` |
| Boş içerikte istek gitmiyor | Onay geçmişi satırları |
| Esaslı seçimde onay diyalogu çıkıyor | Sürüm metni diyaloğunun içeriği |
| Yayından sonra seçimin sıfırlanması | Yarış durumunda `400` → kurtarma akışı |

Eski backend'de `version` alanı dönmeyeceği için sürüm göstergesinde sayı yerine boş/`undefined` görülebilir ve `/admin/users/{id}/consents` olmadığı için onay geçmişi bölümü "yüklenemedi" hâlinde kalır. Bu beklenen ara durum; backend çıkınca ikinci kolon elden geçirilir.

## Review Focus

Spec'in ima ettiği ama hiçbir bölümünün açıkça yazmadığı, kullanıcıyı en çok ısıracak beş girdi. Her biri aşağıda sahibi olan görevde adı geçen bir doğrulama adımıyla sabitlendi:

1. **Yayınla'ya çift tıklama** → iki ayrı sürüm yayınlanır ve biri gereksiz. Beklenen: istek uçarken düğme pasif, ikinci tık hiç işlenmez. (Görev 1, Adım 8)
2. **Boş veya yalnızca boşluktan oluşan içerik** → kalıcı, silinemez, boş bir yasal metin sürümü doğar. Beklenen: istek hiç gitmez, hata toast'ı çıkar. (Görev 1, Adım 8)
3. **Bozuk veya boş `givenAt`** → `format(new Date(...))` date-fns v4'te `RangeError` atar ve kullanıcı detay sheet'inin tamamı çöker. Beklenen: o hücrede `—`, sheet ayakta. (Görev 6, Adım 6)
4. **Beklenmeyen belge türü** (backend beşinci bir tür ekler) → etiket haritasında karşılığı yok, satırda `undefined` yazar. Beklenen: ham tür adı basılır. (Görev 6, Adım 7)
5. **Onay satırının işaret ettiği sürüm metni gelmiyor** (`404`) → diyalog sessizce boş açılır, kanıt zincirinin koptuğu belli olmaz. Beklenen: "Bu sürümün metni bulunamadı." (Görev 6, Adım 8)

---

### Task 1: Tip katmanı, yayın API'si ve zorunlu nitelik seçimi

Spec §3 + §4.3 + §4.4. Bu üçü tek görevde, çünkü `publishLegalDocumentVersion` imzası `requiresReconsent`'i **zorunlu** kılıyor: imzayı değiştirip radyoyu sonraya bırakmak, çağrı yerine dürüst olmayan bir varsayılan (`false`) yazmak demek olurdu. Bu yüzden imza ve onu besleyen seçim birlikte doğuyor.

**Files:**
- Modify: `lib/types.ts:86-92`
- Modify: `lib/api/legal.ts:17-20`
- Modify: `lib/hooks/useLegal.ts:1-21`
- Modify: `app/(admin)/legal/page.tsx:4` (import), `:54-93` (`LegalEditor`)

**Interfaces:**
- Consumes: mevcut `apiClient` (`lib/api/client.ts`, baseURL `/api/backend/api/v1`), mevcut `getLegalDocument`.
- Produces:
  - `type LegalDocumentType = "PrivacyPolicy" | "TermsOfService" | "KvkkNotice" | "ExplicitConsent"`
  - `interface LegalDocument { type: LegalDocumentType; content: string; version: number; updatedAt: string }`
  - `publishLegalDocumentVersion(type: LegalDocumentType, content: string, requiresReconsent: boolean): Promise<LegalDocument>`
  - `usePublishLegalDocumentVersion()` — `mutateAsync({ type, content, requiresReconsent })`, başarıda `["legal", type]` invalidate eder.

- [ ] **Step 1: Tipleri genişlet**

`lib/types.ts` içindeki mevcut bloğu (satır 86-92) bununla değiştir:

```ts
export type LegalDocumentType =
  | "PrivacyPolicy"
  | "TermsOfService"
  | "KvkkNotice"
  | "ExplicitConsent";

export interface LegalDocument {
  type: LegalDocumentType;
  content: string;
  version: number;
  updatedAt: string;
}
```

`requiresReconsent` bu tipe **eklenmiyor** — backend onu public GET'te açmıyor (spec §3).

- [ ] **Step 2: API fonksiyonunu yeniden adlandır ve imzayı genişlet**

`lib/api/legal.ts` içindeki `upsertLegalDocument` fonksiyonunu (satır 17-20) bununla değiştir:

```ts
export async function publishLegalDocumentVersion(
  type: LegalDocumentType,
  content: string,
  requiresReconsent: boolean
): Promise<LegalDocument> {
  const { data } = await apiClient.put<LegalDocument>("/admin/legal", {
    type,
    content,
    requiresReconsent,
  });
  return data;
}
```

Rota aynı (`PUT /admin/legal`), değişen yalnız gövde ve ad. "upsert" append-only modelde yalan olduğu için ad değişiyor; backend'de komut adı da `PublishLegalDocumentVersion` oluyor.

- [ ] **Step 3: Hook'u yeniden adlandır ve üçüncü alanı geçir**

`lib/hooks/useLegal.ts` dosyasının tamamını bununla değiştir:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLegalDocument, publishLegalDocumentVersion } from "@/lib/api/legal";
import type { LegalDocumentType } from "@/lib/types";

export function useLegalDocument(type: LegalDocumentType) {
  return useQuery({
    queryKey: ["legal", type],
    queryFn: () => getLegalDocument(type),
  });
}

export function usePublishLegalDocumentVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      content,
      requiresReconsent,
    }: {
      type: LegalDocumentType;
      content: string;
      requiresReconsent: boolean;
    }) => publishLegalDocumentVersion(type, content, requiresReconsent),
    onSuccess: (_, { type }) =>
      qc.invalidateQueries({ queryKey: ["legal", type] }),
  });
}
```

- [ ] **Step 4: Editördeki import ve durumu güncelle**

`app/(admin)/legal/page.tsx` satır 4'teki import'u değiştir:

```tsx
import { useLegalDocument, usePublishLegalDocumentVersion } from "@/lib/hooks/useLegal";
```

`LegalEditor`'ın gövdesindeki durum satırlarını (mevcut satır 55-57) bununla değiştir:

```tsx
  const [content, setContent] = useState(doc?.content ?? "");
  const [updatedAt, setUpdatedAt] = useState<string | null>(doc?.updatedAt ?? null);
  const [reconsent, setReconsent] = useState<"minor" | "material" | null>(null);
  const publish = usePublishLegalDocumentVersion();
```

`"minor" | "material" | null` üç hâli taşıyor; `null` = "cevaplanmadı". Boolean kullanmamanın sebebi tam bu: `false` ile "henüz seçilmedi" aynı değer olmamalı (spec §4.4).

- [ ] **Step 5: Yayınlama işleyicisini yaz**

`LegalEditor` içindeki `handleSave` fonksiyonunu (mevcut satır 59-71) bununla değiştir:

```tsx
  async function handlePublish() {
    if (!content.trim()) {
      toast.error("İçerik boş olamaz.");
      return;
    }
    if (!reconsent) return;
    try {
      const saved = await publish.mutateAsync({
        type,
        content,
        requiresReconsent: reconsent === "material",
      });
      setUpdatedAt(saved.updatedAt);
      setReconsent(null);
      toast.success("Yeni sürüm yayınlandı.");
    } catch {
      toast.error("Yayınlanamadı. Backend loglarını kontrol edin.");
    }
  }
```

`setReconsent(null)` spec §4.4'ün sıfırlama kuralı: başarılı yayından sonra seçim boşa döner, yoksa yazım hatası düzeltmesi de esaslı sayılıp tüm kullanıcılara ikinci kez onay ekranı çıkar.

- [ ] **Step 6: Radyo grubunu ve yeni düğmeyi yaz**

`LegalEditor`'ın `return` bloğunda, `<textarea ... />`'nın kapanışı ile alt satırdaki `<div className="flex items-center justify-between">` arasına şu `fieldset`'i ekle (dosyadaki `textarea` kendi kendine kapanıyor, ayrı bir `</textarea>` yok):

```tsx
      <fieldset className="space-y-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Değişikliğin niteliği</legend>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name={`reconsent-${type}`}
            className="mt-1"
            checked={reconsent === "minor"}
            onChange={() => setReconsent("minor")}
          />
          <span>
            <span className="font-medium">Esaslı değişiklik değil</span>
            <span className="block text-gray-500">
              Yazım/biçim düzeltmesi, kapsam aynı. Kullanıcılardan yeniden onay istenmez.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="radio"
            name={`reconsent-${type}`}
            className="mt-1"
            checked={reconsent === "material"}
            onChange={() => setReconsent("material")}
          />
          <span>
            <span className="font-medium">Esaslı değişiklik</span>
            <span className="block text-gray-500">
              Kapsam genişliyor: yeni alıcı, yeni amaç, yeni ülke. Tüm kullanıcılara
              yeniden onay sorulur.
            </span>
          </span>
        </label>
      </fieldset>
```

`components/ui` içinde radio-group bileşeni yok; yerel `input type="radio"` kullanılıyor. `name` içine `type` konuyor ki sekmeler arası grup çakışmasın.

Aynı `return` bloğundaki `<Button>`'ı (mevcut satır 88-90) bununla değiştir:

```tsx
        <Button onClick={handlePublish} disabled={!reconsent || publish.isPending}>
          {publish.isPending ? "Yayınlanıyor..." : "Yeni sürüm yayınla"}
        </Button>
```

`disabled` iki işi birden yapıyor: seçim yapılmadan yayına izin vermiyor (spec §4.4) ve istek uçarken çift tıklamayı engelliyor (Review Focus 1).

- [ ] **Step 7: Tip ve lint kapısı**

```bash
npx tsc --noEmit
npm run lint
```

Beklenen: `tsc` çıktı vermez (çıkış 0) — `upsertLegalDocument`/`useUpsertLegalDocument` adına kalan bir referans varsa burada patlar. `lint` yeni uyarı vermez.

- [ ] **Step 8: Tarayıcı kontrolü — çift tıklama ve boş içerik (Review Focus 1-2)**

`http://localhost:3000/legal` adresinde:

1. Sayfa açıldığında "Yeni sürüm yayınla" düğmesi **pasif** (seçim yok). → Review Focus 1'in ilk yarısı.
2. "Esaslı değişiklik değil"i seç → düğme aktifleşir.
3. Textarea'yı tamamen boşalt, yayınla'ya bas → "İçerik boş olamaz." toast'ı çıkar ve **ağ sekmesinde `PUT /admin/legal` isteği görünmez**. → Review Focus 2.
4. Textarea'ya bir şey yaz, yayınla'ya bas ve düğmeye hızla ikinci kez bas → düğme "Yayınlanıyor..." yazarken pasif, ağ sekmesinde **tek** `PUT` isteği var. → Review Focus 1.
5. İstek döndükten sonra radyo seçimi boşa dönmüş, düğme yeniden pasif. → spec §4.4 sıfırlama.

- [ ] **Step 9: Commit**

```bash
git add lib/types.ts lib/api/legal.ts lib/hooks/useLegal.ts "app/(admin)/legal/page.tsx"
git commit -m "feat: yasal metin yayınlama — sürümlü API + zorunlu esaslılık seçimi"
```

---

### Task 2: Dördüncü sekme ve sürüm göstergesi

Spec §4.1 + §4.2. Etiket haritası paylaşılan bir modüle taşınıyor çünkü Görev 6 onay geçmişinde aynı etiketlere ihtiyaç duyuyor; tarih biçimlendirmesi de öyle.

**Files:**
- Create: `lib/legalLabels.ts`
- Create: `lib/format.ts`
- Modify: `app/(admin)/legal/page.tsx:1-12` (import + `DOC_TYPES`), `:54-93` (`LegalEditor`)

**Interfaces:**
- Consumes: Görev 1'in `LegalDocumentType`, `LegalDocument.version`.
- Produces:
  - `LEGAL_DOC_LABELS: Record<LegalDocumentType, string>`
  - `formatTrDate(value: string | null | undefined, pattern: string): string` — geçersiz/boş tarihte `"—"` döner.

- [ ] **Step 1: Paylaşılan etiket haritasını oluştur**

`lib/legalLabels.ts`:

```ts
import type { LegalDocumentType } from "@/lib/types";

export const LEGAL_DOC_LABELS: Record<LegalDocumentType, string> = {
  PrivacyPolicy: "Gizlilik Politikası",
  TermsOfService: "Kullanım Koşulları",
  KvkkNotice: "KVKK Aydınlatma Metni",
  ExplicitConsent: "Açık Rıza Metni",
};
```

`Record<LegalDocumentType, string>` olduğu için ileride tipe beşinci bir değer eklenirse `tsc` burayı eksik bırakmaya izin vermez.

- [ ] **Step 2: Tarih biçimlendiriciyi oluştur**

`lib/format.ts`:

```ts
import { format } from "date-fns";
import { tr } from "date-fns/locale";

/** Geçersiz/boş tarihte em-dash döner — date-fns v4 `format` Invalid Date'te RangeError atar. */
export function formatTrDate(value: string | null | undefined, pattern: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, pattern, { locale: tr });
}
```

- [ ] **Step 3: Dördüncü sekmeyi ekle**

`app/(admin)/legal/page.tsx` üstündeki `DOC_TYPES` bloğunu (satır 8-12) bununla değiştir:

```tsx
const DOC_TYPES: { type: LegalDocumentType; label: string }[] = (
  ["PrivacyPolicy", "TermsOfService", "KvkkNotice", "ExplicitConsent"] as const
).map((type) => ({ type, label: LEGAL_DOC_LABELS[type] }));
```

Ve import'lara ekle:

```tsx
import { LEGAL_DOC_LABELS } from "@/lib/legalLabels";
import { formatTrDate } from "@/lib/format";
```

- [ ] **Step 4: Sürüm göstergesini editörün üstüne koy**

`LegalEditor` içinde `updatedAt` durumunu artık gösterge taşıyor; şu iki değişiklik birlikte yapılır.

(a) Durum satırından `updatedAt`'i kaldır — Görev 1 Adım 4'te yazdığın satırlardan birincisini sil:

```tsx
  const [updatedAt, setUpdatedAt] = useState<string | null>(doc?.updatedAt ?? null);
```

ve `handlePublish` içindeki `setUpdatedAt(saved.updatedAt);` satırını da sil. Gerek kalmadı: `onSuccess` zaten `["legal", type]`'ı invalidate ediyor, `doc` bir prop olduğu için gösterge kendiliğinden tazeleniyor.

(b) `return` bloğunun en başına, `<textarea>`'nın üstüne göstergeyi ekle:

```tsx
      <p className="text-sm text-gray-500">
        {doc
          ? `Sürüm ${doc.version} · ${formatTrDate(doc.updatedAt, "d MMMM yyyy")}'da güncellendi`
          : "Henüz yayınlanmadı — yayınlamak sürüm 1'i oluşturur."}
      </p>
```

(c) Alttaki eski "Son güncelleme" `<span>`'ını sil ve yerine boş bir `<span />` bırakma — `justify-between` düzenini korumak için `<div>`'i şu hâle getir:

```tsx
      <div className="flex items-center justify-end">
```

- [ ] **Step 5: Tip ve lint kapısı**

```bash
npx tsc --noEmit
npm run lint
```

Beklenen: `tsc` çıktı vermez. `updatedAt`/`setUpdatedAt` artık kullanılmadığı için kalan bir referans varsa `tsc` veya `lint` yakalar.

- [ ] **Step 6: Tarayıcı kontrolü**

`http://localhost:3000/legal`:

1. Sekme şeridinde **dört** düğme var, dördüncüsü "Açık Rıza Metni".
2. "Açık Rıza Metni"ne bas → metin hiç yayınlanmamışsa textarea boş ve üstünde "Henüz yayınlanmadı — yayınlamak sürüm 1'i oluşturur." yazar. (Eski backend bu türü tanımıyorsa 404 yerine 400 dönebilir ve "Metin yüklenemedi." görünür; bu durumu not al, backend çıkınca tekrar bak.)
3. Yayınlanmış bir sekmeye (örn. "Gizlilik Politikası") geç → üstte "Sürüm N · <tarih>'da güncellendi" yazar. Backend `version` göndermiyorsa sayı yerine boşluk görünür; beklenen ara durum (bkz. Doğrulama Yöntemi).
4. Sekmeler arasında gez → her geçişte radyo seçimi boş geliyor (`key={activeType}` editörü remount ediyor).

- [ ] **Step 7: Commit**

```bash
git add lib/legalLabels.ts lib/format.ts "app/(admin)/legal/page.tsx"
git commit -m "feat: açık rıza sekmesi + yasal metinlerde sürüm göstergesi"
```

---

### Task 3: Esaslı değişiklik onay diyalogu

Spec §4.5. Esaslı olmayan yayınlarda diyalog **yok** — gereksiz sürtünme.

**Files:**
- Modify: `app/(admin)/legal/page.tsx` (import + `LegalEditor`)

**Interfaces:**
- Consumes: Görev 1'in `handlePublish`'i (bu görevde ikiye ayrılıyor), mevcut `components/shared/ConfirmDialog.tsx`.
- Produces: `LegalEditor` içinde `confirmOpen` durumu; dışa açılan yeni arayüz yok.

- [ ] **Step 1: ConfirmDialog'u içe al**

`app/(admin)/legal/page.tsx` import'larına ekle:

```tsx
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
```

Bu bileşen repoda zaten `categories/page.tsx:149` ve `reports/page.tsx:165`'te aynı biçimde kullanılıyor; yeni bir diyalog deseni icat edilmiyor.

- [ ] **Step 2: Yayınlamayı "tıklama" ve "gönderme" olarak ikiye ayır**

`LegalEditor` içine `confirmOpen` durumunu ekle (diğer `useState` satırlarının yanına):

```tsx
  const [confirmOpen, setConfirmOpen] = useState(false);
```

Görev 1'de yazdığın `handlePublish`'i şu iki fonksiyonla değiştir:

```tsx
  function handlePublishClick() {
    if (!content.trim()) {
      toast.error("İçerik boş olamaz.");
      return;
    }
    if (!reconsent) return;
    if (reconsent === "material") {
      setConfirmOpen(true);
      return;
    }
    void doPublish();
  }

  async function doPublish() {
    setConfirmOpen(false);
    try {
      await publish.mutateAsync({
        type,
        content,
        requiresReconsent: reconsent === "material",
      });
      setReconsent(null);
      toast.success("Yeni sürüm yayınlandı.");
    } catch {
      toast.error("Yayınlanamadı. Backend loglarını kontrol edin.");
    }
  }
```

Boş içerik kapısı `handlePublishClick`'te kalıyor; diyalog açılmadan önce kontrol edilmeli, yoksa admin boş metin için onay diyaloğu görür.

- [ ] **Step 3: Düğmeyi yeni işleyiciye bağla**

`<Button>`'ın `onClick`'ini güncelle:

```tsx
        <Button onClick={handlePublishClick} disabled={!reconsent || publish.isPending}>
```

- [ ] **Step 4: Diyalogu yerleştir**

`LegalEditor`'ın `return` bloğunun en sonuna, kapanış `</div>`'inden hemen önce ekle:

```tsx
      <ConfirmDialog
        open={confirmOpen}
        title="Esaslı değişiklik olarak yayınlanacak"
        description="Bu sürüm esaslı değişiklik olarak yayınlanacak. Tüm kullanıcılar uygulamayı açtığında metni yeniden onaylamak zorunda kalacak. Devam edilsin mi?"
        onConfirm={() => void doPublish()}
        onCancel={() => setConfirmOpen(false)}
        confirmLabel="Yayınla"
      />
```

Metin spec §4.5'ten aynen alındı. `confirmVariant` verilmiyor — bu yıkıcı bir işlem değil, geri alınamaz bir işlem; kırmızı düğme yanlış sinyal verir.

- [ ] **Step 5: Tip ve lint kapısı**

```bash
npx tsc --noEmit
npm run lint
```

Beklenen: temiz. `handlePublish` adına kalan referans varsa burada patlar.

- [ ] **Step 6: Tarayıcı kontrolü**

`http://localhost:3000/legal`:

1. "Esaslı değişiklik değil" seçili, yayınla'ya bas → **diyalog çıkmaz**, doğrudan yayınlanır.
2. "Esaslı değişiklik" seçili, yayınla'ya bas → diyalog çıkar, metni spec'teki cümleyle birebir aynı.
3. Diyalogda "İptal" → hiçbir istek gitmez, radyo seçimi **"Esaslı değişiklik"te kalır** (iptal bir cevap değil).
4. Diyalogda "Yayınla" → istek gider, başarıda seçim boşa döner ve düğme pasifleşir.
5. Textarea boş + "Esaslı değişiklik" seçili, yayınla'ya bas → diyalog **açılmaz**, "İçerik boş olamaz." toast'ı çıkar.

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)/legal/page.tsx"
git commit -m "feat: esaslı değişiklik yayınında onay diyalogu"
```

---

### Task 4: Yarış durumu kurtarması

Spec §4.6. İki admin aynı anda yayınlarsa backend'in `(Type, Version)` tekil indeksi ikinciyi `400` ile düşürür.

**Plan yorumu:** Spec "en son sürüm yüklendi — değişikliğinizi tekrar uygulayın" diyor, yani textarea sunucunun metniyle güncelleniyor; ama aynı paragraf admin'in yazdığının sessizce kaybolmamasını da şart koşuyor. Bu ikisi birlikte şöyle karşılanıyor: textarea tazelenir, admin'in yazdığı metin durumda tutulur ve altta "Geri yükle" düğmesiyle sunulur. Panoya yazmak seçilmedi — sistem panosunu habersiz ezmek kullanıcının başka verisini yok eder.

**Files:**
- Modify: `lib/hooks/useLegal.ts` (yeni hook)
- Modify: `app/(admin)/legal/page.tsx` (`LegalEditor`)

**Interfaces:**
- Consumes: Görev 1'in `getLegalDocument`'i, Görev 3'ün `doPublish`'i.
- Produces: `useRefetchLegalDocument(): (type: LegalDocumentType) => Promise<LegalDocument | null>` — metni tazeler, `["legal", type]` önbelleğine yazar ve taze belgeyi döner.

- [ ] **Step 1: Tazeleme hook'unu ekle**

`lib/hooks/useLegal.ts` dosyasının sonuna ekle:

```ts
export function useRefetchLegalDocument() {
  const qc = useQueryClient();
  return async (type: LegalDocumentType) => {
    const fresh = await getLegalDocument(type);
    qc.setQueryData(["legal", type], fresh);
    return fresh;
  };
}
```

Sayfadan doğrudan `lib/api` çağırmamak için hook katmanında duruyor (repo deseni: ekran → hook → api). `setQueryData` ile sürüm göstergesi de aynı anda tazeleniyor.

- [ ] **Step 2: Editörde taslak durumunu ve hook'u bağla**

`LegalEditor` import'una ekle:

```tsx
import { useLegalDocument, usePublishLegalDocumentVersion, useRefetchLegalDocument } from "@/lib/hooks/useLegal";
```

`LegalEditor` içine ekle:

```tsx
  const [staleDraft, setStaleDraft] = useState<string | null>(null);
  const refetchLegal = useRefetchLegalDocument();
```

- [ ] **Step 3: `400` yakalamasını yaz**

Görev 3'te yazdığın `doPublish`'in `catch` bloğunu bununla değiştir:

```tsx
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) {
        const mine = content;
        const fresh = await refetchLegal(type);
        if (fresh) {
          setStaleDraft(mine);
          setContent(fresh.content);
        }
        toast.error(
          "Bu metin siz yazarken güncellendi, en son sürüm yüklendi — değişikliğinizi tekrar uygulayın."
        );
        return;
      }
      toast.error("Yayınlanamadı. Backend loglarını kontrol edin.");
    }
```

`mine` değişkeni `setContent`'ten **önce** okunuyor; sıra ters olursa admin'in yazdığı kaybolur. `fresh` yoksa (metin bu arada silinmiş — append-only'de olmamalı) textarea'ya dokunulmuyor.

- [ ] **Step 4: Geri yükleme bloğunu yaz**

`fieldset`'in hemen üstüne ekle:

```tsx
      {staleDraft !== null && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Yazdığınız metin korundu</p>
          <p className="text-gray-600">
            Yukarıdaki alanda şimdi sunucudaki en son sürüm duruyor. Kendi metninizi geri
            yükleyip değişikliğinizi tekrar uygulayabilirsiniz.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setContent(staleDraft);
                setStaleDraft(null);
              }}
            >
              Geri yükle
            </Button>
            <Button variant="ghost" onClick={() => setStaleDraft(null)}>
              Yoksay
            </Button>
          </div>
        </div>
      )}
```

`staleDraft !== null` kullanılıyor, `staleDraft &&` değil: boş string de geçerli bir taslaktır ve gösterilmelidir.

- [ ] **Step 5: Başarılı yayında taslağı temizle**

`doPublish` içindeki başarı yoluna, `setReconsent(null)` satırının yanına ekle:

```tsx
      setStaleDraft(null);
```

Yoksa admin çakışmayı çözüp yayınladıktan sonra sarı kutu ekranda kalır.

- [ ] **Step 6: Tip ve lint kapısı**

```bash
npx tsc --noEmit
npm run lint
```

Beklenen: temiz. `Button`'ın `variant="outline"`/`variant="ghost"` değerlerini tanımadığı bir hata çıkarsa `components/ui/button.tsx`'teki `buttonVariants` listesine bak ve oradaki adlardan birini kullan.

- [ ] **Step 7: Tarayıcı kontrolü (backend gerekmez — ağ sekmesinden taklit)**

Yarış durumunu üretmek için iki admin gerekmiyor; `400`'ü tarayıcıdan taklit et:

1. DevTools → Network → `PUT /api/backend/api/v1/admin/legal` isteğini **engelle** (Chrome: isteğe sağ tık → "Block request URL"). Engellenen istek `net::ERR_FAILED` verir, `400` vermez — bunun yerine geçici kod değişikliği kullan:
2. `doPublish` içindeki `const status = ...` satırını geçici olarak `const status = 400;` yap.
3. Textarea'ya bir şey yaz, "Esaslı değişiklik değil" seç, yayınla'ya bas.
4. Beklenen: spec §4.6 toast'ı çıkar; textarea'da sunucudaki metin var; altında sarı "Yazdığınız metin korundu" kutusu duruyor.
5. "Geri yükle"ye bas → textarea senin yazdığın metne döner, kutu kapanır.
6. **Geçici değişikliği geri al** (`const status = (err as ...)?.response?.status;`) ve `npx tsc --noEmit` ile temiz olduğunu doğrula.

- [ ] **Step 8: Commit**

```bash
git add lib/hooks/useLegal.ts "app/(admin)/legal/page.tsx"
git commit -m "feat: eşzamanlı yayında çakışma kurtarması — taslak korunuyor"
```

---

### Task 5: Onay geçmişi veri katmanı

Spec §5'in veri tarafı. Arayüz Görev 6'da; burada yalnız tip, iki API fonksiyonu ve iki hook var, böylece Görev 6 tek dosyaya odaklanıyor.

**Files:**
- Modify: `lib/types.ts` (yeni arayüz, `LegalDocument`'ın altına)
- Modify: `lib/api/users.ts` (yeni fonksiyon, dosya sonuna)
- Modify: `lib/api/legal.ts` (yeni fonksiyon, dosya sonuna)
- Modify: `lib/hooks/useUsers.ts` (yeni hook, dosya sonuna)
- Modify: `lib/hooks/useLegal.ts` (yeni hook, dosya sonuna)

**Interfaces:**
- Consumes: Görev 1'in `LegalDocumentType` ve `LegalDocument` tipleri, mevcut `apiClient`.
- Produces:
  - `interface UserConsent { type: LegalDocumentType; version: number; givenAt: string }`
  - `getUserConsents(id: string): Promise<UserConsent[]>`
  - `getLegalDocumentVersion(type: LegalDocumentType, version: number): Promise<LegalDocument>`
  - `useUserConsents(id: string | null)` — `queryKey: ["admin-user-consents", id]`
  - `useLegalDocumentVersion(type: LegalDocumentType | null, version: number | null)` — `queryKey: ["legal-version", type, version]`

- [ ] **Step 1: `UserConsent` tipini ekle**

`lib/types.ts` içinde `LegalDocument` arayüzünün hemen altına ekle:

```ts
export interface UserConsent {
  type: LegalDocumentType;
  version: number;
  givenAt: string;
}
```

Alan adları backend spec §5.6'daki yanıtla aynı: `{ "type": "ExplicitConsent", "version": 2, "givenAt": "2026-10-12T14:33:00Z" }`. `givenAt` ham UTC geliyor, biçimlendirme panelin işi.

- [ ] **Step 2: Onay listesi API fonksiyonunu ekle**

`lib/api/users.ts` dosyasının sonuna ekle:

```ts
export async function getUserConsents(id: string): Promise<UserConsent[]> {
  const { data } = await apiClient.get<UserConsent[]>(`/admin/users/${id}/consents`);
  return data;
}
```

Ve satır 2'deki import'a `UserConsent`'i ekle:

```ts
import type { AdminUser, AdminUserDetail, PagedResult, UserConsent, UserRole } from "@/lib/types";
```

Boş dizi geçerli bir cevap (`200`), hata değil — `404` yakalaması **yok**, çünkü `404` burada "kullanıcı yok" demek ve hata olarak görünmesi doğru.

- [ ] **Step 3: Sürüm metni API fonksiyonunu ekle**

`lib/api/legal.ts` dosyasının sonuna ekle:

```ts
export async function getLegalDocumentVersion(
  type: LegalDocumentType,
  version: number
): Promise<LegalDocument> {
  const { data } = await apiClient.get<LegalDocument>(`/legal/${type}/versions/${version}`);
  return data;
}
```

`getLegalDocument`'taki `404 → null` kalıbı burada **kullanılmıyor**: güncel metnin hiç yayınlanmamış olması normal, ama bir onay satırının işaret ettiği sürümün bulunamaması anormaldir ve hata olarak görünmeli (Review Focus 5).

- [ ] **Step 4: Onay listesi hook'unu ekle**

`lib/hooks/useUsers.ts` dosyasının sonuna ekle:

```ts
export function useUserConsents(id: string | null) {
  return useQuery({
    queryKey: ["admin-user-consents", id],
    queryFn: () => getUserConsents(id!),
    enabled: !!id,
  });
}
```

Ve satır 2'deki import'a `getUserConsents`'i ekle:

```ts
import { getAdminUsers, getAdminUserById, updateUserRole, getUserConsents, type GetUsersParams } from "@/lib/api/users";
```

`enabled: !!id` deseni dosyadaki `useUserDetail` ile aynı.

- [ ] **Step 5: Sürüm metni hook'unu ekle**

`lib/hooks/useLegal.ts` dosyasının sonuna ekle:

```ts
export function useLegalDocumentVersion(
  type: LegalDocumentType | null,
  version: number | null
) {
  return useQuery({
    queryKey: ["legal-version", type, version],
    queryFn: () => getLegalDocumentVersion(type!, version!),
    enabled: !!type && version !== null,
  });
}
```

Ve dosyanın en üstündeki import'a `getLegalDocumentVersion`'ı ekle:

```ts
import { getLegalDocument, getLegalDocumentVersion, publishLegalDocumentVersion } from "@/lib/api/legal";
```

`version !== null` kullanılıyor, `!!version` değil: sürüm numaraları 1'den başlasa da `0` kontrolünü tipe güvenerek değil açıkça yapmak doğru.

- [ ] **Step 6: Tip ve lint kapısı**

```bash
npx tsc --noEmit
npm run lint
```

Beklenen: temiz. Bu görev hiçbir ekranı değiştirmiyor, yani tarayıcıda görünür bir değişiklik **yok** — bu beklenen.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/api/users.ts lib/api/legal.ts lib/hooks/useUsers.ts lib/hooks/useLegal.ts
git commit -m "feat: onay geçmişi ve sürüm metni için veri katmanı"
```

---

### Task 6: Onay geçmişi arayüzü ve sürüm metni diyaloğu

Spec §5'in ekran tarafı. Kanıt zinciri burada tamamlanıyor: onay satırı → sürüm numarası → o sürümün metni.

**Files:**
- Modify: `app/(admin)/users/_components/UserDetailSheet.tsx` (iki yeni bileşen + `UserDetailBody`'ye bir satır)

**Interfaces:**
- Consumes: Görev 5'in `useUserConsents`, `useLegalDocumentVersion` hook'ları ve `UserConsent` tipi; Görev 2'nin `LEGAL_DOC_LABELS` ve `formatTrDate`'i; mevcut `components/ui/dialog` ve `components/ui/skeleton`.
- Produces: dosya içinde kalan `ConsentHistory` ve `ConsentTextDialog`; dışa açılan yeni arayüz yok.

- [ ] **Step 1: Import'ları ekle**

`app/(admin)/users/_components/UserDetailSheet.tsx` üstüne ekle:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserConsents } from "@/lib/hooks/useUsers";
import { useLegalDocumentVersion } from "@/lib/hooks/useLegal";
import { LEGAL_DOC_LABELS } from "@/lib/legalLabels";
import { formatTrDate } from "@/lib/format";
import type { LegalDocumentType } from "@/lib/types";
```

Mevcut `import { format } from "date-fns"` ve `import { tr } from "date-fns/locale"` satırları **kalıyor** — dosyadaki eski `format` çağrıları onlara bağlı, bu görevde dokunulmuyor.

- [ ] **Step 2: Sürüm metni diyaloğunu yaz**

Dosyanın sonuna, `UserDetailSheet` export'undan önce ekle:

```tsx
type ConsentTarget = { type: LegalDocumentType; version: number };

function ConsentTextDialog({
  target,
  onClose,
}: {
  target: ConsentTarget | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useLegalDocumentVersion(
    target?.type ?? null,
    target?.version ?? null
  );

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {target
              ? `${LEGAL_DOC_LABELS[target.type] ?? target.type} — sürüm ${target.version}`
              : ""}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : isError ? (
          <p className="text-sm text-gray-400">Bu sürümün metni bulunamadı.</p>
        ) : (
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap font-mono text-xs">
            {data?.content}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

`whitespace-pre-wrap` markdown kaynağını satır sonlarıyla birlikte okunur tutuyor; önizleme **render edilmiyor** (spec §6).

- [ ] **Step 3: Onay geçmişi bölümünü yaz**

`ConsentTextDialog`'un hemen üstüne ekle:

```tsx
function ConsentHistory({ userId }: { userId: string }) {
  const { data, isLoading, isError } = useUserConsents(userId);
  const [selected, setSelected] = useState<ConsentTarget | null>(null);

  return (
    <div className="mt-6 border-t pt-4 px-1 space-y-2">
      <p className="text-sm font-medium">Onay Geçmişi</p>
      {isLoading ? (
        <Skeleton className="h-5" />
      ) : isError ? (
        <p className="text-sm text-gray-400">Onay geçmişi yüklenemedi.</p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-gray-400">Bu kullanıcının onay kaydı yok.</p>
      ) : (
        <ul className="divide-y">
          {data.map((c) => (
            <li
              key={`${c.type}-${c.version}`}
              className="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <span>{LEGAL_DOC_LABELS[c.type] ?? c.type}</span>
              <button
                onClick={() => setSelected({ type: c.type, version: c.version })}
                className="text-right text-blue-600 hover:underline"
              >
                Sürüm {c.version} · {formatTrDate(c.givenAt, "d MMM yyyy HH:mm")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConsentTextDialog target={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
```

`LEGAL_DOC_LABELS[c.type] ?? c.type` — backend beşinci bir tür eklerse satırda `undefined` değil ham tür adı görünür (Review Focus 4). `formatTrDate` bozuk tarihte `—` döndürüyor, sheet çökmüyor (Review Focus 3).

- [ ] **Step 4: Bölümü sheet'e tak**

`UserDetailBody`'nin `return` bloğundaki rol kutusunun (`<div className="mt-6 border-t pt-4 px-1 space-y-2">` ile başlayan blok) kapanışından sonra, `</>`'den hemen önce ekle:

```tsx
      <ConsentHistory userId={user.id} />
```

- [ ] **Step 5: Tip ve lint kapısı**

```bash
npx tsc --noEmit
npm run lint
```

Beklenen: temiz.

- [ ] **Step 6: Bozuk tarih kontrolü (Review Focus 3)**

1. `ConsentHistory` içindeki `formatTrDate(c.givenAt, ...)` çağrısını geçici olarak `formatTrDate("bozuk-tarih", ...)` yap.
2. `http://localhost:3000/users` → bir kullanıcıya tıkla.
3. Beklenen: satırda tarih yerine `—` yazar, **sheet açık ve çalışır durumda** (beyaz ekran veya konsolda `RangeError` yok).
4. Geçici değişikliği geri al.

- [ ] **Step 7: Bilinmeyen tür kontrolü (Review Focus 4)**

1. `ConsentHistory` içindeki `LEGAL_DOC_LABELS[c.type] ?? c.type` ifadesini geçici olarak `LEGAL_DOC_LABELS["Bilinmeyen" as LegalDocumentType] ?? "Bilinmeyen"` yap.
2. Sheet'i aç. Beklenen: satırda `undefined` değil `Bilinmeyen` yazar.
3. Geçici değişikliği geri al.

- [ ] **Step 8: Eksik sürüm metni kontrolü (Review Focus 5)**

1. `ConsentHistory` içindeki `setSelected({ type: c.type, version: c.version })` çağrısını geçici olarak `setSelected({ type: c.type, version: 9999 })` yap.
2. Sheet'te bir onay satırına tıkla. Beklenen: diyalog açılır ve "Bu sürümün metni bulunamadı." yazar — boş/sessiz bir diyalog değil.
3. Geçici değişikliği geri al ve `npx tsc --noEmit` ile temiz olduğunu doğrula.

- [ ] **Step 9: Tarayıcı kontrolü — asıl akış**

`http://localhost:3000/users` → bir kullanıcıya tıkla:

1. Rol kutusunun altında "Onay Geçmişi" başlığı var.
2. Backend henüz çıkmadıysa: "Onay geçmişi yüklenemedi." (uç yok). Backend çıktıysa ve kullanıcının kaydı yoksa: "Bu kullanıcının onay kaydı yok."
3. Backend çıktıysa ve kayıt varsa: her satırda belge adı solda, "Sürüm N · tarih" sağda mavi ve tıklanabilir.
4. Sürüme tıkla → diyalog o sürümün ham metniyle açılır; başlıkta "Açık Rıza Metni — sürüm N" yazar.
5. Diyalogu kapat, başka bir kullanıcıya geç → geçmiş yeni kullanıcıya göre tazelenir (`key={user.id}` gövdeyi remount ediyor).

- [ ] **Step 10: Commit**

```bash
git add "app/(admin)/users/_components/UserDetailSheet.tsx"
git commit -m "feat: kullanıcı detayında onay geçmişi + onaylanan sürümün metni"
```

---

## Kapanış

Altı görev bittiğinde panel spec'in §3, §4 ve §5'ini tamamen karşılıyor. Kalan iki şey bu planın dışında:

1. **Backend çıkışı** — ayrı ajanın işi. Çıktıktan sonra "Doğrulama Yöntemi" tablosunun sağ kolonu elden geçirilmeli.
2. **Push ve birleştirme** — `feature/acik-riza-onay-kaydi` dalı `main`'e girmeden önce `superpowers:requesting-code-review`, sonra `superpowers:finishing-a-development-branch`.
