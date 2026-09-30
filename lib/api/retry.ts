/**
 * Backend hız sınırına (rate limit) takılan istekleri bekleyip yeniden dener.
 *
 * Backend giriş yapmış kullanıcıya dakikada 120 istek veriyor, kuyruk YOK —
 * sınırı aşan istek anında 429 ile reddediliyor. Toplu içe aktarım bu sınırı
 * aştığında sorular sessizce kaybolmasın diye beklenip tekrar denenir.
 */

/** Varsayılan bekleme aralıkları: pencere 1 dakika olduğu için sonuncusu onu aşar. */
const BACKOFF_MS = [5_000, 15_000, 35_000, 65_000] as const;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Hata hız sınırından mı geliyor? (axios hata nesnesi duck-type okunur) */
export function isRateLimited(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 429;
}

/** Sunucu `Retry-After` verdiyse milisaniye olarak döner, yoksa null. */
export function retryAfterMs(error: unknown): number | null {
  const raw = (error as { response?: { headers?: Record<string, unknown> } })
    ?.response?.headers?.["retry-after"];
  if (raw == null) return null;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

/**
 * `send`'i çağırır; yalnızca 429'da bekleyip yeniden dener. Başka her hata
 * (400 doğrulama, 500 vb.) anında yukarı fırlatılır — onları yutmak veri
 * sorunlarını gizlerdi.
 *
 * `sleep` enjekte edilebilir: testler gerçek süre beklemeden çalışsın diye.
 */
export async function withRateLimitRetry<T>(
  send: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = defaultSleep,
  backoffMs: readonly number[] = BACKOFF_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send();
    } catch (error) {
      if (!isRateLimited(error) || attempt >= backoffMs.length) throw error;
      await sleep(retryAfterMs(error) ?? backoffMs[attempt]);
    }
  }
}
