import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { datacrazyConfigured } from "@/lib/mcc/datacrazy";
import { resultadoDaBase } from "@/lib/mcc/disparosResultados";

export const runtime = "nodejs";
export const maxDuration = 120;

/** GET ?envioId=N (ou ?tag=nome) [&refresh=1]: retorno da base no DataCrazy. */
export async function GET(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;
  if (!datacrazyConfigured()) return NextResponse.json({ error: "DATACRAZY_TOKEN não configurado" }, { status: 400 });

  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";
  let tag = url.searchParams.get("tag")?.trim() || "";
  let enviados: number | null = null;
  const envioId = Number(url.searchParams.get("envioId"));
  if (Number.isInteger(envioId) && envioId > 0) {
    const envio = await prisma.disparoEnvio.findUnique({ where: { id: envioId }, select: { tagNome: true, criados: true, atualizados: true } });
    if (!envio) return NextResponse.json({ error: "Envio não encontrado" }, { status: 404 });
    if (!envio.tagNome) return NextResponse.json({ error: "Este envio não tem tag própria; o retorno é medido pela tag da base." }, { status: 400 });
    tag = envio.tagNome;
    enviados = envio.criados + envio.atualizados;
  }
  if (!tag) return NextResponse.json({ error: "Informe a tag ou o envio" }, { status: 400 });

  try {
    const r = await resultadoDaBase(tag, refresh);
    return NextResponse.json({ ...r, enviados });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao consultar o DataCrazy" }, { status: 502 });
  }
}
