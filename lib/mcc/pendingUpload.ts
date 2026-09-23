/**
 * Guarda (em memória, no navegador) uma planilha adequada para ser enviada
 * à tela "Processar Planilha" sem precisar baixar e subir de novo.
 */
let pending: File | null = null;

export function setPendingUpload(file: File) {
  pending = file;
}

export function takePendingUpload(): File | null {
  const f = pending;
  pending = null;
  return f;
}
