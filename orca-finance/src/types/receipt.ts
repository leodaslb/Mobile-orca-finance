export interface ReceiptFile {
  uri: string;
  name: string;
  mimeType: 'image/jpeg' | 'image/png';
  size: number;
  webFile?: Blob;
}
