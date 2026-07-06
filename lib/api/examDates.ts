import { apiClient } from "./client";
import type { ExamDateDto, KpssType } from "@/lib/types";

export async function getExamDate(kpssType: KpssType): Promise<ExamDateDto | null> {
  try {
    const { data } = await apiClient.get<ExamDateDto>(`/exam-dates/${kpssType}`);
    return data;
  } catch (e: unknown) {
    if ((e as { response?: { status?: number } }).response?.status === 404) return null;
    throw e;
  }
}

export async function upsertExamDate(kpssType: KpssType, date: string): Promise<ExamDateDto> {
  const { data } = await apiClient.put<ExamDateDto>("/admin/exam-dates", { kpssType, date });
  return data;
}
