import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';

describe('Fundação funcional HTTP → PostgreSQL', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const emailA = `foundation-a-${suffix}@example.test`;
  const emailB = `foundation-b-${suffix}@example.test`;
  const senha = 'senha de teste';
  let userAId: string;
  let userBId: string;
  let profileAId: string;
  let profileBId: string;
  let tokenA: string;
  let tokenB: string;
  let categoryId: string;

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.usuario.findMany({
        where: { email: { in: [emailA, emailB] } }, select: { id: true },
      });
      const ids = users.map((user) => user.id);
      if (ids.length) {
        const profiles = await prisma.perfilFinanceiro.findMany({
          where: { usuarioId: { in: ids } }, select: { id: true },
        });
        const profileIds = profiles.map((profile) => profile.id);
        await prisma.transacao.deleteMany({ where: { perfilId: { in: profileIds } } });
        await prisma.subcategoria.deleteMany({ where: { perfilId: { in: profileIds } } });
        await prisma.perfilFinanceiro.deleteMany({ where: { usuarioId: { in: ids } } });
        await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
      }
    }
    await app?.close();
  });

  it('cadastra dois usuários com primeiro perfil BRL e senha protegida', async () => {
    for (const [nome, email] of [['Conta A', emailA], ['Conta B', emailB]]) {
      const response = await app.inject({
        method: 'POST', url: '/auth/register', payload: { nome, email, senha },
      });
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user.email).toBe(email);
      expect(body.user).not.toHaveProperty('senhaHash');
      expect(body.profile.nome).toBe(nome);
      expect(body.profile.moedaBase).toBe('BRL');
      expect(body.profile).not.toHaveProperty('saldo');
      if (email === emailA) { userAId = body.user.id; profileAId = body.profile.id; }
      else { userBId = body.user.id; profileBId = body.profile.id; }
    }
    const stored = await prisma.usuario.findUniqueOrThrow({ where: { id: userAId } });
    expect(stored.senhaHash).not.toBe(senha);
    expect(await bcrypt.compare(senha, stored.senhaHash)).toBe(true);
    expect(await prisma.perfilFinanceiro.count({ where: { usuarioId: userAId } })).toBe(1);
  });

  it('recusa e-mail duplicado sem criar usuário ou perfil parcial', async () => {
    const response = await app.inject({
      method: 'POST', url: '/auth/register',
      payload: { nome: 'Duplicada', email: emailA, senha },
    });
    expect(response.statusCode).toBe(409);
    expect(await prisma.usuario.count({ where: { email: emailA } })).toBe(1);
    expect(await prisma.perfilFinanceiro.count({ where: { usuarioId: userAId } })).toBe(1);
  });

  it('autentica, protege rotas e não expõe senhaHash', async () => {
    const invalid = await app.inject({
      method: 'POST', url: '/auth/login', payload: { email: emailA, senha: 'errada' },
    });
    const unknown = await app.inject({
      method: 'POST', url: '/auth/login', payload: { email: 'ninguem@example.test', senha },
    });
    expect(invalid.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(invalid.json().message).toBe(unknown.json().message);
    for (const [email, assign] of [[emailA, 'a'], [emailB, 'b']]) {
      const response = await app.inject({
        method: 'POST', url: '/auth/login', payload: { email, senha },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json().accessToken).toEqual(expect.any(String));
      if (assign === 'a') tokenA = response.json().accessToken;
      else tokenB = response.json().accessToken;
    }
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/profiles', headers: auth('invalid') })).statusCode).toBe(401);
    const me = await app.inject({ method: 'GET', url: '/me', headers: auth(tokenA) });
    expect(me.statusCode).toBe(200);
    expect(me.json().id).toBe(userAId);
    expect(me.json()).not.toHaveProperty('senhaHash');
  });

  it('isola perfis e cria perfil adicional sem saldo persistido', async () => {
    const list = await app.inject({ method: 'GET', url: '/profiles', headers: auth(tokenA) });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((item: { id: string }) => item.id)).toEqual([profileAId]);
    const created = await app.inject({
      method: 'POST', url: '/profiles', headers: auth(tokenA), payload: { nome: 'Reserva' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().moedaBase).toBe('BRL');
    expect(created.json()).not.toHaveProperty('saldo');
    expect(await prisma.transacao.count({ where: { perfilId: created.json().id } })).toBe(0);
    expect((await app.inject({ method: 'GET', url: `/profiles/${profileBId}`, headers: auth(tokenA) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/profiles/${profileBId}`, headers: auth(tokenA), payload: { nome: 'Invasão' } })).statusCode).toBe(403);
    const renamed = await app.inject({
      method: 'PATCH', url: `/profiles/${profileAId}`, headers: auth(tokenA), payload: { nome: 'Renomeado' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().nome).toBe('Renomeado');
    expect((await prisma.perfilFinanceiro.findUniqueOrThrow({ where: { id: profileBId } })).usuarioId).toBe(userBId);
  });

  it('lê catálogo global e isola, duplica por escopo e desativa subcategorias', async () => {
    const catalog = await app.inject({ method: 'GET', url: '/categories', headers: auth(tokenA) });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json()).toHaveLength(7);
    expect((await app.inject({ method: 'POST', url: '/categories', headers: auth(tokenA), payload: { nome: 'Não autorizada' } })).statusCode).toBe(404);
    categoryId = catalog.json()[0].id;
    expect((await app.inject({ method: 'POST', url: `/profiles/${profileAId}/subcategories`, headers: auth(tokenA), payload: { categoriaId: randomUUID(), nome: 'Inexistente' } })).statusCode).toBe(404);
    const payload = { categoriaId: categoryId, nome: 'Teste de subcategoria' };
    const created = await app.inject({
      method: 'POST', url: `/profiles/${profileAId}/subcategories`, headers: auth(tokenA), payload,
    });
    expect(created.statusCode).toBe(201);
    const subcategoryId = created.json().id;
    expect(created.json().perfilId).toBe(profileAId);
    expect((await app.inject({ method: 'POST', url: `/profiles/${profileAId}/subcategories`, headers: auth(tokenA), payload })).statusCode).toBe(409);
    const other = await app.inject({
      method: 'POST', url: `/profiles/${profileBId}/subcategories`, headers: auth(tokenB), payload,
    });
    expect(other.statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: `/profiles/${profileBId}/subcategories`, headers: auth(tokenA) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/profiles/${profileBId}/subcategories/${other.json().id}`, headers: auth(tokenA), payload: { ativa: false } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `/profiles/${profileAId}/subcategories/${other.json().id}`, headers: auth(tokenA), payload: { ativa: false } })).statusCode).toBe(404);
    const disabled = await app.inject({
      method: 'PATCH', url: `/profiles/${profileAId}/subcategories/${subcategoryId}`,
      headers: auth(tokenA), payload: { ativa: false },
    });
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json().ativa).toBe(false);
    expect((await prisma.subcategoria.findUniqueOrThrow({ where: { id: subcategoryId } })).ativa).toBe(false);
    expect((await app.inject({ method: 'PATCH', url: `/profiles/${profileAId}/subcategories/${subcategoryId}`, headers: auth(tokenA), payload: { categoriaId: categoryId } })).statusCode).toBe(400);
  });

  it('cria e filtra transações manuais com valores decimais e contexto de perfil', async () => {
    const catalog = (await app.inject({ method: 'GET', url: '/categories', headers: auth(tokenA) })).json();
    const otherCategoryId = catalog[1].id as string;
    const subA = await app.inject({
      method: 'POST', url: `/profiles/${profileAId}/subcategories`, headers: auth(tokenA),
      payload: { categoriaId: categoryId, nome: 'Transação A' },
    });
    const subB = await app.inject({
      method: 'POST', url: `/profiles/${profileBId}/subcategories`, headers: auth(tokenB),
      payload: { categoriaId: categoryId, nome: 'Transação B' },
    });
    expect(subA.statusCode).toBe(201);
    expect(subB.statusCode).toBe(201);
    const base = {
      tipo: 'DESPESA', valor: '15.75', dataHora: '2026-09-29T15:30:00-03:00',
      descricao: 'Café e almoço', categoriaId: categoryId, status: 'EFETIVADA', metodoPagamento: 'PIX',
      subcategoriaId: subA.json().id, anotacao: 'Contexto adicional',
    };
    const urlA = `/profiles/${profileAId}/transactions`;
    const urlB = `/profiles/${profileBId}/transactions`;
    expect((await app.inject({ method: 'POST', url: urlA, payload: base })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: urlB, headers: auth(tokenA), payload: base })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: urlA, headers: auth(tokenA), payload: { ...base, categoriaId: null, subcategoriaId: null } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: urlA, headers: auth(tokenA), payload: { ...base, valor: '0' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: urlA, headers: auth(tokenA), payload: { ...base, valor: '1.234' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: urlA, headers: auth(tokenA), payload: { ...base, descricao: '' } })).statusCode).toBe(400);
    const withoutStatus: Partial<typeof base> = { ...base };
    delete withoutStatus.status;
    expect((await app.inject({ method: 'POST', url: urlA, headers: auth(tokenA), payload: withoutStatus })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: urlA, headers: auth(tokenA), payload: { ...base, subcategoriaId: subB.json().id } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: urlA, headers: auth(tokenA), payload: { ...base, categoriaId: otherCategoryId } })).statusCode).toBe(400);

    const createdA = await app.inject({ method: 'POST', url: urlA, headers: auth(tokenA), payload: base });
    expect(createdA.statusCode).toBe(201);
    expect(createdA.json()).toMatchObject({ valor: '15.75', perfilId: profileAId, anotacao: 'Contexto adicional', essencialidade: 'NAO_CLASSIFICADA', ehGastoLivre: false });
    const idA = createdA.json().id as string;
    const createdB = await app.inject({
      method: 'POST', url: urlB, headers: auth(tokenB),
      payload: { ...base, descricao: 'Despesa B', subcategoriaId: subB.json().id },
    });
    expect(createdB.statusCode).toBe(201);
    const idB = createdB.json().id as string;
    const incomeB = await app.inject({
      method: 'POST', url: urlB, headers: auth(tokenB),
      payload: { ...base, tipo: 'RECEITA', valor: '100.00', descricao: 'Receita B',
        status: 'PREVISTA', subcategoriaId: subB.json().id },
    });
    expect(incomeB.statusCode).toBe(201);
    expect(incomeB.json().tipo).toBe('RECEITA');
    const free = await app.inject({
      method: 'POST', url: urlA, headers: auth(tokenA),
      payload: { tipo: 'DESPESA', valor: '3.50', dataHora: '2026-09-30T12:00:00Z', descricao: 'Gasto livre', status: 'PREVISTA', ehGastoLivre: true },
    });
    expect(free.statusCode).toBe(201);
    expect(free.json().categoriaId).toBeNull();
    expect((await app.inject({ method: 'POST', url: urlA, headers: auth(tokenA), payload: { ...base, tipo: 'RECEITA', ehGastoLivre: true } })).statusCode).toBe(400);

    const list = await app.inject({ method: 'GET', url: urlA, headers: auth(tokenA) });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(2);
    expect(list.json().map((item: { id: string }) => item.id)).not.toContain(idB);
    expect((await app.inject({ method: 'GET', url: urlB, headers: auth(tokenA) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: `${urlB}/${idB}`, headers: auth(tokenA) })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: `${urlA}/${idB}`, headers: auth(tokenA) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: `${urlB}/${idB}`, headers: auth(tokenA), payload: { descricao: 'Invasão' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: `${urlA}/${idB}`, headers: auth(tokenA), payload: { descricao: 'Invasão' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `${urlA}/${idA}`, headers: auth(tokenA) })).statusCode).toBe(404);

    const filter = async (query: string) => (await app.inject({ method: 'GET', url: `${urlA}?${query}`, headers: auth(tokenA) })).json();
    for (const query of [
      `categoriaId=${categoryId}`, 'descricao=almo%C3%A7o', 'valor=15.75',
      'metodoPagamento=PIX', 'tipo=DESPESA&status=EFETIVADA',
      'dataInicial=2026-09-29T18%3A00%3A00Z&dataFinal=2026-09-29T19%3A00%3A00Z',
    ]) {
      expect((await filter(query)).map((item: { id: string }) => item.id)).toEqual([idA]);
    }
    expect(await filter('descricao=Contexto')).toEqual([]);
    expect((await app.inject({ method: 'GET', url: `${urlA}?dataInicial=2026-10-01T00%3A00%3A00Z&dataFinal=2026-09-01T00%3A00%3A00Z`, headers: auth(tokenA) })).statusCode).toBe(400);
  });

  it('revalida o estado final do PATCH e preserva a transação', async () => {
    const url = `/profiles/${profileAId}/transactions`;
    const list = (await app.inject({ method: 'GET', url, headers: auth(tokenA) })).json();
    const categorized = list.find((item: { categoriaId: string | null }) => item.categoriaId);
    const id = categorized.id as string;
    expect((await app.inject({ method: 'PATCH', url: `${url}/${id}`, headers: auth(tokenA), payload: { categoriaId: null, ehGastoLivre: true } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `${url}/${id}`, headers: auth(tokenA), payload: { tipo: 'RECEITA', ehGastoLivre: true } })).statusCode).toBe(400);
    const updated = await app.inject({
      method: 'PATCH', url: `${url}/${id}`, headers: auth(tokenA),
      payload: { categoriaId: null, subcategoriaId: null, ehGastoLivre: true, anotacao: 'Revisada' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ categoriaId: null, subcategoriaId: null, ehGastoLivre: true, anotacao: 'Revisada' });
    const detail = await app.inject({ method: 'GET', url: `${url}/${id}`, headers: auth(tokenA) });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().valor).toBe('15.75');
    expect(detail.json().dataHora).toBe('2026-09-29T18:30:00.000Z');
    expect((await prisma.transacao.findUniqueOrThrow({ where: { id } })).recorrenciaId).toBeNull();
  });
});
