import { BadGatewayException, BadRequestException, HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ProfilesService } from '../profiles/profiles.service';
import { TransactionsRepository } from './transactions.repository';
import { CloudinaryStorageService, StoredReceipt } from './cloudinary-storage.service';
import { ReceiptUpload, validateReceiptUpload } from './receipt-upload';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  constructor(private readonly transactions: TransactionsRepository, private readonly profiles: ProfilesService,
    private readonly storage: CloudinaryStorageService) {}

  private async assertExpense(profile: string, id: string) {
    const item = await this.transactions.findByProfileAndId(profile, id);
    if (!item) throw new NotFoundException('Transação não encontrada.');
    if (item.tipo !== 'DESPESA') throw new BadRequestException('Recibo exige transação DESPESA.');
  }

  async create(user: string, profile: string, id: string, readFile: () => Promise<ReceiptUpload>) {
    await this.profiles.assertOwnership(user, profile);
    await this.assertExpense(profile, id);
    // A leitura é adiada para autorizar o recurso antes de consumir o arquivo.
    const file = await readFile();
    validateReceiptUpload(file);
    let stored: StoredReceipt;
    try { stored = await this.storage.uploadReceipt(file); }
    catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException('Não foi possível enviar o recibo ao armazenamento.');
    }
    try {
      // O upload externo não mantém uma transação/lock Postgres aberto.
      return await this.transactions.transaction(async (tx) => {
        await this.transactions.lock(profile, id, tx);
        const item = await this.transactions.findByProfileAndId(profile, id, tx);
        if (!item) throw new NotFoundException('Transação não encontrada.');
        if (item.tipo !== 'DESPESA') throw new BadRequestException('Recibo exige transação DESPESA.');
        return this.transactions.createReceipt(profile, id, stored.secureUrl, file.mimeType, tx);
      });
    } catch (error) {
      try { await this.storage.removeReceipt(stored.publicId); }
      catch { this.logger.warn('Falha na compensação do recibo após erro de persistência.'); }
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Não foi possível salvar os metadados do recibo.');
    }
  }
  async list(user: string, profile: string, id: string) {
    await this.profiles.assertOwnership(user, profile);
    await this.assertExpense(profile, id);
    return this.transactions.findReceipts(profile, id);
  }
}
