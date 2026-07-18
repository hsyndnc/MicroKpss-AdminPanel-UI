import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminUsers, getAdminUserById, updateUserRole, type GetUsersParams } from "@/lib/api/users";
import type { UserRole } from "@/lib/types";

export function useUsers(params: GetUsersParams = {}) {
  return useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => getAdminUsers(params),
  });
}

export function useUserDetail(id: string | null) {
  return useQuery({
    queryKey: ["admin-user", id],
    queryFn: () => getAdminUserById(id!),
    enabled: !!id,
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateUserRole(id, role),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user", id] });
    },
  });
}
