import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "İsim zorunlu").max(100),
  parentCategoryId: z.string().uuid().optional().or(z.literal("")),
});

export type CategoryInput = z.infer<typeof categorySchema>;
