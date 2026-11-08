import * as DocumentPicker from 'expo-document-picker';
import { File as LocalFile } from 'expo-file-system';
import { Platform } from 'react-native';
import { ApiError, apiRequest, getApiSession, profilePath, SessionChangedError } from './api-client';
export interface ImportRow { rowNumber: number; status: 'VALID' | 'REJECTED'; tipo: 'RECEITA' | 'DESPESA'; valor: string; dataHora: string; descricao: string; categoria: { categoriaId: string | null; resolved: boolean; input: string }; possibleDuplicate: boolean; errors: string[] }
export interface ImportPreview { summary: { totalRows: number; validRows: number; rejectedRows: number; withoutCategory: number; possibleDuplicates: number }; rows: ImportRow[] }
async function importRequest<T>(path: string, body: unknown): Promise<T> {
  try { return await apiRequest<T>(path, { method: 'POST', body }); }
  catch (error) {
    if (error instanceof ApiError) {
      const messages: Record<number, string> = { 400: 'Confira o formato do CSV e os dados das linhas antes de importar.', 409: 'A importação requer revisão de possíveis duplicatas. Confira a prévia e autorize explicitamente se desejar continuar.', 413: 'O CSV deve ter no máximo 5 MiB.', 415: 'Selecione um arquivo CSV no formato informado.', 502: 'O serviço de importação não confirmou a operação. Consulte suas transações antes de tentar novamente.', 503: 'O serviço de importação está indisponível. Se você estava confirmando, consulte suas transações antes de tentar novamente.' };
      if (messages[error.status]) throw new ApiError(error.status, messages[error.status]);
    }
    throw error;
  }
}
export async function pickImport(): Promise<{ name: string; preview: ImportPreview } | null> {
  const revision = getApiSession().revision;
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (revision !== getApiSession().revision) throw new SessionChangedError();
  if (result.canceled) return null;
  const file = result.assets[0]; const size = file.size ?? (Platform.OS === 'web' ? file.file?.size : new LocalFile(file.uri).size);
  if (size !== undefined && size > 5 * 1024 * 1024) throw new ApiError(413, 'O CSV deve ter no máximo 5 MiB.');
  const data = new FormData();
  if (Platform.OS === 'web') { if (!file.file) throw new ApiError(400, 'Selecione novamente o arquivo.'); data.append('file', file.file, file.name); }
  // O conversor multipart do fetch Expo lê File/bytes, não o objeto legado { uri }.
  else data.append('file', new LocalFile(file.uri), file.name);
  return { name: file.name, preview: await importRequest<ImportPreview>(profilePath('imports/transactions/preview'), data) };
}
export const confirmImport = (preview: ImportPreview, confirmPossibleDuplicates: boolean) => importRequest<{ created: number; transactionIds: string[] }>(profilePath('imports/transactions/confirm'), {
  confirmPossibleDuplicates, rows: preview.rows.filter(r => r.status === 'VALID').map(r => ({ tipo: r.tipo, valor: r.valor, dataHora: r.dataHora, descricao: r.descricao, categoriaId: r.categoria.categoriaId })),
});
