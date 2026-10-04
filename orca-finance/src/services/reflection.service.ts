import { apiRequest, profilePath } from '@/services/api-client';
export interface RemoteReflectionItem { id: string; descricao: string; entradaEm: string; liberaEm: string; duracaoHoras: number; liberado: boolean }
export function getRemoteReflectionItems() { return apiRequest<RemoteReflectionItem[]>(profilePath('reflection-items')); }
export function getRemoteReflectionItem(id: string) {
  return apiRequest<RemoteReflectionItem>(profilePath(`reflection-items/${encodeURIComponent(id)}`));
}
export function discardRemoteReflectionItem(id: string) {
  return apiRequest<void>(profilePath(`reflection-items/${encodeURIComponent(id)}`), { method: 'DELETE' });
}
export function createRemoteReflectionItem(description: string, durationHours = 48) {
  return apiRequest<RemoteReflectionItem>(profilePath('reflection-items'), {
    method: 'POST', body: { descricao: description.trim(), duracaoHoras: durationHours },
  });
}
