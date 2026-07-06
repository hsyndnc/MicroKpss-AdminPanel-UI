import { z } from "zod";

export const importQuestionSchema = z.object({
  body: z.string().min(1, "body zorunlu"),
  categoryId: z.string().uuid("categoryId geçerli UUID olmalı"),
  options: z.array(z.string()).min(2, "en az 2 şık gerekli"),
  correctAnswer: z.string().min(1, "correctAnswer zorunlu"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).default("Medium"),
  explanation: z.string().optional(),
  year: z.number().optional(),
  questionType: z.enum(["MultipleChoice", "TrueFalse"]).default("MultipleChoice"),
});

export type ImportQuestion = z.infer<typeof importQuestionSchema>;

export function parseImportFile(
  content: string
): { valid: ImportQuestion[]; errors: string[] } {
  const errors: string[] = [];
  const valid: ImportQuestion[] = [];

  let raw: unknown;
  try { raw = JSON.parse(content); } catch {
    return { valid: [], errors: ["Geçersiz JSON formatı"] };
  }

  if (!Array.isArray(raw)) {
    return { valid: [], errors: ["JSON kök elemanı bir dizi olmalı: [...]"] };
  }

  raw.forEach((item, i) => {
    const result = importQuestionSchema.safeParse(item);
    if (result.success) valid.push(result.data);
    else errors.push(`Satır ${i + 1}: ${result.error.issues[0]?.message}`);
  });

  return { valid, errors };
}
