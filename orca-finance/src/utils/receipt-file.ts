import { ApiError } from '@/services/api-client';
import type { ReceiptFile } from '@/types/receipt';
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export function validateReceiptFile(file: ReceiptFile) {
  if (!file.uri || !/^(file|content|blob):/i.test(file.uri)) throw new ApiError(400, 'Escolha uma imagem da galeria ou tire uma foto.');
  if (!['image/jpeg', 'image/png'].includes(file.mimeType)) throw new ApiError(415, 'Escolha uma imagem JPEG ou PNG.');
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new ApiError(400, 'Não foi possível ler a imagem. Escolha outra ou tire uma nova foto.');
  if (file.size > MAX_RECEIPT_BYTES) throw new ApiError(413, 'A imagem deve ter no máximo 5 MiB. Escolha uma imagem menor.');
}
