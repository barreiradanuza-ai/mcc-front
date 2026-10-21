import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { garantirPresetPadrao, lerPreset } from "@/lib/mcc/disparosPreset";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await ensureMccSession();
  if (error) return error;
  await garantirPresetPadrao();
  const presets = await prisma.disparoPreset.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json({ presets });
}

export async function POST(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }
  const parsed = lerPreset(body);
  if ("erro" in parsed) return NextResponse.json({ error: parsed.erro }, { status: 400 });
  const preset = await prisma.disparoPreset.create({ data: parsed.data });
  return NextResponse.json(preset, { status: 201 });
}
