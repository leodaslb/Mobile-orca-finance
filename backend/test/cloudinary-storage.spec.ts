import { BadGatewayException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Writable } from 'node:stream';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { CloudinaryStorageService } from '../src/modules/transactions/cloudinary-storage.service';
import { PNG_RECEIPT } from './receipt-fixtures';

jest.mock('cloudinary', () => ({ v2: { uploader: { upload_stream: jest.fn(), destroy: jest.fn() } } }));

describe('US19: adapter do SDK oficial Cloudinary', () => {
  const upload = cloudinary.uploader.upload_stream as jest.Mock;
  const destroy = cloudinary.uploader.destroy as jest.Mock;
  const keys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const;
  const previous = keys.map(key => process.env[key]);
  const secret = 'adapter-test-secret';
  const file = { buffer: PNG_RECEIPT, mimeType: 'image/png' };
  let options: UploadApiOptions;
  let bytes: Buffer;
  let result: Partial<UploadApiResponse>;
  let error: UploadApiErrorResponse | undefined;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'; process.env.CLOUDINARY_API_KEY = 'test-key'; process.env.CLOUDINARY_API_SECRET = secret;
    result = { secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/receipt.png' }; error = undefined;
    destroy.mockResolvedValue({ result: 'ok' });
    upload.mockImplementation((input: UploadApiOptions, callback: (error?: UploadApiErrorResponse, result?: UploadApiResponse) => void) => {
      options = input;
      return new Writable({ write(chunk, _encoding, done) { bytes = Buffer.from(chunk); done(); },
        final(done) { callback(error, { public_id: input.public_id, ...result } as UploadApiResponse); done(); } });
    });
  });
  afterEach(() => {
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
    jest.restoreAllMocks();
  });
  const service = new CloudinaryStorageService();
  it('envia bytes com autenticação por chamada, prefixo e UUID independente do nome original', async () => {
    const receipt = await service.uploadReceipt(file);
    expect(bytes).toEqual(PNG_RECEIPT);
    expect(options).toMatchObject({ cloud_name: 'test-cloud', api_key: 'test-key', api_secret: secret, resource_type: 'image', overwrite: false });
    expect(receipt.publicId).toMatch(/^orca-finance\/receipts\/[\da-f-]{36}$/);
    expect(receipt.secureUrl).toBe(result.secure_url);
    const second = await service.uploadReceipt(file); expect(second.publicId).not.toBe(receipt.publicId);
    expect(JSON.stringify(receipt)).not.toContain(secret);
  });
  it.each(keys)('configuração ausente %s falha sem chamar SDK', async key => {
    delete process.env[key];
    await expect(service.uploadReceipt(file)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(upload).not.toHaveBeenCalled();
  });
  it('sanitiza resposta de falha do provider, sem logs ou credenciais', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = { message: secret, name: 'provider', http_code: 401 };
    await expect(service.uploadReceipt(file)).rejects.toEqual(new BadGatewayException('Não foi possível enviar o recibo ao armazenamento.'));
    expect(warn).not.toHaveBeenCalled(); expect(destroy).not.toHaveBeenCalled();
  });
  it('sanitiza erro síncrono do SDK', async () => {
    upload.mockImplementation(() => { throw new Error(secret); });
    await expect(service.uploadReceipt(file)).rejects.toBeInstanceOf(BadGatewayException);
  });
  it('sanitiza erro emitido pelo stream', async () => {
    upload.mockImplementation(() => new Writable({ write(_chunk, _encoding, done) { done(new Error(secret)); } }));
    await expect(service.uploadReceipt(file)).rejects.toBeInstanceOf(BadGatewayException);
  });
  it('resposta sem HTTPS tenta compensação e não retorna URL insegura', async () => {
    result = { secure_url: 'http://res.cloudinary.com/test/receipt.png' };
    await expect(service.uploadReceipt(file)).rejects.toBeInstanceOf(BadGatewayException);
    expect(destroy).toHaveBeenCalledWith(options.public_id, expect.objectContaining({ resource_type: 'image', invalidate: true, api_secret: secret }));
  });
  it('falha de compensação de resposta inválida registra apenas aviso estável', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(); result = { secure_url: '' };
    destroy.mockRejectedValue(new Error(secret));
    await expect(service.uploadReceipt(file)).rejects.toBeInstanceOf(BadGatewayException);
    expect(warn).toHaveBeenCalledTimes(1); expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
  });
  it.each(['ok', 'not found'])('remoção reconhece %s sem expor resposta SDK', async status => {
    destroy.mockResolvedValue({ result: status }); await service.removeReceipt('orca-finance/receipts/test');
  });
  it('erro de remoção do provider é sanitizado', async () => {
    destroy.mockRejectedValue(new Error(secret));
    await expect(service.removeReceipt('orca-finance/receipts/test')).rejects.toEqual(new BadGatewayException('Não foi possível remover o recibo do armazenamento.'));
  });
});
