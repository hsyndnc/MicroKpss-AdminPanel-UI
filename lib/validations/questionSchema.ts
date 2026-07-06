import { z } from "zod";

export const questionSchema = z.object({
  body: z.string().min(1, "Soru metni zorunlu").max(2000),
  categoryId: z.string().uuid("Kategori seçin"),
  questionType: z.enum(["MultipleChoice", "TrueFalse"]),
  options: z.array(z.string().min(1, "Şık boş olamaz")).min(2, "En az 2 şık gerekli"),
  correctAnswer: z.string().min(1, "Doğru cevap seçin"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  explanation: z.string().optional(),
  imageUrl: z.string().optional(),
  year: z.number().optional(),
});

export type QuestionInput = z.infer<typeof questionSchema>;
