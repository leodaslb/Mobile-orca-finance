import { apiRequest, getApiSession, profilePath, SessionChangedError } from '@/services/api-client';

import type { ReceiptFile } from '@/types/receipt';
import { validateReceiptFile } from '@/utils/receipt-file';

export async function uploadReceipt(transactionId: string, file: ReceiptFile) {
  validateReceiptFile(file);
  const revision = getApiSession().revision;
  const body = new FormData();
  if (file.webFile) body.append('file', file.webFile, file.name);
  else {
    // O fetch do Expo aceita File/Blob; o objeto legado { uri } não é suportado.
    const { File } = await import('expo-file-system');
    if (revision !== getApiSession().revision) throw new SessionChangedError();
    body.append('file', new File(file.uri), file.name);
  }
  return apiRequest<{ id: string; arquivoUrl: string; mimeType: string }>(
    profilePath(`transactions/${encodeURIComponent(transactionId)}/receipts`), { method: 'POST', body });
}
