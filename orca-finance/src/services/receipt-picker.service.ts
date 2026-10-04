import * as ImagePicker from 'expo-image-picker';
import { File as LocalFile } from 'expo-file-system';
import { ApiError, getApiSession, SessionChangedError } from '@/services/api-client';
import type { ReceiptFile } from '@/types/receipt';
import { validateReceiptFile } from '@/utils/receipt-file';

export async function pickReceipt(source: 'camera' | 'gallery'): Promise<ReceiptFile | null> {
  const revision = getApiSession().revision;
  const assertSession = () => { if (revision !== getApiSession().revision) throw new SessionChangedError(); };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    assertSession();
    if (!permission.granted) throw new ApiError(403, permission.canAskAgain
      ? 'Permita o acesso à câmera para fotografar o recibo. Você também pode escolher uma imagem da galeria.'
      : 'O acesso à câmera está bloqueado. Ative a permissão nas configurações do dispositivo ou escolha uma imagem da galeria.');
  }
  // O seletor de fotos do sistema concede acesso apenas à imagem escolhida.
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false,
    allowsMultipleSelection: false, quality: 1, base64: false, exif: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  assertSession();
  if (result.canceled) return null;
  const asset = result.assets[0];
  const extension = (asset.fileName ?? asset.uri).split('.').pop()?.toLowerCase().split(/[?#]/)[0];
  const mimeType = asset.mimeType ?? (extension === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(extension ?? '') ? 'image/jpeg' : '');
  let size = asset.fileSize ?? asset.file?.size;
  if (size === undefined) {
    try { size = new LocalFile(asset.uri).size; }
    catch { throw new ApiError(400, 'Não foi possível ler a imagem. Escolha outra ou tire uma nova foto.'); }
  }
  const file: ReceiptFile = { uri: asset.uri, name: mimeType === 'image/png' ? 'comprovante.png' : 'comprovante.jpg',
    mimeType: mimeType as ReceiptFile['mimeType'], size, ...(asset.file && { webFile: asset.file }) };
  validateReceiptFile(file);
  return file;
}
