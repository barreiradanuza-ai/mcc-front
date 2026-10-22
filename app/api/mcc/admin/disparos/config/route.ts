import { NextResponse } from "next/server";
import { ensureMccSession } from "@/lib/mcc/authz";
import { lerConfigAuto, salvarConfigAuto } from "@/lib/mcc/disparosAuto";

export const runtime = "nodejs";

/** GET: configuração do envio automático após o processamento. */
export async function GET() {
  const { error } = await ensureMccSession();
  if (error) return error;
  return NextResponse.json(await lerConfigAuto());
}

/** PUT: { ativo, presetId, pularEnviados } */
export async function PUT(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;
  let body: { ativo?: unknown; presetId?: unknown; pularEnviados?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const presetId = Number(body.presetId);
  const cfg = {
    ativo: Boolean(body.ativo),
    presetId: Number.isInteger(presetId) && presetId > 0 ? presetId : null,
    pularEnviados: body.pularEnviados !== false,
  };
  if (cfg.ativo && !cfg.presetId) return NextResponse.json({ error: "Escolha o disparo para o envio automático" }, { status: 400 });
  await salvarConfigAuto(cfg);
  return NextResponse.json(cfg);
}
