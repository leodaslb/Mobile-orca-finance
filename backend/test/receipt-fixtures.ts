import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const PNG_RECEIPT = readFileSync(join(__dirname, 'fixtures/receipt.png'));
export const JPEG_RECEIPT = readFileSync(join(__dirname, 'fixtures/receipt.jpg'));

export function receiptMultipart(files: { buffer: Buffer; mimeType: string; field?: string; filename?: string }[] = [
  { buffer: PNG_RECEIPT, mimeType: 'image/png' },
], fields: { name: string; value: string }[] = []) {
  const boundary = `orca-receipt-${randomUUID()}`;
  const parts: Buffer[] = [];
  for (const field of fields) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`));
  for (const file of files) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field ?? 'file'}"; filename="${file.filename ?? 'receipt'}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`));
    parts.push(file.buffer, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat(parts) };
}
