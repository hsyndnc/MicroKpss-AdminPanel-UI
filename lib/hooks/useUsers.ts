import { useQuery } from "@tanstack/react-query";
import { getAdminUsers } from "@/lib/api/users";

export function useUsers(page = 1) {
  return useQuery({
    queryKey: ["admin-users", page],
    queryFn: () => getAdminUsers(page),
  });
}
