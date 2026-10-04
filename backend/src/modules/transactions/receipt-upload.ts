import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

// Decisão técnica da US19: uma foto de até 5 MiB por requisição.
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
export const RECEIPT_MULTIPART_LIMITS = { fileSize: RECEIPT_MAX_BYTES, files: 1, fields: 0, parts: 1 };

export interface ReceiptUpload {
  buffer: Buffer;
  mimeType: string;
}

export function validateReceiptUpload(file: ReceiptUpload): void {
  if (file.buffer.length > RECEIPT_MAX_BYTES) throw new PayloadTooLargeException('O recibo deve ter no máximo 5 MiB.');
  const png = file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = file.buffer.length >= 3 && file.buffer[0] === 255 && file.buffer[1] === 216 && file.buffer[2] === 255;
  if (!((file.mimeType === 'image/png' && png) || (file.mimeType === 'image/jpeg' && jpeg))) {
    throw new BadRequestException('Envie um arquivo JPEG ou PNG com conteúdo compatível com o MIME informado.');
  }
}
