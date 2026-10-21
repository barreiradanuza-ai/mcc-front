import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { datacrazyConfigured } from "@/lib/mcc/datacrazy";
import { garantirTag, hasRunningEnvio, iniciarEnvio, parseMapeamento, resolverNomeTag, type PresetEnvio } from "@/lib/mcc/disparos";
import { lerPlanilhaDaRequisicao } from "@/lib/mcc/disparosPlanilha";

export const runtime = "nodejs";
export const maxDuration = 30; // só para receber o arquivo; o envio roda em segundo plano

/** GET: histórico de envios (mais recentes primeiro). */
export async function GET(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") || 50), 200);
  const envios = await prisma.disparoEnvio.findMany({
    orderBy: { id: "desc" },
    take: limit,
    select: {
      id: true, presetId: true, presetNome: true, arquivo: true, tagNome: true, status: true, total: true, filtrados: true,
      criados: true, atualizados: true, falhas: true, mensagem: true, createdAt: true, finishedAt: true,
    },
  });
  return NextResponse.json({ envios });
}

/**
 * POST: inicia um envio. multipart com "file" + "presetId" (ou "jobId" + "presetId").
 * Responde logo com o id do envio; o progresso é consultado em /envios/[id].
 */
export async function POST(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;
  if (!datacrazyConfigured()) return NextResponse.json({ error: "DATACRAZY_TOKEN não configurado no servidor" }, { status: 400 });
  if (hasRunningEnvio()) return NextResponse.json({ error: "Já existe um envio em andamento. Aguarde terminar." }, { status: 409 });

  const lida = await lerPlanilhaDaRequisicao(req);
  if ("erro" in lida) return NextResponse.json({ error: lida.erro }, { status: 400 });

  const presetId = Number(lida.extra.presetId);
  if (!Number.isInteger(presetId) || presetId <= 0) return NextResponse.json({ error: "Escolha o disparo" }, { status: 400 });
  const p = await prisma.disparoPreset.findUnique({ where: { id: presetId } });
  if (!p) return NextResponse.json({ error: "Disparo não encontrado" }, { status: 404 });

  // Tag: fixa (do preset) ou criada por envio (nome vindo da tela ou do padrão do preset).
  let tagId = p.tagId;
  let tagNome = p.tagNome;
  if (p.tagModo === "por_envio") {
    const nome = (lida.extra.tagNome || "").trim() || resolverNomeTag(p.tagPadrao, lida.arquivo);
    if (!nome) return NextResponse.json({ error: "Informe o nome da tag deste envio" }, { status: 400 });
    try {
      const t = await garantirTag(nome);
      tagId = t.id;
      tagNome = t.name;
    } catch (e) {
      return NextResponse.json({ error: `Não foi possível criar a tag no DataCrazy: ${e instanceof Error ? e.message : e}` }, { status: 502 });
    }
  }

  const preset: PresetEnvio = {
    id: p.id,
    nome: p.nome,
    listaId: p.listaId,
    tagId,
    tagNome,
    stageId: p.stageId,
    origem: p.origem,
    filtroColuna: p.filtroColuna,
    filtroValor: p.filtroValor,
    mapeamento: parseMapeamento(p.mapeamento),
  };

  // Confere se as colunas obrigatórias existem nesta planilha.
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const faltam = ["name", "phone"].filter((k) => {
    const col = preset.mapeamento.campos[k as "name" | "phone"];
    return !col || !lida.headers.some((h) => norm(h) === norm(col));
  });
  if (faltam.length) {
    return NextResponse.json(
      { error: `A planilha não tem as colunas mapeadas para ${faltam.map((k) => (k === "name" ? "Nome" : "Telefone")).join(" e ")} neste disparo` },
      { status: 400 },
    );
  }

  const job = await iniciarEnvio(lida.rows, lida.arquivo, preset);
  return NextResponse.json({ id: job.id, total: job.total, tagNome: job.tagNome }, { status: 202 });
}
