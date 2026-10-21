import { parseMapeamento, validarMapeamento } from "@/lib/mcc/disparos";
import type { Prisma } from "@/lib/generated/prisma/client";

const str = (v: unknown, max = 160): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** Valida e normaliza o corpo de criação/edição de preset. */
export function lerPreset(body: Record<string, unknown>) {
  const nome = str(body.nome, 120);
  if (!nome) return { erro: "Informe o nome do disparo" } as const;
  const mapeamento = parseMapeamento(body.mapeamento);
  const erroMap = validarMapeamento(mapeamento);
  if (erroMap) return { erro: erroMap } as const;
  const listaId = str(body.listaId, 80);
  const tagId = str(body.tagId, 80);
  const stageId = str(body.stageId, 80);
  if (!listaId && !tagId && !stageId) return { erro: "Escolha pelo menos um destino: lista, tag ou etapa do funil" } as const;
  return {
    data: {
      nome,
      descricao: str(body.descricao, 2000),
      listaId,
      listaNome: str(body.listaNome),
      tagId,
      tagNome: str(body.tagNome),
      pipelineId: str(body.pipelineId, 80),
      pipelineNome: str(body.pipelineNome),
      stageId,
      stageNome: str(body.stageNome),
      origem: str(body.origem, 120),
      filtroColuna: str(body.filtroColuna, 120),
      filtroValor: str(body.filtroValor, 120),
      mapeamento: mapeamento as unknown as Prisma.InputJsonValue,
    },
  } as const;
}

