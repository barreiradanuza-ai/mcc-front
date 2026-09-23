/**
 * Gera CPFs válidos que NUNCA se repetem entre gerações:
 * cada CPF gerado é reservado na tabela cpfs_gerados e também é conferido
 * contra os CPFs já processados (cpfs_cobertura).
 */
import { prisma } from "@/lib/db";
import { generateCpf } from "@/lib/mcc/adequacao";

export async function reservarCpfsUnicos(n: number, usados: Set<string>): Promise<string[]> {
  const result: string[] = [];
  const local = new Set(usados);
  let tentativas = 0;

  while (result.length < n) {
    if (++tentativas > 50) throw new Error("Não foi possível gerar CPFs únicos");
    const faltam = n - result.length;
    const candidatos: string[] = [];
    for (let i = 0; i < faltam; i++) candidatos.push(generateCpf(local));

    for (let i = 0; i < candidatos.length; i += 5000) {
      const lote = candidatos.slice(i, i + 5000);
      const jaProcessados = await prisma.cpfCobertura.findMany({
        where: { cpf: { in: lote } },
        select: { cpf: true },
      });
      const bloqueados = new Set(jaProcessados.map((r) => r.cpf));
      const livres = lote.filter((c) => !bloqueados.has(c));
      if (livres.length === 0) continue;

      // skipDuplicates + retorno: só volta o que foi realmente reservado agora
      const criados = await prisma.cpfGerado.createManyAndReturn({
        data: livres.map((cpf) => ({ cpf })),
        skipDuplicates: true,
        select: { cpf: true },
      });
      for (const r of criados) result.push(r.cpf);
    }
  }

  return result.slice(0, n);
}
