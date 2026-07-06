import { apiClient } from "./client";
import type { AdminUser, PagedResult } from "@/lib/types";

export async function getAdminUsers(page = 1, pageSize = 20): Promise<PagedResult<AdminUser>> {
  const { data } = await apiClient.get<PagedResult<AdminUser>>("/admin/users", {
    params: { page, pageSize },
  });
  return data;
}
