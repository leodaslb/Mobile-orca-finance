import { Platform } from 'react-native';
import { StorageAccessFramework, EncodingType, deleteAsync } from 'expo-file-system/legacy';
import { getApiSession, SessionChangedError } from '@/services/api-client';
function base64(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const value = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    result += alphabet[(value >> 18) & 63] + alphabet[(value >> 12) & 63] + (i + 1 < bytes.length ? alphabet[(value >> 6) & 63] : '=') + (i + 2 < bytes.length ? alphabet[value & 63] : '=');
  }
  return result;
}
export async function saveExportFile(file: { bytes: Uint8Array; fileName: string; contentType: string }, revision: number) {
  const current = () => { if (revision !== getApiSession().revision) throw new SessionChangedError(); };
  current();
  if (Platform.OS === 'web') {
    const copy = new Uint8Array(file.bytes); const url = URL.createObjectURL(new Blob([copy], { type: file.contentType }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.fileName; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); return true;
  }
  if (Platform.OS !== 'android') throw new Error('Salvar arquivo disponível no Android e na Web.');
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync(); current();
  if (!permission.granted) return false;
  const uri = await StorageAccessFramework.createFileAsync(permission.directoryUri, file.fileName, file.contentType.split(';')[0]);
  try { current(); await StorageAccessFramework.writeAsStringAsync(uri, base64(file.bytes), { encoding: EncodingType.Base64 }); current(); }
  catch (error) { await deleteAsync(uri, { idempotent: true }).catch(() => {}); throw error; }
  return true;
}
