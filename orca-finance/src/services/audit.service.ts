import { apiRequest, profilePath } from './api-client';
export interface AuditEvent { id: string; transacaoId: string | null; operacao: 'CRIACAO' | 'EDICAO' | 'EXCLUSAO'; estadoAnterior: Record<string, unknown> | null; estadoNovo: Record<string, unknown> | null; realizadoEm: string }
export const getAudits = (transactionId?: string) => apiRequest<AuditEvent[]>(`${profilePath('transaction-audits')}${transactionId ? `?${new URLSearchParams({ transactionId })}` : ''}`);
