import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const exists = await prisma.disparoBase.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Base não encontrada" }, { status: 404 });
  await prisma.disparoBase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { error } = await ensureMccSession();
  if (error) return error;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  let body: { nome?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const nome = typeof body.nome === "string" ? body.nome.trim().slice(0, 200) : "";
  if (!nome) return NextResponse.json({ error: "Informe o nome" }, { status: 400 });
  const base = await prisma.disparoBase.update({ where: { id }, data: { nome }, select: { id: true, nome: true } });
  return NextResponse.json(base);
}
