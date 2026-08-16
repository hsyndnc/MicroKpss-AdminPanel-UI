import { useQuery } from "@tanstack/react-query";
import { listReports } from "@/lib/api/reports";

export function useReports(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: ["admin-reports"], queryFn: listReports, enabled: options?.enabled });
}
