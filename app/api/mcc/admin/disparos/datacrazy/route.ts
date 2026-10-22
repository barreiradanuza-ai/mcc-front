import { NextResponse } from "next/server";
import { ensureMccSession } from "@/lib/mcc/authz";
import { DataCrazyError, datacrazyConfigured, dcCreateLista, dcCreateTag } from "@/lib/mcc/datacrazy";
import { getDcOptionsCached, invalidateDcOptionsCache } from "@/lib/mcc/dcCache";

export const runtime = "nodejs";

/** GET: catálogo do DataCrazy (listas, tags, funis/etapas). ?refresh=1 ignora o cache. */
export async function GET(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;

  if (!datacrazyConfigured()) {
    return NextResponse.json({ configured: false, error: "DATACRAZY_TOKEN não configurado no servidor" }, { status: 200 });
  }

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    const data = await getDcOptionsCached(refresh);
    return NextResponse.json({ configured: true, ...data });
  } catch (e) {
    const status = e instanceof DataCrazyError ? e.status : 500;
    const msg = e instanceof Error ? e.message : "Falha ao consultar o DataCrazy";
    return NextResponse.json({ configured: true, error: msg }, { status: status === 401 || status === 403 ? 200 : 502 });
  }
}

/** POST: cria uma tag ou lista no DataCrazy. Body: { tipo: "tag" | "lista", nome, descricao? } */
export async function POST(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;
  if (!datacrazyConfigured()) return NextResponse.json({ error: "DATACRAZY_TOKEN não configurado" }, { status: 400 });

  let body: { tipo?: string; nome?: string; descricao?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const nome = String(body.nome ?? "").trim();
  if (!nome) return NextResponse.json({ error: "Informe o nome" }, { status: 400 });

  try {
    const created = body.tipo === "lista" ? await dcCreateLista(nome, body.descricao) : await dcCreateTag(nome);
    invalidateDcOptionsCache();
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao criar no DataCrazy" }, { status: 502 });
  }
}
