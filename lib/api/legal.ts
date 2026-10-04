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

export async function publishLegalDocumentVersion(
  type: LegalDocumentType,
  content: string,
  requiresReconsent: boolean
): Promise<LegalDocument> {
  const { data } = await apiClient.put<LegalDocument>("/admin/legal", {
    type,
    content,
    requiresReconsent,
  });
  return data;
}

export async function getLegalDocumentVersion(
  type: LegalDocumentType,
  version: number
): Promise<LegalDocument> {
  const { data } = await apiClient.get<LegalDocument>(`/legal/${type}/versions/${version}`);
  return data;
}
