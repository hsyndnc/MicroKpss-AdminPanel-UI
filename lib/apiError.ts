/**
 * Backend hata gövdesinden kullanıcıya gösterilebilir bir cümle çıkarır.
 *
 * Üç biçim görülüyor:
 *  - `{ error: "..." }`        — backend'in kendi iş kuralı hataları
 *  - ProblemDetails `errors`   — ASP.NET model doğrulama hataları; işe yarayan cümle
 *                                burada, `title` ise genel ("One or more validation
 *                                errors occurred."), o yüzden `errors` önce okunur
 *  - ProblemDetails `title`    — doğrulama dışı hatalar
 *
 * Hiçbiri yoksa `undefined` döner; çağıran kendi genel mesajını kullanır.
 */
export function backendErrorMessage(err: unknown): string | undefined {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (!data || typeof data !== "object") return undefined;

  const body = data as { error?: unknown; errors?: unknown; title?: unknown };

  if (typeof body.error === "string" && body.error.trim()) return body.error;

  if (body.errors && typeof body.errors === "object") {
    for (const value of Object.values(body.errors as Record<string, unknown>)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === "string" && first.trim()) return first;
    }
  }

  if (typeof body.title === "string" && body.title.trim()) return body.title;

  return undefined;
}
