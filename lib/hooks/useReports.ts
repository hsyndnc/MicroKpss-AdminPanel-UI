import { useQuery } from "@tanstack/react-query";
import { listReports } from "@/lib/api/reports";

export function useReports() {
  return useQuery({ queryKey: ["admin-reports"], queryFn: listReports });
}
