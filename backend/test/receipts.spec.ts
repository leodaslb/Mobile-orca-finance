import { BadGatewayException, BadRequestException, ForbiddenException, InternalServerErrorException, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ReceiptsService } from '../src/modules/transactions/receipts.service';
import { CloudinaryStorageService } from '../src/modules/transactions/cloudinary-storage.service';
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { RECEIPT_MAX_BYTES, validateReceiptUpload } from '../src/modules/transactions/receipt-upload';
import { JPEG_RECEIPT, PNG_RECEIPT } from './receipt-fixtures';

describe('RF12 → US19: upload e consistência de recibos', () => {
  const secret = 'simulated-provider-secret';
  const metadata = { id: 'receipt', tipo: 'RECIBO', arquivoUrl: 'https://res.cloudinary.com/test/image/upload/receipt.png', mimeType: 'image/png' };
  const tx = {};
  const repository = {
    findByProfileAndId: jest.fn(), createReceipt: jest.fn(), findReceipts: jest.fn(), lock: jest.fn(),
    transaction: jest.fn((operation: (client: unknown) => Promise<unknown>) => operation(tx)),
  };
  const profiles = { assertOwnership: jest.fn() };
  const storage = { uploadReceipt: jest.fn(), removeReceipt: jest.fn() };
  const readFile = jest.fn();
  const service = new ReceiptsService(repository as unknown as TransactionsRepository, profiles as unknown as ProfilesService,
    storage as unknown as CloudinaryStorageService);
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findByProfileAndId.mockResolvedValue({ tipo: 'DESPESA' });
    repository.createReceipt.mockResolvedValue(metadata);
    storage.uploadReceipt.mockResolvedValue({ publicId: 'orca-finance/receipts/uuid', secureUrl: metadata.arquivoUrl });
    storage.removeReceipt.mockResolvedValue(undefined);
    profiles.assertOwnership.mockResolvedValue(undefined);
    readFile.mockResolvedValue({ buffer: PNG_RECEIPT, mimeType: 'image/png' });
  });
  afterEach(() => jest.restoreAllMocks());
  const create = () => service.create('user', 'profile', 'transaction', readFile);

  it.each([[JPEG_RECEIPT, 'image/jpeg'], [PNG_RECEIPT, 'image/png']])('aceita bytes reais de JPEG/PNG e persiste só metadados (%s)', async (buffer, mimeType) => {
    readFile.mockResolvedValue({ buffer, mimeType });
    await expect(create()).resolves.toEqual(metadata);
    expect(profiles.assertOwnership).toHaveBeenCalledWith('user', 'profile');
    expect(storage.uploadReceipt).toHaveBeenCalledWith({ buffer, mimeType });
    expect(repository.createReceipt).toHaveBeenCalledWith('profile', 'transaction', metadata.arquivoUrl, mimeType, tx);
    expect(storage.uploadReceipt.mock.invocationCallOrder[0]).toBeLessThan(repository.transaction.mock.invocationCallOrder[0]);
    expect(storage.removeReceipt).not.toHaveBeenCalled();
  });
  it.each(['application/pdf', 'image/svg+xml', 'image/webp', 'text/plain'])('rejeita MIME %s antes do provider', async mimeType => {
    readFile.mockResolvedValue({ buffer: PNG_RECEIPT, mimeType });
    await expect(create()).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.uploadReceipt).not.toHaveBeenCalled();
  });
  it('recusa arquivo vazio ou assinatura incompatível, sem confiar no MIME', () => {
    for (const buffer of [Buffer.alloc(0), Buffer.from('texto'), JPEG_RECEIPT]) {
      expect(() => validateReceiptUpload({ buffer, mimeType: 'image/png' })).toThrow(BadRequestException);
    }
  });
  it('aceita limite exato e rejeita um byte acima', async () => {
    const buffer = Buffer.alloc(RECEIPT_MAX_BYTES); PNG_RECEIPT.copy(buffer);
    expect(() => validateReceiptUpload({ buffer, mimeType: 'image/png' })).not.toThrow();
    readFile.mockResolvedValue({ buffer: Buffer.concat([buffer, Buffer.from([0])]), mimeType: 'image/png' });
    await expect(create()).rejects.toBeInstanceOf(PayloadTooLargeException);
    expect(storage.uploadReceipt).not.toHaveBeenCalled();
  });
  it('não lê nem envia arquivo de outro usuário', async () => {
    profiles.assertOwnership.mockRejectedValue(new ForbiddenException());
    await expect(create()).rejects.toBeInstanceOf(ForbiddenException);
    expect(readFile).not.toHaveBeenCalled(); expect(storage.uploadReceipt).not.toHaveBeenCalled();
  });
  it.each([['RECEITA', BadRequestException], [null, NotFoundException]])('recusa receita ou transação ausente antes da leitura (%s)', async (tipo, error) => {
    repository.findByProfileAndId.mockResolvedValue(tipo ? { tipo } : null);
    await expect(create()).rejects.toBeInstanceOf(error);
    expect(readFile).not.toHaveBeenCalled(); expect(storage.uploadReceipt).not.toHaveBeenCalled();
  });
  it('falha do provider não persiste recibo nem expõe segredo', async () => {
    storage.uploadReceipt.mockRejectedValue(new Error(secret));
    await expect(create()).rejects.toEqual(new BadGatewayException('Não foi possível enviar o recibo ao armazenamento.'));
    expect(repository.createReceipt).not.toHaveBeenCalled(); expect(storage.removeReceipt).not.toHaveBeenCalled();
  });
  it('falha no Neon tenta remover somente o arquivo recém-criado e sanitiza o erro', async () => {
    repository.createReceipt.mockRejectedValue(new Error(secret));
    await expect(create()).rejects.toEqual(new InternalServerErrorException('Não foi possível salvar os metadados do recibo.'));
    expect(storage.removeReceipt).toHaveBeenCalledWith('orca-finance/receipts/uuid');
  });
  it('falha de compensação registra aviso sem resposta/stack/credencial do provider', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    repository.createReceipt.mockRejectedValue(new Error(secret)); storage.removeReceipt.mockRejectedValue(new Error(secret));
    await expect(create()).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(warn).toHaveBeenCalledTimes(1); expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
  });
  it('revalida transação após upload; reversão concorrente compensa o arquivo', async () => {
    repository.findByProfileAndId.mockResolvedValueOnce({ tipo: 'DESPESA' }).mockResolvedValueOnce(null);
    await expect(create()).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.removeReceipt).toHaveBeenCalledWith('orca-finance/receipts/uuid');
    expect(repository.createReceipt).not.toHaveBeenCalled();
  });
  it('listagem mantém ownership e consulta somente os metadados do recurso', async () => {
    repository.findReceipts.mockResolvedValue([metadata]);
    await expect(service.list('user', 'profile', 'transaction')).resolves.toEqual([metadata]);
    expect(repository.findReceipts).toHaveBeenCalledWith('profile', 'transaction');
    expect(storage.uploadReceipt).not.toHaveBeenCalled();
  });
});
