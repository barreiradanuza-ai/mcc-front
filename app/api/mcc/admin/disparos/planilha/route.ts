import { NextResponse } from "next/server";
import { ensureMccSession } from "@/lib/mcc/authz";
import { sugerirMapeamento } from "@/lib/mcc/disparos";
import { lerPlanilhaDaRequisicao } from "@/lib/mcc/disparosPlanilha";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST: lê uma planilha (arquivo ou jobId) e devolve cabeçalhos, total de linhas,
 * uma amostra e a sugestão de mapeamento. Não envia nada ao DataCrazy.
 */
export async function POST(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const lida = await lerPlanilhaDaRequisicao(req);
  if ("erro" in lida) return NextResponse.json({ error: lida.erro }, { status: 400 });
  const amostra = lida.rows.slice(0, 5);
  return NextResponse.json({
    arquivo: lida.arquivo,
    headers: lida.headers,
    total: lida.rows.length,
    amostra,
    sugestao: sugerirMapeamento(lida.headers),
  });
}
