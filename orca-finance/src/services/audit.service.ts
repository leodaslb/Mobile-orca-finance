import { apiRequest, profilePath } from './api-client';
export interface AuditEvent { id: string; transacaoId: string | null; operacao: 'CRIACAO' | 'EDICAO' | 'EXCLUSAO'; estadoAnterior: Record<string, unknown> | null; estadoNovo: Record<string, unknown> | null; realizadoEm: string }
export function getAudits(transactionId?: string, operation?: AuditEvent['operacao']) {
  const query = new URLSearchParams();
  if (transactionId) query.set('transactionId', transactionId);
  if (operation) query.set('operation', operation);
  const search = query.toString();
  return apiRequest<AuditEvent[]>(`${profilePath('transaction-audits')}${search ? `?${search}` : ''}`);
}
