import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { datacrazyConfigured, dcCreateBoost, dcGetBoost, dcPauseBoost, dcStartBoost, dcTags } from "@/lib/mcc/datacrazy";
import { getEnvioJob } from "@/lib/mcc/disparos";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/** GET: situação do Impulso ligado a este envio. */
export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const id = Number((await params).id);
  const reg = await prisma.disparoEnvio.findUnique({ where: { id }, select: { impulsoId: true, impulsoStatus: true } });
  if (!reg?.impulsoId) return NextResponse.json({ impulso: null });
  try {
    const b = await dcGetBoost(reg.impulsoId);
    if (b.status !== reg.impulsoStatus) await prisma.disparoEnvio.update({ where: { id }, data: { impulsoStatus: b.status } });
    return NextResponse.json({ impulso: b });
  } catch (e) {
    return NextResponse.json({ impulso: { id: reg.impulsoId, status: reg.impulsoStatus ?? "" }, error: e instanceof Error ? e.message : "Falha ao consultar" });
  }
}

/** POST { acao: "criar" | "iniciar" | "pausar" } */
export async function POST(req: Request, { params }: Ctx) {
  const { error } = await ensureMccSession();
  if (error) return error;
  if (!datacrazyConfigured()) return NextResponse.json({ error: "DATACRAZY_TOKEN não configurado" }, { status: 400 });
  const id = Number((await params).id);
  let body: { acao?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const reg = await prisma.disparoEnvio.findUnique({ where: { id }, include: { preset: { select: { flowId: true, flowNome: true } } } });
  if (!reg) return NextResponse.json({ error: "Envio não encontrado" }, { status: 404 });

  try {
    if (body.acao === "criar") {
      if (reg.impulsoId) return NextResponse.json({ error: "Este envio já tem um Impulso" }, { status: 409 });
      if (!reg.tagNome) return NextResponse.json({ error: "Envio sem tag própria" }, { status: 400 });
      if (!reg.preset?.flowId) return NextResponse.json({ error: "O disparo não tem automação configurada" }, { status: 400 });
      const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
      const tag = (await dcTags()).find((t) => norm(t.name) === norm(reg.tagNome!));
      if (!tag) return NextResponse.json({ error: "Tag não encontrada no DataCrazy" }, { status: 404 });
      const b = await dcCreateBoost({ title: reg.tagNome, description: `Portal MCC · envio #${id}`, flowId: reg.preset.flowId, tagId: tag.id });
      await prisma.disparoEnvio.update({ where: { id }, data: { impulsoId: b.id, impulsoStatus: b.status } });
      const job = getEnvioJob(id);
      if (job) job.impulso = { id: b.id, status: b.status };
      return NextResponse.json({ impulso: b });
    }
    if (!reg.impulsoId) return NextResponse.json({ error: "Este envio não tem Impulso" }, { status: 400 });
    if (body.acao === "iniciar") await dcStartBoost(reg.impulsoId);
    else if (body.acao === "pausar") await dcPauseBoost(reg.impulsoId);
    else return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    await new Promise((r) => setTimeout(r, 1500));
    const b = await dcGetBoost(reg.impulsoId);
    await prisma.disparoEnvio.update({ where: { id }, data: { impulsoStatus: b.status } });
    const job = getEnvioJob(id);
    if (job) job.impulso = { id: b.id, status: b.status };
    return NextResponse.json({ impulso: b });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no DataCrazy" }, { status: 502 });
  }
}
