import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { ensureMccSession } from "@/lib/mcc/authz";
import { normalizeCpf } from "@/lib/mcc/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return NextResponse.json({ error: "Planilha vazia" }, { status: 400 });
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Planilha sem dados" }, { status: 400 });
  }

  const headers = Object.keys(rows[0]);
  const cpfCol = headers.find((h) => h.toLowerCase().trim() === "cpf");
  if (!cpfCol) {
    return NextResponse.json({ error: 'Coluna "CPF" não encontrada na planilha' }, { status: 400 });
  }

  const cpfs = [
    ...new Set(
      rows
        .map((r) => normalizeCpf(r[cpfCol]))
        .filter((c): c is string => c !== null),
    ),
  ];

  if (cpfs.length === 0) {
    return NextResponse.json({ error: "Nenhum CPF válido encontrado na planilha" }, { status: 400 });
  }

  let totalDeleted = 0;
  const chunkSize = 1000;
  for (let i = 0; i < cpfs.length; i += chunkSize) {
    const chunk = cpfs.slice(i, i + chunkSize);
    const result = await prisma.cpfCobertura.deleteMany({
      where: { cpf: { in: chunk } },
    });
    totalDeleted += result.count;
  }

  return NextResponse.json({ deleted: totalDeleted, total: cpfs.length });
}
