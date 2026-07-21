
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { normalizeCpf, normalizeCep } from "@/lib/mcc/admin";
import { buildCoverageString, resolveClaroPromoCeps } from "@/lib/mcc/coverage";
import { normalizePhone, checkWhatsAppBulk } from "@/lib/mcc/validators/whatsappChecker";
import { createJob, updateJob } from "@/lib/mcc/jobStore";
import { ensureMccSession } from "@/lib/mcc/authz";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30; // Only for receiving the file, not processing

async function runProcessingJob(jobId: string, rows: Record<string, unknown>[], headers: string[], filename: string) {
  const t0 = performance.now();
  const cepCol = headers.find((h) => h.toLowerCase().trim() === "cep")!;
  const cpfCol = headers.find((h) => h.toLowerCase().trim() === "cpf")!;
  const contatoCol = headers.find((h) => h.toLowerCase().trim() === "contato"); // Optional

  try {
    updateJob(jobId, { status: "processing", progressMsg: "Verificando CPFs duplicados..." });

    const normalizedCpfs = rows.map((r) => normalizeCpf(r[cpfCol]));
    const validCpfs = [...new Set(normalizedCpfs.filter((c): c is string => c !== null))];

    let existingCpfSet = new Set<string>();
    if (validCpfs.length > 0) {
      const existing = await prisma.cpfCobertura.findMany({
        where: { cpf: { in: validCpfs } },
        select: { cpf: true },
      });
      existingCpfSet = new Set(existing.map((r) => r.cpf));
    }

    const filteredIndices: number[] = [];
    let skippedCpfs = 0;
    for (let i = 0; i < rows.length; i++) {
      const cpf = normalizedCpfs[i];
      if (cpf && existingCpfSet.has(cpf)) {
        skippedCpfs++;
      } else {
        filteredIndices.push(i);
      }
    }

    updateJob(jobId, { progressMsg: `${skippedCpfs} CPFs duplicados removidos. ${filteredIndices.length} linhas para processar.` });

    // --- Phone / WhatsApp validation ---------------------------------------
    // Only runs when the sheet actually has a CONTATO column; sheets without
    // it skip straight to coverage (same as before this step existed).
    const normalizedPhones = filteredIndices.map((i) => (contatoCol ? normalizePhone(rows[i][contatoCol]) : null));

    let incorrectNumber = 0;
    let withoutWhatsApp = 0;
    let whatsappValidIndices: number[];

    if (contatoCol) {
      const phoneValidLocalIdx: number[] = [];
      for (let li = 0; li < filteredIndices.length; li++) {
        if (normalizedPhones[li] === null) {
          incorrectNumber++;
        } else {
          phoneValidLocalIdx.push(li);
        }
      }

      const uniquePhones = [...new Set(phoneValidLocalIdx.map((li) => normalizedPhones[li] as string))];

      updateJob(jobId, {
        progressMsg: `Verificando ${uniquePhones.length} números no WhatsApp...`,
        progressChecked: 0,
        progressTotal: uniquePhones.length,
      });

      const { existsSet: whatsappSet } = await checkWhatsAppBulk(uniquePhones, (checked, total) => {
        updateJob(jobId, {
          progressMsg: `WhatsApp: ${checked}/${total} números verificados`,
          progressChecked: checked,
          progressTotal: total,
        });
      });

      const whatsappValidLocalIdx = phoneValidLocalIdx.filter((li) => whatsappSet.has(normalizedPhones[li] as string));
      withoutWhatsApp = phoneValidLocalIdx.length - whatsappValidLocalIdx.length;
      whatsappValidIndices = whatsappValidLocalIdx.map((li) => filteredIndices[li]);
    } else {
      whatsappValidIndices = filteredIndices;
    }

    updateJob(jobId, { progressMsg: "Verificando cobertura por CEP...", progressChecked: 0, progressTotal: 0 });

    const allFilteredCeps = filteredIndices.map((i) => normalizeCep(rows[i][cepCol]));
    const validCeps = [...new Set(allFilteredCeps.filter((c): c is string => c !== null))];

    const [claroResults, timResults, nioResults] = await Promise.all([
      validCeps.length > 0 ? prisma.cepClaro.findMany({ where: { cep: { in: validCeps } }, select: { cep: true } }) : [],
      validCeps.length > 0 ? prisma.cepTim.findMany({ where: { cep: { in: validCeps } }, select: { cep: true } }) : [],
      validCeps.length > 0 ? prisma.cepNio.findMany({ where: { cep: { in: validCeps } }, select: { cep: true } }) : [],
    ]);

    const claroSet = new Set(claroResults.map((r: { cep: string }) => r.cep.trim()));
    const timSet = new Set(timResults.map((r: { cep: string }) => r.cep.trim()));
    const nioSet = new Set(nioResults.map((r: { cep: string }) => r.cep.trim()));

    const claroCeps = validCeps.filter((c) => claroSet.has(c));
    const claroPromoCeps = await resolveClaroPromoCeps(claroCeps, async (cities) => {
      const promoResults = await prisma.cidadePromoClaro.findMany({
        where: { cidade: { in: cities } },
        select: { cidade: true },
      });
      return new Set(promoResults.map((r: { cidade: string }) => r.cidade));
    });

    function getCoverage(localIdx: number): string {
      const cep = allFilteredCeps[localIdx];
      if (!cep) return "CEP inválido";
      const hasClaro = claroSet.has(cep);
      const hasTim = timSet.has(cep);
      const hasNio = nioSet.has(cep);
      const claroPromo = claroPromoCeps.has(cep);
      return buildCoverageString(hasClaro, claroPromo, hasTim, hasNio);
    }

    updateJob(jobId, { progressMsg: "Montando planilha de saída..." });

    const approvedRowIndicesSet = new Set(whatsappValidIndices);
    const cpfsToSave: { cpf: string; cep: string | null; contato: string | null; cobertura: string; motivoRecusa: string | null }[] = [];

    let withCoverage = 0;
    let withoutCoverage = 0;
    let invalid = 0;
    const outputRows: Record<string, unknown>[] = [];

    for (let li = 0; li < filteredIndices.length; li++) {
      const origIdx = filteredIndices[li];
      const cpf = normalizedCpfs[origIdx];
      const rawContato = contatoCol ? String(rows[origIdx][contatoCol] ?? "").replace(/\D/g, "") || null : null;
      const cep = allFilteredCeps[li];
      const coverage = getCoverage(li);

      if (contatoCol && normalizedPhones[li] === null) {
        if (cpf) cpfsToSave.push({ cpf, cep, contato: rawContato, cobertura: coverage, motivoRecusa: "Número incorreto" });
        continue;
      }

      if (!approvedRowIndicesSet.has(origIdx)) {
        if (cpf) cpfsToSave.push({ cpf, cep, contato: rawContato, cobertura: coverage, motivoRecusa: "Sem WhatsApp" });
        continue;
      }

      if (coverage === "CEP inválido") {
        invalid++;
        outputRows.push({ ...rows[origIdx], Cobertura: coverage });
        continue;
      }

      if (coverage === "Sem cobertura") {
        withoutCoverage++;
        if (cpf) cpfsToSave.push({ cpf, cep, contato: rawContato, cobertura: coverage, motivoRecusa: "Sem cobertura" });
        continue;
      }

      withCoverage++;
      outputRows.push({ ...rows[origIdx], Cobertura: coverage });
      if (cpf) cpfsToSave.push({ cpf, cep, contato: rawContato, cobertura: coverage, motivoRecusa: null });
    }

    updateJob(jobId, { progressMsg: "Salvando registros no banco..." });

    let newCpfsSaved = 0;
    if (cpfsToSave.length > 0) {
      const uniqueMap = new Map<string, { cep: string | null; contato: string | null; cobertura: string; motivoRecusa: string | null }>();
      for (const entry of cpfsToSave) {
        if (!uniqueMap.has(entry.cpf)) {
          uniqueMap.set(entry.cpf, { cep: entry.cep, contato: entry.contato, cobertura: entry.cobertura, motivoRecusa: entry.motivoRecusa });
        }
      }
      const data = [...uniqueMap.entries()].map(([cpf, v]) => ({ cpf, cep: v.cep, contato: v.contato, cobertura: v.cobertura, motivoRecusa: v.motivoRecusa }));
      const chunkSize = 1000;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const result = await prisma.cpfCobertura.createMany({ data: chunk, skipDuplicates: true });
        newCpfsSaved += result.count;
      }
    }

    const newSheet = XLSX.utils.json_to_sheet(outputRows);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Sheet1");
    const outBuffer: Buffer = XLSX.write(newWorkbook, { type: "buffer", bookType: "xlsx" });

    const safeName = filename.replace(/\.[^.]+$/, "");
    const resultFilename = `${safeName}_cobertura.xlsx`;
    const elapsedMs = Math.round(performance.now() - t0);

    updateJob(jobId, {
      status: "done",
      progressMsg: "Processamento concluído!",
      resultBase64: outBuffer.toString("base64"),
      resultFilename,
      resultStats: {
        total: rows.length,
        withCoverage,
        withoutCoverage,
        incorrectNumber,
        withoutWhatsApp,
        invalid,
        skippedCpfs,
        newCpfsSaved,
        elapsedMs,
        // Saldo é consultado ao vivo em /api/mcc/admin/checknumber/balance, não por job
        // (a API de tasks não retorna saldo restante por chamada).
        creditsRemaining: null,
      },
    });

    console.log(`[job:${jobId}] Concluído em ${elapsedMs}ms. ${withCoverage} com cobertura, ${withoutCoverage} sem cobertura.`);
  } catch (err) {
    console.error(`[job:${jobId}] Erro:`, err);
    const message = err instanceof Error ? err.message : "Erro interno ao processar planilha";
    updateJob(jobId, { status: "error", errorMessage: message, progressMsg: "Erro no processamento" });
  }
}

export async function POST(req: Request) {
  const { error } = await ensureMccSession();
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return NextResponse.json({ error: "Planilha vazia" }, { status: 400 });

  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length === 0) return NextResponse.json({ error: "Planilha sem dados" }, { status: 400 });

  const headers = Object.keys(rows[0]);
  if (!headers.find((h) => h.toLowerCase().trim() === "cep")) {
    return NextResponse.json({ error: 'Coluna "CEP" não encontrada na planilha' }, { status: 400 });
  }
  if (!headers.find((h) => h.toLowerCase().trim() === "cpf")) {
    return NextResponse.json({ error: 'Coluna "CPF" não encontrada na planilha' }, { status: 400 });
  }
  // CONTATO é opcional: se ausente, a etapa de validação de WhatsApp é pulada.

  const jobId = randomUUID();
  createJob(jobId);

  // Start processing in background (non-blocking)
  setImmediate(() => {
    runProcessingJob(jobId, rows, headers, file.name).catch((err) => {
      console.error(`[job:${jobId}] Unhandled error:`, err);
      updateJob(jobId, { status: "error", errorMessage: "Erro interno inesperado" });
    });
  });

  return NextResponse.json({ jobId }, { status: 202 });
}
