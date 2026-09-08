import { z } from "zod";
import type { ParsingOptions } from "xlsx";

export const importQuestionSchema = z.object({
  body: z.string().min(1, "soru metni zorunlu"),
  categoryId: z.string().uuid("kategori bulunamadı"),
  options: z.array(z.string().min(1)).min(2, "en az 2 şık gerekli"),
  correctAnswer: z.string().min(1, "doğru cevap zorunlu"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  explanation: z.string().optional(),
  year: z.number().optional(),
  questionType: z.enum(["MultipleChoice", "TrueFalse"]).default("MultipleChoice"),
});

export type ImportQuestion = z.infer<typeof importQuestionSchema>;

export type ParseResult = { valid: ImportQuestion[]; errors: string[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Küçük harf + kırp + Türkçe aksanları sadeleştir — başlık/kategori eşleştirmesi için. */
function normalize(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/\s+/g, " ");
}

/** Kategori adı → id haritası (normalize edilmiş anahtarla). */
export function buildCategoryMap(categories: { id: string; name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) map.set(normalize(c.name), c.id);
  return map;
}

/** UUID ise doğrudan; değilse kategori adını haritadan çöz. Bulunamazsa null. */
function resolveCategory(value: unknown, categoryMap: Map<string, string>): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (UUID_RE.test(raw)) return raw;
  return categoryMap.get(normalize(raw)) ?? null;
}

const DIFFICULTY: Record<string, "Easy" | "Medium" | "Hard"> = {
  kolay: "Easy", easy: "Easy",
  orta: "Medium", medium: "Medium", normal: "Medium",
  zor: "Hard", hard: "Hard",
};

function resolveDifficulty(value: unknown): "Easy" | "Medium" | "Hard" {
  return DIFFICULTY[normalize(value)] ?? "Medium";
}

const TYPE: Record<string, "MultipleChoice" | "TrueFalse"> = {
  multiplechoice: "MultipleChoice", coktan: "MultipleChoice", "coktan secmeli": "MultipleChoice",
  truefalse: "TrueFalse", "dogru yanlis": "TrueFalse", dy: "TrueFalse",
};

function resolveType(value: unknown): "MultipleChoice" | "TrueFalse" {
  return TYPE[normalize(value)] ?? "MultipleChoice";
}

/** Kategoriyi çöz; yoksa (boşsa) hedef derse düş. Değer verilmiş ama tanınmazsa null (hata). */
function pickCategory(rawCat: unknown, categoryMap: Map<string, string>, defaultCategoryId?: string): string | null {
  const resolved = resolveCategory(rawCat, categoryMap);
  if (resolved) return resolved;
  if (String(rawCat ?? "").trim()) return null; // değer var ama tanınmadı → hata
  return defaultCategoryId ?? null; // hiç kategori yok → seçilen hedef ders
}

/** "A) İlig" gibi baştaki şık etiketini temizler. */
function stripOptionPrefix(s: unknown): string {
  return String(s ?? "").replace(/^\s*[A-E]\)\s*/i, "").trim();
}

function letterToIndex(letter: unknown): number {
  return ["A", "B", "C", "D", "E"].indexOf(String(letter ?? "").trim().toUpperCase());
}

