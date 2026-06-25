import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
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

function parseCsvValues(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.split(/[;,]/)[0]?.trim())
    .filter((line): line is string => Boolean(line));
}

function parseSpreadsheetValues(buffer: Buffer): unknown[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const preferred = headers.find((h) => ["cep", "cidade", "valor", "value"].includes(h.trim().toLowerCase()));
  const column = preferred ?? headers[0];
  if (!column) return [];

  return rows.map((row) => row[column]);
}

async function createInChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delegate: any,
  column: "cep" | "cidade",
  values: string[],
) {
  if (!delegate) return 0;
  let inserted = 0;
  const chunkSize = 1000;

  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    const created = await delegate.createMany({
      data: chunk.map((value) => ({ [column]: value })),
      skipDuplicates: true,
    });
    inserted += created.count;
  }

  return inserted;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const authResult = await ensureMccSession();
  if ("error" in authResult) return authResult.error;

  const { resource } = await context.params;
  const config = getResourceConfig(resource);
  const delegate = getDelegate(resource);
  if (!config || !delegate) {
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let rawValues: unknown[] = [];
  if (ext === "csv") {
    rawValues = parseCsvValues(buffer.toString("utf-8"));
  } else if (ext === "xls" || ext === "xlsx") {
    rawValues = parseSpreadsheetValues(buffer);
  } else {
    return NextResponse.json({ error: "Formato inválido. Use .csv, .xls ou .xlsx" }, { status: 400 });
  }

  if (rawValues.length === 0) {
    return NextResponse.json({ error: "Arquivo sem dados" }, { status: 400 });
  }

  if (rawValues.length > 100000) {
    return NextResponse.json({ error: "Arquivo excede limite de 100.000 linhas" }, { status: 400 });
  }

  const uniqueValid = [
    ...new Set(
      rawValues
        .map((value) => normalizeValue(resource, value))
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  if (uniqueValid.length === 0) {
    return NextResponse.json({ error: "Nenhum registro válido encontrado" }, { status: 400 });
  }

  const inserted = await createInChunks(delegate, config.column, uniqueValid);
  const ignored = uniqueValid.length - inserted;

  return NextResponse.json({
    totalRows: rawValues.length,
    totalValid: uniqueValid.length,
    inserted,
    ignored,
  });
}
