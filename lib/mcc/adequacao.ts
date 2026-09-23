/**
 * Adequação de planilhas brutas para o formato aceito pelo "Processar Planilha".
 *
 * Regras:
 *  - CEP: 8 dígitos, sem pontos/traços/espaços. CEPs espalhados em outras colunas
 *    (ex.: dentro do endereço "75530-365" ou em colunas "CEP 2") são consolidados
 *    em uma única coluna "CEP". Sem CEP → preenche com DEFAULT_CEP.
 *  - CONTATO: colunas telefone/celular/fone/whatsapp... → renomeada para "CONTATO"
 *    no formato +55DDDNUMERO. Se houver coluna DDD separada, ela é usada.
 *  - CPF: 11 dígitos, sem pontos/traços/espaços (zeros à esquerda restaurados).
 *    Sem CPF → gera CPF válido apenas para a planilha processar. Coluna criada se
 *    chama "CPF Criado"; CPFs gerados nunca se repetem (reservados no banco).
 *  - Nome do cliente: "Maria da Silva" (caixa baixa, inicial maiúscula).
 *  - Demais colunas não são alteradas.
 */
import * as XLSX from "xlsx";

export const DEFAULT_CEP = "22790420";
export const CPF_CRIADO_HEADER = "CPF Criado";
export const ORIGEM_CPF_HEADER = "Origem CPF";

/** Fornece `n` CPFs inéditos (que não estejam em `usados`). */
export type CpfProvider = (n: number, usados: Set<string>) => Promise<string[]>;

type Cell = unknown;

export interface AdequacaoStats {
  linhas: number;
  cepsFormatados: number;
  cepsEncontradosEmOutrasColunas: number;
  cepsPadrao: number;
  contatosFormatados: number;
  contatosInvalidos: number;
  cpfsFormatados: number;
  cpfsGerados: number;
  nomesFormatados: number;
  colunaCepCriada: boolean;
  colunaCpfCriada: boolean;
  colunasRenomeadas: string[];
  colunasCepMescladas: string[];
  avisos: string[];
}

// ---------------------------------------------------------------------------
// Helpers de cabeçalho
// ---------------------------------------------------------------------------

export function normHeader(h: unknown): string {
  return String(h ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(h: string): string[] {
  // separa também "telefone1" → ["telefone", "1"]
  return h.replace(/([a-z])(\d)/g, "$1 $2").split(" ").filter(Boolean);
}

function isCepHeader(h: string): boolean {
  const t = tokens(h);
  return t.includes("cep") || h.includes("codigo postal") || h === "zip" || h === "zipcode";
}

function isCpfHeader(h: string): boolean {
  const t = tokens(h);
  if (t.includes("cpf")) return true;
  return ["documento", "doc", "cpf cnpj", "cnpj cpf", "n documento", "num documento", "numero documento"].includes(h);
}

const PHONE_WORDS = ["telefone", "tel", "fone", "celular", "cel", "whatsapp", "whats", "zap", "contato", "movel", "telefones", "celulares"];
const PHONE_EXCLUDE = ["ddd", "terminal", "email", "mail", "nome", "tipo", "status", "data", "dt", "operadora", "obs", "observacao"];

/** Prioridade (menor = melhor) ou null se não for coluna de telefone. */
function phonePriority(h: string): number | null {
  const t = tokens(h);
  if (t.some((x) => PHONE_EXCLUDE.includes(x))) return null;
  if (!t.some((x) => PHONE_WORDS.includes(x))) return null;
  if (h === "contato") return 0;
  if (t.some((x) => ["whatsapp", "whats", "zap"].includes(x))) return 1;
  if (t.some((x) => ["celular", "cel", "movel", "celulares"].includes(x))) return 2;
  if (t.includes("contato")) return 3;
  return 4;
}

function isDddHeader(h: string): boolean {
  return h === "ddd" || /^ddd\b/.test(h);
}

const NAME_HEADERS = [
  "nome", "cliente", "nome cliente", "cliente nome", "nome do cliente", "nome completo",
  "razao social", "titular", "nome titular", "assinante", "nome assinante", "responsavel", "nome responsavel",
];

function isNameHeader(h: string): boolean {
  return NAME_HEADERS.includes(h);
}

// ---------------------------------------------------------------------------
// Normalizadores
// ---------------------------------------------------------------------------

function digitsOf(v: Cell): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v).toString() : "";
  return String(v).replace(/\D/g, "");
}

