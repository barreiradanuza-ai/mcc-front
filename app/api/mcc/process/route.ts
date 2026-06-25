import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { normalizeCpf } from "@/lib/mcc/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

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

  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  if (digits.length < 10 || digits.length > 11) {
    return null;
  }

  return `55${digits}`;
}

function normalizeCity(text: string): string {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

async function resolveInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
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

type ProgressFn = (checked: number, total: number) => void;

interface WhatsAppResult {
  existsSet: Set<string>;
  creditsRemaining: number | null;
}

const WAVALIDATOR_TIMEOUT_MS = 180000;
const WAVALIDATOR_MAX_RETRIES = 2;

async function callWavalidator(batch: string[]): Promise<Response> {
  return fetch("https://wavalidator.com/api/v1/bulk-check/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVALIDATOR_API_KEY}`,
    },
    body: JSON.stringify({ numbers: batch }),
    signal: AbortSignal.timeout(WAVALIDATOR_TIMEOUT_MS),
  });
}

interface BatchOutcome {
  exists: string[];
  creditsRemaining: number | null;
}

async function processWavalidatorBatch(
  batch: string[],
  batchLabel: string,
): Promise<BatchOutcome> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= WAVALIDATOR_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const backoff = 15000 * attempt;
        console.log(`[wavalidator] ${batchLabel} retry ${attempt}/${WAVALIDATOR_MAX_RETRIES} após ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
      }

      const res = await callWavalidator(batch);

      if (res.status === 402) {
        console.error("[wavalidator] Credits exhausted (402)");
        throw new Error("Créditos do Wavalidator esgotados. Recarregue em wavalidator.com/pricing");
      }

      if (res.status === 429) {
        console.warn(`[wavalidator] ${batchLabel} rate limited (429) - aguardando 15s antes de retry`);
        lastError = new Error("Rate limited");
        await new Promise((r) => setTimeout(r, 15000));
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
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.message.includes("timeout"));
      console.error(`[wavalidator] ${batchLabel} tentativa ${attempt + 1} falhou${isTimeout ? " (timeout)" : ""}:`, err instanceof Error ? err.message : err);
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Falha ao validar números no Wavalidator após ${WAVALIDATOR_MAX_RETRIES + 1} tentativas (${batchLabel}): ${msg}. Tente novamente em alguns minutos.`,
  );
}

