import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminQuestions, approveQuestion, rejectQuestion, deleteQuestion,
  type GetQuestionsParams,
} from "@/lib/api/questions";

export function useQuestions(params: GetQuestionsParams) {
  return useQuery({
    queryKey: ["admin-questions", params],
    queryFn: () => getAdminQuestions(params),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin-questions"] });
  qc.invalidateQueries({ queryKey: ["admin-stats"] });
}

export function useApproveQuestion() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: approveQuestion, onSuccess: () => invalidate(qc) });
}

export function useRejectQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectQuestion(id, reason),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: deleteQuestion, onSuccess: () => invalidate(qc) });
}
