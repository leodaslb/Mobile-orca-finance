import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository';

describe('RF21 / US02: tags HTTP → Neon', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const emails = [`tags-a-${suffix}@example.test`, `tags-b-${suffix}@example.test`];
  const profiles: string[] = [];
  const tokens: string[] = [];
  const transactions: string[] = [];
  const tags: string[] = [];
  let otherTag: string;
  const headers = (index = 0) => ({ authorization: `Bearer ${tokens[index]}` });
  const tagUrl = (index = 0) => `/profiles/${profiles[index]}/tags`;
  const transactionUrl = (index = 0) => `/profiles/${profiles[index]}/transactions/${transactions[index]}`;
  const setTags = (tagIds: string[]) => app.inject({
    method: 'PUT', url: `${transactionUrl()}/tags`, headers: headers(), payload: { tagIds },
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useLogger(false);
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
    for (const email of emails) {
      const response = await app.inject({ method: 'POST', url: '/auth/register',
        payload: { nome: 'Conta de teste', email, senha: 'senha de teste' } });
      expect(response.statusCode).toBe(201);
      profiles.push(response.json().profile.id);
      const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, senha: 'senha de teste' } });
      expect(login.statusCode).toBe(201);
      tokens.push(login.json().accessToken);
      const index = profiles.length - 1;
      const created = await app.inject({ method: 'POST', url: `/profiles/${profiles[index]}/transactions`, headers: headers(index),
        payload: { tipo: 'DESPESA', valor: '15.75', dataHora: '2026-10-01T12:00:00Z', descricao: 'Teste de tags',
          status: 'EFETIVADA', ehGastoLivre: true } });
      expect(created.statusCode).toBe(201);
      transactions.push(created.json().id);
    }
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (prisma) {
      const users = await prisma.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
      const ids = users.map((user) => user.id);
      const owned = await prisma.perfilFinanceiro.findMany({ where: { usuarioId: { in: ids } }, select: { id: true } });
      const perfilId = { in: owned.map((profile) => profile.id) };
      await prisma.transacao.deleteMany({ where: { perfilId } });
      await prisma.auditoriaTransacao.deleteMany({ where: { perfilId } });
      await prisma.tag.deleteMany({ where: { perfilId } });
      await prisma.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } });
      await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  it('cria e lista tags, aceita mesmo nome em outro perfil e trata duplicidade com 409', async () => {
    for (const nome of ['#viagem', '#urgente']) {
      const created = await app.inject({ method: 'POST', url: tagUrl(), headers: headers(), payload: { nome } });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ nome, perfilId: profiles[0] });
      tags.push(created.json().id);
    }
    const duplicate = await app.inject({ method: 'POST', url: tagUrl(), headers: headers(), payload: { nome: '#viagem' } });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().message).toBe('Tag já cadastrada neste perfil.');
    const other = await app.inject({ method: 'POST', url: tagUrl(1), headers: headers(1), payload: { nome: '#viagem' } });
    expect(other.statusCode).toBe(201);
    otherTag = other.json().id;
    const list = await app.inject({ method: 'GET', url: tagUrl(), headers: headers() });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((tag: { id: string }) => tag.id).sort()).toEqual([...tags].sort());
    expect(list.json().every((tag: { perfilId: string }) => tag.perfilId === profiles[0])).toBe(true);
  });

  it('recusa nome vazio/branco e payloads inválidos de associação', async () => {
    for (const nome of ['', ' \t\n ']) {
      expect((await app.inject({ method: 'POST', url: tagUrl(), headers: headers(), payload: { nome } })).statusCode).toBe(400);
    }
    for (const payload of [{}, { tagIds: null }, { tagIds: 'uuid' }, { tagIds: ['inválido'] }]) {
      expect((await app.inject({ method: 'PUT', url: `${transactionUrl()}/tags`, headers: headers(), payload })).statusCode).toBe(400);
    }
    expect(await prisma.tag.count({ where: { perfilId: profiles[0] } })).toBe(2);
  });

  it('substitui o conjunto de forma idempotente, retorna tags no detalhe e permite esvaziar', async () => {
    const before = await prisma.transacao.findUniqueOrThrow({ where: { id: transactions[0] } });
    const audits = await prisma.auditoriaTransacao.count({ where: { transacaoId: transactions[0] } });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await setTags([...tags, tags[0]]);
      expect(response.statusCode).toBe(200);
      expect(response.json().tags.map((tag: { id: string }) => tag.id).sort()).toEqual([...tags].sort());
    }
    const detail = await app.inject({ method: 'GET', url: transactionUrl(), headers: headers() });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().tags).toEqual([
      { id: tags[1], nome: '#urgente' }, { id: tags[0], nome: '#viagem' },
    ]);
    expect((await setTags([tags[0]])).json().tags).toEqual([{ id: tags[0], nome: '#viagem' }]);
    expect((await setTags([])).json()).toEqual({ tags: [] });
    expect(await prisma.transacaoTag.count({ where: { transacaoId: transactions[0] } })).toBe(0);
    expect(await prisma.transacao.findUniqueOrThrow({ where: { id: transactions[0] } })).toEqual(before);
    expect(await prisma.auditoriaTransacao.count({ where: { transacaoId: transactions[0] } })).toBe(audits);
  });

  it('recusa tags de outro perfil/inexistentes sem alterar os vínculos atuais', async () => {
    expect((await setTags([tags[0]])).statusCode).toBe(200);
    for (const id of [otherTag, randomUUID()]) {
      expect((await setTags([tags[1], id])).statusCode).toBe(400);
      expect(await prisma.transacaoTag.findMany({ where: { transacaoId: transactions[0] } }))
        .toEqual([{ transacaoId: transactions[0], tagId: tags[0] }]);
    }
  });

  it('exige JWT e bloqueia acesso cruzado a tags e transações', async () => {
    expect((await app.inject({ method: 'GET', url: tagUrl() })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: tagUrl(), payload: { nome: 'Sem token' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PUT', url: `${transactionUrl()}/tags`, payload: { tagIds: tags } })).statusCode).toBe(401);
    for (const method of ['GET', 'POST'] as const) {
      expect((await app.inject({ method, url: tagUrl(1), headers: headers(),
        ...(method === 'POST' && { payload: { nome: 'Invasão' } }) })).statusCode).toBe(403);
    }
    expect((await app.inject({ method: 'GET', url: transactionUrl(1), headers: headers() })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: `${transactionUrl(1)}/tags`, headers: headers(), payload: { tagIds: tags } })).statusCode).toBe(403);
    const wrongProfile = `/profiles/${profiles[0]}/transactions/${transactions[1]}/tags`;
    expect((await app.inject({ method: 'PUT', url: wrongProfile, headers: headers(), payload: { tagIds: tags } })).statusCode).toBe(404);
  });

  it('PUTs simultâneos substituem um conjunto inteiro, sem unir associações parciais', async () => {
    for (let round = 0; round < 3; round++) {
      expect((await setTags([])).statusCode).toBe(200);
      const responses = await Promise.all([setTags([tags[0]]), setTags([tags[1]])]);
      expect(responses.map(response => response.statusCode)).toEqual([200, 200]);
      const links = await prisma.transacaoTag.findMany({ where: { transacaoId: transactions[0] } });
      expect(links).toHaveLength(1);
      expect(tags).toContain(links[0].tagId);
    }
    expect((await setTags([tags[0]])).statusCode).toBe(200);
  });

  it('faz rollback da remoção dos vínculos se a inclusão seguinte falha no banco', async () => {
    const repository = app.get(TransactionsRepository);
    const original = repository.replaceTags.bind(repository);
    const spy = jest.spyOn(repository, 'replaceTags').mockImplementation((perfilId, id, _ids, tx) =>
      original(perfilId, id, [randomUUID()], tx));
    try {
      expect((await setTags([tags[1]])).statusCode).toBe(500);
    } finally { spy.mockRestore(); }
    expect(await prisma.transacaoTag.findMany({ where: { transacaoId: transactions[0] } }))
      .toEqual([{ transacaoId: transactions[0], tagId: tags[0] }]);
  });

  it('preserva snapshots escalares e remove só TransacaoTag por CASCADE na reversão', async () => {
    expect((await setTags(tags)).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: transactionUrl(), headers: headers(), payload: { valor: '20.25' } })).statusCode).toBe(200);
    const before = await prisma.transacao.findUniqueOrThrow({ where: { id: transactions[0] } });
    const response = await app.inject({ method: 'DELETE', url: transactionUrl(), headers: headers() });
    expect(response.statusCode).toBe(204);
    expect(await prisma.transacaoTag.count({ where: { transacaoId: transactions[0] } })).toBe(0);
    expect(await prisma.tag.count({ where: { perfilId: profiles[0], id: { in: tags } } })).toBe(2);
    const audits = await prisma.auditoriaTransacao.findMany({ where: { perfilId: profiles[0] } });
    expect(audits).toHaveLength(3);
    expect(audits.map((audit) => audit.operacao).sort()).toEqual(['CRIACAO', 'EDICAO', 'EXCLUSAO']);
    for (const audit of audits) {
      expect(audit.transacaoId).toBeNull();
      for (const snapshot of [audit.estadoAnterior, audit.estadoNovo]) {
        if (snapshot) expect(Object.keys(snapshot).sort()).toEqual(Object.keys(before).sort());
      }
    }
  });
});
