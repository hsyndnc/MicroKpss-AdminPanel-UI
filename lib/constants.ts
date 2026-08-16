import type { ReportReason } from "@/lib/types";

export const REASON_LABELS: Record<ReportReason, string> = {
  WrongAnswer: "Yanlış cevap",
  Typo: "Yazım",
  Nonsense: "Anlamsız",
  Inappropriate: "Uygunsuz",
  Other: "Diğer",
};