function pickYear(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** JSON satırından doğru cevabı metin olarak çöz: correctAnswer > dogru_indeks > dogru_harf. */
function resolveCorrectJson(row: Record<string, unknown>, options: string[]): string {
  const ca = row.correctAnswer;
  if (ca != null && String(ca).trim() !== "") {
    const s = String(ca).trim();
    const idx = letterToIndex(s);
    if (s.length === 1 && idx >= 0 && options[idx]) return options[idx];
    return s;
  }
  if (row.dogru_indeks != null && row.dogru_indeks !== "") {
    const idx = Number(row.dogru_indeks);
    if (Number.isInteger(idx) && options[idx]) return options[idx];
  }
  const harfIdx = letterToIndex(row.dogru_harf);
  if (harfIdx >= 0 && options[harfIdx]) return options[harfIdx];
  return "";
}

// ---- JSON ----

export function parseImportFile(content: string, categoryMap: Map<string, string>, defaultCategoryId?: string): ParseResult {
  let raw: unknown;
  try { raw = JSON.parse(content); } catch {
    return { valid: [], errors: ["Geçersiz JSON formatı"] };
  }
  if (!Array.isArray(raw)) {
    return { valid: [], errors: ["JSON kök elemanı bir dizi olmalı: [...]"] };
  }

  const errors: string[] = [];
  const valid: ImportQuestion[] = [];

  raw.forEach((item, i) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const rawCat = row.categoryId ?? row.categoryName ?? row.kategori;
    const categoryId = pickCategory(rawCat, categoryMap, defaultCategoryId);

    const bodyRaw = row.body ?? row.soru;
    const optionsSrc = Array.isArray(row.options) ? row.options
      : Array.isArray(row.siklar) ? row.siklar
      : [];
    const options = optionsSrc.map(stripOptionPrefix).filter((v) => v.length > 0);

    const candidate = {
      body: typeof bodyRaw === "string" ? bodyRaw : String(bodyRaw ?? ""),
      categoryId: categoryId ?? "",
      options,
      correctAnswer: resolveCorrectJson(row, options),
      difficulty: resolveDifficulty(row.difficulty ?? row.zorluk),
      explanation: row.explanation != null ? String(row.explanation) : undefined,
      year: pickYear(row.year ?? row.yil),
      questionType: resolveType(row.questionType),
    };
    pushValidated(candidate, categoryId, rawCat, i + 1, valid, errors);
  });

  return { valid, errors };
}

// ---- Excel ----

const OPTION_LETTERS = ["a", "b", "c", "d", "e"] as const;

// Normalize edilmiş başlık → alan eşleşmeleri
const HEADERS = {
  body: ["soru", "body", "question", "metin"],
  category: ["kategori", "category", "categoryid", "categoryname", "kategori adi", "ders", "konu"],
  correct: ["dogru", "dogru cevap", "dogrucevap", "cevap", "correctanswer", "correct", "answer"],
  difficulty: ["zorluk", "difficulty", "seviye"],
  explanation: ["aciklama", "explanation", "cozum", "izah"],
  year: ["yil", "year"],
  type: ["tip", "tur", "questiontype", "type"],
};

function matchField(header: string): keyof typeof HEADERS | null {
  for (const field of Object.keys(HEADERS) as (keyof typeof HEADERS)[]) {
    if (HEADERS[field].includes(header)) return field;
  }
  return null;
}

/** Bir şık sütunu mu? "a".."e", "secenek a", "sik a", "option a" gibi → harf döner. */
const OPTION_HEADER_RE = /^(?:secenek|sik|option)?\s*([a-e])$/;
function matchOptionLetter(header: string): string | null {
  return OPTION_HEADER_RE.exec(header)?.[1] ?? null;
}

/** xlsx'i yalnızca dosya seçilince yükle — başlangıç paketine girmesin. Excel + CSV ortak. */
async function parseSheet(
  input: ArrayBuffer | string,
  readOpts: ParsingOptions,
  readErr: string,
  categoryMap: Map<string, string>,
  defaultCategoryId?: string,
): Promise<ParseResult> {
  let rows: Record<string, string>[];
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(input, readOpts);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = sheet ? XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false }) : [];
  } catch {
    return { valid: [], errors: [readErr] };
  }
  return rowsToResult(rows, categoryMap, defaultCategoryId);
}

export function parseExcelFile(buffer: ArrayBuffer, categoryMap: Map<string, string>, defaultCategoryId?: string): Promise<ParseResult> {
  return parseSheet(buffer, { type: "array" }, "Excel dosyası okunamadı", categoryMap, defaultCategoryId);
}

export function parseCsvFile(text: string, categoryMap: Map<string, string>, defaultCategoryId?: string): Promise<ParseResult> {
  return parseSheet(text, { type: "string", FS: detectCsvDelimiter(text) }, "CSV dosyası okunamadı", categoryMap, defaultCategoryId);
}

