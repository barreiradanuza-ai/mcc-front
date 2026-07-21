/**
 * Adapter for the CheckNumber.ai WhatsApp Number Checker API.
 * Bulk, asynchronous, file-based: submit numbers as a text file -> poll the
 * task -> download a ZIP result.
 * Docs: https://docs.checknumber.ai/whatsapp-bulk-checker/ (says the result is a
 * bare xlsx with a "whatsapp" column — confirmed WRONG against a real task: the
 * result_url actually points to a .zip containing activated.txt, unregistered.txt,
 * all.csv and result.xlsx, and the column inside result.xlsx is "activated", not
 * "whatsapp". We parse activated.txt (plain E.164 list, one per line) since it
 * has no header-naming to get wrong.
 * Balance: https://docs.checknumber.ai/balance-api/
 */
import AdmZip from "adm-zip";

const BASE_URL = "https://api.checknumber.ai";
const API_KEY = process.env.CHECKNUMBER_API_KEY ?? "";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000; // ceiling per task; provider doesn't document typical duration

// Not documented anywhere in the provider's docs — discovered empirically via the
// "invalid_batch_size" error returned by POST /v1/tasks for task_type=ws.
export const CHECKNUMBER_MIN_BATCH_SIZE = 500;

export function normalizePhone(raw: unknown): string | null {
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

function toE164(localPhone: string): string {
  return `+${localPhone}`;
}

function fromE164(e164: string): string {
  return e164.replace(/^\+/, "");
}

interface CheckNumberTask {
  task_id: string;
  status: "pending" | "processing" | "exported" | "failed";
  total: number;
  success: number;
  failure: number;
  result_url?: string;
}

async function describeError(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  let parsed: { error?: string; message?: string } | null = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    // body não é JSON — segue com a mensagem crua
  }

  if (parsed?.error === "invalid_batch_size") {
    return `lote abaixo do mínimo exigido pelo provedor — ${parsed.message ?? body}`;
  }

  switch (res.status) {
    case 401:
      return "chave de API inválida ou ausente (CHECKNUMBER_API_KEY)";
    case 402:
      return "saldo insuficiente na CheckNumber.ai";
    case 400:
      return `requisição inválida: ${parsed?.message ?? body.slice(0, 200)}`;
    case 413:
      return "arquivo de números grande demais para uma única task";
    default:
      return `erro ${res.status}: ${body.slice(0, 200)}`;
  }
}

async function submitTask(phonesE164: string[]): Promise<CheckNumberTask> {
  const form = new FormData();
  form.append("file", new Blob([phonesE164.join("\n")], { type: "text/plain" }), "numbers.txt");
  form.append("task_type", "ws");

  const res = await fetch(`${BASE_URL}/v1/tasks`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY },
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`CheckNumber: falha ao enviar task — ${await describeError(res)}`);
  const task = await res.json();
  console.log(`[checknumber] task ${task.task_id} criada (${phonesE164.length} números)`);
  return task;
}

async function getTask(taskId: string): Promise<CheckNumberTask> {
  const form = new FormData();
  form.append("task_id", taskId);

  const res = await fetch(`${BASE_URL}/v1/gettasks`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY },
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`CheckNumber: falha ao consultar status da task — ${await describeError(res)}`);
  return res.json();
}

type ProgressFn = (checked: number, total: number) => void;

async function pollUntilDone(taskId: string, onProgress?: ProgressFn): Promise<CheckNumberTask> {
  const startedAt = Date.now();

  for (;;) {
    const task = await getTask(taskId);
    onProgress?.(task.success + task.failure, task.total);

    if (task.status === "exported") {
      console.log(`[checknumber] task ${task.task_id} concluída: ${task.success}/${task.total} (falhas: ${task.failure})`);
      return task;
    }
    if (task.status === "failed") {
      throw new Error("CheckNumber: a validação de números falhou no provedor");
    }
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error(`CheckNumber: tempo limite de ${POLL_TIMEOUT_MS / 1000}s excedido aguardando a validação`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

/**
 * Downloads the result ZIP and returns the set of local-format (55DDDNUMERO)
 * numbers confirmed to have WhatsApp, parsed from activated.txt (one E.164
 * number per line — the most format-stable file in the archive).
 */
async function downloadResults(resultUrl: string): Promise<Set<string>> {
  const res = await fetch(resultUrl, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`CheckNumber: falha ao baixar resultado (${res.status})`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const activatedEntry = entries.find((e) => e.entryName.toLowerCase().endsWith("activated.txt"));
  if (!activatedEntry) {
    const found = entries.map((e) => e.entryName).join(", ") || "(zip vazio)";
    throw new Error(`CheckNumber: "activated.txt" não encontrado no resultado — arquivos presentes: ${found}`);
  }

  const text = activatedEntry.getData().toString("utf8");
  const existsSet = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) existsSet.add(fromE164(trimmed));
  }
  return existsSet;
}

export interface WhatsAppCheckResult {
  /** Local-format numbers (55DDDNUMERO, no "+") confirmed to have an active WhatsApp account. */
  existsSet: Set<string>;
}

/**
 * Checks a list of already-normalized local phone numbers (55DDDNUMERO)
 * against CheckNumber.ai and returns which ones have an active WhatsApp account.
 */
export async function checkWhatsAppBulk(
  localPhones: string[],
  onProgress?: ProgressFn,
): Promise<WhatsAppCheckResult> {
  if (!API_KEY) {
    throw new Error("CHECKNUMBER_API_KEY não configurada — validação de WhatsApp indisponível");
  }
  if (localPhones.length === 0) {
    return { existsSet: new Set() };
  }
  if (localPhones.length < CHECKNUMBER_MIN_BATCH_SIZE) {
    throw new Error(
      `CheckNumber exige no mínimo ${CHECKNUMBER_MIN_BATCH_SIZE} números válidos únicos por validação — esta planilha tem apenas ${localPhones.length}. Envie um lote maior ou aguarde acumular mais leads.`,
    );
  }

  const task = await submitTask(localPhones.map(toE164));
  const finalTask = await pollUntilDone(task.task_id, onProgress);

  if (!finalTask.result_url) {
    throw new Error("CheckNumber: task concluída sem result_url");
  }

  const existsSet = await downloadResults(finalTask.result_url);
  console.log(`[checknumber] ${existsSet.size} de ${localPhones.length} números têm WhatsApp ativo`);
  return { existsSet };
}

/** Live balance query (GET /v1/balance) — no local caching. */
export async function getBalance(): Promise<number | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${BASE_URL}/v1/balance`, {
      headers: { "X-API-Key": API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.balance === "number" ? data.balance : null;
  } catch {
    return null;
  }
}
