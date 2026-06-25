import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { normalizeCpf } from "@/lib/mcc/admin";
import { createJob, updateJob } from "@/lib/mcc/jobStore";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30; // Only for receiving the file, not processing

const OPENCEP_CONCURRENCY = 10;
const WAVALIDATOR_BATCH_SIZE = 100;
const WAVALIDATOR_CONCURRENCY = 1;
const WAVALIDATOR_INTER_BATCH_DELAY_MS = 3000;
const WAVALIDATOR_API_KEY = process.env.WAVALIDATOR_API_KEY ?? "";

function normalizeCep(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 0) return null;
  const padded = digits.padStart(8, "0");
  if (padded.length !== 8) return null;
  return padded;
}

function normalizePhone(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return digits;
  if (digits.length < 10 || digits.length > 11) return null;
  return `55${digits}`;
}

function normalizeCity(text: string): string {
  return text.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function fetchCity(cep: string): Promise<string> {
  try {
    const res = await fetch(`https://opencep.com/v1/${cep}`, {
      headers: { "User-Agent": "mcc-front/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data?.localidade ?? "";
  } catch {
    return "";
  }
}

async function resolveInBatches<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function callWavalidator(batch: string[]): Promise<Response> {
  return fetch("https://wavalidator.com/api/v1/bulk-check/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVALIDATOR_API_KEY}`,
    },
    body: JSON.stringify({ numbers: batch }),
    signal: AbortSignal.timeout(180000),
  });
}

async function processWavalidatorBatch(batch: string[], batchLabel: string): Promise<{ exists: string[]; creditsRemaining: number | null }> {
  let lastError: unknown = null;
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = 15000 * attempt;
        console.log(`[wavalidator] ${batchLabel} retry ${attempt}/${maxRetries} após ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
      }

      const res = await callWavalidator(batch);

      if (res.status === 402) throw new Error("Créditos do Wavalidator esgotados. Recarregue em wavalidator.com/pricing");

      if (res.status === 429) {
        console.warn(`[wavalidator] ${batchLabel} rate limited (429) - aguardando 20s antes de retry`);
        lastError = new Error("Rate limited");
        await new Promise((r) => setTimeout(r, 20000));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`API ${res.status} — ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      const creditsRemaining: number | null = data.credits_remaining ?? null;
      const results: { number: string; exists: boolean }[] = data.results ?? [];
      const exists = results.filter((r) => r.exists).map((r) => r.number);
      return { exists, creditsRemaining };
    } catch (err) {
      if (err instanceof Error && err.message.includes("Créditos")) throw err;
      lastError = err;
      console.error(`[wavalidator] ${batchLabel} tentativa ${attempt + 1} falhou:`, err instanceof Error ? err.message : err);
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Falha ao validar números no Wavalidator após ${maxRetries + 1} tentativas (${batchLabel}): ${msg}. Tente novamente em alguns minutos.`);
}

function buildCoverageString(hasClaro: boolean, claroPromo: boolean, hasTim: boolean, hasNio: boolean): string {
  const claroLabel = claroPromo ? "Claro Promo" : "Claro";
  const hasAnyClaro = hasClaro || claroPromo;
  if (hasAnyClaro && hasTim && hasNio) return `${claroLabel} e Tim e Nio`;
  if (hasAnyClaro && hasTim) return `Tim e ${claroLabel}`;
  if (hasAnyClaro && hasNio) return `Nio e ${claroLabel}`;
  if (hasTim && hasNio) return "Tim e Nio";
  if (hasAnyClaro) return claroLabel;
  if (hasTim) return "Tim";
  if (hasNio) return "Nio";
  return "Sem cobertura";
}

async function saveCredits(credits: number) {
  try {
    await prisma.appConfig.upsert({
      where: { key: "wavalidator_credits" },
      update: { value: String(credits) },
      create: { key: "wavalidator_credits", value: String(credits) },
    });
  } catch (err) {
    console.error("[wavalidator] Failed to save credits:", err);
  }
}

async function runProcessingJob(jobId: string, rows: Record<string, unknown>[], headers: string[], filename: string) {
  const t0 = performance.now();
  const cepCol = headers.find((h) => h.toLowerCase().trim() === "cep")!;
  const cpfCol = headers.find((h) => h.toLowerCase().trim() === "cpf")!;
  const contatoCol = headers.find((h) => h.toLowerCase().trim() === "contato")!;

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

    const normalizedPhones = filteredIndices.map((i) => normalizePhone(rows[i][contatoCol]));

    let incorrectNumber = 0;
    const phoneValidIndices: number[] = [];
    const phoneValidLocalIdx: number[] = [];

    for (let li = 0; li < filteredIndices.length; li++) {
      if (normalizedPhones[li] === null) {
        incorrectNumber++;
      } else {
        phoneValidIndices.push(filteredIndices[li]);
        phoneValidLocalIdx.push(li);
      }
    }

    const uniquePhones = [...new Set(normalizedPhones.filter((p): p is string => p !== null))];
    const totalWaBatches = Math.ceil(uniquePhones.length / WAVALIDATOR_BATCH_SIZE);

    updateJob(jobId, {
      progressMsg: `Verificando ${uniquePhones.length} números no WhatsApp (${totalWaBatches} lotes)...`,
      progressChecked: 0,
      progressTotal: uniquePhones.length,
    });

    // Process WhatsApp batches sequentially
    const existsSet = new Set<string>();
    let creditsRemaining: number | null = null;
    const batches: string[][] = [];
    for (let i = 0; i < uniquePhones.length; i += WAVALIDATOR_BATCH_SIZE) {
      batches.push(uniquePhones.slice(i, i + WAVALIDATOR_BATCH_SIZE));
    }

    let processedPhones = 0;
    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      const label = `Lote ${bi + 1}/${batches.length} (${batch.length} numbers)`;
      console.log(`[job:${jobId}] [wavalidator] ${label} iniciando`);

      const outcome = await processWavalidatorBatch(batch, label);
      for (const num of outcome.exists) existsSet.add(num);
      if (outcome.creditsRemaining !== null) creditsRemaining = outcome.creditsRemaining;
      processedPhones += batch.length;

      updateJob(jobId, {
        progressMsg: `WhatsApp: ${processedPhones}/${uniquePhones.length} números verificados (lote ${bi + 1}/${batches.length})`,
        progressChecked: processedPhones,
        progressTotal: uniquePhones.length,
      });

      if (bi < batches.length - 1) {
        console.log(`[job:${jobId}] Aguardando ${WAVALIDATOR_INTER_BATCH_DELAY_MS}ms antes do próximo lote...`);
        await new Promise((r) => setTimeout(r, WAVALIDATOR_INTER_BATCH_DELAY_MS));
      }
    }

    if (creditsRemaining !== null) await saveCredits(creditsRemaining);

    let withoutWhatsApp = 0;
    const whatsappValidIndices: number[] = [];
    const whatsappValidPhoneLocalIdx: number[] = [];

    for (let pi = 0; pi < phoneValidIndices.length; pi++) {
      const phone = normalizedPhones[phoneValidLocalIdx[pi]];
      if (phone && existsSet.has(phone)) {
        whatsappValidIndices.push(phoneValidIndices[pi]);
        whatsappValidPhoneLocalIdx.push(phoneValidLocalIdx[pi]);
      } else {
        withoutWhatsApp++;
      }
    }

    console.log(`[job:${jobId}] [whatsapp-check] Resultado: ${whatsappValidIndices.length} com WhatsApp | ${withoutWhatsApp} sem WhatsApp`);

    updateJob(jobId, { progressMsg: "Verificando cobertura por CEP..." });

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
    const cityMap = new Map<string, string>();

    if (claroCeps.length > 0) {
      const cities = await resolveInBatches(claroCeps, OPENCEP_CONCURRENCY, async (cep) => {
        const city = await fetchCity(cep);
        return { cep, city };
      });
      for (const { cep, city } of cities) {
        if (city) cityMap.set(cep, normalizeCity(city));
      }

      const uniqueCities = [...new Set(cityMap.values())].filter(Boolean);
      if (uniqueCities.length > 0) {
        const promoResults = await prisma.cidadePromoClaro.findMany({
          where: { cidade: { in: uniqueCities } },
          select: { cidade: true },
        });
        const promoSet = new Set(promoResults.map((r: { cidade: string }) => r.cidade));
        for (const [cep, city] of cityMap) {
          if (!promoSet.has(city)) cityMap.delete(cep);
        }
      } else {
        cityMap.clear();
      }
    }

    function getCoverage(localIdx: number): string {
      const cep = allFilteredCeps[localIdx];
      if (!cep) return "CEP inválido";
      const hasClaro = claroSet.has(cep);
      const hasTim = timSet.has(cep);
      const hasNio = nioSet.has(cep);
      const claroPromo = hasClaro && cityMap.has(cep);
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
      const phone = normalizedPhones[li];
      const cep = allFilteredCeps[li];
      const rawContato = String(rows[origIdx][contatoCol] ?? "").replace(/\D/g, "") || null;
      const coverage = getCoverage(li);

      if (phone === null) {
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
        creditsRemaining,
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
  if (!headers.find((h) => h.toLowerCase().trim() === "contato")) {
    return NextResponse.json({ error: 'Coluna "CONTATO" não encontrada na planilha' }, { status: 400 });
  }

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
