import { NextResponse } from "next/server";
import { ensureMccSession } from "@/lib/mcc/authz";
import { cancelEnvioJob } from "@/lib/mcc/disparos";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const ok = cancelEnvioJob(id);
  if (!ok) return NextResponse.json({ error: "Envio não está em andamento" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
