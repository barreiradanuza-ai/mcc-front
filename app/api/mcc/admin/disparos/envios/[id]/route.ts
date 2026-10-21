import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { getEnvioJob } from "@/lib/mcc/disparos";

export const runtime = "nodejs";

/** GET: progresso de um envio (memória) ou, se já expirou da memória, o registro do histórico. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const job = getEnvioJob(id);
  if (job) {
    return NextResponse.json({
      id: job.id,
      status: job.status,
      progressMsg: job.progressMsg,
      processed: job.processed,
      total: job.total,
      filtrados: job.filtrados,
      criados: job.criados,
      atualizados: job.atualizados,
      falhas: job.falhas,
      erros: job.erros.slice(0, 200),
      live: true,
    });
  }

  const reg = await prisma.disparoEnvio.findUnique({ where: { id } });
  if (!reg) return NextResponse.json({ error: "Envio não encontrado" }, { status: 404 });
  const erros = Array.isArray(reg.erros) ? reg.erros : [];
  return NextResponse.json({
    id: reg.id,
    status: reg.status,
    progressMsg: reg.mensagem ?? "",
    processed: reg.total,
    total: reg.total,
    filtrados: reg.filtrados,
    criados: reg.criados,
    atualizados: reg.atualizados,
    falhas: reg.falhas,
    erros: erros.slice(0, 200),
    live: false,
    presetNome: reg.presetNome,
    arquivo: reg.arquivo,
    createdAt: reg.createdAt,
    finishedAt: reg.finishedAt,
  });
}