function isBlank(v: Cell): boolean {
  return v == null || String(v).trim() === "";
}

/** CEP a partir de uma célula da coluna de CEP (aceita número sem zero à esquerda). */
export function cepFromCepCell(v: Cell): string | null {
  if (isBlank(v)) return null;
  const s = typeof v === "number" ? "" : String(v);
  // texto com mais coisas (ex. "CEP 22790-420 RJ") → procura padrão
  if (s && /[a-z]/i.test(s)) return cepFromText(s);
  const d = digitsOf(v);
  if (d.length < 7 || d.length > 8) return null;
  const cep = d.padStart(8, "0");
  return cep === "00000000" ? null : cep;
}

/** Procura um CEP dentro de um texto livre (endereço etc). */
export function cepFromText(v: Cell): string | null {
  if (isBlank(v) || typeof v === "number") return null;
  const s = String(v);
  const patterns = [
    /cep\s*[:.\-]?\s*(\d{2})\.?(\d{3})\s*-?\s*(\d{3})(?!\d)/i,
    /(?<!\d)(\d{2})\.(\d{3})-(\d{3})(?!\d)/,
    /(?<!\d)(\d{2})(\d{3})-(\d{3})(?!\d)/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const cep = `${m[1]}${m[2]}${m[3]}`;
      if (cep !== "00000000") return cep;
    }
  }
  return null;
}

/**
 * Normaliza telefone para +55DDDNUMERO. Retorna null se não for possível.
 * Aceita células com vários números ("21 99999-0000 / 21 3333-4444") – usa o primeiro válido.
 */
export function formatPhone(v: Cell, ddd?: string | null): string | null {
  if (isBlank(v)) return null;
  const raw = typeof v === "number" ? Math.trunc(v).toString() : String(v);
  const parts = raw.split(/[\/;,|]| e | ou |\n/i).map((p) => p.replace(/\D/g, "")).filter(Boolean);
  for (const p of parts) {
    const r = formatPhoneDigits(p, ddd);
    if (r) return r;
  }
  return null;
}

function formatPhoneDigits(input: string, ddd?: string | null): string | null {
  let d = input.replace(/^0+/, ""); // 021..., 0xx21...
  // remove código de operadora "0xx" (ex.: 0 15 21 99999-9999 → após tirar 0: 1521999999999)
  if (d.length === 13 && !d.startsWith("55")) d = d.slice(2);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);

  const dddClean = ddd ? ddd.replace(/\D/g, "").replace(/^0+/, "") : "";
  if ((d.length === 8 || d.length === 9) && dddClean.length === 2) d = dddClean + d;

  if (d.length !== 10 && d.length !== 11) return null;
  const area = d.slice(0, 2);
  if (!/^[1-9][1-9]$/.test(area)) return null;
  let local = d.slice(2);
  // celular antigo com 8 dígitos (6-9 no início) → acrescenta o 9
  if (local.length === 8 && /^[6-9]/.test(local)) local = `9${local}`;
  if (local.length === 9 && !local.startsWith("9")) return null;
  return `+55${area}${local}`;
}

export function formatCpf(v: Cell): string | null {
  if (isBlank(v)) return null;
  const d = digitsOf(v);
  if (d.length === 0) return null;
  if (d.length <= 11) {
    const cpf = d.padStart(11, "0");
    return /^0+$/.test(cpf) ? null : cpf;
  }
  if (d.length <= 14) return d.padStart(14, "0"); // CNPJ – mantém só dígitos
  return null;
}

function cpfCheckDigits(base9: string): string {
  const nums = base9.split("").map(Number);
  let s = 0;
  for (let i = 0; i < 9; i++) s += nums[i] * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  s = 0;
  for (let i = 0; i < 9; i++) s += nums[i] * (11 - i);
  s += d1 * 2;
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return `${d1}${d2}`;
}

