import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { datacrazyConfigured, type DcCampoAdicional } from "@/lib/mcc/datacrazy";
import { getDcOptionsCached } from "@/lib/mcc/dcCache";
import { garantirTag, hasRunningEnvio, iniciarEnvio, parseMapeamento, resolverNomeTag, validarMapeamento, type PresetEnvio } from "@/lib/mcc/disparos";
import type { Prisma } from "@/lib/generated/prisma/client";
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
 * Opcionais: "mapeamento" (JSON, substitui o do preset), "salvarMapeamento" ("1" grava
 * no preset), "linhas" (JSON com os índices das linhas selecionadas; sem ele vão todas),
 * "tagNome" (tag deste envio). Responde logo com o id; progresso em /envios/[id].
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

  // Mapeamento: o enviado pela tela (se houver) tem prioridade sobre o do preset.
  let mapeamento = parseMapeamento(p.mapeamento);
  if (lida.extra.mapeamento) {
    try {
      mapeamento = parseMapeamento(JSON.parse(lida.extra.mapeamento));
    } catch {
      return NextResponse.json({ error: "Mapeamento inválido" }, { status: 400 });
    }
    if (lida.extra.salvarMapeamento === "1") {
      await prisma.disparoPreset.update({ where: { id: p.id }, data: { mapeamento: mapeamento as unknown as Prisma.InputJsonValue } });
    }
  }
  const erroMap = validarMapeamento(mapeamento);
  if (erroMap) return NextResponse.json({ error: erroMap }, { status: 400 });

  // Seleção de linhas (índices na planilha, base 0). Sem "linhas", envia todas.
  let rows = lida.rows;
  let indices = lida.rows.map((_, i) => i);
  if (lida.extra.linhas) {
    try {
      const idx = JSON.parse(lida.extra.linhas) as unknown;
      if (!Array.isArray(idx)) throw new Error();
      const set = new Set(idx.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n < lida.rows.length));
      indices = lida.rows.map((_, i) => i).filter((i) => set.has(i));
      rows = indices.map((i) => lida.rows[i]);
    } catch {
      return NextResponse.json({ error: "Seleção de linhas inválida" }, { status: 400 });
    }
    if (rows.length === 0) return NextResponse.json({ error: "Nenhuma linha selecionada" }, { status: 400 });
  }

  let camposAdicionais: DcCampoAdicional[] | undefined;
  try {
    camposAdicionais = (await getDcOptionsCached()).campos;
  } catch {
    /* segue sem conversão de tipos */
  }

  const preset: PresetEnvio = {
    id: p.id,
    nome: p.nome,
    camposAdicionais,
    listaId: p.listaId,
    tagId,
    tagNome,
    stageId: p.stageId,
    origem: p.origem,
    // Quando a tela manda a seleção de linhas, o filtro do preset não se aplica de novo.
    filtroColuna: lida.extra.linhas ? null : p.filtroColuna,
    filtroValor: lida.extra.linhas ? null : p.filtroValor,
    mapeamento,
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

  const job = await iniciarEnvio(rows, lida.arquivo, preset, { headers: lida.headers, rows: lida.rows, indices });
  return NextResponse.json({ id: job.id, total: job.total, tagNome: job.tagNome }, { status: 202 });
}
