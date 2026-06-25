/**
 * In-memory job store for async spreadsheet processing.
 * Jobs expire after 1 hour to prevent memory leaks.
 */

export type JobStatus = "pending" | "processing" | "done" | "error";

export interface ProcessJob {
  id: string;
  status: JobStatus;
  progressMsg: string;
  progressChecked: number;
  progressTotal: number;
  createdAt: number;
  // Result fields (set when done)
  resultBase64?: string;
  resultFilename?: string;
  resultStats?: {
    total: number;
    withCoverage: number;
    withoutCoverage: number;
    incorrectNumber: number;
    withoutWhatsApp: number;
    invalid: number;
    skippedCpfs: number;
    newCpfsSaved: number;
    elapsedMs: number;
    creditsRemaining: number | null;
  };
  errorMessage?: string;
}

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

// Use globalThis to survive hot-reloads in Next.js dev mode
declare global {
  // eslint-disable-next-line no-var
  var __mccJobStore: Map<string, ProcessJob> | undefined;
}

function getStore(): Map<string, ProcessJob> {
  if (!globalThis.__mccJobStore) {
    globalThis.__mccJobStore = new Map();
  }
  return globalThis.__mccJobStore;
}

export function createJob(id: string): ProcessJob {
  const job: ProcessJob = {
    id,
    status: "pending",
    progressMsg: "Aguardando processamento...",
    progressChecked: 0,
    progressTotal: 0,
    createdAt: Date.now(),
  };
  getStore().set(id, job);
  // Cleanup expired jobs opportunistically
  cleanupExpired();
  return job;
}

export function getJob(id: string): ProcessJob | undefined {
  return getStore().get(id);
}

export function updateJob(id: string, patch: Partial<ProcessJob>): void {
  const store = getStore();
  const job = store.get(id);
  if (job) {
    Object.assign(job, patch);
  }
}

export function cleanupExpired(): void {
  const store = getStore();
  const now = Date.now();
  for (const [id, job] of store.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      store.delete(id);
    }
  }
}
