import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

const codes: Record<number, string> = {
  400: 'INVALID_INPUT', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
  409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE', 415: 'UNSUPPORTED_MEDIA_TYPE',
  500: 'INTERNAL_ERROR', 502: 'BAD_GATEWAY', 503: 'SERVICE_UNAVAILABLE',
};

// Contrato Sprint 2, seção 3.6. Preserva mensagens HTTP já usadas pelo app;
// erros de infraestrutura nunca têm mensagem/stack enviados ao cliente.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const response = exception instanceof HttpException ? exception.getResponse() : null;
    const payload = typeof response === 'object' && response !== null ? response as { message?: string | string[]; code?: string } : null;
    const original = payload?.message ?? (typeof response === 'string' ? response : 'Internal server error');
    const details = Array.isArray(original) ? original : [];
    const message = Array.isArray(original) ? 'Dados inválidos.' : original;
    host.switchToHttp().getResponse<FastifyReply>().status(statusCode).send({
      statusCode, code: statusCode === 409 && payload?.code === 'POSSIBLE_DUPLICATE_CONFIRMATION_REQUIRED'
        ? payload.code : codes[statusCode] ?? 'HTTP_ERROR', message, details,
    });
  }
}
