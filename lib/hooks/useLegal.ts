import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLegalDocument, publishLegalDocumentVersion } from "@/lib/api/legal";
import type { LegalDocumentType } from "@/lib/types";

export function useLegalDocument(type: LegalDocumentType) {
  return useQuery({
    queryKey: ["legal", type],
    queryFn: () => getLegalDocument(type),
  });
}

export function usePublishLegalDocumentVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      content,
      requiresReconsent,
    }: {
      type: LegalDocumentType;
      content: string;
      requiresReconsent: boolean;
    }) => publishLegalDocumentVersion(type, content, requiresReconsent),
    onSuccess: (_, { type }) =>
      qc.invalidateQueries({ queryKey: ["legal", type] }),
  });
}

export function useRefetchLegalDocument() {
  const qc = useQueryClient();
  return async (type: LegalDocumentType) => {
    const fresh = await getLegalDocument(type);
    qc.setQueryData(["legal", type], fresh);
    return fresh;
  };
}
