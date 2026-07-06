import { apiClient } from "./client";
import type { AdminQuestion, PagedResult } from "@/lib/types";

export interface GetQuestionsParams {
  status?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export async function getAdminQuestions(params: GetQuestionsParams): Promise<PagedResult<AdminQuestion>> {
  const { data } = await apiClient.get<PagedResult<AdminQuestion>>("/admin/questions", { params });
  return data;
}

export async function getAdminQuestionById(id: string): Promise<AdminQuestion> {
  const { data } = await apiClient.get<AdminQuestion>(`/admin/questions/${id}`);
  return data;
}

export async function createQuestion(body: Partial<AdminQuestion>): Promise<AdminQuestion> {
  const { data } = await apiClient.post<AdminQuestion>("/admin/questions", body);
  return data;
}

export async function updateQuestion(id: string, body: Partial<AdminQuestion>): Promise<AdminQuestion> {
  const { data } = await apiClient.put<AdminQuestion>(`/admin/questions/${id}`, body);
  return data;
}

export async function approveQuestion(id: string): Promise<void> {
  await apiClient.post(`/admin/questions/${id}/approve`);
}

export async function rejectQuestion(id: string): Promise<void> {
  await apiClient.post(`/admin/questions/${id}/reject`);
}

export async function deleteQuestion(id: string): Promise<void> {
  await apiClient.delete(`/admin/questions/${id}`);
}
