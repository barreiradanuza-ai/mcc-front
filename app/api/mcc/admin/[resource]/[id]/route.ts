import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { getResourceConfig, normalizeValue } from "@/lib/mcc/admin";

export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDelegate(resource: string): any {
  switch (resource) {
    case "ceps-claro":
      return prisma.cepClaro;
    case "ceps-nio":
      return prisma.cepNio;
    case "ceps-tim":
      return prisma.cepTim;
    case "cidades-promo-claro":
      return prisma.cidadePromoClaro;
    default:
      return null;
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const { resource, id } = await context.params;
  const config = getResourceConfig(resource);
  const delegate = getDelegate(resource);
  if (!config || !delegate) {
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  }

  const currentValue = normalizeValue(resource, decodeURIComponent(id));
  if (!currentValue) {
    return NextResponse.json({ error: "Registro inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const nextValue = normalizeValue(resource, body?.value);
  if (!nextValue) {
    return NextResponse.json({ error: "Novo valor inválido" }, { status: 400 });
  }

  try {
    await delegate.update({
      where: { [config.column]: currentValue },
      data: { [config.column]: nextValue },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível atualizar (registro não encontrado ou já existente)" },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const { resource, id } = await context.params;
  const config = getResourceConfig(resource);
  const delegate = getDelegate(resource);
  if (!config || !delegate) {
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  }

  const currentValue = normalizeValue(resource, decodeURIComponent(id));
  if (!currentValue) {
    return NextResponse.json({ error: "Registro inválido" }, { status: 400 });
  }

  try {
    await delegate.delete({ where: { [config.column]: currentValue } });
  } catch {
    return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
