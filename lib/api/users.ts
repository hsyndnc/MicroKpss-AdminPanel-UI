import { apiClient } from "./client";
import type { AdminUser, AdminUserDetail, PagedResult, UserRole } from "@/lib/types";

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  kpssType?: string;
}

export async function getAdminUsers(params: GetUsersParams = {}): Promise<PagedResult<AdminUser>> {
  const { page = 1, pageSize = 20, search, role, kpssType } = params;
  const { data } = await apiClient.get<PagedResult<AdminUser>>("/admin/users", {
    params: {
      page,
      pageSize,
      ...(search ? { search } : {}),
      ...(role ? { role } : {}),
      ...(kpssType ? { kpssType } : {}),
    },
  });
  return data;
}

export async function getAdminUserById(id: string): Promise<AdminUserDetail> {
  const { data } = await apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
  return data;
}

export async function updateUserRole(id: string, role: UserRole): Promise<void> {
  await apiClient.put(`/admin/users/${id}/role`, { role });
}
