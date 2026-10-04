import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';
import type { ReceiptUpload } from './receipt-upload';

export interface StoredReceipt {
  publicId: string;
  secureUrl: string;
}

@Injectable()
export class CloudinaryStorageService {
  private readonly logger = new Logger(CloudinaryStorageService.name);

  private options(): UploadApiOptions {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const api_key = process.env.CLOUDINARY_API_KEY?.trim();
    const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (!cloud_name || !api_key || !api_secret) {
      throw new ServiceUnavailableException('O armazenamento de recibos não está configurado.');
    }
    return { cloud_name, api_key, api_secret, resource_type: 'image', type: 'upload', timeout: 30000 };
  }

  async uploadReceipt(file: ReceiptUpload): Promise<StoredReceipt> {
    const options = { ...this.options(), public_id: `orca-finance/receipts/${randomUUID()}`, overwrite: false };
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const fail = () => reject(new BadGatewayException('Não foi possível enviar o recibo ao armazenamento.'));
      try {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
          if (error || !result) { fail(); return; }
          resolve(result);
        });
        stream.on('error', fail);
        stream.end(file.buffer);
      } catch { fail(); }
    });
    let secure = false;
    try { secure = new URL(result.secure_url).protocol === 'https:'; } catch { /* Resposta inválida do provider. */ }
    if (!secure || !result.public_id) {
      try { await this.removeReceipt(result.public_id || options.public_id); }
      catch { this.logger.warn('Não foi possível compensar um upload com resposta inválida.'); }
      throw new BadGatewayException('O armazenamento não retornou um recibo válido.');
    }
    return { publicId: result.public_id, secureUrl: result.secure_url };
  }

  async removeReceipt(publicId: string): Promise<void> {
    const options = this.options();
    try {
      const result: { result?: string } = await cloudinary.uploader.destroy(publicId, { ...options, invalidate: true });
      if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Falha na remoção.');
    } catch {
      throw new BadGatewayException('Não foi possível remover o recibo do armazenamento.');
    }
  }
}
