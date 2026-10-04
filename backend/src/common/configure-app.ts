import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { RECEIPT_MULTIPART_LIMITS } from '../modules/transactions/receipt-upload';

export function configureApp(app: INestApplication): void {
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  // Sem attachFieldsToBody: autenticação/ownership precedem a leitura do stream.
  void fastify.register(multipart, { limits: RECEIPT_MULTIPART_LIMITS, throwFileSizeLimit: true });
  // O app usa Bearer token, sem cookies de sessão entre origens.
  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Accept', 'Content-Type', 'Authorization'],
    credentials: false,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
}
