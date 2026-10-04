import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository';

describe('Auditoria e reversão HTTP → Neon', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let repository: TransactionsRepository;
  const suffix = randomUUID();
  const emails = [`audit-a-${suffix}@example.test`, `audit-b-${suffix}@example.test`];
  const profiles: string[] = [];
  const tokens: string[] = [];
  const payload = {
    tipo: 'DESPESA', valor: '15.75', dataHora: '2026-09-29T15:30:00-03:00',
    descricao: 'Despesa auditada', status: 'EFETIVADA', ehGastoLivre: true,
  };
  const headers = (index = 0) => ({ authorization: `Bearer ${tokens[index]}` });
  const url = (index = 0) => `/profiles/${profiles[index]}/transactions`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useLogger(false);
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    repository = app.get(TransactionsRepository);
    for (const email of emails) {
      const registered = await app.inject({
        method: 'POST', url: '/auth/register', payload: { nome: 'Conta de teste', email, senha: 'senha de teste' },
      });
      expect(registered.statusCode).toBe(201);
      profiles.push(registered.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } });
      expect(login.statusCode).toBe(201);
      tokens.push(login.json().accessToken);
    }
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (prisma) {
      const users = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
      const ids = users.map((user) => user.id);
      const owned = await prisma.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } });
      const perfilId = { in: owned.map((profile) => profile.id) };
      // Apenas os dados identificados pelos e-mails exclusivos desta execução.
      await prisma.transacao.deleteMany({ where: { perfilId } });
      await prisma.auditoriaTransacao.deleteMany({ where: { perfilId } });
      await prisma.tag.deleteMany({ where: { perfilId } });
      await prisma.orcamento.deleteMany({ where: { perfilId } });
      await prisma.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  async function create(index = 0) {
    const response = await app.inject({ method: 'POST', url: url(index), headers: headers(index), payload });
    expect(response.statusCode).toBe(201);
    return response.json().id as string;
  }

  it('CRIACAO guarda todos os campos persistidos com Decimal, ISO e null', async () => {
    const id = await create();
    const stored = await prisma.transacao.findUniqueOrThrow({ where: { id } });
    const audit = await prisma.auditoriaTransacao.findFirstOrThrow({ where: { transacaoId: id, operacao: 'CRIACAO' } });
    expect(audit.perfilId).toBe(profiles[0]);
    expect(audit.estadoAnterior).toBeNull();
    expect(audit.estadoNovo).toEqual(JSON.parse(JSON.stringify(stored)));
    expect(audit.estadoNovo).toMatchObject({ valor: '15.75', dataHora: '2026-09-29T18:30:00.000Z', anotacao: null });
    expect(audit.realizadoEm).toBeInstanceOf(Date);
  });

  it('EDICAO preserva before/after e precisão dos campos persistidos opcionais', async () => {
    const id = await create();
    const before = await prisma.transacao.update({ where: { id }, data: {
      moedaOriginal: 'USD', valorOriginal: '15.75', taxaCambio: '1.12345678', valorConvertido: '17.69',
      latitude: '-23.123456', longitude: '-46.123456', ocorrenciaReferencia: new Date('2026-09-29T18:30:00Z'),
    } });
    const response = await app.inject({ method: 'PATCH', url: `${url()}/${id}`, headers: headers(),
      payload: { valor: '20.25', descricao: 'Despesa revisada', anotacao: 'Contexto' } });
    expect(response.statusCode).toBe(200);
    const after = await prisma.transacao.findUniqueOrThrow({ where: { id } });
    const audit = await prisma.auditoriaTransacao.findFirstOrThrow({ where: { transacaoId: id, operacao: 'EDICAO' } });
    expect(audit.estadoAnterior).toEqual(JSON.parse(JSON.stringify(before)));
    expect(audit.estadoNovo).toEqual(JSON.parse(JSON.stringify(after)));
    expect(audit.estadoAnterior).toMatchObject({ valor: '15.75', taxaCambio: '1.12345678', latitude: '-23.123456' });
    expect(audit.estadoNovo).toMatchObject({ valor: '20.25', descricao: 'Despesa revisada', anotacao: 'Contexto' });
  });

  it('DELETE exige JWT e ownership e não registra auditoria para acesso negado', async () => {
    const id = await create(1);
    const audits = await prisma.auditoriaTransacao.count({ where: { transacaoId: id } });
    expect((await app.inject({ method: 'DELETE', url: `${url(1)}/${id}` })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: `${url(1)}/${id}`, headers: headers() })).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: `${url()}/${id}`, headers: headers() })).statusCode).toBe(404);
    expect(await prisma.transacao.findUnique({ where: { id } })).not.toBeNull();
    expect(await prisma.auditoriaTransacao.count({ where: { transacaoId: id } })).toBe(audits);
  });

  it('reverte fisicamente, preserva auditorias via SET NULL e executa os cinco CASCADE', async () => {
    const id = await create();
    const changed = await app.inject({ method: 'PATCH', url: `${url()}/${id}`, headers: headers(), payload: { valor: '20.25' } });
    expect(changed.statusCode).toBe(200);
    const before = await prisma.transacao.findUniqueOrThrow({ where: { id } });
    const tag = await prisma.tag.create({ data: { perfilId: profiles[0], nome: 'Tag de teste' } });
    const budget = await prisma.orcamento.create({ data: {
      perfilId: profiles[0], tipo: 'MENSAL', dataInicio: new Date('2026-09-01'), dataFim: new Date('2026-09-30'),
    } });
    await prisma.transacaoTag.create({ data: { transacaoId: id, tagId: tag.id } });
    await prisma.anexoTransacao.create({ data: { transacaoId: id, tipo: 'RECIBO', arquivoUrl: 'https://example.test/recibo' } });
    await prisma.participacaoTransacao.create({ data: { transacaoId: id, nomeParticipante: 'Participante de teste', valor: '1.00' } });
    await prisma.lembreteVencimento.create({ data: { perfilId: profiles[0], transacaoId: id, notificarEm: new Date('2026-10-01T12:00:00Z') } });
    await prisma.transacaoOrcamento.create({ data: { transacaoId: id, orcamentoId: budget.id } });
    const previous = await prisma.auditoriaTransacao.findMany({ where: { transacaoId: id } });

    const response = await app.inject({ method: 'DELETE', url: `${url()}/${id}`, headers: headers() });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(await prisma.transacao.findUnique({ where: { id } })).toBeNull();
    const exclusion = await prisma.auditoriaTransacao.findFirstOrThrow({ where: {
      perfilId: profiles[0], operacao: 'EXCLUSAO', estadoAnterior: { path: ['id'], equals: id },
    } });
    expect(exclusion.transacaoId).toBeNull();
    expect(exclusion.estadoAnterior).toEqual(JSON.parse(JSON.stringify(before)));
    expect(exclusion.estadoNovo).toBeNull();
    const preserved = await prisma.auditoriaTransacao.findMany({ where: { id: { in: previous.map((audit) => audit.id) } } });
    expect(preserved).toHaveLength(2);
    expect(preserved.every((audit) => audit.transacaoId === null)).toBe(true);
    expect(await prisma.transacaoTag.count({ where: { transacaoId: id } })).toBe(0);
    expect(await prisma.anexoTransacao.count({ where: { transacaoId: id } })).toBe(0);
    expect(await prisma.participacaoTransacao.count({ where: { transacaoId: id } })).toBe(0);
    expect(await prisma.lembreteVencimento.count({ where: { transacaoId: id } })).toBe(0);
    expect(await prisma.transacaoOrcamento.count({ where: { transacaoId: id } })).toBe(0);
    expect(await prisma.tag.findUnique({ where: { id: tag.id } })).not.toBeNull();
    expect(await prisma.orcamento.findUnique({ where: { id: budget.id } })).not.toBeNull();
    expect((await app.inject({ method: 'GET', url: `${url()}/${id}`, headers: headers() })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `${url()}/${id}`, headers: headers() })).statusCode).toBe(404);
  });

  it.each(['POST', 'PATCH', 'DELETE'] as const)('%s faz rollback quando a auditoria viola uma FK real', async (method) => {
    const id = method === 'POST' ? null : await create();
    const before = id ? await prisma.transacao.findUniqueOrThrow({ where: { id } }) : null;
    const count = await prisma.transacao.count({ where: { perfilId: profiles[0] } });
    const audits = await prisma.auditoriaTransacao.count({ where: { perfilId: profiles[0] } });
    const spy = jest.spyOn(repository, 'createAudit').mockImplementation((data, tx) =>
      tx.auditoriaTransacao.create({ data: { ...data, perfilId: randomUUID() } }));
    try {
      const response = await app.inject({ method, url: id ? `${url()}/${id}` : url(), headers: headers(),
        ...(method !== 'DELETE' && { payload: method === 'POST' ? payload : { valor: '99.99' } }),
      });
      expect(response.statusCode).toBe(500);
      expect(response.json().message).toBe('Internal server error');
    } finally {
      spy.mockRestore();
    }
    expect(await prisma.transacao.count({ where: { perfilId: profiles[0] } })).toBe(count);
    expect(await prisma.auditoriaTransacao.count({ where: { perfilId: profiles[0] } })).toBe(audits);
    if (id) expect(await prisma.transacao.findUniqueOrThrow({ where: { id } })).toEqual(before);
  });

  it('falha no DELETE desfaz também a auditoria gravada antes dele', async () => {
    const id = await create();
    const audits = await prisma.auditoriaTransacao.count({ where: { transacaoId: id } });
    const spy = jest.spyOn(repository, 'deleteByProfileAndId').mockImplementation(async (_profileId, _id, tx) => {
      await tx.transacao.delete({ where: { id: randomUUID() } });
      return { count: 1 };
    });
    try {
      expect((await app.inject({ method: 'DELETE', url: `${url()}/${id}`, headers: headers() })).statusCode).toBe(500);
    } finally {
      spy.mockRestore();
    }
    expect(await prisma.transacao.findUnique({ where: { id } })).not.toBeNull();
    expect(await prisma.auditoriaTransacao.count({ where: { transacaoId: id } })).toBe(audits);
    expect(await prisma.auditoriaTransacao.count({ where: {
      perfilId: profiles[0], operacao: 'EXCLUSAO', estadoAnterior: { path: ['id'], equals: id },
    } })).toBe(0);
  });
});
