import * as XLSX from "xlsx";
import { getJob } from "@/lib/mcc/jobStore";

export type Row = Record<string, unknown>;

export interface PlanilhaLida {
  arquivo: string;
  headers: string[];
  rows: Row[];
}

export function lerPlanilha(buffer: Buffer, arquivo: string): PlanilhaLida | { erro: string } {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { erro: "Não foi possível ler a planilha" };
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { erro: "Planilha vazia" };
  const rows: Row[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  if (rows.length === 0) return { erro: "Planilha sem dados" };
  const headers = Object.keys(rows[0]);
  return { arquivo, headers, rows };
}

/** Planilha processada por um job de /mcc (ainda em memória). */
export function lerPlanilhaDoJob(jobId: string): PlanilhaLida | { erro: string } {
  const job = getJob(jobId);
  if (!job) return { erro: "Processamento não encontrado (expirado?). Baixe a planilha e envie o arquivo." };
  if (job.status !== "done" || !job.resultBase64) return { erro: "O processamento ainda não terminou" };
  return lerPlanilha(Buffer.from(job.resultBase64, "base64"), job.resultFilename || `job-${jobId}.xlsx`);
}

/** Lê a planilha de uma requisição: multipart (campo "file") ou JSON/query com jobId. */
export async function lerPlanilhaDaRequisicao(req: Request): Promise<(PlanilhaLida & { extra: Record<string, string> }) | { erro: string }> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    let fd: FormData;
    try {
      fd = await req.formData();
    } catch {
      return { erro: "Requisição inválida" };
    }
    const extra: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (typeof v === "string") extra[k] = v;
    const file = fd.get("file");
    if (file && typeof file !== "string") {
      const lida = lerPlanilha(Buffer.from(await file.arrayBuffer()), file.name);
      return "erro" in lida ? lida : { ...lida, extra };
    }
    if (extra.jobId) {
      const lida = lerPlanilhaDoJob(extra.jobId);
      return "erro" in lida ? lida : { ...lida, extra };
    }
    return { erro: "Nenhum arquivo enviado" };
  }
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* sem corpo */
  }
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) if (typeof v === "string" || typeof v === "number") extra[k] = String(v);
  if (!extra.jobId) return { erro: "Nenhum arquivo enviado" };
  const lida = lerPlanilhaDoJob(extra.jobId);
  return "erro" in lida ? lida : { ...lida, extra };
}
