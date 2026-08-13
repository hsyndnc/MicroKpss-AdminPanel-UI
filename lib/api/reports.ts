import { apiClient } from "./client";
import type { ReportedQuestion } from "@/lib/types";

export async function listReports(): Promise<ReportedQuestion[]> {
  const { data } = await apiClient.get<ReportedQuestion[]>("/admin/reports");
  return data;
}

export async function dismissReport(questionId: string): Promise<void> {
  await apiClient.post(`/admin/reports/${questionId}/dismiss`);
}
