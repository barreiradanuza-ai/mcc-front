import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { lerPreset } from "@/lib/mcc/disparosPreset";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PUT(req: Request, { params }: Ctx) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const parsed = lerPreset(body);
  if ("erro" in parsed) return NextResponse.json({ error: parsed.erro }, { status: 400 });

  const exists = await prisma.disparoPreset.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Disparo não encontrado" }, { status: 404 });

  const preset = await prisma.disparoPreset.update({ where: { id }, data: parsed.data });
  return NextResponse.json(preset);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const exists = await prisma.disparoPreset.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Disparo não encontrado" }, { status: 404 });
  await prisma.disparoPreset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
