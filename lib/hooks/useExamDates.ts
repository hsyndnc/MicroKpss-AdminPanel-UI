import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getExamDate, upsertExamDate } from "@/lib/api/examDates";
import type { KpssType } from "@/lib/types";

export function useExamDate(kpssType: KpssType) {
  return useQuery({
    queryKey: ["exam-date", kpssType],
    queryFn: () => getExamDate(kpssType),
  });
}

export function useUpsertExamDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kpssType, date }: { kpssType: KpssType; date: string }) =>
      upsertExamDate(kpssType, date),
    onSuccess: (_, { kpssType }) =>
      qc.invalidateQueries({ queryKey: ["exam-date", kpssType] }),
  });
}
