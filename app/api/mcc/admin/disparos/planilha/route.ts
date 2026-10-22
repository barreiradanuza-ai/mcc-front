import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { datacrazyConfigured, type DcCampoAdicional } from "@/lib/mcc/datacrazy";
import { getDcOptionsCached } from "@/lib/mcc/dcCache";
import { parseMapeamento, sugerirMapeamento } from "@/lib/mcc/disparos";
import { lerPlanilhaDaRequisicao } from "@/lib/mcc/disparosPlanilha";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_LINHAS = 5000;

/**
 * POST: lê uma planilha (arquivo ou jobId) e devolve cabeçalhos, linhas (até 5000,
 * para filtro/seleção na tela) e a sugestão de mapeamento — considerando os campos
 * adicionais do DataCrazy e, se informado, o mapeamento salvo no preset (presetId).
 * Não envia nada ao DataCrazy.
 */
export async function POST(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const lida = await lerPlanilhaDaRequisicao(req);
  if ("erro" in lida) return NextResponse.json({ error: lida.erro }, { status: 400 });

  let campos: DcCampoAdicional[] = [];
  if (datacrazyConfigured()) {
    try {
      campos = (await getDcOptionsCached()).campos;
    } catch {
      campos = [];
    }
  }

  let base;
  const presetId = Number(lida.extra.presetId);
  if (Number.isInteger(presetId) && presetId > 0) {
    const p = await prisma.disparoPreset.findUnique({ where: { id: presetId }, select: { mapeamento: true } });
    if (p) base = parseMapeamento(p.mapeamento);
  }

  const rows = lida.rows.slice(0, MAX_LINHAS);
  return NextResponse.json({
    arquivo: lida.arquivo,
    headers: lida.headers,
    total: lida.rows.length,
    truncado: lida.rows.length > MAX_LINHAS,
    rows,
    sugestao: sugerirMapeamento(lida.headers, campos, base),
  });
}
