import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { CloudinaryStorageService } from '../src/modules/transactions/cloudinary-storage.service';
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository';
import { RECEIPT_MAX_BYTES } from '../src/modules/transactions/receipt-upload';
import { JPEG_RECEIPT, PNG_RECEIPT, receiptMultipart } from './receipt-fixtures';

describe('RF12 → US19: multipart HTTP → adapter Cloudinary → Neon', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const emails = [0, 1].map(() => `receipt-upload-${randomUUID()}@example.test`);
  const profiles: string[] = []; const tokens: string[] = []; const expenses: string[] = [];
  let income: string;
  const storage = { uploadReceipt: jest.fn(), removeReceipt: jest.fn() };
  const fakeSecret = 'e2e-provider-secret';
  const secureUrl = 'https://res.cloudinary.com/test/image/upload/orca-finance/receipts/test.png';
  const url = (transaction = expenses[0], profile = profiles[0]) => `/profiles/${profile}/transactions/${transaction}/receipts`;
  const auth = (index = 0) => ({ authorization: `Bearer ${tokens[index]}` });
  const upload = (body = receiptMultipart(), transaction = expenses[0], profile = profiles[0], index = 0) => app.inject({
    method: 'POST', url: url(transaction, profile), headers: { ...auth(index), ...body.headers }, payload: body.payload,
  });
  const count = () => prisma.anexoTransacao.count({ where: { transacao: { perfilId: profiles[0] } } });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CloudinaryStorageService).useValue(storage).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter()); app.useLogger(false); configureApp(app);
    await app.init(); await app.getHttpAdapter().getInstance().ready(); prisma = app.get(PrismaService);
    const category = (await prisma.categoria.findFirstOrThrow({ where: { ativa: true }, select: { id: true } })).id;
    for (const email of emails) {
      const registered = await app.inject({ method: 'POST', url: '/auth/register', payload: { nome: 'US19 upload test', email, senha: 'test-only-password' } });
      expect(registered.statusCode).toBe(201); profiles.push(registered.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'test-only-password' } });
      expect(login.statusCode).toBe(201); tokens.push(login.json().accessToken);
      const created = await app.inject({ method: 'POST', url: `/profiles/${profiles.at(-1)}/transactions`, headers: auth(profiles.length - 1),
        payload: { tipo: 'DESPESA', valor: '12.34', descricao: 'US19 receipt fixture', status: 'EFETIVADA', dataHora: '2026-10-03T12:30:00Z', categoriaId: category } });
      expect(created.statusCode).toBe(201); expenses.push(created.json().id);
    }
    const created = await app.inject({ method: 'POST', url: `/profiles/${profiles[0]}/transactions`, headers: auth(),
      payload: { tipo: 'RECEITA', valor: '100', descricao: 'US19 income', status: 'EFETIVADA', dataHora: '2026-10-03T12:30:00Z', categoriaId: category } });
    expect(created.statusCode).toBe(201); income = created.json().id;
  }, 90000);
  beforeEach(() => { jest.clearAllMocks(); storage.uploadReceipt.mockResolvedValue({ publicId: 'orca-finance/receipts/test', secureUrl }); storage.removeReceipt.mockResolvedValue(undefined); });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    try {
      if (prisma) {
        const users = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
        const ids = users.map(user => user.id);
        const owned = await prisma.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } });
        const perfilId = { in: owned.map(profile => profile.id) };
        await prisma.$transaction(async tx => {
          await tx.transacao.deleteMany({ where: { perfilId } }); await tx.auditoriaTransacao.deleteMany({ where: { perfilId } });
          await tx.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } }); await tx.usuario.deleteMany({ where: { id: { in: ids } } });
        });
        expect(await prisma.usuario.count({ where: { email: { in: emails } } })).toBe(0);
        expect(await prisma.anexoTransacao.count({ where: { transacaoId: { in: expenses } } })).toBe(0);
      }
    } finally { await app?.close(); }
  });

  it.each([{ buffer: JPEG_RECEIPT, mimeType: 'image/jpeg' }, { buffer: PNG_RECEIPT, mimeType: 'image/png' }])('upload $mimeType salva URL segura e retorna metadados', async file => {
    const response = await upload(receiptMultipart([file])); expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ transacaoId: expenses[0], tipo: 'RECIBO', arquivoUrl: secureUrl, mimeType: file.mimeType });
    expect(storage.uploadReceipt).toHaveBeenCalledWith(file);
    expect(await prisma.anexoTransacao.findUnique({ where: { id: response.json().id } })).toMatchObject({ arquivoUrl: secureUrl, mimeType: file.mimeType });
    for (const key of ['buffer', 'publicId', 'api_secret', 'api_key']) expect(response.json()).not.toHaveProperty(key);
  });
  it.each([{ buffer: PNG_RECEIPT, mimeType: 'application/pdf' }, { buffer: JPEG_RECEIPT, mimeType: 'image/png' }, { buffer: Buffer.alloc(0), mimeType: 'image/jpeg' }])('rejeita MIME/conteúdo inválidos sem enviar ou persistir ($mimeType)', async file => {
    const before = await count(); expect((await upload(receiptMultipart([file]))).statusCode).toBe(400);
    expect(storage.uploadReceipt).not.toHaveBeenCalled(); expect(await count()).toBe(before);
  });
  it('limite multipart rejeita 5 MiB + 1 byte com 413', async () => {
    const buffer = Buffer.alloc(RECEIPT_MAX_BYTES + 1); PNG_RECEIPT.copy(buffer);
    const before = await count(); const response = await upload(receiptMultipart([{ buffer, mimeType: 'image/png' }]));
    expect(response.statusCode).toBe(413); expect(response.json().message).toContain('5 MiB');
    expect(storage.uploadReceipt).not.toHaveBeenCalled(); expect(await count()).toBe(before);
  });
  it.each([receiptMultipart([]), receiptMultipart([{ buffer: PNG_RECEIPT, mimeType: 'image/png', field: 'photo' }]),
    receiptMultipart(undefined, [{ name: 'arquivoUrl', value: 'https://example.test/forged.png' }]),
    receiptMultipart([{ buffer: PNG_RECEIPT, mimeType: 'image/png' }, { buffer: PNG_RECEIPT, mimeType: 'image/png' }])])('rejeita arquivo ausente/campo errado/campos extras/múltiplos arquivos', async body => {
    expect((await upload(body)).statusCode).toBe(400); expect(storage.uploadReceipt).not.toHaveBeenCalled();
  });
  it('JSON de metadados não substitui arquivo físico', async () => {
    const response = await app.inject({ method: 'POST', url: url(), headers: auth(), payload: { arquivoUrl: 'https://example.test/image.png' } });
    expect(response.statusCode).toBe(415); expect(storage.uploadReceipt).not.toHaveBeenCalled();
  });
  it('JWT, perfil e transação são autorizados antes do upload; receita não aceita recibo', async () => {
    const multipart = receiptMultipart();
    expect((await app.inject({ method: 'POST', url: url(), ...multipart })).statusCode).toBe(401);
    expect((await upload(multipart, expenses[0], profiles[0], 1)).statusCode).toBe(403);
    expect((await upload(multipart, expenses[1])).statusCode).toBe(404);
    expect((await upload(multipart, randomUUID())).statusCode).toBe(404);
    expect((await upload(multipart, income)).statusCode).toBe(400);
    expect(storage.uploadReceipt).not.toHaveBeenCalled();
  });
  it('falha Cloudinary não cria AnexoTransacao nem expõe credenciais/logs', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(); const before = await count();
    storage.uploadReceipt.mockRejectedValue(new Error(fakeSecret));
    const response = await upload(); expect(response.statusCode).toBe(502); expect(response.body).not.toContain(fakeSecret);
    expect(JSON.stringify(log.mock.calls)).not.toContain(fakeSecret); expect(await count()).toBe(before);
  });
  it('falha na persistência desfaz o upload e não expõe erro Prisma', async () => {
    const before = await count(); const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(app.get(TransactionsRepository), 'createReceipt').mockRejectedValue(new Error(fakeSecret));
    const response = await upload(); expect(response.statusCode).toBe(500); expect(response.body).not.toContain(fakeSecret);
    expect(JSON.stringify(log.mock.calls)).not.toContain(fakeSecret); expect(await count()).toBe(before);
    expect(storage.removeReceipt).toHaveBeenCalledWith('orca-finance/receipts/test');
  });
  it('falha na compensação mantém resposta sanitizada e aviso operacional sem segredo', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(); const before = await count();
    jest.spyOn(app.get(TransactionsRepository), 'createReceipt').mockRejectedValue(new Error(fakeSecret));
    storage.removeReceipt.mockRejectedValue(new Error(fakeSecret));
    const response = await upload(); expect(response.statusCode).toBe(500); expect(response.body).not.toContain(fakeSecret);
    expect(warn).toHaveBeenCalledTimes(1); expect(JSON.stringify(warn.mock.calls)).not.toContain(fakeSecret); expect(await count()).toBe(before);
  });
  it('listagem/detalhe mantêm recibos; reversão CASCADE não altera snapshots nem tenta limpeza física', async () => {
    const list = await app.inject({ method: 'GET', url: url(), headers: auth() }); expect(list.statusCode).toBe(200); expect(list.json()).toHaveLength(2);
    const detail = await app.inject({ method: 'GET', url: url().replace('/receipts', ''), headers: auth() });
    expect(detail.statusCode).toBe(200); expect(detail.json().recibos).toEqual(list.json());
    const response = await app.inject({ method: 'DELETE', url: url().replace('/receipts', ''), headers: auth() }); expect(response.statusCode).toBe(204);
    expect(await prisma.anexoTransacao.count({ where: { transacaoId: expenses[0] } })).toBe(0);
    const audits = await prisma.auditoriaTransacao.findMany({ where: { perfilId: profiles[0] } });
    for (const audit of audits) for (const state of [audit.estadoAnterior, audit.estadoNovo]) if (state && typeof state === 'object') {
      for (const key of ['recibos', 'anexos', 'tags', 'buffer']) expect(state).not.toHaveProperty(key);
    }
    expect(storage.removeReceipt).not.toHaveBeenCalled();
  });
});
