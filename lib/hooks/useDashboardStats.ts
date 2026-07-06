import { useQuery } from "@tanstack/react-query";
import { getAdminStats } from "@/lib/api/stats";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    staleTime: 5 * 60 * 1000,
  });
}
