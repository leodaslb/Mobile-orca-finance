import { Body, Controller, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';

// DTO e rota exclusivos do teste, sem expor endpoints de domínio na aplicação.
class ProbeDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  count!: number;
}

@Controller('validation-probe')
class ProbeController {
  @Post()
  create(@Body() body: ProbeDto): { count: number; transformed: boolean } {
    return { count: body.count, transformed: body instanceof ProbeDto };
  }
}

describe('Bootstrap NestJS + Fastify', () => {
  let app: NestFastifyApplication;
  const originalUrl = process.env.DATABASE_URL;
  const originalSecret = process.env.JWT_SECRET;
  const originalExpiry = process.env.JWT_EXPIRES_IN;

  beforeAll(async () => {
    // URL fictícia: os testes não executam queries nem abrem conexão PostgreSQL.
    process.env.DATABASE_URL = 'postgresql://bootstrap:unused@127.0.0.1:1/bootstrap';
    process.env.JWT_SECRET = 'bootstrap-test-only-secret';
    process.env.JWT_EXPIRES_IN = '3600';
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    if (originalExpiry === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = originalExpiry;
  });

  it('responde health sem depender de banco acessível', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('transforma payload em DTO e converte tipo declarado', async () => {
    const response = await app.inject({
      method: 'POST', url: '/validation-probe', payload: { count: '2' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ count: 2, transformed: true });
  });

  it.each([{ count: 2, unexpected: true }, { count: 'invalid' }, {}])(
    'rejeita payload inválido ou propriedade desconhecida: %j',
    async (payload) => {
      const response = await app.inject({
        method: 'POST', url: '/validation-probe', payload,
      });
      expect(response.statusCode).toBe(400);
    },
  );
});