/** Gera CPF válido (dígitos verificadores corretos), único dentro do conjunto `used`. */
export function generateCpf(used: Set<string>): string {
  for (;;) {
    let base = "";
    for (let i = 0; i < 9; i++) base += Math.floor(Math.random() * 10).toString();
    if (/^(\d)\1{8}$/.test(base)) continue;
    const cpf = base + cpfCheckDigits(base);
    if (!used.has(cpf)) {
      used.add(cpf);
      return cpf;
    }
  }
}

const LOWER_PARTICLES = new Set(["da", "de", "do", "das", "dos", "e", "di", "du", "del", "della", "van", "von", "y"]);
const UPPER_KEEP = new Set(["ltda", "me", "epp", "eireli", "s/a", "sa", "ii", "iii", "iv", "cia"]);

export function formatName(v: Cell): string | null {
  if (isBlank(v) || typeof v !== "string") return null;
  const words = v.trim().replace(/\s+/g, " ").toLowerCase().split(" ");
  return words
    .map((w, i) => {
      if (i > 0 && LOWER_PARTICLES.has(w)) return w;
      if (UPPER_KEEP.has(w) && i > 0) return w === "ltda" || w === "cia" ? cap(w) : w.toUpperCase();
      // capitaliza após hífen/apóstrofo: "d'avila" → "D'Avila", "ana-maria" → "Ana-Maria"
      return w.split(/(['\-])/).map((p) => (p === "'" || p === "-" ? p : cap(p))).join("");
    })
    .join(" ");
}

function cap(w: string): string {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

// ---------------------------------------------------------------------------
// Detecção da linha de cabeçalho
// ---------------------------------------------------------------------------

function headerScore(row: Cell[]): number {
  let score = 0;
  for (const c of row) {
    const h = normHeader(c);
    if (!h) continue;
    if (isCepHeader(h) || isCpfHeader(h) || phonePriority(h) !== null || isNameHeader(h) || isDddHeader(h)) score += 3;
    else if (typeof c === "string" && !/\d{4,}/.test(c)) score += 0.2;
  }
  return score;
}

function findHeaderRow(aoa: Cell[][]): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const s = headerScore(aoa[i] ?? []);
    if (s > bestScore + 0.001) {
      best = i;
      bestScore = s;
    }
    if (s >= 6) break;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Adequação
// ---------------------------------------------------------------------------

export async function adequarLinhas(
  aoaInput: Cell[][],
  cpfProvider?: CpfProvider,
): Promise<{ aoa: Cell[][]; stats: AdequacaoStats }> {
  const stats: AdequacaoStats = {
    linhas: 0,
    cepsFormatados: 0,
    cepsEncontradosEmOutrasColunas: 0,
    cepsPadrao: 0,
    contatosFormatados: 0,
    contatosInvalidos: 0,
    cpfsFormatados: 0,
    cpfsGerados: 0,
    nomesFormatados: 0,
    colunaCepCriada: false,
    colunaCpfCriada: false,
    colunasRenomeadas: [],
    colunasCepMescladas: [],
    avisos: [],
  };

  const headerIdx = findHeaderRow(aoaInput);
  if (headerIdx > 0) stats.avisos.push(`${headerIdx} linha(s) acima do cabeçalho foram ignoradas.`);

  const rawHeader = aoaInput[headerIdx] ?? [];
  const body = aoaInput
    .slice(headerIdx + 1)
    .filter((r) => Array.isArray(r) && r.some((c) => !isBlank(c)));

  const width = Math.max(rawHeader.length, ...body.map((r) => r.length), 0);
  const header: string[] = [];
  for (let c = 0; c < width; c++) {
    const h = rawHeader[c];
    header.push(isBlank(h) ? `Coluna ${c + 1}` : String(h).trim());
  }
  const nh = header.map(normHeader);
  const rows: Cell[][] = body.map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push("");
    return out;
  });
  stats.linhas = rows.length;

  const rename = (col: number, to: string) => {
    if (header[col] !== to) stats.colunasRenomeadas.push(`${header[col]} → ${to}`);
    header[col] = to;
  };

  // ---- Colunas -----------------------------------------------------------
  const cepCols = nh.map((h, i) => (isCepHeader(h) ? i : -1)).filter((i) => i >= 0);
  // preferir coluna chamada exatamente "cep"
  cepCols.sort((a, b) => (nh[a] === "cep" ? -1 : 0) - (nh[b] === "cep" ? -1 : 0) || a - b);
  const cpfCols = nh.map((h, i) => (isCpfHeader(h) ? i : -1)).filter((i) => i >= 0);
  cpfCols.sort((a, b) => (nh[a] === "cpf" ? -1 : 0) - (nh[b] === "cpf" ? -1 : 0) || a - b);
  const phoneCols = nh
    .map((h, i) => ({ i, p: phonePriority(h) }))
    .filter((x): x is { i: number; p: number } => x.p !== null)
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.i);
  const dddCol = nh.findIndex(isDddHeader);
  const nameCols = nh.map((h, i) => (isNameHeader(h) ? i : -1)).filter((i) => i >= 0);
  const textCols = header.map((_, i) => i).filter((i) => !cepCols.includes(i));

  // ---- CEP ---------------------------------------------------------------
  const cepPrimary = cepCols[0] ?? -1;
  const cepValues: string[] = [];
  for (const row of rows) {
    let cep: string | null = null;
    let fromOther = false;
    for (const c of cepCols) {
      cep = cepFromCepCell(row[c]);
      if (cep) {
        fromOther = c !== cepPrimary;
        break;
      }
    }
    if (!cep) {
      for (const c of textCols) {
        cep = cepFromText(row[c]);
        if (cep) {
          fromOther = true;
          break;
        }
      }
    }
    if (!cep) {
      cep = DEFAULT_CEP;
      stats.cepsPadrao++;
    } else if (fromOther) {
      stats.cepsEncontradosEmOutrasColunas++;
    } else if (String(row[cepPrimary] ?? "") !== cep) {
      stats.cepsFormatados++;
    }
    cepValues.push(cep);
  }

  // ---- CPF ---------------------------------------------------------------
  const cpfPrimary = cpfCols[0] ?? -1;
  const usedCpfs = new Set<string>();
  const cpfPre: (string | null)[] = rows.map((row) => {
    for (const c of cpfCols) {
      const v = formatCpf(row[c]);
      if (v) return v;
    }
    return null;
  });
  cpfPre.forEach((c) => c && usedCpfs.add(c));
  const faltantes = cpfPre.filter((c) => !c).length;
  let novos: string[] = [];
  if (faltantes > 0) {
    novos = cpfProvider
      ? await cpfProvider(faltantes, usedCpfs)
      : Array.from({ length: faltantes }, () => generateCpf(usedCpfs));
    if (novos.length !== faltantes) throw new Error("Não foi possível gerar CPFs suficientes");
    novos.forEach((c) => usedCpfs.add(c));
  }
  let novoIdx = 0;
  const cpfCriadoNaLinha: boolean[] = [];
  const cpfValues: string[] = cpfPre.map((c, idx) => {
    if (c) {
      if (cpfPrimary >= 0 && String(rows[idx][cpfPrimary] ?? "") !== c) stats.cpfsFormatados++;
      cpfCriadoNaLinha.push(false);
      return c;
    }
    stats.cpfsGerados++;
    cpfCriadoNaLinha.push(true);
    return novos[novoIdx++];
  });

  // ---- CONTATO -----------------------------------------------------------
  const phonePrimary = phoneCols[0] ?? -1;
  if (phonePrimary >= 0) {
    for (const row of rows) {
      const ddd = dddCol >= 0 ? digitsOf(row[dddCol]) : null;
      let phone: string | null = null;
      for (const c of phoneCols) {
        phone = formatPhone(row[c], ddd);
        if (phone) break;
      }
      if (phone) {
        if (String(row[phonePrimary] ?? "") !== phone) stats.contatosFormatados++;
        row[phonePrimary] = phone;
      } else {
        stats.contatosInvalidos++;
        // mantém o valor original (o processamento vai marcar como "Número incorreto")
        if (typeof row[phonePrimary] === "number") row[phonePrimary] = String(row[phonePrimary]);
      }
    }
    rename(phonePrimary, "CONTATO");
  } else {
    stats.avisos.push("Nenhuma coluna de telefone encontrada — a validação de WhatsApp será pulada.");
  }

  // ---- Nomes -------------------------------------------------------------
  for (const c of nameCols) {
    for (const row of rows) {
      const f = formatName(row[c]);
      if (f && f !== row[c]) {
        row[c] = f;
        stats.nomesFormatados++;
      }
    }
  }

  // ---- Grava CEP / CPF ---------------------------------------------------
  if (cepPrimary >= 0) {
    rows.forEach((row, i) => (row[cepPrimary] = cepValues[i]));
    rename(cepPrimary, "CEP");
  }
  if (cpfPrimary >= 0) {
    rows.forEach((row, i) => (row[cpfPrimary] = cpfValues[i]));
    rename(cpfPrimary, "CPF");
  }

  // remove colunas extras de CEP (já consolidadas na principal)
  const dropCols = new Set(cepCols.slice(1));
  stats.colunasCepMescladas = cepCols.slice(1).map((c) => header[c]);
  // outras colunas de CPF extras permanecem, mas não podem se chamar "CPF"
  const keep = header.map((_, i) => i).filter((i) => !dropCols.has(i));
  let outHeader: Cell[] = keep.map((i) => header[i]);
  let outRows: Cell[][] = rows.map((r) => keep.map((i) => r[i]));

  if (cpfPrimary < 0) {
    // planilha sem CPF: coluna nova "CPF Criado" com CPFs gerados
    stats.colunaCpfCriada = true;
    outHeader = [...outHeader, CPF_CRIADO_HEADER];
    outRows = outRows.map((r, i) => [...r, cpfValues[i]]);
  } else if (stats.cpfsGerados > 0) {
    // algumas linhas sem CPF: marca quais foram criados
    outHeader = [...outHeader, ORIGEM_CPF_HEADER];
    outRows = outRows.map((r, i) => [...r, cpfCriadoNaLinha[i] ? CPF_CRIADO_HEADER : ""]);
  }
  if (cepPrimary < 0) {
    stats.colunaCepCriada = true;
    outHeader = [...outHeader, "CEP"];
    outRows = outRows.map((r, i) => [...r, cepValues[i]]);
  }

  return { aoa: [outHeader, ...outRows], stats };
}

/** Lê o arquivo, adequa a primeira aba e devolve o xlsx (demais abas preservadas). */
export async function adequarPlanilha(
  buffer: Buffer,
  cpfProvider?: CpfProvider,
): Promise<{ output: Buffer; stats: AdequacaoStats }> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstName = wb.SheetNames[0];
  if (!firstName) throw new Error("Planilha vazia");
  const sheet = wb.Sheets[firstName];
  const aoa = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: "", blankrows: false });
  if (aoa.length < 2) throw new Error("Planilha sem dados");

  const { aoa: out, stats } = await adequarLinhas(aoa, cpfProvider);
  const newSheet = XLSX.utils.aoa_to_sheet(out, { cellDates: true, dateNF: "dd/mm/yyyy" });

  // Força CEP, CPF e CONTATO como texto (preserva zeros à esquerda)
  const hdr = out[0] as string[];
  const textCols = hdr.map((h, i) => (h === "CEP" || h === "CPF" || h === CPF_CRIADO_HEADER || h === "CONTATO" ? i : -1)).filter((i) => i >= 0);
  for (let r = 1; r < out.length; r++) {
    for (const c of textCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = newSheet[addr];
      if (cell && cell.v !== "" && cell.v != null) {
        cell.t = "s";
        cell.v = String(cell.v);
        cell.z = "@";
      }
    }
  }

  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, newSheet, firstName);
  for (const name of wb.SheetNames.slice(1)) XLSX.utils.book_append_sheet(outWb, wb.Sheets[name], name);
  const output: Buffer = XLSX.write(outWb, { type: "buffer", bookType: "xlsx" });
  return { output, stats };
}