/** İlk satırdaki ayraç sayımıyla CSV ayracını sez (Türkçe Excel çoğu zaman ';' kullanır). */
function detectCsvDelimiter(text: string): string {
  const nl = text.search(/\r?\n/);
  const firstLine = nl >= 0 ? text.slice(0, nl) : text;
  const semi = (firstLine.match(/;/g) ?? []).length;
  const comma = (firstLine.match(/,/g) ?? []).length;
  return semi > comma ? ";" : ",";
}

/** Sayfa satırlarını (başlık→değer nesneleri) doğrulanmış sorulara çevirir. Excel + CSV ortak. */
function rowsToResult(rows: Record<string, string>[], categoryMap: Map<string, string>, defaultCategoryId?: string): ParseResult {
  if (rows.length === 0) return { valid: [], errors: ["Dosya boş görünüyor"] };

  // Başlıklar her satırda aynı — sınıflandırmayı satır döngüsünden önce bir kez yap.
  const fieldOf = new Map<string, keyof typeof HEADERS>();
  const optionOf = new Map<string, string>();
  for (const header of Object.keys(rows[0])) {
    const key = normalize(header);
    const field = matchField(key);
    if (field) { fieldOf.set(header, field); continue; }
    const letter = matchOptionLetter(key);
    if (letter) optionOf.set(header, letter);
  }

  const errors: string[] = [];
  const valid: ImportQuestion[] = [];

  rows.forEach((rawRow, i) => {
    const rowNo = i + 2; // 1. satır başlık
    const fields: Partial<Record<keyof typeof HEADERS, string>> = {};
    const optionByLetter: Record<string, string> = {};
    let hasValue = false;

    for (const [header, value] of Object.entries(rawRow)) {
      const v = String(value ?? "").trim();
      if (v) hasValue = true;
      const field = fieldOf.get(header);
      if (field) { fields[field] = v; continue; }
      const letter = optionOf.get(header);
      if (letter) optionByLetter[letter] = v;
    }
    if (!hasValue) return; // boş satırı atla

    const options = OPTION_LETTERS
      .map((L) => optionByLetter[L])
      .filter((v): v is string => !!v && v.length > 0);

    const categoryRaw = fields.category;
    const categoryId = pickCategory(categoryRaw, categoryMap, defaultCategoryId);

    const candidate = {
      body: fields.body ?? "",
      categoryId: categoryId ?? "",
      options,
      correctAnswer: resolveCorrect(fields.correct ?? "", optionByLetter),
      difficulty: resolveDifficulty(fields.difficulty),
      explanation: fields.explanation || undefined,
      year: fields.year ? Number(fields.year) : undefined,
      questionType: resolveType(fields.type),
    };
    pushValidated(candidate, categoryId, categoryRaw, rowNo, valid, errors);
  });

  return { valid, errors };
}

/** Doğru cevap harf ise (A-E) ilgili şıkkın metnine çevir; değilse olduğu gibi bırak. */
function resolveCorrect(raw: string, optionByLetter: Record<string, string>): string {
  const key = normalize(raw);
  if (key.length === 1 && optionByLetter[key]) return optionByLetter[key];
  return raw.trim();
}

/** Ortak doğrulama + hata mesajı üretimi. */
function pushValidated(
  candidate: Record<string, unknown>,
  categoryId: string | null,
  categoryRaw: unknown,
  rowNo: number,
  valid: ImportQuestion[],
  errors: string[],
): void {
  if (!categoryId) {
    const rawCat = String(categoryRaw ?? "").trim();
    errors.push(`Satır ${rowNo}: ${rawCat ? `kategori bulunamadı ("${rawCat}")` : "kategori yok — üstten bir hedef ders seç"}`);
    return;
  }
  const result = importQuestionSchema.safeParse(candidate);
  if (result.success) valid.push(result.data);
  else errors.push(`Satır ${rowNo}: ${result.error.issues[0]?.message}`);
}
