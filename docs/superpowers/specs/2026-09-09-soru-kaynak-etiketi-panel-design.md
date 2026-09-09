# Soru Kaynak Etiketi (Servis / İmport) — Panel Tasarım Spec'i

**Tarih:** 2026-09-09
**Repo:** `kpss-admin-panel` (Next.js)
**İkiz (backend):** `KpssSoru-backend` — asıl iş orada. Bkz.
`KpssSoru-backend/docs/superpowers/specs/2026-09-09-soru-kaynak-etiketi-backend-design.md`
**Bağımlılık:** Backend `Question`'a `source` alanı + `?source=` filtresi ekler. Panel bu
alanı **gösterir + filtreler**; backend hazır olmadan graceful (alan `undefined` → "—", filtre
paramı backend'ce yok sayılır).

## İstek

Sorular listesinde bir sorunun **kaynağı** görünmüyor. Her soruya kaynak etiketi
(`Servis` = pipeline üretti · `İmport` = panelden import) eklensin; listede **sütun** olarak
görünsün ve üstte **"Kaynak" filtresiyle** (Hepsi / Servis / İmport) daraltılabilsin.

## Bulgu (kod okundu) — filtre + veri akışı ZATEN hazır kalıpta

Liste filtreleri URL search param'ıyla yürüyor; `useQuestions` parametre nesnesini olduğu gibi
API'ye geçiriyor ve `getAdminQuestions` bunu `{ params }` ile query string'e seriyor:

```
setQueryParam("source", v) --URL ?source=--> useQuestions({ ..., source })
  --> getAdminQuestions(params) --> apiClient.get("/admin/questions", { params }) --> ?source=<v>
```

Kanıt:
```ts
// lib/api/questions.ts — params OLDUĞU GİBİ query'ye gider
export async function getAdminQuestions(params: GetQuestionsParams) {
  const { data } = await apiClient.get<PagedResult<AdminQuestion>>("/admin/questions", { params });
  return data;
}
// lib/hooks/useQuestions.ts — params queryKey'de + queryFn'e geçiyor (cache doğru anahtarlanır)
useQuery({ queryKey: ["admin-questions", params], queryFn: () => getAdminQuestions(params) });
```

Yani `GetQuestionsParams`'a `source` eklenip page'den geçilince query string'e **otomatik**
akar. Filtre Select kalıbı (`STATUS_OPTIONS` + `setQueryParam`) ve rozet kalıbı
(`VerificationBadge`: `Record<string,{label,className}>` + `<Badge>`) mevcut; sütun tablosu
`questions/page.tsx`'te (`Soru/Kategori/Zorluk/Durum/AI Doğrulama/Tarih/Aksiyonlar`, boş satır `colSpan={8}`).

## Kilitli kararlar

1. **Backend'in string enum'unu aynen kullan** — `source` değerleri `"Service"` / `"Import"`
   (backend `JsonStringEnumConverter`); panel Türkçe etiketlere çevirir (`Servis` / `İmport`).
2. **Yeni `SourceBadge`** bileşeni `VerificationBadge` kalıbında; `StatusBadge`/`VerificationBadge`
   ile aynı yerlerde (liste sütunu + detay başlığı) kullanılır. Ayrı renk paleti (Servis=mavi,
   İmport=mor) → durum/AI rozetlerinden görsel ayrışır.
3. **Filtre mevcut URL-param kalıbında** — `setQueryParam("source", v)`; `"all"` → param silinir
   (tüm kaynaklar), tıpkı `status` filtresi gibi. Ekstra state yok.
4. **Graceful degradation** — `q.source` yoksa (backend eski) rozet "—" gösterir, filtre paramı
   zararsızdır. Uçtan uca doğrulama backend canlı olduktan sonra anlamlı.

## Değişiklikler

### 1. `lib/types.ts` — `AdminQuestion`
```ts
source?: "Service" | "Import";   // kaynak: pipeline mi panel-import mu
```

### 2. `lib/api/questions.ts` — `GetQuestionsParams`
```ts
source?: string;   // kaynak filtresi ("Service" | "Import"); {params} ile otomatik query'ye gider
```

### 3. `components/shared/SourceBadge.tsx` — YENİ (VerificationBadge kalıbı)
```tsx
import { Badge } from "@/components/ui/badge";

const config: Record<string, { label: string; className: string }> = {
  Service: { label: "Servis", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  Import:  { label: "İmport", className: "bg-purple-100 text-purple-800 hover:bg-purple-100" },
};

export function SourceBadge({ source }: { source?: string | null }) {
  if (!source) return <span className="text-gray-400 text-sm">—</span>;
  const entry = config[source];
  if (!entry) return <span className="text-gray-400 text-sm">—</span>;
  return <Badge className={entry.className}>{entry.label}</Badge>;
}
```

### 4. `app/(admin)/questions/page.tsx`
```tsx
// sabit — STATUS_OPTIONS yanına
const SOURCE_OPTIONS = [
  { value: "all", label: "Tümü" },
  { value: "Service", label: "Servis" },
  { value: "Import", label: "İmport" },
];

// param oku (verification'ın yanında)
const source = searchParams.get("source") ?? "";

// useQuestions'a geçir
useQuestions({ status: ..., verification: ..., source: source || undefined, page, pageSize: 20 });

// status Select'in yanına "Kaynak" Select'i (aynı kalıp):
<Select value={source || "all"} onValueChange={(v) => v && setQueryParam("source", v === "all" ? "" : v)}>
  ... SOURCE_OPTIONS ...
</Select>

// tabloya sütun (ör. "AI Doğrulama"dan sonra):
<TableHead>Kaynak</TableHead>
...
<TableCell><SourceBadge source={q.source} /></TableCell>

// boş satır: colSpan={8} → {9}
```
Not: `setQueryParam("source","")` boş değer set eder; `status` filtresindeki `"all"` mantığını
izler (boş → backend paramı göndermez). İstenirse `setQueryParam` yerine `verification`'daki
gibi `params.delete("source")` ile ufak bir yardımcı da kullanılabilir.

### 5. `app/(admin)/questions/[id]/page.tsx` — detay
Durum/AI rozetlerinin bulunduğu başlık bölümüne `<SourceBadge source={q.source} />` eklenir.

## Testler

Panelde test altyapısı yok (mevcut örüntü); doğrulama `tsc + lint + build` + canlı smoke:

- **Sütun:** listede her satırda "Kaynak" rozeti; import edilen 25 soru **"İmport"**, pipeline
  soruları **"Servis"**.
- **Filtre:** "Kaynak: İmport" → yalnız import'lar; "Servis" → yalnız pipeline; "Tümü" → hepsi.
  Sayfalama sayacı filtreyle tutarlı.
- **Detay:** bir sorunun detayında doğru kaynak rozeti.
- **Graceful:** backend güncel değilken sütun "—" gösterir, sayfa bozulmaz.

## Kapsam dışı (YAGNI)

- **"Manuel" kova / üçüncü kaynak** — panelde elle ekleme akışı yok.
- **Kaynağa göre toplu aksiyon / dashboard kırılımı** — bu iş yalnız sütun + filtre.
- **AI doğrulamanın import'a uygulanması** — ayrı, daha büyük iş.

## Sıra / bağımlılık

Backend spec'i önce uygulanır (`source` alanı + `?source=` filtresi + restart). Panel değişikliği
bağımsız yazılabilir; graceful olduğu için backend'den önce merge edilse de sayfa bozulmaz, ama
uçtan uca doğrulama backend canlı olduktan sonra anlamlıdır.
