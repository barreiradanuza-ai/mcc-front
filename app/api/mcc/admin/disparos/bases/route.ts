import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { lerPlanilhaDaRequisicao, salvarBase } from "@/lib/mcc/disparosPlanilha";

export const runtime = "nodejs";
export const maxDuration = 30;

/** GET: bases salvas (mais recentes primeiro). */
export async function GET() {
  const { error } = await ensureMccSession();
  if (error) return error;
  const bases = await prisma.disparoBase.findMany({
    orderBy: { id: "desc" },
    take: 100,
    select: { id: true, nome: true, arquivo: true, total: true, origem: true, createdAt: true },
  });
  return NextResponse.json({ bases });
}

/** POST: guarda uma planilha (multipart "file" ou "jobId") como base. */
export async function POST(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const lida = await lerPlanilhaDaRequisicao(req);
  if ("erro" in lida) return NextResponse.json({ error: lida.erro }, { status: 400 });
  const id = await salvarBase(lida, lida.extra.jobId ? "processamento" : "upload");
  return NextResponse.json({ id, arquivo: lida.arquivo, total: Math.min(lida.rows.length, 5000) }, { status: 201 });
}