async function checkWhatsAppBatch(phones: string[], onProgress?: ProgressFn): Promise<WhatsAppResult> {
  if (!WAVALIDATOR_API_KEY) {
    return { existsSet: new Set(phones), creditsRemaining: null };
  }

  const existsSet = new Set<string>();
  let creditsRemaining: number | null = null;

  const batches: string[][] = [];
  for (let i = 0; i < phones.length; i += WAVALIDATOR_BATCH_SIZE) {
    batches.push(phones.slice(i, i + WAVALIDATOR_BATCH_SIZE));
  }
  const totalBatches = batches.length;

  console.log(`[wavalidator] ${totalBatches} lotes (${WAVALIDATOR_BATCH_SIZE} por lote, concorrência ${WAVALIDATOR_CONCURRENCY})`);

  let nextBatchIdx = 0;
  let processedPhones = 0;
  let firstFailure: unknown = null;

  async function worker() {
    while (true) {
      if (firstFailure) return;
      const myIdx = nextBatchIdx++;
      if (myIdx >= totalBatches) return;

      const batch = batches[myIdx];
      const label = `Lote ${myIdx + 1}/${totalBatches} (${batch.length} numbers)`;
      console.log(`[wavalidator] ${label} iniciando`);

      try {
        const outcome = await processWavalidatorBatch(batch, label);
        for (const num of outcome.exists) existsSet.add(num);
        if (outcome.creditsRemaining !== null) creditsRemaining = outcome.creditsRemaining;
        processedPhones += batch.length;
        onProgress?.(processedPhones, phones.length);
        // Delay entre lotes para evitar rate limit
        if (myIdx < totalBatches - 1) {
          console.log(`[wavalidator] Aguardando ${WAVALIDATOR_INTER_BATCH_DELAY_MS}ms antes do próximo lote...`);
          await new Promise((r) => setTimeout(r, WAVALIDATOR_INTER_BATCH_DELAY_MS));
        }
      } catch (err) {
        firstFailure = err;
        return;
      }
    }
  }

  const concurrency = Math.min(WAVALIDATOR_CONCURRENCY, totalBatches);
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (firstFailure) throw firstFailure;

  return { existsSet, creditsRemaining };
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

export async function POST(req: Request) {
  const t0 = performance.now();
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
  const cepCol = headers.find((h) => h.toLowerCase().trim() === "cep");
  if (!cepCol) {
    return NextResponse.json({ error: 'Coluna "CEP" não encontrada na planilha' }, { status: 400 });
  }
  const cpfCol = headers.find((h) => h.toLowerCase().trim() === "cpf");
  if (!cpfCol) {
    return NextResponse.json({ error: 'Coluna "CPF" não encontrada na planilha' }, { status: 400 });
  }
  const contatoCol = headers.find((h) => h.toLowerCase().trim() === "contato");
  if (!contatoCol) {
    return NextResponse.json({ error: 'Coluna "CONTATO" não encontrada na planilha' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = (obj: Record<string, unknown>) =>
    writer.write(encoder.encode(JSON.stringify(obj) + "\n"));

  (async () => {
    try {
      await send({ type: "progress", step: "cpf", message: "Verificando CPFs duplicados..." });

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

      await send({ type: "progress", step: "cpf", message: `${skippedCpfs} CPFs duplicados removidos. ${filteredIndices.length} linhas para processar.` });

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

      console.log(`[phone-validation] Resultado: ${phoneValidIndices.length} válidos | ${incorrectNumber} inválidos (de ${filteredIndices.length} total)`);


      const uniquePhones = [...new Set(normalizedPhones.filter((p): p is string => p !== null))];
      const totalWaBatches = Math.ceil(uniquePhones.length / WAVALIDATOR_BATCH_SIZE);

      console.log(`[phone-validation] ${uniquePhones.length} números únicos para checar WhatsApp`);
      if (uniquePhones.length > 0) {
        console.log(`[phone-validation] Amostra dos primeiros números: ${uniquePhones.slice(0, 5).join(", ")}`);
      }

      await send({ type: "progress", step: "whatsapp", message: `Verificando ${uniquePhones.length} números no WhatsApp (${totalWaBatches} lotes)...`, checked: 0, total: uniquePhones.length });

      const { existsSet: whatsappSet, creditsRemaining } = await checkWhatsAppBatch(uniquePhones, (checked, total) => {
        send({ type: "progress", step: "whatsapp", message: `WhatsApp: ${checked}/${total} números verificados`, checked, total });
      });

      if (creditsRemaining !== null) {
        await saveCredits(creditsRemaining);
      }

      console.log(`[whatsapp-check] Wavalidator retornou ${whatsappSet.size} números com WhatsApp (créditos restantes: ${creditsRemaining})`);

      let withoutWhatsApp = 0;
      const whatsappValidIndices: number[] = [];
      const whatsappValidPhoneLocalIdx: number[] = [];

      for (let pi = 0; pi < phoneValidIndices.length; pi++) {
        const phone = normalizedPhones[phoneValidLocalIdx[pi]];
        if (phone && whatsappSet.has(phone)) {
          whatsappValidIndices.push(phoneValidIndices[pi]);
          whatsappValidPhoneLocalIdx.push(phoneValidLocalIdx[pi]);
        } else {
          withoutWhatsApp++;
        }
      }

      console.log(`[whatsapp-check] Resultado: ${whatsappValidIndices.length} com WhatsApp | ${withoutWhatsApp} sem WhatsApp`);

      await send({ type: "progress", step: "coverage", message: "Verificando cobertura por CEP..." });

      const allFilteredCeps = filteredIndices.map((i) => normalizeCep(rows[i][cepCol]));
      const validCeps = [...new Set(allFilteredCeps.filter((c): c is string => c !== null))];

      const [claroResults, timResults, nioResults] = await Promise.all([
        validCeps.length > 0
          ? prisma.cepClaro.findMany({ where: { cep: { in: validCeps } }, select: { cep: true } })
          : [],
        validCeps.length > 0
          ? prisma.cepTim.findMany({ where: { cep: { in: validCeps } }, select: { cep: true } })
          : [],
        validCeps.length > 0
          ? prisma.cepNio.findMany({ where: { cep: { in: validCeps } }, select: { cep: true } })
          : [],
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

      await send({ type: "progress", step: "build", message: "Montando planilha de saída..." });

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
          if (cpf) {
            cpfsToSave.push({ cpf, cep, contato: rawContato, cobertura: coverage, motivoRecusa: "Número incorreto" });
          }
          continue;
        }

        if (!approvedRowIndicesSet.has(origIdx)) {
          if (cpf) {
            cpfsToSave.push({ cpf, cep, contato: rawContato, cobertura: coverage, motivoRecusa: "Sem WhatsApp" });
          }
          continue;
        }

        if (coverage === "CEP inválido") {
          invalid++;
          outputRows.push({ ...rows[origIdx], Cobertura: coverage });
          continue;
        }

        if (coverage === "Sem cobertura") {
          withoutCoverage++;
          if (cpf) {
            cpfsToSave.push({ cpf, cep, contato: rawContato, cobertura: coverage, motivoRecusa: "Sem cobertura" });
          }
          continue;
        }

        withCoverage++;
        outputRows.push({ ...rows[origIdx], Cobertura: coverage });
        if (cpf) {
          cpfsToSave.push({ cpf, cep, contato: rawContato, cobertura: coverage, motivoRecusa: null });
        }
      }

      await send({ type: "progress", step: "save", message: "Salvando registros no banco..." });

      let newCpfsSaved = 0;
      if (cpfsToSave.length > 0) {
        const uniqueMap = new Map<string, { cep: string | null; contato: string | null; cobertura: string; motivoRecusa: string | null }>();
        for (const entry of cpfsToSave) {
          if (!uniqueMap.has(entry.cpf)) {
            uniqueMap.set(entry.cpf, { cep: entry.cep, contato: entry.contato, cobertura: entry.cobertura, motivoRecusa: entry.motivoRecusa });
          }
        }
        const data = [...uniqueMap.entries()].map(([cpf, v]) => ({
          cpf,
          cep: v.cep,
          contato: v.contato,
          cobertura: v.cobertura,
          motivoRecusa: v.motivoRecusa,
        }));
        const chunkSize = 1000;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const result = await prisma.cpfCobertura.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          newCpfsSaved += result.count;
        }
      }

      const newSheet = XLSX.utils.json_to_sheet(outputRows);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);
      const outBuffer: Buffer = XLSX.write(newWorkbook, { type: "buffer", bookType: "xlsx" });

      const safeName = file.name.replace(/\.[^.]+$/, "");
      const filename = `${safeName}_cobertura.xlsx`;

      const elapsedMs = Math.round(performance.now() - t0);

      await send({
        type: "done",
        filename,
        fileBase64: outBuffer.toString("base64"),
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
      });
    } catch (err) {
      console.error("[process] Error:", err);
      const message = err instanceof Error ? err.message : "Erro interno ao processar planilha";
      await send({ type: "error", error: message });
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
