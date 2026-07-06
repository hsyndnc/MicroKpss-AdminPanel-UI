import { apiClient } from "./client";
import type { AdminCategory } from "@/lib/types";

export async function getAdminCategories(): Promise<AdminCategory[]> {
  const { data } = await apiClient.get<AdminCategory[]>("/admin/categories");
  return data;
}

export async function createCategory(body: { name: string; parentCategoryId?: string }): Promise<AdminCategory> {
  const { data } = await apiClient.post<AdminCategory>("/admin/categories", body);
  return data;
}

export async function updateCategory(id: string, body: { name: string; parentCategoryId?: string }): Promise<AdminCategory> {
  const { data } = await apiClient.put<AdminCategory>(`/admin/categories/${id}`, body);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/admin/categories/${id}`);
}
