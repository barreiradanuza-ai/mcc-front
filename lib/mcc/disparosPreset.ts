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
  const tagModo = body.tagModo === "fixa" ? "fixa" : "por_envio";
  const tagId = tagModo === "fixa" ? str(body.tagId, 80) : null;
  const tagPadrao = tagModo === "por_envio" ? str(body.tagPadrao, 160) || "api_{arquivo}" : null;
  if (tagModo === "fixa" && !tagId) return { erro: "Escolha a tag fixa ou mude para tag por envio" } as const;
  const stageId = str(body.stageId, 80);
  return {
    data: {
      nome,
      descricao: str(body.descricao, 2000),
      listaId,
      listaNome: str(body.listaNome),
      tagId,
      tagNome: tagModo === "fixa" ? str(body.tagNome) : null,
      tagModo,
      tagPadrao,
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

