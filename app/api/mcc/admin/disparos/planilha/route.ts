import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { datacrazyConfigured, type DcCampoAdicional } from "@/lib/mcc/datacrazy";
import { getDcOptionsCached } from "@/lib/mcc/dcCache";
import { consultarEnviadosDetalhado, parseMapeamento, sugerirMapeamento, type EnviadoInfo } from "@/lib/mcc/disparos";
import { lerPlanilhaDaRequisicao, salvarBase } from "@/lib/mcc/disparosPlanilha";

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
  const sugestao = sugerirMapeamento(lida.headers, campos, base);
  // Quais linhas já foram enviadas ao DataCrazy (pelo telefone/CPF das colunas sugeridas).
  let enviados: (EnviadoInfo | null)[] = rows.map(() => null);
  try {
    enviados = await consultarEnviadosDetalhado(rows, sugestao.campos.phone, sugestao.campos.taxId);
  } catch (e) {
    console.warn("[disparos] consulta de enviados falhou:", e instanceof Error ? e.message : e);
  }

  // Planilha nova (arquivo ou job) vira uma base salva, para segmentar depois sem subir de novo.
  let baseId = Number(lida.extra.baseId) || null;
  if (!baseId && lida.extra.salvarBase !== "0") {
    try {
      baseId = await salvarBase(lida, lida.extra.jobId ? "processamento" : "upload");
    } catch (e) {
      console.warn("[disparos] não foi possível guardar a base:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    baseId,
    arquivo: lida.arquivo,
    headers: lida.headers,
    total: lida.rows.length,
    truncado: lida.rows.length > MAX_LINHAS,
    rows,
    enviadoEm: enviados.map((e) => e?.enviadoEm ?? null),
    enviadoTag: enviados.map((e) => e?.tagNome ?? null),
    sugestao,
  });
}
