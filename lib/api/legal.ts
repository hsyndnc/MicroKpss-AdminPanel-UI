import { apiClient } from "./client";
import type { LegalDocument, LegalDocumentType } from "@/lib/types";

export async function getLegalDocument(type: LegalDocumentType): Promise<LegalDocument | null> {
  try {
    const { data } = await apiClient.get<LegalDocument>(`/legal/${type}`);
    return data;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "response" in error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 404) return null;
    }
    throw error;
  }
}

export async function upsertLegalDocument(type: LegalDocumentType, content: string): Promise<LegalDocument> {
  const { data } = await apiClient.put<LegalDocument>("/admin/legal", { type, content });
  return data;
}
