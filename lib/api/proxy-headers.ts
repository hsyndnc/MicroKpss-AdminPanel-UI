/**
 * Backend yanıtından panele geçirilecek başlıkları seçer.
 *
 * Proxy varsayılan olarak hiçbir başlığı aktarmaz; burada yalnız panelin gerçekten
 * okuduğu başlıklar beyaz listeye alınır.
 */
export function proxyResponseHeaders(
  from: Headers,
  hasPayload: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {};

  const contentType = from.get("content-type");
  if (contentType) headers["content-type"] = contentType;
  else if (hasPayload) headers["content-type"] = "application/json";

  // 429'da backend "kaç saniye sonra gel" diyor. Aktarılmazsa panelin yeniden
  // deneme mantığı (lib/api/retry.ts) körlemesine tahmin yürütmek zorunda kalır.
  const retryAfter = from.get("retry-after");
  if (retryAfter) headers["retry-after"] = retryAfter;

  return headers;
}
