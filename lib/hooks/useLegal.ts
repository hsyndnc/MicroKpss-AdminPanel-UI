import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLegalDocument, upsertLegalDocument } from "@/lib/api/legal";
import type { LegalDocumentType } from "@/lib/types";

export function useLegalDocument(type: LegalDocumentType) {
  return useQuery({
    queryKey: ["legal", type],
    queryFn: () => getLegalDocument(type),
  });
}

export function useUpsertLegalDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, content }: { type: LegalDocumentType; content: string }) =>
      upsertLegalDocument(type, content),
    onSuccess: (_, { type }) =>
      qc.invalidateQueries({ queryKey: ["legal", type] }),
  });
}
