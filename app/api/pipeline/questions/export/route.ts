import { NextRequest } from "next/server";
import { pipelineProxy } from "@/lib/api/pipeline-proxy";

/**
 * Üretilen soruları panelin "Soru İçe Aktar" formatında döndürür.
 * durum=hepsi: doğrulamadan geçmeyenler de gelir — eleme kullanıcıda
 * (doğrulayıcı AI yanılabiliyor).
 */
export async function GET(request: NextRequest) {
  const sourceId = request.nextUrl.searchParams.get("source_id");
  const query = new URLSearchParams({ format: "panel", durum: "hepsi" });
  if (sourceId) query.set("source_id", sourceId);
  return pipelineProxy(`/questions/export?${query.toString()}`);
}
