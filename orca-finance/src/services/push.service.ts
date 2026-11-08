import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ApiError, apiRequest, getApiSession, SessionChangedError } from './api-client';
const deviceKey = (user: string) => `orca.push-device.${user}`;
async function pushDeviceRequest<T>(path: string, method: 'POST' | 'DELETE', body?: unknown) {
  try { return await apiRequest<T>(path, { method, body }); }
  catch (error) {
    if (error instanceof ApiError && [502, 503].includes(error.status)) throw new ApiError(error.status, 'O serviço de notificações está indisponível. Tente novamente mais tarde.');
    throw error;
  }
}
export async function registerPush(user: string) {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') throw new ApiError(400, 'Use uma build de desenvolvimento ou distribuição para ativar push.');
  const revision = getApiSession().revision;
  const notifications = await import('expo-notifications');
  if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('default', { name: 'Orca Finance', importance: notifications.AndroidImportance.DEFAULT });
  const permission = await notifications.requestPermissionsAsync();
  if (revision !== getApiSession().revision) throw new SessionChangedError();
  if (!permission.granted) throw new ApiError(403, 'Notificações não permitidas. Revise a permissão nas configurações do aparelho.');
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new ApiError(400, 'Projeto de notificações não configurado neste aplicativo.');
  let token: string;
  try { token = (await notifications.getExpoPushTokenAsync({ projectId })).data; }
  catch {
    if (revision !== getApiSession().revision) throw new SessionChangedError();
    throw new ApiError(503, 'Não foi possível registrar as notificações. Confira a conexão e a configuração de push desta versão.');
  }
  if (revision !== getApiSession().revision) throw new SessionChangedError();
  const result = await pushDeviceRequest<{ id: string; active: boolean }>('/me/push-devices', 'POST', { token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' });
  await SecureStore.setItemAsync(deviceKey(user), result.id);
  return result;
}
export async function deactivatePush(user: string) {
  if (Platform.OS === 'web') return false;
  const revision = getApiSession().revision;
  const id = await SecureStore.getItemAsync(deviceKey(user));
  if (revision !== getApiSession().revision) throw new SessionChangedError();
  if (!id) return false;
  try { await pushDeviceRequest<void>(`/me/push-devices/${encodeURIComponent(id)}`, 'DELETE'); }
  catch (e) { if (!(e instanceof ApiError && e.status === 404)) throw e; }
  await SecureStore.deleteItemAsync(deviceKey(user));
  return true;
}
export type PushContext = { profileId: string; type: 'TRANSACTION_REMINDER' | 'WEEKLY_SUMMARY' | 'SPENDING_LIMIT'; ruleId?: string; categoriaId?: string; referenceDate?: string; periodStart?: string; periodEnd?: string };
export function parsePushContext(data: Record<string, unknown>): PushContext | null {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof data.profileId !== 'string' || !uuid.test(data.profileId) || !['TRANSACTION_REMINDER', 'WEEKLY_SUMMARY', 'SPENDING_LIMIT'].includes(String(data.type))) return null;
  const day = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  if (data.type === 'WEEKLY_SUMMARY' && (!day(data.periodStart) || !day(data.periodEnd) || data.periodStart > data.periodEnd)) return null;
  return { type: data.type as PushContext['type'], profileId: data.profileId,
    ...(typeof data.ruleId === 'string' && uuid.test(data.ruleId) ? { ruleId: data.ruleId } : {}),
    ...(typeof data.categoriaId === 'string' && uuid.test(data.categoriaId) ? { categoriaId: data.categoriaId } : {}),
    ...(day(data.referenceDate) ? { referenceDate: data.referenceDate } : {}),
    ...(data.type === 'WEEKLY_SUMMARY' ? { periodStart: String(data.periodStart), periodEnd: String(data.periodEnd) } : {}),
  };
}
