# AI Doğrulama Etiketini Soru İçe Aktar Formuna Taşıma

## Bağlam

Panelin "Soru İçe Aktar" ekranı (`app/(admin)/questions/_components/ImportSheet.tsx`)
yüklenen dosyayı `lib/validations/importSchema.ts`'teki `parseImportFile`/`parseExcelFile`/
`parseCsvFile` ile satır satır doğrulayıp `ImportQuestion[]` üretir, sonra her birini
`createQuestion(q)` (`lib/api/questions.ts`) ile backend'in `POST /admin/questions`
endpoint'ine TEK TEK gönderir.

Pipeline tarafı (kpss-content-pipeline reposu, eşzamanlı yazılan ayrı bir spec) artık
panel-format export'una (`?format=panel`) soru başına bir AI doğrulama etiketi
(`verificationStatus`: `"gecti"`/`"supheli"`/`"kontrol_edilemedi"`, opsiyonel
`verificationNote`) koyacak. Bu JSON panelden yüklenince, şu an `importQuestionSchema`
bu iki alanı tanımadığı için **SESSİZCE ATILIYOR**.

`lib/types.ts`'teki `AdminQuestion` tipi bu alanları ZATEN biliyor
(`verificationStatus?: string | null`, `verificationNote?: string | null` — satır 27-28)
ve soru LİSTESİ ekranında (`app/(admin)/questions/page.tsx`) zaten bir `VerificationBadge`
sütunu + "AI geçti" filtresi var. Yani OKUMA tarafı hazır; eksik olan yalnız bu YÜKLEME
(import) formunun alanı TANIYIP taşıması.

Backend tarafında da (KpssSoru-backend reposu, eşzamanlı ayrı bir spec)
`CreateQuestionCommand`'a aynı alanlar eklenmesi gerekiyor — o olmadan bu değişiklik
tek başına işe yaramaz (alan backend'e ulaşır ama kabul edilmez).

## Kapsam

YALNIZCA JSON import yolu: `lib/validations/importSchema.ts` içindeki
`importQuestionSchema` + `parseImportFile`.

Excel/CSV yolu (`parseExcelFile`/`parseCsvFile`/`rowsToResult`/`HEADERS`/`matchField`)
**KAPSAM DIŞI** — elle hazırlanan Excel/CSV dosyalarında AI etiketi olmaz, gerek yok.

## Değişiklik

**1. `importQuestionSchema`** (dosyanın başı, `body`/`categoryId`/... alanlarının
yanına) iki opsiyonel alan ekle:

```ts
export const importQuestionSchema = z.object({
  body: z.string().min(1, "soru metni zorunlu"),
  categoryId: z.string().uuid("kategori bulunamadı"),
  options: z.array(z.string().min(1)).min(2, "en az 2 şık gerekli"),
  correctAnswer: z.string().min(1, "doğru cevap zorunlu"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  explanation: z.string().optional(),
  year: z.number().optional(),
  questionType: z.enum(["MultipleChoice", "TrueFalse"]).default("MultipleChoice"),
  sourceText: z.string().optional(),
  verificationStatus: z.string().optional(),   // YENİ
  verificationNote: z.string().optional(),      // YENİ
});
```

**2. `parseImportFile`** fonksiyonunda, `candidate` objesine ekle (JSON path, `body.soru`/
`body.question` fallback'lerinin yanına, `sourceText` satırının hemen altına):

```ts
verificationStatus: row.verificationStatus != null ? String(row.verificationStatus) : undefined,
verificationNote: row.verificationNote != null ? String(row.verificationNote) : undefined,
```

Bundan sonra HİÇBİR BAŞKA DOSYA değişmiyor: `ImportSheet.tsx`'teki `createQuestion(q)`
çağrısı `q`'yu (artık bu iki alanı da taşıyan `ImportQuestion` nesnesini) olduğu gibi
POST ediyor; backend tarafı güncellenince zincir otomatik tamamlanır.

**Alan adları sabit sözleşme (3 repo ortak):** `verificationStatus`, `verificationNote` —
kpss-content-pipeline ve KpssSoru-backend spec'leriyle AYNI isim, camelCase.

## Test planı

⚠️ Bu repoda test altyapısı YOK (`package.json`'da test script'i/jest/vitest yok).
Geleneksel TDD (red/green) yapılamaz. Bunun yerine:

1. `npm run build` (veya `npx tsc --noEmit`) ile tip hatası olmadığını doğrula.
2. Elle doğrulama — örnek bir JSON ile `parseImportFile`'ı çağır (ör. geçici bir Node/ts-node
   script'iyle, veya repoda bir REPL ile), girdi:
   ```json
   [{"body": "test", "options": ["A", "B"], "correctAnswer": "A",
     "categoryId": "00000000-0000-0000-0000-000000000000",
     "verificationStatus": "supheli", "verificationNote": "kaynak desteklemiyor"}]
   ```
   çıktıda `valid[0].verificationStatus === "supheli"` ve
   `valid[0].verificationNote === "kaynak desteklemiyor"` olmalı.
3. Backend spec'i de uygulanmışsa: dev sunucusunda ("Soru İçe Aktar" ekranından) gerçek
   bir dosya yükleyip oluşan sorunun panelin "Sorular" listesinde `VerificationBadge` ile
   göründüğünü gözle teyit et.

## Kapsam DIŞI

- Excel/CSV import yolu.
- `ImportSheet.tsx`, `lib/api/questions.ts`, `lib/types.ts` — hiçbiri değişmiyor (zaten
  uyumlu/gerek yok).
- kpss-content-pipeline ve KpssSoru-backend tarafı — ayrı spec'ler.

## Kabul kriterleri

- [ ] `importQuestionSchema`'da iki yeni opsiyonel alan.
- [ ] `parseImportFile` onları okuyup taşıyor.
- [ ] Build/tip kontrolü hatasız.
- [ ] Elle doğrulama (test planı madde 2) yapıldı ve beklenen çıktı alındı.
