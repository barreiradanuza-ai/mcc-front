import { NextResponse } from "next/server";
import { ensureMccSession } from "@/lib/mcc/authz";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const url = new URL(req.url);
  const cep = (url.searchParams.get("cep") ?? "").replace(/\D/g, "");
  if (cep.length !== 8) {
    return NextResponse.json({ error: "Informe um CEP com 8 dígitos" }, { status: 400 });
  }

  const serviceUrl = process.env.NIO_LIVE_QUERY_URL;
  if (!serviceUrl) {
    return NextResponse.json({ error: "Serviço isolado NIO não configurado" }, { status: 503 });
  }

  const headers: HeadersInit = {};
  if (process.env.NIO_LIVE_API_KEY) headers["X-API-Key"] = process.env.NIO_LIVE_API_KEY;
  try {
    const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/api/live-facades?cep=${cep}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(120000),
    });
    const body = await response.json().catch(() => ({ error: "Resposta inválida do serviço NIO" }));
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Serviço de consulta NIO indisponível ou expirou o tempo limite" }, { status: 504 });
  }
}
