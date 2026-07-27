import { NextResponse } from "next/server";

/**
 * Pipeline'a giden tüm proxy route'ların ortak, dayanıklı fetch'i.
 * - X-Api-Key'i sunucuda ekler (caller header'larıyla birleştirir).
 * - Ağ hatasında 502 + {error} döner (route çökmez).
 * - Yanıtı text okuyup güvenli JSON.parse eder; non-JSON'da upstream status'u
 *   KORUR ve {error} döner (200'ü maskelemez, çökmez).
 *
 * @param path Pipeline tabanına göre yol, örn. `/sources/${id}/topics`
 * @param init method/body/ek header. Content-Type helper eklemez (upload multipart).
 */
export async function pipelineProxy(
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  const headers = new Headers(init.headers);
  headers.set("X-Api-Key", process.env.PIPELINE_API_KEY ?? "");

  let res: Response;
  try {
    res = await fetch(`${process.env.PIPELINE_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: "Pipeline servisine ulaşılamıyor." },
      { status: 502 },
    );
  }

  const text = await res.text();
  if (!text) {
    return new NextResponse(null, { status: res.status });
  }
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Pipeline beklenmeyen bir yanıt döndürdü." },
      { status: res.status },
    );
  }
}
